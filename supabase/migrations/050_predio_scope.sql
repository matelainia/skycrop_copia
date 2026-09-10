-- ==============================================================================
-- SKYCROP 050: Alcance por predio (cierra hallazgo E2E REAL-AUTH-05)
-- Problema: RLS aislaba por empresa, no por predio. Un usuario sin predio
--   asignado podía listar todos los predios/lotes vía SQL directo.
-- Solución:
--   1. Tabla user_predios (asignación usuario×predio, con tenant + FK).
--   2. Backfill: cada miembro activo queda asignado a todos los predios de su
--      empresa (conserva EXACTAMENTE el acceso actual; nadie pierde nada).
--      Restringir = quitar filas de user_predios (opt-out), nunca código.
--   3. Helper tiene_acceso_predio(): roles de alcance empresa
--      (super_admin, gerente, administrador, ingeniero, supervisor) pasan
--      siempre; el resto solo con asignación vigente.
--   4. Policies predios/lotes reescritas con alcance (SELECT/INSERT/UPDATE).
--      DELETE de lotes sigue siendo solo-administrador (021, sin cambios).
-- Extensión sugerida (comentada al final): aplicaciones/monitoreos/cosechas
--   vía lote_id → predio_id.
-- ==============================================================================

-- ── 1. Asignación usuario × predio ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_predios (
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  predio_id UUID NOT NULL REFERENCES public.predios(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  alcance TEXT NOT NULL DEFAULT 'lectura_escritura'
    CHECK (alcance IN ('lectura', 'lectura_escritura')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (company_id, predio_id, clerk_user_id)
);
CREATE INDEX IF NOT EXISTS idx_user_predios_user
  ON public.user_predios(company_id, clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_user_predios_predio
  ON public.user_predios(predio_id);

-- Guarda tenant: el predio debe pertenecer a la empresa declarada.
CREATE OR REPLACE FUNCTION public.process_user_predios_tenant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.predios p
    WHERE p.id = NEW.predio_id AND p.company_id = NEW.company_id) THEN
    RAISE EXCEPTION 'Predio % no pertenece a la empresa % (user_predios).', NEW.predio_id, NEW.company_id USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS user_predios_tenant_trg ON public.user_predios;
CREATE TRIGGER user_predios_tenant_trg BEFORE INSERT OR UPDATE ON public.user_predios
  FOR EACH ROW EXECUTE FUNCTION public.process_user_predios_tenant();

ALTER TABLE public.user_predios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_predios_select ON public.user_predios;
CREATE POLICY user_predios_select ON public.user_predios FOR SELECT TO authenticated
  USING (company_id = public.current_company());
DROP POLICY IF EXISTS user_predios_write ON public.user_predios;
CREATE POLICY user_predios_write ON public.user_predios FOR ALL TO authenticated
  USING (company_id = public.current_company() AND public.current_role_id() IN ('administrador', 'gerente'))
  WITH CHECK (company_id = public.current_company() AND public.current_role_id() IN ('administrador', 'gerente'));

-- ── 2. Backfill conservador (nadie pierde acceso actual) ───────────────────
INSERT INTO public.user_predios (company_id, predio_id, clerk_user_id, alcance)
SELECT cu.company_id, p.id, cu.clerk_user_id, 'lectura_escritura'
FROM public.company_users cu
JOIN public.predios p ON p.company_id = cu.company_id
WHERE COALESCE(cu.activo, true) = true AND COALESCE(cu.status, 'active') = 'active'
ON CONFLICT DO NOTHING;

-- ── 3. Helper de alcance ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tiene_acceso_predio(p_predio_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_company UUID; v_user TEXT; v_role TEXT;
BEGIN
  v_company := public.current_company();
  v_user := public.current_user_id();
  IF v_company IS NULL OR v_user IS NULL THEN RETURN false; END IF;
  SELECT role_id INTO v_role FROM public.company_users
  WHERE company_id = v_company AND clerk_user_id = v_user AND COALESCE(activo, true) = true LIMIT 1;
  IF v_role IN ('super_admin', 'gerente', 'administrador', 'ingeniero', 'supervisor') THEN RETURN true; END IF;
  RETURN EXISTS (SELECT 1 FROM public.user_predios up
    WHERE up.company_id = v_company AND up.predio_id = p_predio_id AND up.clerk_user_id = v_user);
EXCEPTION WHEN OTHERS THEN RETURN false;
END; $$;
REVOKE EXECUTE ON FUNCTION public.tiene_acceso_predio(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tiene_acceso_predio(UUID) TO authenticated, service_role;

-- ── 4. Policies predios/lotes con alcance ───────────────────────────────────
DROP POLICY IF EXISTS predios_select ON public.predios;
CREATE POLICY predios_select ON public.predios FOR SELECT TO authenticated
  USING (company_id = public.current_company() AND public.tiene_acceso_predio(id));
DROP POLICY IF EXISTS predios_all ON public.predios;
CREATE POLICY predios_write ON public.predios FOR ALL TO authenticated
  USING (company_id = public.current_company() AND public.tiene_acceso_predio(id))
  WITH CHECK (company_id = public.current_company() AND public.tiene_acceso_predio(id));

DROP POLICY IF EXISTS lotes_select ON public.lotes;
CREATE POLICY lotes_select ON public.lotes FOR SELECT TO authenticated
  USING (company_id = public.current_company()
    AND (deleted_at IS NULL OR public.current_role_id() = 'administrador' OR deleted_by = public.current_user_id())
    AND (predio_id IS NULL OR public.tiene_acceso_predio(predio_id)));
DROP POLICY IF EXISTS lotes_insert ON public.lotes;
CREATE POLICY lotes_insert ON public.lotes FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company()
    AND (predio_id IS NULL OR public.tiene_acceso_predio(predio_id)));
DROP POLICY IF EXISTS lotes_update ON public.lotes;
CREATE POLICY lotes_update ON public.lotes FOR UPDATE TO authenticated
  USING (company_id = public.current_company()
    AND (predio_id IS NULL OR public.tiene_acceso_predio(predio_id)))
  WITH CHECK (company_id = public.current_company()
    AND (predio_id IS NULL OR public.tiene_acceso_predio(predio_id)));
-- lotes_delete (solo administrador, 021) se conserva sin cambios.

-- ── 5. Extensión sugerida (operativas vía lote → predio) ───────────────────
-- Aplicar el mismo patrón cuando el negocio lo exija, p. ej.:
--   USING (company_id = public.current_company()
--     AND (lote_id IS NULL OR public.tiene_acceso_predio(
--       (SELECT predio_id FROM public.lotes WHERE id = lote_id))))
-- en aplicaciones / monitoreos / cosechas. No se incluye aquí para no cambiar
-- el comportamiento de módulos en producción sin una ventana de validación.
