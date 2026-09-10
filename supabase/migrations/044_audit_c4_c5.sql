-- ==============================================================================
-- SKYCROP 044: Auditoria confiable C4 + C5 (sin traceability_events aun)
-- C4: audit_logs inmutable (solo SELECT+INSERT tenant), columnas tabla/
--     registro_id/metadata, trigger anti UPDATE/DELETE.
-- C5: guardar_evaluacion_completa (028:157-177) insertaba columnas inexistentes
--     (tabla,registro_id,detalles + accion CREATE_EVALUATION fuera del CHECK).
--     Se reescribe a esquema real 019 + CHECK valido.
-- Tambien: corrige limpieza 038:148 (columna vereda, no nombre).
-- ==============================================================================

-- ── C4a: columnas faltantes (actor/entidad/registro/metadata) ────────────────
-- Resiliente: si 019 no esta aplicada, se omite (staging_checks 044.A lo reporta).
DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS tabla TEXT;
    ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS registro_id UUID;
    ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

    -- C4b: RLS append-only: solo SELECT + INSERT tenant
    DROP POLICY IF EXISTS audit_logs_select_policy ON public.audit_logs;
    DROP POLICY IF EXISTS audit_logs_insert_policy ON public.audit_logs;
    DROP POLICY IF EXISTS audit_logs_update_policy ON public.audit_logs;
    DROP POLICY IF EXISTS audit_logs_delete_policy ON public.audit_logs;
    CREATE POLICY audit_logs_select_policy ON public.audit_logs
      FOR SELECT TO authenticated USING (company_id = public.current_company());
    CREATE POLICY audit_logs_insert_policy ON public.audit_logs
      FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company());
    -- Sin UPDATE ni DELETE para authenticated: historial no editable ni borrable.
    -- service_role conserva acceso via bypass (tareas internas), sin policy.

    CREATE OR REPLACE FUNCTION public.process_audit_logs_immutable()
    RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
    AS $fn$
    BEGIN
      RAISE EXCEPTION 'audit_logs es inmutable: no se permite % sobre el historial.', TG_OP USING ERRCODE='25001';
      RETURN NULL;
    END; $fn$;
    DROP TRIGGER IF EXISTS audit_logs_immutable_trg ON public.audit_logs;
    CREATE TRIGGER audit_logs_immutable_trg BEFORE UPDATE OR DELETE ON public.audit_logs
      FOR EACH ROW EXECUTE FUNCTION public.process_audit_logs_immutable();
  ELSE
    RAISE NOTICE '[044 C4] omitido: falta tabla audit_logs (019 no aplicada)';
  END IF;
END $do$;

-- ── C5: RPC 028 reescrita a esquema real ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guardar_evaluacion_completa(
    p_company_id            UUID,
    p_lote_id               UUID,
    p_objeto_evaluacion_id  UUID,
    p_protocolo_version_id  UUID,
    p_tipo_monitoreo        VARCHAR,
    p_responsable           VARCHAR,
    p_valores_evaluacion    JSONB,
    p_incidencia_pct        DOUBLE PRECISION,
    p_severidad_pct         DOUBLE PRECISION,
    p_humedad_pct           DOUBLE PRECISION,
    p_temperatura_c         DOUBLE PRECISION,
    p_plagas_detectadas     TEXT,
    p_enfermedades_detectadas TEXT,
    p_observaciones         TEXT,
    p_user_id               TEXT,
    p_estado_sanitario      VARCHAR
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_mon_id UUID;
    v_current_ndvi DOUBLE PRECISION;
    v_next_ndvi DOUBLE PRECISION;
    v_ndvi_change DOUBLE PRECISION;
BEGIN
    PERFORM public.rpc_assert_tenant_access(p_company_id, p_user_id);
    IF p_lote_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.lotes l WHERE l.id = p_lote_id AND l.company_id = p_company_id) THEN
      RAISE EXCEPTION 'Lote % no pertenece a la empresa %.', p_lote_id, p_company_id USING ERRCODE='42501';
    END IF;

    INSERT INTO public.monitoreos (
        company_id, lote_id, objeto_evaluacion_id, protocolo_version_id,
        tipo_monitoreo, fecha_monitoreo, responsable, valores_evaluacion,
        incidencia_pct, severidad_pct, humedad_pct, temperatura_c,
        plagas_detectadas, enfermedades_detectadas, observaciones
    ) VALUES (
        p_company_id, p_lote_id, p_objeto_evaluacion_id, p_protocolo_version_id,
        p_tipo_monitoreo, now(), p_responsable, p_valores_evaluacion,
        p_incidencia_pct, p_severidad_pct, p_humedad_pct, p_temperatura_c,
        p_plagas_detectadas, p_enfermedades_detectadas, p_observaciones
    ) RETURNING id INTO v_mon_id;

    SELECT ndvi_actual INTO v_current_ndvi FROM public.lotes WHERE id = p_lote_id;
    v_ndvi_change := COALESCE(p_severidad_pct, 0) / 100.0;
    v_next_ndvi := COALESCE(v_current_ndvi, 0.75) - v_ndvi_change;
    IF v_next_ndvi < 0.15 THEN v_next_ndvi := 0.15; END IF;

    UPDATE public.lotes SET estado_sanitario = p_estado_sanitario,
      ndvi_actual = v_next_ndvi, updated_at = now() WHERE id = p_lote_id;

    DELETE FROM public.draft_evaluaciones
    WHERE company_id = p_company_id AND user_id = p_user_id AND lote_id = p_lote_id;

    -- Esquema real 019: accion del CHECK + modulo/tabla/registro + antes/despues
    INSERT INTO public.audit_logs (
        company_id, usuario_id, usuario_email, accion, modulo,
        tabla, registro_id, antes, despues, metadata
    ) VALUES (
        p_company_id, p_user_id, COALESCE(p_user_id, 'sistema'),
        'INSERT', 'evaluaciones', 'monitoreos', v_mon_id, NULL,
        json_build_object('lote_id', p_lote_id, 'objeto_evaluacion_id', p_objeto_evaluacion_id,
          'incidencia_pct', p_incidencia_pct, 'severidad_pct', p_severidad_pct,
          'estado_sanitario', p_estado_sanitario),
        json_build_object('rpc', 'guardar_evaluacion_completa')
    );

    RETURN v_mon_id;
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Rollback ejecutado. Error al guardar evaluacion: % (Estado: %)', SQLERRM, SQLSTATE;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guardar_evaluacion_completa(UUID,UUID,UUID,UUID,VARCHAR,VARCHAR,JSONB,DOUBLE PRECISION,DOUBLE PRECISION,DOUBLE PRECISION,DOUBLE PRECISION,TEXT,TEXT,TEXT,TEXT,VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_evaluacion_completa(UUID,UUID,UUID,UUID,VARCHAR,VARCHAR,JSONB,DOUBLE PRECISION,DOUBLE PRECISION,DOUBLE PRECISION,DOUBLE PRECISION,TEXT,TEXT,TEXT,TEXT,VARCHAR) TO authenticated, service_role;

-- ── Fix limpieza semilla: columna real es vereda (028:49), no nombre ─────────
-- (idempotente; solo documenta el criterio correcto para futuras limpiezas)
DO $$ BEGIN
  DELETE FROM public.division_politica
  WHERE departamento = 'Valle del Cauca' AND municipio = 'Zarzal' AND vereda = 'La Paila';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
