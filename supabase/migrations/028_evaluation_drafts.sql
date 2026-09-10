-- ==============================================================================
-- SKYCROP DATABASE V2: 028_evaluation_drafts.sql
-- Descripción: Tabla de Borradores de Evaluación, Cartografía para PostGIS
--              y Función Transaccional para Guardar Evaluaciones.
-- ==============================================================================

-- 1. TABLA DE BORRADORES (DRAFTS) DE EVALUACIÓN
CREATE TABLE IF NOT EXISTS public.draft_evaluaciones (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL,
    lote_id     UUID REFERENCES public.lotes(id) ON DELETE CASCADE,
    step_name   VARCHAR(100) NOT NULL, -- e.g., 'LOT_SELECTED', 'PROTOCOL_LOADED', 'VARIABLES_COMPLETED'
    state_data  JSONB NOT NULL,        -- Contiene todo el estado del formulario del wizard
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (company_id, user_id, lote_id)
);

-- RLS y Políticas de Aislamiento Multi-Tenant para draft_evaluaciones
ALTER TABLE public.draft_evaluaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY draft_evaluaciones_select_policy ON public.draft_evaluaciones 
    FOR SELECT TO authenticated USING (company_id = public.current_company());

CREATE POLICY draft_evaluaciones_insert_policy ON public.draft_evaluaciones 
    FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company());

CREATE POLICY draft_evaluaciones_update_policy ON public.draft_evaluaciones 
    FOR UPDATE TO authenticated USING (company_id = public.current_company()) 
    WITH CHECK (company_id = public.current_company());

CREATE POLICY draft_evaluaciones_delete_policy ON public.draft_evaluaciones 
    FOR DELETE TO authenticated USING (company_id = public.current_company());

-- Vincular Trigger Zero-Trust para asegurar company_id
DROP TRIGGER IF EXISTS secure_company_id_trg ON public.draft_evaluaciones;
CREATE TRIGGER secure_company_id_trg 
    BEFORE INSERT OR UPDATE ON public.draft_evaluaciones 
    FOR EACH ROW EXECUTE FUNCTION public.process_secure_company_id();


-- 2. TABLA DE DIVISIÓN POLÍTICO-ADMINISTRATIVA (Para Geocodificación PostGIS Interna)
CREATE TABLE IF NOT EXISTS public.division_politica (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    departamento  VARCHAR(100) NOT NULL,
    municipio     VARCHAR(100) NOT NULL,
    vereda        VARCHAR(100) NOT NULL,
    geom          public.geometry(Geometry, 4326) NOT NULL
);

-- Índice Espacial GIST
CREATE INDEX IF NOT EXISTS division_politica_geom_idx ON public.division_politica USING GIST (geom);

-- RLS para lectura pública
ALTER TABLE public.division_politica ENABLE ROW LEVEL SECURITY;
CREATE POLICY division_politica_select_policy ON public.division_politica 
    FOR SELECT TO authenticated USING (true);

-- Semillar un polígono de prueba que contiene las coordenadas de Valle del Cauca (Zarzal / La Paila / Palmira)
INSERT INTO public.division_politica (departamento, municipio, vereda, geom)
VALUES (
    'Valle del Cauca',
    'Zarzal',
    'La Paila',
    public.ST_GeomFromText('POLYGON((-76.45 3.35, -76.00 3.35, -76.00 4.55, -76.45 4.55, -76.45 3.35))', 4326)
) ON CONFLICT DO NOTHING;


-- 3. FUNCIÓN TRANSACCIONAL ATÓMICA DE PERSISTENCIA (RPC)
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
SECURITY DEFINER
AS $$
DECLARE
    v_mon_id UUID;
    v_current_ndvi DOUBLE PRECISION;
    v_next_ndvi DOUBLE PRECISION;
    v_ndvi_change DOUBLE PRECISION;
BEGIN
    -- 1. Insertar evaluación en monitoreos
    INSERT INTO public.monitoreos (
        company_id,
        lote_id,
        objeto_evaluacion_id,
        protocolo_version_id,
        tipo_monitoreo,
        fecha_monitoreo,
        responsable,
        valores_evaluacion,
        incidencia_pct,
        severidad_pct,
        humedad_pct,
        temperatura_c,
        plagas_detectadas,
        enfermedades_detectadas,
        observaciones
    ) VALUES (
        p_company_id,
        p_lote_id,
        p_objeto_evaluacion_id,
        p_protocolo_version_id,
        p_tipo_monitoreo,
        now(),
        p_responsable,
        p_valores_evaluacion,
        p_incidencia_pct,
        p_severidad_pct,
        p_humedad_pct,
        p_temperatura_c,
        p_plagas_detectadas,
        p_enfermedades_detectadas,
        p_observaciones
    )
    RETURNING id INTO v_mon_id;

    -- 2. Actualizar estado y vigor (NDVI) del lote de forma controlada
    SELECT ndvi_actual INTO v_current_ndvi FROM public.lotes WHERE id = p_lote_id;
    v_ndvi_change := p_severidad_pct / 100.0;
    v_next_ndvi := COALESCE(v_current_ndvi, 0.75) - v_ndvi_change;
    IF v_next_ndvi < 0.15 THEN
        v_next_ndvi := 0.15;
    END IF;

    UPDATE public.lotes
    SET 
        estado_sanitario = p_estado_sanitario,
        ndvi_actual = v_next_ndvi,
        updated_at = now()
    WHERE id = p_lote_id;

    -- 3. Limpiar borrador si existe
    DELETE FROM public.draft_evaluaciones
    WHERE company_id = p_company_id 
      AND user_id = p_user_id 
      AND lote_id = p_lote_id;

    -- 4. Registrar evento en audit_logs para trazabilidad histórica
    INSERT INTO public.audit_logs (
        company_id,
        usuario_id,
        accion,
        tabla,
        registro_id,
        detalles
    ) VALUES (
        p_company_id,
        p_user_id,
        'CREATE_EVALUATION',
        'monitoreos',
        v_mon_id,
        json_build_object(
            'lote_id', p_lote_id,
            'objeto_evaluacion_id', p_objeto_evaluacion_id,
            'incidencia_pct', p_incidencia_pct,
            'severidad_pct', p_severidad_pct,
            'estado_sanitario', p_estado_sanitario
        )
    );

    RETURN v_mon_id;
EXCEPTION WHEN OTHERS THEN
    -- Rollback implícito por PostgreSQL al levantar excepción
    RAISE EXCEPTION 'Rollback ejecutado. Error al guardar evaluación: % (Estado: %)', SQLERRM, SQLSTATE;
END;
$$;
