-- ==============================================================================
-- SKYCROP 043: Seguridad multi-tenant C1 + C2 + C3 + H1 (sin trazabilidad aun)
-- C1: RLS fertilizacion_recomendaciones + detalle (antes sin RLS, company NULLABLE,
--     code UNIQUE global). Ver 035.
-- C2: evaluation_snapshots/* + evaluation_events SELECT USING(true) -> chequeo
--     tenant via monitoreos. Ver 031:234-240.
-- C3: current_company()/current_user_id() vuelven a NULL (038), con search_path
--     de 041 conservado; se revoca anon. 041:31-42 reintroducia fallback semilla.
-- H1: validacion universal company->predio->lote + trigger secure_company_id en
--     tablas nuevas (032/035/040/042). Frontend no es frontera (ver informe).
-- Estrategia: solo endurece, no borra datos; filas viejas con company NULL quedan
-- ocultas (fail-closed). No crea traceability_events.
-- ==============================================================================

-- ── C3: contexto sin empresa semilla (038 restaurado, 041 revertido parcial) ──
CREATE OR REPLACE FUNCTION public.current_company()
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_org_id TEXT; BEGIN
  v_org_id := auth.jwt() ->> 'org_id';
  IF v_org_id IS NULL THEN RETURN NULL; END IF;
  RETURN v_org_id::uuid;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END; $$;
REVOKE EXECUTE ON FUNCTION public.current_company() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_company() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN RETURN auth.jwt() ->> 'sub';
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END; $$;
REVOKE EXECUTE ON FUNCTION public.current_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_id() TO authenticated, service_role;

-- ── C1: RLS recomendaciones ──────────────────────────────────────────────────
-- Resiliente: si 035 no esta aplicada en esta base, se omite (staging_checks 043.C
-- lo reportara como FAIL para completar la base antes de la compuerta).
DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fertilizacion_recomendaciones') THEN
    ALTER TABLE public.fertilizacion_recomendaciones ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS fert_rec_select ON public.fertilizacion_recomendaciones;
    DROP POLICY IF EXISTS fert_rec_insert ON public.fertilizacion_recomendaciones;
    DROP POLICY IF EXISTS fert_rec_update ON public.fertilizacion_recomendaciones;
    DROP POLICY IF EXISTS fert_rec_delete ON public.fertilizacion_recomendaciones;
    CREATE POLICY fert_rec_select ON public.fertilizacion_recomendaciones
      FOR SELECT TO authenticated USING (company_id = public.current_company());
    CREATE POLICY fert_rec_insert ON public.fertilizacion_recomendaciones
      FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company());
    CREATE POLICY fert_rec_update ON public.fertilizacion_recomendaciones
      FOR UPDATE TO authenticated USING (company_id = public.current_company())
      WITH CHECK (company_id = public.current_company());
    CREATE POLICY fert_rec_delete ON public.fertilizacion_recomendaciones
      FOR DELETE TO authenticated USING (
        company_id = public.current_company()
        AND public.current_role_id() IN ('administrador', 'gerente'));
    -- code UNIQUE global -> UNIQUE(company_id, code); filas NULL/company quedan fuera
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fertilizacion_recomendaciones_code_key') THEN
      ALTER TABLE public.fertilizacion_recomendaciones DROP CONSTRAINT fertilizacion_recomendaciones_code_key;
    END IF;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_fert_rec_company_code
      ON public.fertilizacion_recomendaciones(company_id, code) WHERE company_id IS NOT NULL;
  ELSE
    RAISE NOTICE '[043 C1] omitido: falta tabla fertilizacion_recomendaciones (035 no aplicada)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fertilizacion_recomendacion_detalle') THEN
    ALTER TABLE public.fertilizacion_recomendacion_detalle ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS fert_rec_det_select ON public.fertilizacion_recomendacion_detalle;
    DROP POLICY IF EXISTS fert_rec_det_insert ON public.fertilizacion_recomendacion_detalle;
    DROP POLICY IF EXISTS fert_rec_det_update ON public.fertilizacion_recomendacion_detalle;
    DROP POLICY IF EXISTS fert_rec_det_delete ON public.fertilizacion_recomendacion_detalle;
    CREATE POLICY fert_rec_det_select ON public.fertilizacion_recomendacion_detalle
      FOR SELECT TO authenticated USING (EXISTS (
        SELECT 1 FROM public.fertilizacion_recomendaciones r
        WHERE r.id = recomendacion_id AND r.company_id = public.current_company()));
    CREATE POLICY fert_rec_det_insert ON public.fertilizacion_recomendacion_detalle
      FOR INSERT TO authenticated WITH CHECK (EXISTS (
        SELECT 1 FROM public.fertilizacion_recomendaciones r
        WHERE r.id = recomendacion_id AND r.company_id = public.current_company()));
    CREATE POLICY fert_rec_det_update ON public.fertilizacion_recomendacion_detalle
      FOR UPDATE TO authenticated USING (EXISTS (
        SELECT 1 FROM public.fertilizacion_recomendaciones r
        WHERE r.id = recomendacion_id AND r.company_id = public.current_company()))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.fertilizacion_recomendaciones r
        WHERE r.id = recomendacion_id AND r.company_id = public.current_company()));
    CREATE POLICY fert_rec_det_delete ON public.fertilizacion_recomendacion_detalle
      FOR DELETE TO authenticated USING (
        EXISTS (SELECT 1 FROM public.fertilizacion_recomendaciones r
          WHERE r.id = recomendacion_id AND r.company_id = public.current_company())
        AND public.current_role_id() IN ('administrador', 'gerente'));
  ELSE
    RAISE NOTICE '[043 C1] omitido: falta tabla fertilizacion_recomendacion_detalle (035 no aplicada)';
  END IF;
END $do$;

-- ── C2: snapshots/events con tenant (sin anadir columnas) ────────────────────
-- Resiliente: si 031 no esta aplicada, se omite (staging_checks 043.D lo reporta).
DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evaluation_snapshots') THEN
    DROP POLICY IF EXISTS "eval_snapshots_select" ON public.evaluation_snapshots;
    CREATE POLICY "eval_snapshots_select" ON public.evaluation_snapshots FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.monitoreos m WHERE m.id = evaluation_id AND m.company_id = public.current_company()));
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evaluation_snapshot_variables') THEN
    DROP POLICY IF EXISTS "eval_snap_vars_select" ON public.evaluation_snapshot_variables;
    CREATE POLICY "eval_snap_vars_select" ON public.evaluation_snapshot_variables FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.evaluation_snapshots s JOIN public.monitoreos m ON m.id = s.evaluation_id
      WHERE s.id = snapshot_id AND m.company_id = public.current_company()));
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evaluation_snapshot_rules') THEN
    DROP POLICY IF EXISTS "eval_snap_rules_select" ON public.evaluation_snapshot_rules;
    CREATE POLICY "eval_snap_rules_select" ON public.evaluation_snapshot_rules FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.evaluation_snapshots s JOIN public.monitoreos m ON m.id = s.evaluation_id
      WHERE s.id = snapshot_id AND m.company_id = public.current_company()));
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evaluation_snapshot_thresholds') THEN
    DROP POLICY IF EXISTS "eval_snap_thresh_select" ON public.evaluation_snapshot_thresholds;
    CREATE POLICY "eval_snap_thresh_select" ON public.evaluation_snapshot_thresholds FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.evaluation_snapshots s JOIN public.monitoreos m ON m.id = s.evaluation_id
      WHERE s.id = snapshot_id AND m.company_id = public.current_company()));
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evaluation_snapshot_alerts') THEN
    DROP POLICY IF EXISTS "eval_snap_alerts_select" ON public.evaluation_snapshot_alerts;
    CREATE POLICY "eval_snap_alerts_select" ON public.evaluation_snapshot_alerts FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.evaluation_snapshots s JOIN public.monitoreos m ON m.id = s.evaluation_id
      WHERE s.id = snapshot_id AND m.company_id = public.current_company()));
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evaluation_snapshot_recommendations') THEN
    DROP POLICY IF EXISTS "eval_snap_recs_select" ON public.evaluation_snapshot_recommendations;
    CREATE POLICY "eval_snap_recs_select" ON public.evaluation_snapshot_recommendations FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.evaluation_snapshots s JOIN public.monitoreos m ON m.id = s.evaluation_id
      WHERE s.id = snapshot_id AND m.company_id = public.current_company()));
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evaluation_events') THEN
    DROP POLICY IF EXISTS "eval_events_select" ON public.evaluation_events;
    CREATE POLICY "eval_events_select" ON public.evaluation_events FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.monitoreos m WHERE m.id = evaluation_id AND m.company_id = public.current_company()));
  ELSE
    RAISE NOTICE '[043 C2] omitido: faltan tablas evaluation_* (031 no aplicada)';
  END IF;
END $do$;
-- Escritura service_role se conserva (031:251-257), no se toca.

-- ── H1a: extender secure_company_id a tablas nuevas ──────────────────────────
DO $$
DECLARE t_name TEXT;
  tables TEXT[] := ARRAY[
    'fertilization_plans', 'fertilization_plan_items', 'fertilization_applications',
    'fertilization_observations', 'fertilization_observation_comments',
    'fertilization_observation_attachments', 'fertilization_observation_nutrients',
    'fertilization_alerts', 'fertilization_field_conditions',
    'fertilizacion_recomendaciones',
    'analisis_suelos', 'resultados_analisis_suelo', 'laboratorios',
    'lotes_producto', 'procesos_postcosecha', 'clientes', 'destinos',
    'ventas', 'venta_detalles', 'despachos', 'facturas', 'factura_detalles'
  ];
BEGIN
  FOREACH t_name IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t_name) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS secure_company_id_trg ON public.%I', t_name);
      -- detalle sin company_id se salta (usa RLS via padre)
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t_name AND column_name='company_id') THEN
        EXECUTE format('CREATE TRIGGER secure_company_id_trg BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.process_secure_company_id()', t_name);
      END IF;
    END IF;
  END LOOP;
END $$;

-- ── H1b: validacion cruzada lote/predio pertenecen a la misma empresa ────────
-- NOTA: una misma funcion trigger sirve a tablas con columnas distintas; por eso
-- NUNCA se referencia NEW.campo directo (error en tablas sin esa columna) sino
-- via to_jsonb(NEW) ->> 'campo'. AND cortocircuita, pero la validacion de campos
-- de PL/pgSQL ocurre al ejecutar la rama: con jsonb no hay campo que validar.
CREATE OR REPLACE FUNCTION public.process_validate_lote_predio_tenant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_company UUID; v_row JSONB; v_lote UUID; v_predio UUID; v_lote_agri UUID;
BEGIN
  v_row := to_jsonb(NEW);
  BEGIN v_company := COALESCE((v_row ->> 'company_id')::UUID, public.current_company());
  EXCEPTION WHEN OTHERS THEN v_company := public.current_company(); END;
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    BEGIN v_lote := NULLIF(v_row ->> 'lote_id', '')::UUID; EXCEPTION WHEN OTHERS THEN v_lote := NULL; END;
    BEGIN v_predio := NULLIF(v_row ->> 'predio_id', '')::UUID; EXCEPTION WHEN OTHERS THEN v_predio := NULL; END;
    BEGIN v_lote_agri := NULLIF(v_row ->> 'lote_agricola_id', '')::UUID; EXCEPTION WHEN OTHERS THEN v_lote_agri := NULL; END;
    IF v_lote IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.lotes l WHERE l.id = v_lote AND l.company_id IS NOT DISTINCT FROM v_company) THEN
      RAISE EXCEPTION 'Lote % no pertenece a la empresa % (tabla %).', v_lote, v_company, TG_TABLE_NAME USING ERRCODE='42501';
    END IF;
    IF v_predio IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.predios p WHERE p.id = v_predio AND p.company_id IS NOT DISTINCT FROM v_company) THEN
      RAISE EXCEPTION 'Predio % no pertenece a la empresa % (tabla %).', v_predio, v_company, TG_TABLE_NAME USING ERRCODE='42501';
    END IF;
    IF v_lote_agri IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.lotes l WHERE l.id = v_lote_agri AND l.company_id IS NOT DISTINCT FROM v_company) THEN
      RAISE EXCEPTION 'Lote agricola % no pertenece a la empresa % (tabla %).', v_lote_agri, v_company, TG_TABLE_NAME USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DO $$
DECLARE t_name TEXT;
  tables TEXT[] := ARRAY[
    'labores', 'planificacion_cosechas', 'aplicaciones', 'cosechas', 'monitoreos',
    'costos', 'historial_actividades', 'draft_evaluaciones',
    'fertilization_plans', 'fertilizacion_recomendaciones',
    'analisis_suelos', 'lotes_producto', 'ventas', 'despachos', 'facturas', 'lotes'
  ];
BEGIN
  FOREACH t_name IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t_name) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS validate_lote_predio_trg ON public.%I', t_name);
      EXECUTE format('CREATE TRIGGER validate_lote_predio_trg BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.process_validate_lote_predio_tenant()', t_name);
    END IF;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.process_validate_lote_predio_tenant IS 'H1 043: bloquea colgar actividad propia a lote/predio ajeno aunque se conozca UUID. No exige NOT NULL (C6 lo reporta primero).';
