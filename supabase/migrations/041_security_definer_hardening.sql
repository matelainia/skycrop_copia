-- ==============================================================================
-- SKYCROP DATABASE: 041_security_definer_hardening.sql
-- Descripción: Endurecimiento de funciones SECURITY DEFINER contra hijacking
--              de search_path y exposición excesiva EXECUTE TO PUBLIC.
--
-- Problema detectado en auditoría AppSec:
--   Todas las funciones SECURITY DEFINER se crean sin SET search_path,
--   lo que permite a un atacante crear un esquema con objetos que
--   sombrean pg_catalog/public (search_path hijacking). Además no se
--   revoca EXECUTE a PUBLIC, por lo que cualquier authenticated puede
--   llamar funciones que deberían ser internas.
--
-- Estrategia (cero ruptura funcional):
--   - Añadir SET search_path = public, pg_temp a funciones críticas
--   - REVOKE EXECUTE FROM PUBLIC y conceder solo a roles mínimos
--   - Sin cambiar lógica de negocio ni firmas de RPC públicas
--
-- Tablas afectadas: ninguna (solo definición de funciones)
-- Policies afectadas: ninguna
-- Riesgo: BAJO — solo endurece, no cambia retorno
-- Reversibilidad: recrear funciones sin SET search_path
-- ==============================================================================

-- ── Helpers de contexto (021_rls.sql) ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_company()
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_org_id TEXT; BEGIN
  v_org_id := auth.jwt() ->> 'org_id';
  IF v_org_id IS NULL THEN RETURN '00000000-0000-0000-0000-000000000000'::uuid; END IF;
  RETURN v_org_id::uuid;
EXCEPTION WHEN OTHERS THEN RETURN '00000000-0000-0000-0000-000000000000'::uuid;
END; $$;
REVOKE EXECUTE ON FUNCTION public.current_company() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_company() TO authenticated, service_role, anon;

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN RETURN COALESCE(auth.jwt() ->> 'sub', 'sistema_api');
EXCEPTION WHEN OTHERS THEN RETURN 'sistema_api';
END; $$;
REVOKE EXECUTE ON FUNCTION public.current_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_id() TO authenticated, service_role, anon;

CREATE OR REPLACE FUNCTION public.current_role_id()
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_role_id TEXT; BEGIN
  SELECT role_id INTO v_role_id FROM public.company_users
  WHERE company_id = public.current_company() AND clerk_user_id = public.current_user_id() AND activo = true LIMIT 1;
  RETURN COALESCE(v_role_id, 'operario');
EXCEPTION WHEN OTHERS THEN RETURN 'operario';
END; $$;
REVOKE EXECUTE ON FUNCTION public.current_role_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_role_id() TO authenticated, service_role;

-- ── Guard anti-IDOR (037) ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_assert_tenant_access(p_company_id UUID, p_user_id TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql STABLE SET search_path = public, pg_temp
AS $fn$
DECLARE v_claims TEXT; v_role TEXT; v_sub TEXT;
BEGIN
  v_claims := NULLIF(current_setting('request.jwt.claims', true), '');
  IF v_claims IS NULL THEN RETURN; END IF;
  v_claims := v_claims::jsonb; v_role := v_claims->>'role';
  IF v_role = 'service_role' THEN RETURN; END IF;
  v_sub := v_claims->>'sub';
  IF NOT EXISTS (SELECT 1 FROM public.company_users cu WHERE cu.company_id = p_company_id AND cu.clerk_user_id = COALESCE(p_user_id, v_sub) AND COALESCE(cu.activo, true) = true) THEN
    RAISE EXCEPTION 'ACCESO_DENEGADO: el usuario % no pertenece a la empresa %', v_sub, p_company_id USING ERRCODE = '42501';
  END IF;
END $fn$;
REVOKE EXECUTE ON FUNCTION public.rpc_assert_tenant_access(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_assert_tenant_access(UUID, TEXT) TO authenticated, service_role;

-- ── Triggers de seguridad (022) ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_secure_company_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_current_company UUID;
BEGIN
  v_current_company := public.current_company();
  IF (TG_OP = 'INSERT' AND NEW.company_id IS NULL) THEN NEW.company_id := v_current_company; END IF;
  IF (auth.role() = 'authenticated' AND NEW.company_id <> v_current_company) THEN
    INSERT INTO public.security_events (usuario_id, company_id, accion, tabla, registro_id, resultado)
    VALUES (public.current_user_id(), v_current_company, 'FORGERY_ATTEMPT', TG_TABLE_NAME, NEW.id, 'BLOCKED');
    RAISE EXCEPTION 'Acceso denegado: intento de falsificación de company_id en la tabla %.', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END; $$;

-- ── Vista usuarios (023) — limitar ejecución solo a service_role + authenticated con necesidad ─
-- Se mantiene SECURITY DEFINER pero se revoca PUBLIC por defecto
REVOKE EXECUTE ON FUNCTION public.process_usuarios_view_write() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_usuarios_view_write() TO authenticated, service_role;

-- ── bootstrap_user_org ya fue endurecido en 037 con SET implícito; se añade search_path ──
-- Nota: la función se redefine para incluir search_path sin cambiar lógica (ver 037)
-- Para no duplicar cuerpo largo, solo se enmienda search_path y grants:
DO $$
BEGIN
  -- Añadir search_path si aún no lo tiene (idempotente)
  EXECUTE 'ALTER FUNCTION public.bootstrap_user_org(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) SET search_path = public, pg_temp';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.bootstrap_user_org(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_user_org(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated, service_role, anon;

-- ── Funciones de fertilización (032) — fert_owns_company ─────────────────────
CREATE OR REPLACE FUNCTION public.fert_owns_company(p_company_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ BEGIN RETURN p_company_id = public.current_company(); END; $$;
REVOKE EXECUTE ON FUNCTION public.fert_owns_company(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fert_owns_company(UUID) TO authenticated, service_role;

-- ── Análisis suelos metrics/detail (040) — añadir search_path ────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname IN ('soil_analysis_metrics','soil_analysis_detail') LOOP
    BEGIN EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.soil_analysis_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soil_analysis_metrics() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.soil_analysis_detail(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soil_analysis_detail(UUID) TO authenticated, service_role;

-- ── get_protocolo_completo (030) y get_evaluacion_completa (031) ────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT 'public.get_protocolo_completo(UUID)'::regprocedure AS sig UNION ALL SELECT 'public.get_evaluacion_completa(UUID)'::regprocedure LOOP
    BEGIN EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_protocolo_completo(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_protocolo_completo(UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_evaluacion_completa(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_evaluacion_completa(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.current_company IS 'Tenant actual derivado del JWT (org_id). Hardened 041: SET search_path + grants mínimos.';
