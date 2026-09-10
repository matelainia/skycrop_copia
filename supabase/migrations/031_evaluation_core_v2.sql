-- ==============================================================================
-- SKYCROP DATABASE: 031_evaluation_core_v2.sql
-- Descripción: Arquitectura v2 del ciclo de vida de evaluaciones.
--
-- Agrega:
--   1. evaluation_snapshots            → Cabecera inmutable del protocolo usado
--   2. evaluation_snapshot_variables   → Variables copiadas del protocolo
--   3. evaluation_snapshot_rules       → Reglas copiadas del protocolo
--   4. evaluation_snapshot_thresholds  → Umbrales copiados del protocolo
--   5. evaluation_snapshot_alerts      → Alertas generadas por el motor de reglas
--   6. evaluation_snapshot_recommendations → Recomendaciones generadas
--   7. evaluation_events               → Bitácora de auditoría del ciclo de vida
--   8. Columna evaluation_status       → Estado formal de la evaluación en monitoreos
--   9. RPC guardar_evaluacion_v2       → Persistencia atómica con ROLLBACK explícito
--
-- Estrategia: Zero-Downtime (las tablas existentes no se modifican destructivamente)
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ESTADO DE LA EVALUACIÓN EN TABLA monitoreos
--    Añade la columna evaluation_status al modelo legacy sin romperlo.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.monitoreos
  ADD COLUMN IF NOT EXISTS evaluation_status VARCHAR(50)
    NOT NULL DEFAULT 'BORRADOR'
    CHECK (evaluation_status IN (
      'BORRADOR',
      'CAPTURANDO',
      'VALIDADA',
      'CONSOLIDADA',
      'APROBADA',
      'CERRADA',
      'ARCHIVADA'
    ));

-- Eliminar la restricción obsoleta que restringía tipo_monitoreo únicamente a ('Sanitario', 'Agronómico', 'Post-Aplicación')
ALTER TABLE public.monitoreos
  DROP CONSTRAINT IF EXISTS monitoreos_tipo_monitoreo_check;


COMMENT ON COLUMN public.monitoreos.evaluation_status IS
  'Estado formal del ciclo de vida de la evaluación. '
  'BORRADOR→CAPTURANDO→VALIDADA→CONSOLIDADA→APROBADA→CERRADA→ARCHIVADA. '
  'A partir de CONSOLIDADA los datos son inmutables.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SNAPSHOTS — CABECERA INMUTABLE DEL PROTOCOLO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evaluation_snapshots (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id         UUID NOT NULL REFERENCES public.monitoreos(id) ON DELETE CASCADE,
    protocol_id           UUID REFERENCES public.protocolos_evaluacion(id) ON DELETE SET NULL,
    protocol_name         VARCHAR(200) NOT NULL,
    protocol_version      VARCHAR(50)  NOT NULL DEFAULT '1.0',
    monitoring_type       VARCHAR(100) NOT NULL,
    evaluation_object_id  UUID REFERENCES public.objetos_evaluacion(id) ON DELETE SET NULL,
    evaluation_object_name VARCHAR(200) NOT NULL,
    object_category       VARCHAR(100) NOT NULL DEFAULT 'Sin categoría',
    sampling_method       VARCHAR(100),
    minimum_sample        INT,
    -- Resultados calculados por los motores al momento de consolidar
    incidence_pct         DOUBLE PRECISION DEFAULT 0,
    severity_pct          DOUBLE PRECISION DEFAULT 0,
    coverage_pct          DOUBLE PRECISION DEFAULT 0,
    risk_level            VARCHAR(50) CHECK (risk_level IN ('Bajo','Medio','Alto','Crítico','Sin riesgo')),
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

COMMENT ON TABLE public.evaluation_snapshots IS
  'Cabecera inmutable del protocolo utilizado en la evaluación. '
  'Garantiza que el reporte histórico refleje exactamente la versión del protocolo '
  'vigente en el momento de la evaluación, independientemente de cambios futuros.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SNAPSHOTS — VARIABLES COPIADAS DEL PROTOCOLO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evaluation_snapshot_variables (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id     UUID NOT NULL REFERENCES public.evaluation_snapshots(id) ON DELETE CASCADE,
    variable_clave  VARCHAR(100) NOT NULL,
    etiqueta        VARCHAR(200) NOT NULL,
    tipo            VARCHAR(50)  NOT NULL,
    unidad          VARCHAR(100),
    obligatorio     BOOLEAN DEFAULT true,
    orden           INT DEFAULT 0,
    -- Valor capturado por el evaluador
    valor_capturado TEXT,
    -- Interpretación generada por el motor de escalas
    interpretacion  TEXT,
    escala_nivel    VARCHAR(50),   -- Bajo / Medio / Alto / Crítico
    escala_color    VARCHAR(20),   -- #hex
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

COMMENT ON TABLE public.evaluation_snapshot_variables IS
  'Copia inmutable de cada variable del protocolo y su valor capturado, junto con '
  'la interpretación generada por el motor de escalas en el momento de la evaluación.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SNAPSHOTS — REGLAS COPIADAS DEL PROTOCOLO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evaluation_snapshot_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id     UUID NOT NULL REFERENCES public.evaluation_snapshots(id) ON DELETE CASCADE,
    variable_clave  VARCHAR(100) NOT NULL,
    operador        VARCHAR(10)  NOT NULL,
    valor           TEXT         NOT NULL,
    accion          VARCHAR(100) NOT NULL,
    mensaje         TEXT,
    -- ¿Se disparó esta regla en la evaluación?
    fue_disparada   BOOLEAN DEFAULT false,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

COMMENT ON TABLE public.evaluation_snapshot_rules IS
  'Copia inmutable de las reglas SI/ENTONCES del protocolo, con indicación de si '
  'fueron disparadas durante la evaluación.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. SNAPSHOTS — UMBRALES COPIADOS DEL PROTOCOLO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evaluation_snapshot_thresholds (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id     UUID NOT NULL REFERENCES public.evaluation_snapshots(id) ON DELETE CASCADE,
    variable_clave  VARCHAR(100) NOT NULL,
    operador        VARCHAR(10)  NOT NULL,
    valor_umbral    DOUBLE PRECISION NOT NULL,
    nivel_riesgo    VARCHAR(50)  NOT NULL,
    mensaje         TEXT,
    -- Valor real obtenido en la evaluación para comparación
    valor_obtenido  DOUBLE PRECISION,
    -- ¿Se superó el umbral?
    fue_superado    BOOLEAN DEFAULT false,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

COMMENT ON TABLE public.evaluation_snapshot_thresholds IS
  'Copia inmutable de los umbrales del protocolo, con el valor real obtenido y si '
  'fue superado en la evaluación. Permite mostrar la comparativa en el reporte.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. SNAPSHOTS — ALERTAS GENERADAS POR EL MOTOR DE REGLAS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evaluation_snapshot_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id     UUID NOT NULL REFERENCES public.evaluation_snapshots(id) ON DELETE CASCADE,
    nivel_riesgo    VARCHAR(50)  NOT NULL CHECK (nivel_riesgo IN ('Bajo','Medio','Alto','Crítico')),
    prioridad       VARCHAR(20)  NOT NULL DEFAULT 'Media',
    mensaje         TEXT         NOT NULL,
    variable_clave  VARCHAR(100),  -- Variable que originó la alerta
    valor_disparador TEXT,          -- Valor que superó el umbral/regla
    fecha_disparo   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

COMMENT ON TABLE public.evaluation_snapshot_alerts IS
  'Alertas inmutables generadas por el ProtocolRuleEngine durante la evaluación. '
  'Se muestran en el reporte histórico con su color y prioridad originales.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. SNAPSHOTS — RECOMENDACIONES GENERADAS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evaluation_snapshot_recommendations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id     UUID NOT NULL REFERENCES public.evaluation_snapshots(id) ON DELETE CASCADE,
    categoria       VARCHAR(100),
    mensaje         TEXT NOT NULL,
    prioridad       VARCHAR(20) DEFAULT 'Media',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

COMMENT ON TABLE public.evaluation_snapshot_recommendations IS
  'Recomendaciones inmutables generadas por el motor de evaluación. '
  'Complementan el reporte histórico con acciones agronómicas sugeridas.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. EVENT LOG / BITÁCORA DE AUDITORÍA
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evaluation_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id   UUID NOT NULL REFERENCES public.monitoreos(id) ON DELETE CASCADE,
    event_type      VARCHAR(100) NOT NULL,
    -- Eventos válidos del ciclo de vida:
    -- EVALUACION_CREADA | PROTOCOLO_ASIGNADO | CAPTURA_INICIADA
    -- VARIABLES_CALCULADAS | REGLAS_EVALUADAS | ALERTA_DISPARADA
    -- VALIDACION_COMPLETADA | ESTADO_CAMBIADO | SNAPSHOT_CONSOLIDADO
    -- EVALUACION_APROBADA | EVALUACION_CERRADA | EVALUACION_ARCHIVADA
    description     TEXT,
    -- Estado anterior → nuevo estado en transiciones
    estado_anterior VARCHAR(50),
    estado_nuevo    VARCHAR(50),
    -- Datos adicionales del evento (resultado de cálculo, alert disparada, etc.)
    payload         JSONB DEFAULT '{}'::jsonb,
    user_id         TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

COMMENT ON TABLE public.evaluation_events IS
  'Bitácora cronológica e inmutable de todos los eventos del ciclo de vida de una evaluación. '
  'Permite diagnóstico, trazabilidad completa y auditoría de cambios de estado.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. ÍNDICES DE RENDIMIENTO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_eval_snapshots_evaluation  ON public.evaluation_snapshots(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_eval_snap_vars_snapshot    ON public.evaluation_snapshot_variables(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_eval_snap_rules_snapshot   ON public.evaluation_snapshot_rules(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_eval_snap_thresh_snapshot  ON public.evaluation_snapshot_thresholds(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_eval_snap_alerts_snapshot  ON public.evaluation_snapshot_alerts(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_eval_snap_recs_snapshot    ON public.evaluation_snapshot_recommendations(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_eval_events_evaluation     ON public.evaluation_events(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_eval_events_type           ON public.evaluation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_monitoreos_status          ON public.monitoreos(evaluation_status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.evaluation_snapshots                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_snapshot_variables       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_snapshot_rules           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_snapshot_thresholds      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_snapshot_alerts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_snapshot_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_events                   ENABLE ROW LEVEL SECURITY;

-- Lectura autenticada (coherente con el resto del esquema)
DROP POLICY IF EXISTS "eval_snapshots_select"       ON public.evaluation_snapshots;
DROP POLICY IF EXISTS "eval_snap_vars_select"       ON public.evaluation_snapshot_variables;
DROP POLICY IF EXISTS "eval_snap_rules_select"      ON public.evaluation_snapshot_rules;
DROP POLICY IF EXISTS "eval_snap_thresh_select"     ON public.evaluation_snapshot_thresholds;
DROP POLICY IF EXISTS "eval_snap_alerts_select"     ON public.evaluation_snapshot_alerts;
DROP POLICY IF EXISTS "eval_snap_recs_select"       ON public.evaluation_snapshot_recommendations;
DROP POLICY IF EXISTS "eval_events_select"          ON public.evaluation_events;

CREATE POLICY "eval_snapshots_select"       ON public.evaluation_snapshots                FOR SELECT TO authenticated USING (true);
CREATE POLICY "eval_snap_vars_select"       ON public.evaluation_snapshot_variables       FOR SELECT TO authenticated USING (true);
CREATE POLICY "eval_snap_rules_select"      ON public.evaluation_snapshot_rules           FOR SELECT TO authenticated USING (true);
CREATE POLICY "eval_snap_thresh_select"     ON public.evaluation_snapshot_thresholds      FOR SELECT TO authenticated USING (true);
CREATE POLICY "eval_snap_alerts_select"     ON public.evaluation_snapshot_alerts          FOR SELECT TO authenticated USING (true);
CREATE POLICY "eval_snap_recs_select"       ON public.evaluation_snapshot_recommendations FOR SELECT TO authenticated USING (true);
CREATE POLICY "eval_events_select"          ON public.evaluation_events                   FOR SELECT TO authenticated USING (true);

-- Escritura solo service_role (acceso desde backend con supabaseAdmin)
DROP POLICY IF EXISTS "eval_snapshots_write"        ON public.evaluation_snapshots;
DROP POLICY IF EXISTS "eval_snap_vars_write"        ON public.evaluation_snapshot_variables;
DROP POLICY IF EXISTS "eval_snap_rules_write"       ON public.evaluation_snapshot_rules;
DROP POLICY IF EXISTS "eval_snap_thresh_write"      ON public.evaluation_snapshot_thresholds;
DROP POLICY IF EXISTS "eval_snap_alerts_write"      ON public.evaluation_snapshot_alerts;
DROP POLICY IF EXISTS "eval_snap_recs_write"        ON public.evaluation_snapshot_recommendations;
DROP POLICY IF EXISTS "eval_events_write"           ON public.evaluation_events;

CREATE POLICY "eval_snapshots_write"        ON public.evaluation_snapshots                FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "eval_snap_vars_write"        ON public.evaluation_snapshot_variables       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "eval_snap_rules_write"       ON public.evaluation_snapshot_rules           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "eval_snap_thresh_write"      ON public.evaluation_snapshot_thresholds      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "eval_snap_alerts_write"      ON public.evaluation_snapshot_alerts          FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "eval_snap_recs_write"        ON public.evaluation_snapshot_recommendations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "eval_events_write"           ON public.evaluation_events                   FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. RPC ATÓMICA: guardar_evaluacion_v2
--     Persiste la evaluación completa en una transacción atómica.
--     Si cualquier inserción falla → ROLLBACK de toda la transacción.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guardar_evaluacion_v2(
    -- Datos básicos de la evaluación
    p_company_id              UUID,
    p_lote_id                 UUID,
    p_responsable             VARCHAR,
    p_observaciones           TEXT,
    p_user_id                 TEXT,
    -- Datos del protocolo snapshot
    p_protocol_id             UUID,
    p_protocol_name           VARCHAR,
    p_protocol_version        VARCHAR,
    p_monitoring_type         VARCHAR,
    p_objeto_evaluacion_id    UUID,
    p_objeto_evaluacion_name  VARCHAR,
    p_object_category         VARCHAR,
    p_sampling_method         VARCHAR,
    p_minimum_sample          INT,
    -- Resultados calculados (motor de cálculo)
    p_incidence_pct           DOUBLE PRECISION DEFAULT 0,
    p_severity_pct            DOUBLE PRECISION DEFAULT 0,
    p_coverage_pct            DOUBLE PRECISION DEFAULT 0,
    p_risk_level              VARCHAR         DEFAULT 'Sin riesgo',
    p_estado_sanitario        VARCHAR         DEFAULT 'excelente',
    -- Datos de variables (valores_evaluacion legacy + variables del snapshot)
    p_valores_evaluacion      JSONB           DEFAULT '{}'::jsonb,
    p_snapshot_variables      JSONB           DEFAULT '[]'::jsonb,
    -- Reglas, umbrales, alertas, recomendaciones (arrays JSONB)
    p_snapshot_rules          JSONB           DEFAULT '[]'::jsonb,
    p_snapshot_thresholds     JSONB           DEFAULT '[]'::jsonb,
    p_snapshot_alerts         JSONB           DEFAULT '[]'::jsonb,
    p_snapshot_recommendations JSONB          DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_mon_id   UUID;
    v_snap_id  UUID;
    v_item     JSONB;
BEGIN
    -- ══════════════════════════════════════════════════════════════════════
    -- PASO 1: Insertar evaluación en monitoreos (compatible con legacy)
    -- ══════════════════════════════════════════════════════════════════════
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
        observaciones,
        created_by,
        evaluation_status
    ) VALUES (
        p_company_id,
        p_lote_id,
        p_objeto_evaluacion_id,
        p_protocol_id,
        COALESCE(NULLIF(p_monitoring_type, ''), 'Sanitario'),
        now(),
        p_responsable,
        p_valores_evaluacion,
        p_incidence_pct,
        p_severity_pct,
        p_observaciones,
        p_user_id,
        'CONSOLIDADA'
    )
    RETURNING id INTO v_mon_id;

    -- ══════════════════════════════════════════════════════════════════════
    -- PASO 2: Actualizar estado sanitario del lote
    -- ══════════════════════════════════════════════════════════════════════
    UPDATE public.lotes
    SET
        estado_sanitario = p_estado_sanitario,
        ndvi_actual      = GREATEST(0.15, COALESCE(ndvi_actual, 0.75) - (p_severity_pct / 100.0)),
        updated_at       = now()
    WHERE id = p_lote_id;

    -- ══════════════════════════════════════════════════════════════════════
    -- PASO 3: Guardar snapshot cabecera
    -- ══════════════════════════════════════════════════════════════════════
    INSERT INTO public.evaluation_snapshots (
        evaluation_id,
        protocol_id,
        protocol_name,
        protocol_version,
        monitoring_type,
        evaluation_object_id,
        evaluation_object_name,
        object_category,
        sampling_method,
        minimum_sample,
        incidence_pct,
        severity_pct,
        coverage_pct,
        risk_level
    ) VALUES (
        v_mon_id,
        p_protocol_id,
        p_protocol_name,
        p_protocol_version,
        p_monitoring_type,
        p_objeto_evaluacion_id,
        p_objeto_evaluacion_name,
        p_object_category,
        p_sampling_method,
        p_minimum_sample,
        p_incidence_pct,
        p_severity_pct,
        p_coverage_pct,
        p_risk_level
    )
    RETURNING id INTO v_snap_id;

    -- ══════════════════════════════════════════════════════════════════════
    -- PASO 4: Guardar variables del snapshot
    -- ══════════════════════════════════════════════════════════════════════
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_snapshot_variables)
    LOOP
        INSERT INTO public.evaluation_snapshot_variables (
            snapshot_id, variable_clave, etiqueta, tipo,
            unidad, obligatorio, orden, valor_capturado,
            interpretacion, escala_nivel, escala_color
        ) VALUES (
            v_snap_id,
            v_item->>'variable_clave',
            v_item->>'etiqueta',
            COALESCE(v_item->>'tipo', 'Texto'),
            v_item->>'unidad',
            COALESCE((v_item->>'obligatorio')::boolean, true),
            COALESCE((v_item->>'orden')::int, 0),
            v_item->>'valor_capturado',
            v_item->>'interpretacion',
            v_item->>'escala_nivel',
            v_item->>'escala_color'
        );
    END LOOP;

    -- ══════════════════════════════════════════════════════════════════════
    -- PASO 5: Guardar reglas del snapshot
    -- ══════════════════════════════════════════════════════════════════════
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_snapshot_rules)
    LOOP
        INSERT INTO public.evaluation_snapshot_rules (
            snapshot_id, variable_clave, operador, valor,
            accion, mensaje, fue_disparada
        ) VALUES (
            v_snap_id,
            v_item->>'variable_clave',
            COALESCE(v_item->>'operador', '>'),
            COALESCE(v_item->>'valor', '0'),
            COALESCE(v_item->>'accion', 'Crear alerta'),
            v_item->>'mensaje',
            COALESCE((v_item->>'fue_disparada')::boolean, false)
        );
    END LOOP;

    -- ══════════════════════════════════════════════════════════════════════
    -- PASO 6: Guardar umbrales del snapshot
    -- ══════════════════════════════════════════════════════════════════════
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_snapshot_thresholds)
    LOOP
        INSERT INTO public.evaluation_snapshot_thresholds (
            snapshot_id, variable_clave, operador, valor_umbral,
            nivel_riesgo, mensaje, valor_obtenido, fue_superado
        ) VALUES (
            v_snap_id,
            v_item->>'variable_clave',
            COALESCE(v_item->>'operador', '>'),
            COALESCE((v_item->>'valor_umbral')::double precision, 0),
            COALESCE(v_item->>'nivel_riesgo', 'Medio'),
            v_item->>'mensaje',
            (v_item->>'valor_obtenido')::double precision,
            COALESCE((v_item->>'fue_superado')::boolean, false)
        );
    END LOOP;

    -- ══════════════════════════════════════════════════════════════════════
    -- PASO 7: Guardar alertas generadas
    -- ══════════════════════════════════════════════════════════════════════
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_snapshot_alerts)
    LOOP
        INSERT INTO public.evaluation_snapshot_alerts (
            snapshot_id, nivel_riesgo, prioridad,
            mensaje, variable_clave, valor_disparador
        ) VALUES (
            v_snap_id,
            COALESCE(v_item->>'nivel_riesgo', 'Medio'),
            COALESCE(v_item->>'prioridad', 'Media'),
            COALESCE(v_item->>'mensaje', ''),
            v_item->>'variable_clave',
            v_item->>'valor_disparador'
        );
    END LOOP;

    -- ══════════════════════════════════════════════════════════════════════
    -- PASO 8: Guardar recomendaciones generadas
    -- ══════════════════════════════════════════════════════════════════════
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_snapshot_recommendations)
    LOOP
        INSERT INTO public.evaluation_snapshot_recommendations (
            snapshot_id, categoria, mensaje, prioridad
        ) VALUES (
            v_snap_id,
            v_item->>'categoria',
            COALESCE(v_item->>'mensaje', ''),
            COALESCE(v_item->>'prioridad', 'Media')
        );
    END LOOP;

    -- ══════════════════════════════════════════════════════════════════════
    -- PASO 9: Limpiar borrador si existe
    -- ══════════════════════════════════════════════════════════════════════
    DELETE FROM public.draft_evaluaciones
    WHERE company_id = p_company_id
      AND user_id    = p_user_id
      AND lote_id    = p_lote_id;

    -- ══════════════════════════════════════════════════════════════════════
    -- PASO 10: Registrar eventos en la bitácora
    -- ══════════════════════════════════════════════════════════════════════
    INSERT INTO public.evaluation_events (evaluation_id, event_type, description, estado_anterior, estado_nuevo, payload, user_id)
    VALUES
    (v_mon_id, 'EVALUACION_CREADA', 'Evaluación registrada exitosamente', NULL, 'CONSOLIDADA',
     jsonb_build_object('protocol_name', p_protocol_name, 'protocol_version', p_protocol_version), p_user_id),
    (v_mon_id, 'PROTOCOLO_ASIGNADO', format('Protocolo asignado: %s v%s', p_protocol_name, p_protocol_version), NULL, NULL,
     jsonb_build_object('protocol_id', p_protocol_id), p_user_id),
    (v_mon_id, 'SNAPSHOT_CONSOLIDADO', format('Snapshot inmutable creado. Variables: %s, Alertas: %s, Reglas: %s',
     jsonb_array_length(p_snapshot_variables),
     jsonb_array_length(p_snapshot_alerts),
     jsonb_array_length(p_snapshot_rules)), 'CAPTURANDO', 'CONSOLIDADA',
     jsonb_build_object('snapshot_id', v_snap_id, 'risk_level', p_risk_level, 'incidence_pct', p_incidence_pct), p_user_id);

    -- Registrar alerta por alerta disparada
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_snapshot_alerts)
    LOOP
        INSERT INTO public.evaluation_events (evaluation_id, event_type, description, payload, user_id)
        VALUES (
            v_mon_id,
            'ALERTA_DISPARADA',
            format('Alerta %s: %s', v_item->>'nivel_riesgo', v_item->>'mensaje'),
            v_item,
            p_user_id
        );
    END LOOP;

    -- ══════════════════════════════════════════════════════════════════════
    -- RETORNO: IDs generados para confirmación en el cliente
    -- ══════════════════════════════════════════════════════════════════════
    RETURN jsonb_build_object(
        'evaluation_id', v_mon_id,
        'snapshot_id',   v_snap_id,
        'status',        'CONSOLIDADA'
    );

EXCEPTION WHEN OTHERS THEN
    -- ══════════════════════════════════════════════════════════════════════
    -- ROLLBACK AUTOMÁTICO de toda la transacción
    -- PostgreSQL revierte automáticamente al salir del bloque con RAISE EXCEPTION
    -- ══════════════════════════════════════════════════════════════════════
    RAISE EXCEPTION '[guardar_evaluacion_v2] Error atómico. Transacción revertida. Detalle: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.guardar_evaluacion_v2 IS
  'Persistencia atómica de la evaluación completa v2. '
  'Crea: registro en monitoreos (compatible legacy) + snapshot inmutable relacional (variables, reglas, umbrales, alertas, recomendaciones) + bitácora de eventos. '
  'Si cualquier inserción falla, PostgreSQL revierte toda la transacción (ROLLBACK automático).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. FUNCIÓN: Obtener evaluación completa con snapshot
--     Retorna el reporte histórico completo de una evaluación usando
--     la información inmutable del snapshot.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_evaluacion_completa(p_evaluation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_resultado JSONB;
BEGIN
    SELECT jsonb_build_object(
        'evaluation',       row_to_json(m.*),
        'snapshot',         row_to_json(s.*),
        'variables',        COALESCE((
            SELECT jsonb_agg(row_to_json(v.*) ORDER BY v.orden)
            FROM public.evaluation_snapshot_variables v
            WHERE v.snapshot_id = s.id
        ), '[]'::jsonb),
        'rules',            COALESCE((
            SELECT jsonb_agg(row_to_json(r.*))
            FROM public.evaluation_snapshot_rules r
            WHERE r.snapshot_id = s.id
        ), '[]'::jsonb),
        'thresholds',       COALESCE((
            SELECT jsonb_agg(row_to_json(t.*))
            FROM public.evaluation_snapshot_thresholds t
            WHERE t.snapshot_id = s.id
        ), '[]'::jsonb),
        'alerts',           COALESCE((
            SELECT jsonb_agg(row_to_json(a.*) ORDER BY a.fecha_disparo)
            FROM public.evaluation_snapshot_alerts a
            WHERE a.snapshot_id = s.id
        ), '[]'::jsonb),
        'recommendations',  COALESCE((
            SELECT jsonb_agg(row_to_json(rec.*))
            FROM public.evaluation_snapshot_recommendations rec
            WHERE rec.snapshot_id = s.id
        ), '[]'::jsonb),
        'events',           COALESCE((
            SELECT jsonb_agg(row_to_json(e.*) ORDER BY e.created_at)
            FROM public.evaluation_events e
            WHERE e.evaluation_id = m.id
        ), '[]'::jsonb)
    )
    INTO v_resultado
    FROM public.monitoreos m
    LEFT JOIN public.evaluation_snapshots s ON s.evaluation_id = m.id
    WHERE m.id = p_evaluation_id;

    RETURN v_resultado;
END;
$$;

COMMENT ON FUNCTION public.get_evaluacion_completa IS
  'Retorna el reporte histórico completo de una evaluación: datos base + snapshot inmutable '
  '(variables, reglas, umbrales, alertas, recomendaciones) + bitácora de eventos. '
  'Elimina la necesidad de múltiples queries desde el backend.';

DO $$
BEGIN
    RAISE NOTICE '[031] Arquitectura v2 del ciclo de vida de evaluaciones implementada correctamente.';
END;
$$;

