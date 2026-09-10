-- ==============================================================================
-- SKYCROP DATABASE V2: 025_bootstrap.sql
-- Descripción: Función atómica de aprovisionamiento de usuario/organización
-- Ejecuta el bootstrap completo en una sola transacción PostgreSQL:
--   1. Upsert perfil de usuario en profiles
--   2. Upsert empresa en companies
--   3. Crear lote por defecto si la empresa no tiene ninguno (idempotente)
--   4. Upsert membresía de usuario en company_users
-- Retorna JSON con company_id, user_id y role_id.
-- ==============================================================================

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
  v_lote_count  INTEGER;
BEGIN
  -- ── PASO 1: Upsert perfil de usuario ──────────────────────────────────────
  -- Escribimos directamente en la tabla profiles (nunca en la vista usuarios).
  -- PRIMARY KEY (id) permite ON CONFLICT.
  INSERT INTO public.profiles (id, email, nombre, apellido, updated_at)
  VALUES (p_user_id, p_email, p_nombre, p_apellido, now())
  ON CONFLICT (id) DO UPDATE SET
    email     = EXCLUDED.email,
    nombre    = COALESCE(NULLIF(EXCLUDED.nombre, ''),   public.profiles.nombre),
    apellido  = COALESCE(NULLIF(EXCLUDED.apellido, ''), public.profiles.apellido),
    updated_at = now();

  -- ── PASO 2: Upsert empresa ────────────────────────────────────────────────
  -- UNIQUE (clerk_org_id) en companies permite ON CONFLICT.
  INSERT INTO public.companies (clerk_org_id, nombre, slug, logo, estado, updated_at)
  VALUES (p_clerk_org_id, p_org_nombre, p_org_slug, p_org_logo, 'active', now())
  ON CONFLICT (clerk_org_id) DO UPDATE SET
    nombre     = EXCLUDED.nombre,
    updated_at = now()
  RETURNING id INTO v_company_id;

  -- Si la empresa ya existía, ON CONFLICT DO UPDATE no devuelve RETURNING en
  -- todas las versiones de PG. Lo obtenemos explícitamente.
  IF v_company_id IS NULL THEN
    SELECT id INTO v_company_id
    FROM public.companies
    WHERE clerk_org_id = p_clerk_org_id;
  END IF;

  -- ── PASO 3: Lote por defecto (solo si la empresa no tiene ninguno) ─────────
  -- Idempotente: si ya existe cualquier lote para la empresa, no hace nada.
  SELECT COUNT(*) INTO v_lote_count
  FROM public.lotes
  WHERE company_id = v_company_id;

  IF v_lote_count = 0 THEN
    INSERT INTO public.lotes (
      company_id, codigo_interno, nombre, cultivo,
      centroide_lat, centroide_lng, area_ha
    )
    VALUES (
      v_company_id, 'LM', 'Las Margaritas', 'Café',
      4.1234, -73.6543, 15.5
    )
    -- Doble seguridad: si por alguna condición de carrera ya existe, no falla.
    ON CONFLICT (company_id, codigo_interno) DO NOTHING;
  END IF;

  -- ── PASO 4: Upsert membresía de usuario ───────────────────────────────────
  -- UNIQUE (company_id, clerk_user_id) en company_users permite ON CONFLICT.
  -- Solo actualizamos updated_at para preservar el rol si ya fue cambiado manualmente.
  INSERT INTO public.company_users (
    company_id, clerk_user_id, role_id, activo, status, updated_at
  )
  VALUES (v_company_id, p_user_id, p_role_id, true, 'active', now())
  ON CONFLICT (company_id, clerk_user_id) DO UPDATE SET
    updated_at = now();
  -- Nota: no sobreescribimos role_id para respetar cambios de rol manuales.

  -- ── RETORNO ───────────────────────────────────────────────────────────────
  RETURN json_build_object(
    'company_id', v_company_id,
    'user_id',    p_user_id,
    'role_id',    p_role_id
  );

EXCEPTION WHEN OTHERS THEN
  -- Propagar el error con contexto adicional para diagnóstico
  RAISE EXCEPTION 'bootstrap_user_org falló [user: %, org: %]: % %',
    p_user_id, p_clerk_org_id, SQLERRM, SQLSTATE;
END;
$$;

-- Comentario descriptivo para el catálogo
COMMENT ON FUNCTION public.bootstrap_user_org IS
  'Aprovisiona de forma atómica e idempotente el perfil, empresa, '
  'lote por defecto y membresía de un usuario al hacer login por primera vez. '
  'Todos los pasos ocurren en una sola transacción.';
