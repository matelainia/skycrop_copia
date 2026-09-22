-- ==============================================================================
-- SKYCROP DATABASE V2: 068_rpc_assert_fix.sql
-- Fix: rpc_assert_tenant_access (037/041) fallaba SIEMPRE vía PostgREST.
-- Causa: `v_claims := v_claims::jsonb` sobre variable TEXT reconvierte a
-- texto, y `text ->> 'role'` no existe → 42883 "operator does not exist"
-- en CUALQUIER llamada con JWT (anon/authenticated/service_role incluidos).
-- Solo funcionaba sin JWT (SQL editor / llamadas internas), por eso pasó
-- desapercibido: toda RPC guardada vía API estaba rota.
-- Fix: variable JSONB separada; misma firma, mismos grants, mismo hardening.
-- No se editan 037/041 (historia aplicada).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_assert_tenant_access(
  p_company_id UUID,
  p_user_id    TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
STABLE SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_claims TEXT;
  v_json   JSONB;
  v_role   TEXT;
  v_sub    TEXT;
BEGIN
  v_claims := NULLIF(current_setting('request.jwt.claims', true), '');

  -- Sin claims → llamada interna del backend (sin JWT): permitir (compatibilidad)
  IF v_claims IS NULL THEN
    RETURN;
  END IF;

  -- Claims ilegibles → anomalía de auth: bloquear explícito (fail-closed)
  BEGIN
    v_json := v_claims::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'ACCESO_DENEGADO: claims de sesión ilegibles'
      USING ERRCODE = '42501';
  END;

  v_role := v_json->>'role';

  -- El rol de servicio es de confianza total (bypass intencional)
  IF v_role = 'service_role' THEN
    RETURN;
  END IF;

  v_sub := v_json->>'sub';

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = p_company_id
      AND cu.clerk_user_id = COALESCE(p_user_id, v_sub)
      AND COALESCE(cu.activo, true) = true
  ) THEN
    RAISE EXCEPTION 'ACCESO_DENEGADO: el usuario % no pertenece a la empresa %',
      v_sub, p_company_id
      USING ERRCODE = '42501';
  END IF;
END
$fn$;

REVOKE ALL ON FUNCTION public.rpc_assert_tenant_access(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_assert_tenant_access(UUID, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.rpc_assert_tenant_access IS
  'Guard anti-IDOR (037/041, corregido en 068: variable JSONB separada; la versión anterior fallaba con operator text->>unknown en toda llamada con JWT).';

-- ==============================================================================
-- ROLLBACK DOCUMENTADO (dev/staging; NUNCA prod sin backup + aprobación):
-- Re-aplicar 041_security_definer_hardening.sql §guard (restaura el bug;
-- solo tiene sentido como reversión temporal en investigación).
-- ==============================================================================
