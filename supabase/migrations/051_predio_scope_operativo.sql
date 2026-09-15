-- ==============================================================================
-- SKYCROP 051: Alcance por predio en tablas operativas vía lote (Fase 3, §8)
-- Extiende la 050 (predios/lotes) a: aplicaciones, monitoreos, labores,
-- historial_actividades, cosechas, analisis_suelos y traceability_events.
-- Regla: el alcance se resuelve por lote → predio (o predio directo cuando la
--   tabla lo tiene). Roles de alcance empresa pasan siempre; el resto solo con
--   asignación en user_predios. Lotes con predio_id NULL siguen visibles a
--   nivel empresa (decisión 050, §9 del plan).
-- Seguridad del cambio:
--   - Backfill propio e idempotente (miembros activos × predios): conserva el
--     acceso actual, igual que la 050.
--   - Se DROPEAN las policies genéricas 021/040/048 sustituidas (sin el DROP,
--     el OR permisivo anularía el alcance).
--   - service_role (backend) no se ve afectado (bypass RLS).
-- NO tocadas (sin vínculo predio fiable): ventas, facturas, clientes,
--   destinos, despachos, maquinaria, jornadas_maquinaria, lotes_producto →
--   siguen en aislamiento empresa + rol (ver protocolo REAL, §8).
-- ==============================================================================

-- ── 0. Backfill propio (idempotente; no depende de que el 050 corriera) ─────
INSERT INTO public.user_predios (company_id, predio_id, clerk_user_id, alcance)
SELECT cu.company_id, p.id, cu.clerk_user_id, 'lectura_escritura'
FROM public.company_users cu
JOIN public.predios p ON p.company_id = cu.company_id
WHERE COALESCE(cu.activo, true) = true AND COALESCE(cu.status, 'active') = 'active'
ON CONFLICT DO NOTHING;

-- ── 1. Helper lote → predio ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.predio_de_lote(p_lote_id UUID)
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_predio UUID;
BEGIN
  IF p_lote_id IS NULL THEN RETURN NULL; END IF;
  SELECT predio_id INTO v_predio FROM public.lotes WHERE id = p_lote_id;
  RETURN v_predio;
END; $$;
REVOKE EXECUTE ON FUNCTION public.predio_de_lote(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.predio_de_lote(UUID) TO authenticated, service_role;

-- Alcance operativo: NULL (sin lote/predio) = visible empresa; si hay lote con
-- predio, exige acceso; lote huérfano o sin predio = visible empresa (050 §9).
CREATE OR REPLACE FUNCTION public.alcance_operativo(p_lote_id UUID, p_predio_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_predio UUID;
BEGIN
  v_predio := COALESCE(p_predio_id, public.predio_de_lote(p_lote_id));
  IF v_predio IS NULL THEN RETURN true; END IF;
  RETURN public.tiene_acceso_predio(v_predio);
EXCEPTION WHEN OTHERS THEN RETURN false;
END; $$;
REVOKE EXECUTE ON FUNCTION public.alcance_operativo(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.alcance_operativo(UUID, UUID) TO authenticated, service_role;

-- ── 2. aplicaciones + monitoreos + labores + historial (vía lote_id) ────────
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['aplicaciones', 'monitoreos', 'labores', 'historial_actividades'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select_policy ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert_policy ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_update_policy ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete_policy ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select_scoped ON public.%I FOR SELECT TO authenticated ' ||
      'USING (company_id = public.current_company() AND public.alcance_operativo(lote_id, NULL))', t, t);
    EXECUTE format(
      'CREATE POLICY %I_insert_scoped ON public.%I FOR INSERT TO authenticated ' ||
      'WITH CHECK (company_id = public.current_company() AND public.alcance_operativo(lote_id, NULL))', t, t);
    EXECUTE format(
      'CREATE POLICY %I_update_scoped ON public.%I FOR UPDATE TO authenticated ' ||
      'USING (company_id = public.current_company() AND public.alcance_operativo(lote_id, NULL)) ' ||
      'WITH CHECK (company_id = public.current_company() AND public.alcance_operativo(lote_id, NULL))', t, t);
    EXECUTE format(
      'CREATE POLICY %I_delete_scoped ON public.%I FOR DELETE TO authenticated ' ||
      'USING (company_id = public.current_company() AND public.current_role_id() = ''administrador'' AND public.alcance_operativo(lote_id, NULL))', t, t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ── 3. cosechas (predio directo, fallback lote) ─────────────────────────────
DROP POLICY IF EXISTS cosechas_select_policy ON public.cosechas;
DROP POLICY IF EXISTS cosechas_insert_policy ON public.cosechas;
DROP POLICY IF EXISTS cosechas_update_policy ON public.cosechas;
DROP POLICY IF EXISTS cosechas_delete_policy ON public.cosechas;
CREATE POLICY cosechas_select_scoped ON public.cosechas FOR SELECT TO authenticated
  USING (company_id = public.current_company() AND public.alcance_operativo(lote_id, predio_id));
CREATE POLICY cosechas_insert_scoped ON public.cosechas FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company() AND public.alcance_operativo(lote_id, predio_id));
CREATE POLICY cosechas_update_scoped ON public.cosechas FOR UPDATE TO authenticated
  USING (company_id = public.current_company() AND public.alcance_operativo(lote_id, predio_id))
  WITH CHECK (company_id = public.current_company() AND public.alcance_operativo(lote_id, predio_id));
CREATE POLICY cosechas_delete_scoped ON public.cosechas FOR DELETE TO authenticated
  USING (company_id = public.current_company() AND public.current_role_id() = 'administrador' AND public.alcance_operativo(lote_id, predio_id));
ALTER TABLE public.cosechas ENABLE ROW LEVEL SECURITY;

-- ── 4. analisis_suelos (predio directo, fallback lote; 040 sustituido) ──────
DROP POLICY IF EXISTS "analisis_select" ON public.analisis_suelos;
CREATE POLICY "analisis_select" ON public.analisis_suelos FOR SELECT TO authenticated
  USING (company_id = public.current_company() AND public.alcance_operativo(lote_id, predio_id));
DROP POLICY IF EXISTS "analisis_insert" ON public.analisis_suelos;
CREATE POLICY "analisis_insert" ON public.analisis_suelos FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company()
    AND public.alcance_operativo(lote_id, predio_id)
    AND (predio_id IS NULL OR EXISTS (SELECT 1 FROM public.predios WHERE id = predio_id AND company_id = public.current_company()))
    AND (lote_id IS NULL OR EXISTS (SELECT 1 FROM public.lotes WHERE id = lote_id AND company_id = public.current_company())));
DROP POLICY IF EXISTS "analisis_update" ON public.analisis_suelos;
CREATE POLICY "analisis_update" ON public.analisis_suelos FOR UPDATE TO authenticated
  USING (company_id = public.current_company() AND public.alcance_operativo(lote_id, predio_id))
  WITH CHECK (company_id = public.current_company() AND public.alcance_operativo(lote_id, predio_id));
-- "analisis_delete" (040, roles admin/gerente/ingeniero/tecnico) se conserva; se añade alcance:
DROP POLICY IF EXISTS "analisis_delete" ON public.analisis_suelos;
CREATE POLICY "analisis_delete" ON public.analisis_suelos FOR DELETE TO authenticated
  USING (company_id = public.current_company()
    AND public.current_role_id() IN ('administrador', 'gerente', 'ingeniero', 'tecnico')
    AND public.alcance_operativo(lote_id, predio_id));
ALTER TABLE public.analisis_suelos ENABLE ROW LEVEL SECURITY;

-- ── 5. traceability_events (vía lot_id; 048 sustituido en SELECT/INSERT) ────
-- Sin policies UPDATE/DELETE: la inmutabilidad 048 queda intacta.
DROP POLICY IF EXISTS traceability_select_policy ON public.traceability_events;
CREATE POLICY traceability_select_policy ON public.traceability_events FOR SELECT TO authenticated
  USING (company_id = public.current_company() AND public.alcance_operativo(COALESCE(lot_id, lote_id), COALESCE(farm_id, predio_id)));
DROP POLICY IF EXISTS traceability_insert_policy ON public.traceability_events;
CREATE POLICY traceability_insert_policy ON public.traceability_events FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company() AND public.alcance_operativo(COALESCE(lot_id, lote_id), COALESCE(farm_id, predio_id)));
