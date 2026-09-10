-- ==============================================================================
-- SKYCROP DATABASE V2: 038_remove_mock_data.sql
-- Propósito: eliminar datos demo/ficticios y los mecanismos que los regeneran.
--
-- ⚠️ ANTES DE EJECUTAR EN PRODUCCIÓN:
--   1. Hacer backup completo (Dashboard → Database → Backups, o pg_dump).
--   2. Ejecutar primero en un proyecto staging clonado.
--   3. Revisar las queries de identificación (sección 5) y confirmar que
--      NINGÚN registro real coincide con los criterios de borrado.
--
-- Contenido:
--   1. bootstrap_user_org SIN lote demo ('Las Margaritas').
--   2. current_company()/current_user_id() sin fallback a la empresa semilla.
--   3. Borrado controlado de filas semilla (empresa 00000000-…-000).
--   4. (OPCIONAL, comentado) endurecimiento del trigger auto_predio.
--   5. Queries de verificación post-limpieza.
--
-- Rollback: restaurar desde backup. Los DELETE son irreversibles.
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. BOOTSTRAP SIN LOTE DEMO
-- Idéntica a la versión endurecida de 037, pero SIN el PASO 3 que insertaba
-- el lote 'Las Margaritas' (Café, 15.5 ha) en toda empresa nueva o sin lotes.
-- Un usuario nuevo ahora empieza con 0 lotes (política de datos SkyCrop).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bootstrap_user_org(
  p_user_id      TEXT,
  p_email        TEXT,
  p_nombre       TEXT,
  p_apellido     TEXT,
  p_clerk_org_id TEXT,
  p_org_nombre   TEXT,
  p_org_slug     TEXT,
  p_org_logo     TEXT,
  p_role_id      TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id UUID;
  v_claims     TEXT;
BEGIN
  -- GUARD anti-suplantación (heredado de 037)
  v_claims := NULLIF(current_setting('request.jwt.claims', true), '');
  IF v_claims IS NOT NULL THEN
    IF (v_claims::jsonb)->>'role' IS DISTINCT FROM 'service_role'
       AND (v_claims::jsonb)->>'sub' IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'ACCESO_DENEGADO: no se puede aprovisionar otro usuario (sub=%)',
        (v_claims::jsonb)->>'sub'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- PASO 1: Upsert perfil de usuario
  INSERT INTO public.profiles (id, email, nombre, apellido, updated_at)
  VALUES (p_user_id, p_email, p_nombre, p_apellido, now())
  ON CONFLICT (id) DO UPDATE SET
    email     = EXCLUDED.email,
    nombre    = COALESCE(NULLIF(EXCLUDED.nombre, ''),   public.profiles.nombre),
    apellido  = COALESCE(NULLIF(EXCLUDED.apellido, ''), public.profiles.apellido),
    updated_at = now();

  -- PASO 2: Upsert empresa
  INSERT INTO public.companies (clerk_org_id, nombre, slug, logo, estado, updated_at)
  VALUES (p_clerk_org_id, p_org_nombre, p_org_slug, p_org_logo, 'active', now())
  ON CONFLICT (clerk_org_id) DO UPDATE SET
    nombre     = EXCLUDED.nombre,
    updated_at = now()
  RETURNING id INTO v_company_id;

  IF v_company_id IS NULL THEN
    SELECT id INTO v_company_id
    FROM public.companies
    WHERE clerk_org_id = p_clerk_org_id;
  END IF;

  -- PASO 3 ELIMINADO (038): ya NO se crea lote 'Las Margaritas' automático.
  -- Los lotes los crea el usuario desde la UI.

  -- PASO 4: Upsert membresía de usuario
  INSERT INTO public.company_users (
    company_id, clerk_user_id, role_id, activo, status, updated_at
  )
  VALUES (v_company_id, p_user_id, p_role_id, true, 'active', now())
  ON CONFLICT (company_id, clerk_user_id) DO UPDATE SET
    updated_at = now();

  RETURN json_build_object(
    'company_id', v_company_id,
    'user_id',    p_user_id,
    'role_id',    p_role_id
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'bootstrap_user_org falló [user: %, org: %]: % %',
    p_user_id, p_clerk_org_id, SQLERRM, SQLSTATE;
END;
$$;

COMMENT ON FUNCTION public.bootstrap_user_org IS
  'Aprovisionamiento atómico perfil+empresa+membresía. 038: elimina creación automática de lote demo.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CONTEXTO RLS SIN EMPRESA SEMILLA
-- Antes: JWT sin org_id caía a la empresa demo (fuga cross-tenant a datos demo).
-- Ahora: devuelve NULL ⇒ las políticas (company_id = current_company()) no
-- retornan filas. El tráfico legítimo siempre trae org_id (backend/proxy lo
-- firma tras verificar Clerk), así que ningún flujo real se rompe.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_company() RETURNS UUID AS $$
DECLARE
  v_org_id TEXT;
BEGIN
  v_org_id := auth.jwt() ->> 'org_id';
  IF v_org_id IS NULL THEN
    RETURN NULL; -- 038: sin fallback a empresa demo
  END IF;
  RETURN v_org_id::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL; -- 038: org inválida ⇒ sin acceso, jamás empresa semilla
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS TEXT AS $$
BEGIN
  RETURN auth.jwt() ->> 'sub';
EXCEPTION WHEN OTHERS THEN
  RETURN NULL; -- 038: sin sub ⇒ NULL (antes devolvía 'sistema_api')
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. LIMPIEZA CONTROLADA DE FILAS SEMILLA (024_seed.sql)
-- Criterios explícitos y acotados: SOLO la empresa UUID-cero, sus hijos y los
-- perfiles *_test_* creados por seeds. No toca datos de empresas reales.
-- Orden respetando foreign keys: hijos → padres.
-- ─────────────────────────────────────────────────────────────────────────────
DO $cleanup$
DECLARE
  v_seed UUID := '00000000-0000-0000-0000-000000000000';
  v_n INTEGER;
BEGIN
  -- 3.1 Polígono geo-test de 028 (no pertenece a ninguna empresa)
  DELETE FROM public.division_politica
  WHERE departamento = 'Valle del Cauca' AND municipio = 'Zarzal' AND nombre = 'La Paila';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '[038] division_politica: % fila(s) de prueba eliminadas', v_n;

  -- 3.2 Lotes de la empresa semilla
  DELETE FROM public.lotes WHERE company_id = v_seed;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '[038] lotes (semilla): % eliminados', v_n;

  -- 3.3 Predios de la empresa semilla
  DELETE FROM public.predios WHERE company_id = v_seed;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '[038] predios (semilla): % eliminados', v_n;

  -- 3.4 Membresías: empresa semilla o perfiles de prueba
  DELETE FROM public.company_users
  WHERE company_id = v_seed OR clerk_user_id LIKE 'user\_clerk\_test%' OR clerk_user_id LIKE 'admin\_test%';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '[038] company_users (semilla/test): % eliminadas', v_n;

  -- 3.5 Perfiles de prueba
  DELETE FROM public.profiles
  WHERE id LIKE 'user\_clerk\_test%' OR id LIKE 'admin\_test%';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '[038] profiles de prueba: % eliminados', v_n;

  -- 3.6 Empresa semilla (al final; es padre de todo lo anterior)
  DELETE FROM public.companies WHERE id = v_seed;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '[038] companies semilla: % eliminada(s)', v_n;
END
$cleanup$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. OPCIONAL — Endurecer trigger auto_predio (022:71-98).
-- HOY el frontend no envía predio_id al crear lotes: descomentar ROMPERÍA esa
-- vía hasta añadir selector de predio en la UI. Dejar comentado hasta entonces.
-- ─────────────────────────────────────────────────────────────────────────────
-- CREATE OR REPLACE FUNCTION public.process_auto_predio() RETURNS TRIGGER AS $fn$
-- BEGIN
--   IF NEW.predio_id IS NULL THEN
--     RAISE EXCEPTION 'predio_id es requerido: seleccione o cree un predio antes de crear el lote';
--   END IF;
--   RETURN NEW;
-- END;
-- $fn$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. VERIFICACIÓN POST-LIMPIEZA (ejecutar manualmente; resultados esperados: 0)
-- ================================================================================
-- SELECT COUNT(*) FROM companies  WHERE id = '00000000-0000-0000-0000-000000000000';
-- SELECT COUNT(*) FROM lotes      WHERE company_id = '00000000-0000-0000-0000-000000000000';
-- SELECT COUNT(*) FROM predios    WHERE company_id = '00000000-0000-0000-0000-000000000000';
-- SELECT COUNT(*) FROM profiles   WHERE id LIKE 'user\_clerk\_test%' OR id LIKE 'admin\_test%';
-- SELECT COUNT(*) FROM division_politica WHERE nombre = 'La Paila' AND municipio = 'Zarzal';
--
-- Prueba de usuario nuevo (FASE 15): loguearse con una organización nueva y
-- confirmar: 0 lotes, 0 predios, 0 trabajadores, dashboard en ceros.
-- ================================================================================
