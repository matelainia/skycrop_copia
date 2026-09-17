-- ==============================================================================
-- SKYCROP 057: bootstrap refresca logo (sincronía Clerk → companies)
-- Causa: ON CONFLICT solo actualizaba nombre; el logo quedaba congelado al
-- primer login y las re-subidas en Clerk nunca llegaban a la app.
-- Idempotente. Aplicar en Dashboard SQL Editor.
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
  INSERT INTO public.profiles (id, email, nombre, apellido, updated_at)
  VALUES (p_user_id, p_email, p_nombre, p_apellido, now())
  ON CONFLICT (id) DO UPDATE SET
    email     = EXCLUDED.email,
    nombre    = COALESCE(NULLIF(EXCLUDED.nombre, ''),   public.profiles.nombre),
    apellido  = COALESCE(NULLIF(EXCLUDED.apellido, ''), public.profiles.apellido),
    updated_at = now();

  INSERT INTO public.companies (clerk_org_id, nombre, slug, logo, estado, updated_at)
  VALUES (p_clerk_org_id, p_org_nombre, p_org_slug, p_org_logo, 'active', now())
  ON CONFLICT (clerk_org_id) DO UPDATE SET
    nombre     = EXCLUDED.nombre,
    logo       = COALESCE(NULLIF(EXCLUDED.logo, ''), public.companies.logo),
    updated_at = now()
  RETURNING id INTO v_company_id;

  IF v_company_id IS NULL THEN
    SELECT id INTO v_company_id
    FROM public.companies
    WHERE clerk_org_id = p_clerk_org_id;
  END IF;

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
    ON CONFLICT (company_id, codigo_interno) DO NOTHING;
  END IF;

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

-- NOTIFY pgrst, 'reload schema';
