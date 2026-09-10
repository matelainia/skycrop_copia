-- ==============================================================================
-- SKYCROP DATABASE: 032_fertilization_module.sql
-- Descripción: Módulo completo de Fertilización
--
-- Tablas:
--   1. fertilization_plans              → Cabecera del plan de fertilización
--   2. fertilization_plan_items         → Insumos programados del plan
--   3. fertilization_applications       → Cronograma de aplicaciones
--   4. fertilization_observations       → Observaciones de campo
--   5. fertilization_observation_comments → Comentarios en observaciones
--   6. fertilization_observation_attachments → Adjuntos de observaciones
--   7. fertilization_observation_nutrients → Análisis foliar / nutrientes
--   8. fertilization_alerts             → Alertas activas del plan
--   9. fertilization_field_conditions   → Condiciones actuales del lote
--
-- Funciones RPC:
--   - fertilization_get_plan_detail(p_plan_id)
--   - fertilization_save_observation(...)
--   - fertilization_complete_application(...)
--   - fertilization_save_plan(...)
--
-- Estrategia: Zero-Downtime — no modifica tablas existentes
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TIPOS ENUM
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.fert_plan_status AS ENUM (
    'draft', 'active', 'paused', 'completed', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fert_validity_status AS ENUM (
    'scheduled', 'in_progress', 'expired', 'completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fert_application_status AS ENUM (
    'pending', 'completed', 'skipped', 'rescheduled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fert_observation_type AS ENUM (
    'note', 'symptom', 'foliar_analysis', 'application', 'soil', 'climate'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fert_severity AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fert_nutrient_status AS ENUM ('low', 'optimal', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fert_alert_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABLA: fertilization_plans
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fertilization_plans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    lote_id             UUID REFERENCES public.lotes(id) ON DELETE SET NULL,

    -- Identificación
    code                VARCHAR(50)  NOT NULL,
    name                VARCHAR(300) NOT NULL,
    version             VARCHAR(20)  NOT NULL DEFAULT 'v1.0',
    parent_plan_id      UUID REFERENCES public.fertilization_plans(id) ON DELETE SET NULL,

    -- Cultivo / Lote (snapshot en el momento de creación)
    crop_name           VARCHAR(200),
    crop_scientific     VARCHAR(200),
    lot_name            VARCHAR(200),
    sector_name         VARCHAR(200),
    farm_name           VARCHAR(200),
    area_ha             NUMERIC(10,2),
    soil_type           VARCHAR(200),
    density             VARCHAR(100),
    phenological_stage  VARCHAR(100),

    -- Estado
    status              public.fert_plan_status     NOT NULL DEFAULT 'draft',
    validity_status     public.fert_validity_status NOT NULL DEFAULT 'scheduled',

    -- Fechas
    start_date          DATE,
    end_date            DATE,
    period_label        VARCHAR(100),

    -- Economía
    budget_total        NUMERIC(18,2) DEFAULT 0,
    budget_executed     NUMERIC(18,2) DEFAULT 0,
    currency            VARCHAR(10)   DEFAULT 'COP',

    -- Métricas (calculadas/cacheadas)
    applications_total      INT  DEFAULT 0,
    applications_completed  INT  DEFAULT 0,
    observations_total      INT  DEFAULT 0,
    attachments_total       INT  DEFAULT 0,
    alerts_active           INT  DEFAULT 0,
    progress_pct            NUMERIC(5,2) DEFAULT 0,

    -- Responsable / aprobación
    responsible_name    VARCHAR(200),
    responsible_user_id TEXT,
    approved_by         VARCHAR(200),
    approved_at         TIMESTAMP WITH TIME ZONE,

    -- Metadata libre
    metadata            JSONB DEFAULT '{}',
    notes               TEXT,

    -- Auditoría
    created_by          TEXT,
    updated_by          TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

COMMENT ON TABLE public.fertilization_plans IS
  'Planes de fertilización por empresa/lote. Soporta versionado (parent_plan_id). '
  'Las métricas se cachean para evitar conteos en tiempo real.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABLA: fertilization_plan_items
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fertilization_plan_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id             UUID NOT NULL REFERENCES public.fertilization_plans(id) ON DELETE CASCADE,
    company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

    -- Producto / insumo
    product_id          BIGINT REFERENCES public.productos(id) ON DELETE SET NULL,
    product_name        VARCHAR(300) NOT NULL,

    product_formula     VARCHAR(200),

    -- Programación
    item_type           VARCHAR(100), -- fertilizante, enmienda, bioestimulante, etc.
    dose_value          NUMERIC(10,4),
    dose_unit           VARCHAR(50),
    application_method  VARCHAR(100),
    applications_planned INT DEFAULT 1,
    applications_done   INT DEFAULT 0,

    -- Economía
    unit_cost           NUMERIC(18,4),
    total_cost          NUMERIC(18,2),

    -- Orden visual
    sort_order          INT DEFAULT 0,

    -- Auditoría
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

COMMENT ON TABLE public.fertilization_plan_items IS
  'Insumos programados dentro del plan de fertilización.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TABLA: fertilization_applications
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fertilization_applications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id             UUID NOT NULL REFERENCES public.fertilization_plans(id) ON DELETE CASCADE,
    company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    plan_item_id        UUID REFERENCES public.fertilization_plan_items(id) ON DELETE SET NULL,

    -- Identificación
    application_number  INT,
    product_name        VARCHAR(300),
    product_formula     VARCHAR(200),

    -- Programación
    scheduled_date      DATE,
    completed_date      DATE,
    status              public.fert_application_status NOT NULL DEFAULT 'pending',

    -- Dosis aplicada (puede diferir de la planificada)
    dose_applied        NUMERIC(10,4),
    dose_unit           VARCHAR(50),

    -- Ejecución
    completed_by        TEXT,  -- user_id
    completion_note     TEXT,

    -- Auditoría
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

COMMENT ON TABLE public.fertilization_applications IS
  'Cronograma de aplicaciones del plan. Cada fila es una aplicación individual '
  '(puede ser de varios productos según el plan_item_id).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. TABLA: fertilization_observations
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fertilization_observations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id             UUID NOT NULL REFERENCES public.fertilization_plans(id) ON DELETE CASCADE,
    company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    application_id      UUID REFERENCES public.fertilization_applications(id) ON DELETE SET NULL,

    -- Tipo y contenido
    observation_type    public.fert_observation_type NOT NULL DEFAULT 'note',
    title               VARCHAR(200),
    content             TEXT NOT NULL,

    -- Autor
    author_user_id      TEXT,
    author_name         VARCHAR(200),

    -- Alerta
    is_alert            BOOLEAN DEFAULT FALSE,
    severity            public.fert_severity,
    affected_percent    NUMERIC(5,2),

    -- Localización
    sector              VARCHAR(200),
    observed_at         TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),

    -- Metadata (lat/lng, notas adicionales, etc.)
    metadata            JSONB DEFAULT '{}',

    -- Auditoría
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

COMMENT ON TABLE public.fertilization_observations IS
  'Observaciones de campo registradas durante la ejecución del plan de fertilización.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. TABLA: fertilization_observation_comments
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fertilization_observation_comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id  UUID NOT NULL REFERENCES public.fertilization_observations(id) ON DELETE CASCADE,
    company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    author_user_id  TEXT,
    author_name     VARCHAR(200),
    content         TEXT NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

COMMENT ON TABLE public.fertilization_observation_comments IS
  'Comentarios anidados en observaciones de fertilización.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. TABLA: fertilization_observation_attachments
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fertilization_observation_attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id  UUID NOT NULL REFERENCES public.fertilization_observations(id) ON DELETE CASCADE,
    company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    file_path       TEXT NOT NULL,  -- path en Supabase Storage
    file_name       VARCHAR(500),
    mime_type       VARCHAR(100),
    size_bytes      BIGINT,
    uploaded_by     TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

COMMENT ON TABLE public.fertilization_observation_attachments IS
  'Archivos adjuntos de observaciones. file_path referencia a Supabase Storage.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. TABLA: fertilization_observation_nutrients
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fertilization_observation_nutrients (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id      UUID NOT NULL REFERENCES public.fertilization_observations(id) ON DELETE CASCADE,
    company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    element_code        VARCHAR(20)  NOT NULL,  -- N, P, K, Ca, Mg, S, etc.
    element_name        VARCHAR(100),
    value               NUMERIC(10,4) NOT NULL,
    unit                VARCHAR(20)   DEFAULT '%',
    status              public.fert_nutrient_status,
    target_min          NUMERIC(10,4),
    target_max          NUMERIC(10,4),
    lab_report_code     VARCHAR(100),
    sample_date         DATE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

COMMENT ON TABLE public.fertilization_observation_nutrients IS
  'Resultados de análisis nutricional (foliar, suelo) ligados a una observación.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. TABLA: fertilization_alerts
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fertilization_alerts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id             UUID NOT NULL REFERENCES public.fertilization_plans(id) ON DELETE CASCADE,
    company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    observation_id      UUID REFERENCES public.fertilization_observations(id) ON DELETE SET NULL,
    title               VARCHAR(300) NOT NULL,
    description         TEXT,
    severity            public.fert_alert_severity NOT NULL DEFAULT 'medium',
    is_resolved         BOOLEAN DEFAULT FALSE,
    resolved_at         TIMESTAMP WITH TIME ZONE,
    resolved_by         TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

COMMENT ON TABLE public.fertilization_alerts IS
  'Alertas activas del plan generadas cuando una observación se marca como is_alert=true.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. TABLA: fertilization_field_conditions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fertilization_field_conditions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id             UUID NOT NULL REFERENCES public.fertilization_plans(id) ON DELETE CASCADE,
    company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    recorded_at         TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    temperature_c       NUMERIC(5,2),
    humidity_pct        NUMERIC(5,2),
    wind_speed_kmh      NUMERIC(6,2),
    wind_direction      VARCHAR(50),
    precipitation_mm    NUMERIC(8,2),
    soil_moisture_pct   NUMERIC(5,2),
    soil_ph             NUMERIC(4,2),
    location_label      VARCHAR(200),
    source              VARCHAR(100) DEFAULT 'manual',  -- manual, weather_api, sensor
    notes               TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

COMMENT ON TABLE public.fertilization_field_conditions IS
  'Condiciones actuales del lote registradas para el plan de fertilización.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. ÍNDICES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fert_plans_company       ON public.fertilization_plans(company_id);
CREATE INDEX IF NOT EXISTS idx_fert_plans_lote          ON public.fertilization_plans(lote_id);
CREATE INDEX IF NOT EXISTS idx_fert_plans_status        ON public.fertilization_plans(status);
CREATE INDEX IF NOT EXISTS idx_fert_plan_items_plan     ON public.fertilization_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_fert_applications_plan   ON public.fertilization_applications(plan_id);
CREATE INDEX IF NOT EXISTS idx_fert_applications_status ON public.fertilization_applications(status);
CREATE INDEX IF NOT EXISTS idx_fert_observations_plan   ON public.fertilization_observations(plan_id);
CREATE INDEX IF NOT EXISTS idx_fert_observations_alert  ON public.fertilization_observations(is_alert) WHERE is_alert = true;
CREATE INDEX IF NOT EXISTS idx_fert_alerts_plan         ON public.fertilization_alerts(plan_id) WHERE is_resolved = false;
CREATE INDEX IF NOT EXISTS idx_fert_nutrients_obs       ON public.fertilization_observation_nutrients(observation_id);
CREATE INDEX IF NOT EXISTS idx_fert_attachments_obs     ON public.fertilization_observation_attachments(observation_id);
CREATE INDEX IF NOT EXISTS idx_fert_field_plan          ON public.fertilization_field_conditions(plan_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.fertilization_plans                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilization_plan_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilization_applications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilization_observations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilization_observation_comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilization_observation_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilization_observation_nutrients   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilization_alerts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilization_field_conditions        ENABLE ROW LEVEL SECURITY;

-- Helper: permiso básico de fertilización (usa current_company() de 021_rls.sql)
CREATE OR REPLACE FUNCTION public.fert_owns_company(p_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_company_id = public.current_company();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Políticas para fertilization_plans
CREATE POLICY "fert_plans_select" ON public.fertilization_plans
  FOR SELECT USING (public.fert_owns_company(company_id));
CREATE POLICY "fert_plans_insert" ON public.fertilization_plans
  FOR INSERT WITH CHECK (public.fert_owns_company(company_id));
CREATE POLICY "fert_plans_update" ON public.fertilization_plans
  FOR UPDATE USING (public.fert_owns_company(company_id));
CREATE POLICY "fert_plans_delete" ON public.fertilization_plans
  FOR DELETE USING (public.fert_owns_company(company_id));

-- Políticas para fertilization_plan_items
CREATE POLICY "fert_items_select" ON public.fertilization_plan_items
  FOR SELECT USING (public.fert_owns_company(company_id));
CREATE POLICY "fert_items_insert" ON public.fertilization_plan_items
  FOR INSERT WITH CHECK (public.fert_owns_company(company_id));
CREATE POLICY "fert_items_update" ON public.fertilization_plan_items
  FOR UPDATE USING (public.fert_owns_company(company_id));
CREATE POLICY "fert_items_delete" ON public.fertilization_plan_items
  FOR DELETE USING (public.fert_owns_company(company_id));

-- Políticas para fertilization_applications
CREATE POLICY "fert_apps_select" ON public.fertilization_applications
  FOR SELECT USING (public.fert_owns_company(company_id));
CREATE POLICY "fert_apps_insert" ON public.fertilization_applications
  FOR INSERT WITH CHECK (public.fert_owns_company(company_id));
CREATE POLICY "fert_apps_update" ON public.fertilization_applications
  FOR UPDATE USING (public.fert_owns_company(company_id));

-- Políticas para fertilization_observations
CREATE POLICY "fert_obs_select" ON public.fertilization_observations
  FOR SELECT USING (public.fert_owns_company(company_id));
CREATE POLICY "fert_obs_insert" ON public.fertilization_observations
  FOR INSERT WITH CHECK (public.fert_owns_company(company_id));
CREATE POLICY "fert_obs_update" ON public.fertilization_observations
  FOR UPDATE USING (public.fert_owns_company(company_id));

-- Políticas para fertilization_observation_comments
CREATE POLICY "fert_comments_select" ON public.fertilization_observation_comments
  FOR SELECT USING (public.fert_owns_company(company_id));
CREATE POLICY "fert_comments_insert" ON public.fertilization_observation_comments
  FOR INSERT WITH CHECK (public.fert_owns_company(company_id));

-- Políticas para fertilization_observation_attachments
CREATE POLICY "fert_attach_select" ON public.fertilization_observation_attachments
  FOR SELECT USING (public.fert_owns_company(company_id));
CREATE POLICY "fert_attach_insert" ON public.fertilization_observation_attachments
  FOR INSERT WITH CHECK (public.fert_owns_company(company_id));
CREATE POLICY "fert_attach_delete" ON public.fertilization_observation_attachments
  FOR DELETE USING (public.fert_owns_company(company_id));

-- Políticas para fertilization_observation_nutrients
CREATE POLICY "fert_nutrients_select" ON public.fertilization_observation_nutrients
  FOR SELECT USING (public.fert_owns_company(company_id));
CREATE POLICY "fert_nutrients_insert" ON public.fertilization_observation_nutrients
  FOR INSERT WITH CHECK (public.fert_owns_company(company_id));

-- Políticas para fertilization_alerts
CREATE POLICY "fert_alerts_select" ON public.fertilization_alerts
  FOR SELECT USING (public.fert_owns_company(company_id));
CREATE POLICY "fert_alerts_insert" ON public.fertilization_alerts
  FOR INSERT WITH CHECK (public.fert_owns_company(company_id));
CREATE POLICY "fert_alerts_update" ON public.fertilization_alerts
  FOR UPDATE USING (public.fert_owns_company(company_id));

-- Políticas para fertilization_field_conditions
CREATE POLICY "fert_field_select" ON public.fertilization_field_conditions
  FOR SELECT USING (public.fert_owns_company(company_id));
CREATE POLICY "fert_field_insert" ON public.fertilization_field_conditions
  FOR INSERT WITH CHECK (public.fert_owns_company(company_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. STORAGE BUCKET (si no existe)
-- ─────────────────────────────────────────────────────────────────────────────
-- Nota: Ejecutar manualmente en Supabase Storage si el bucket no existe:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('fertilization-attachments', 'fertilization-attachments', false)
-- ON CONFLICT (id) DO NOTHING;

-- Política de Storage (ejecutar como superuser en el dashboard de Supabase si aplica)
-- CREATE POLICY "fert_storage_select" ON storage.objects
--   FOR SELECT USING (bucket_id = 'fertilization-attachments' AND
--     (storage.foldername(name))[1] = public.current_company()::text);
-- CREATE POLICY "fert_storage_insert" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'fertilization-attachments' AND
--     (storage.foldername(name))[1] = public.current_company()::text);

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. FUNCIÓN RPC: fertilization_get_plan_detail
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fertilization_get_plan_detail(p_plan_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_plan          JSONB;
  v_items         JSONB;
  v_applications  JSONB;
  v_observations  JSONB;
  v_alerts        JSONB;
  v_field         JSONB;
  v_next_app      JSONB;
  v_nutrition     JSONB;
BEGIN
  -- Plan principal
  SELECT to_jsonb(p) INTO v_plan
  FROM public.fertilization_plans p
  WHERE p.id = p_plan_id
    AND p.company_id = public.current_company();

  IF v_plan IS NULL THEN
    RETURN jsonb_build_object('error', 'Plan no encontrado o sin acceso');
  END IF;

  -- Items del plan
  SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.sort_order, i.created_at), '[]'::jsonb)
  INTO v_items
  FROM public.fertilization_plan_items i
  WHERE i.plan_id = p_plan_id;

  -- Aplicaciones
  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.scheduled_date, a.application_number), '[]'::jsonb)
  INTO v_applications
  FROM public.fertilization_applications a
  WHERE a.plan_id = p_plan_id;

  -- Próxima aplicación pendiente
  SELECT to_jsonb(a) INTO v_next_app
  FROM public.fertilization_applications a
  WHERE a.plan_id = p_plan_id
    AND a.status = 'pending'
    AND a.scheduled_date >= CURRENT_DATE
  ORDER BY a.scheduled_date
  LIMIT 1;

  -- Observaciones con comentarios, adjuntos y nutrientes
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',               o.id,
        'plan_id',          o.plan_id,
        'application_id',   o.application_id,
        'observation_type', o.observation_type,
        'title',            o.title,
        'content',          o.content,
        'author_user_id',   o.author_user_id,
        'author_name',      o.author_name,
        'is_alert',         o.is_alert,
        'severity',         o.severity,
        'affected_percent', o.affected_percent,
        'sector',           o.sector,
        'observed_at',      o.observed_at,
        'metadata',         o.metadata,
        'created_at',       o.created_at,
        'comments', (
          SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.created_at), '[]'::jsonb)
          FROM public.fertilization_observation_comments c
          WHERE c.observation_id = o.id
        ),
        'attachments', (
          SELECT COALESCE(jsonb_agg(to_jsonb(att) ORDER BY att.created_at), '[]'::jsonb)
          FROM public.fertilization_observation_attachments att
          WHERE att.observation_id = o.id
        ),
        'nutrients', (
          SELECT COALESCE(jsonb_agg(to_jsonb(n) ORDER BY n.element_code), '[]'::jsonb)
          FROM public.fertilization_observation_nutrients n
          WHERE n.observation_id = o.id
        )
      )
      ORDER BY o.observed_at DESC, o.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_observations
  FROM public.fertilization_observations o
  WHERE o.plan_id = p_plan_id;

  -- Alertas activas
  SELECT COALESCE(jsonb_agg(to_jsonb(al) ORDER BY al.severity DESC, al.created_at DESC), '[]'::jsonb)
  INTO v_alerts
  FROM public.fertilization_alerts al
  WHERE al.plan_id = p_plan_id
    AND al.is_resolved = false;

  -- Condiciones del campo (la más reciente)
  SELECT to_jsonb(fc) INTO v_field
  FROM public.fertilization_field_conditions fc
  WHERE fc.plan_id = p_plan_id
  ORDER BY fc.recorded_at DESC
  LIMIT 1;

  -- Estado nutricional: último análisis foliar del plan
  SELECT COALESCE(
    jsonb_agg(to_jsonb(n) ORDER BY n.element_code),
    '[]'::jsonb
  ) INTO v_nutrition
  FROM public.fertilization_observation_nutrients n
  WHERE n.observation_id = (
    SELECT o.id FROM public.fertilization_observations o
    WHERE o.plan_id = p_plan_id
      AND o.observation_type = 'foliar_analysis'
    ORDER BY o.observed_at DESC LIMIT 1
  );

  RETURN jsonb_build_object(
    'plan',         v_plan,
    'items',        v_items,
    'applications', v_applications,
    'nextApp',      v_next_app,
    'observations', v_observations,
    'alerts',       v_alerts,
    'fieldCondition', v_field,
    'nutrition',    v_nutrition
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.fertilization_get_plan_detail IS
  'Retorna el detalle completo del plan de fertilización incluyendo items, aplicaciones, '
  'observaciones (con comentarios, adjuntos y nutrientes), alertas y condiciones del campo.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. FUNCIÓN RPC: fertilization_save_observation
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fertilization_save_observation(
  p_plan_id           UUID,
  p_company_id        UUID,
  p_observation_id    UUID DEFAULT NULL,  -- si es NULL, crea nueva
  p_application_id    UUID DEFAULT NULL,
  p_type              TEXT DEFAULT 'note',
  p_title             TEXT DEFAULT NULL,
  p_content           TEXT DEFAULT '',
  p_author_user_id    TEXT DEFAULT NULL,
  p_author_name       TEXT DEFAULT NULL,
  p_is_alert          BOOLEAN DEFAULT FALSE,
  p_severity          TEXT DEFAULT NULL,
  p_affected_percent  NUMERIC DEFAULT NULL,
  p_sector            TEXT DEFAULT NULL,
  p_observed_at       TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_metadata          JSONB DEFAULT '{}',
  p_attachments       JSONB DEFAULT '[]',
  p_nutrients         JSONB DEFAULT '[]'
)
RETURNS JSONB AS $$
DECLARE
  v_obs_id    UUID;
  v_att       JSONB;
  v_nut       JSONB;
BEGIN
  -- Verificar que el plan pertenece a la empresa
  IF NOT EXISTS (
    SELECT 1 FROM public.fertilization_plans
    WHERE id = p_plan_id AND company_id = p_company_id
  ) THEN
    RETURN jsonb_build_object('error', 'Plan no encontrado o sin acceso');
  END IF;

  -- Upsert de la observación
  IF p_observation_id IS NOT NULL THEN
    UPDATE public.fertilization_observations SET
      application_id   = COALESCE(p_application_id, application_id),
      observation_type = p_type::public.fert_observation_type,
      title            = p_title,
      content          = p_content,
      is_alert         = p_is_alert,
      severity         = CASE WHEN p_severity IS NOT NULL THEN p_severity::public.fert_severity ELSE NULL END,
      affected_percent = p_affected_percent,
      sector           = p_sector,
      observed_at      = COALESCE(p_observed_at, observed_at),
      metadata         = COALESCE(p_metadata, '{}'),
      updated_at       = timezone('utc', now())
    WHERE id = p_observation_id AND company_id = p_company_id
    RETURNING id INTO v_obs_id;
  ELSE
    INSERT INTO public.fertilization_observations (
      plan_id, company_id, application_id, observation_type, title, content,
      author_user_id, author_name, is_alert, severity, affected_percent,
      sector, observed_at, metadata
    ) VALUES (
      p_plan_id, p_company_id, p_application_id,
      p_type::public.fert_observation_type, p_title, p_content,
      p_author_user_id, p_author_name, p_is_alert,
      CASE WHEN p_severity IS NOT NULL THEN p_severity::public.fert_severity ELSE NULL END,
      p_affected_percent, p_sector,
      COALESCE(p_observed_at, timezone('utc', now())),
      COALESCE(p_metadata, '{}')
    ) RETURNING id INTO v_obs_id;
  END IF;

  -- Insertar adjuntos (solo en creación nueva — no se borran en edición)
  IF p_observation_id IS NULL AND jsonb_array_length(p_attachments) > 0 THEN
    INSERT INTO public.fertilization_observation_attachments
      (observation_id, company_id, file_path, file_name, mime_type, size_bytes, uploaded_by)
    SELECT
      v_obs_id, p_company_id,
      (att->>'filePath'), (att->>'fileName'),
      (att->>'mimeType'), (att->>'sizeBytes')::BIGINT,
      p_author_user_id
    FROM jsonb_array_elements(p_attachments) AS att;
  END IF;

  -- Insertar nutrientes
  IF jsonb_array_length(p_nutrients) > 0 THEN
    -- En edición, eliminar los anteriores y reemplazar
    DELETE FROM public.fertilization_observation_nutrients WHERE observation_id = v_obs_id;
    INSERT INTO public.fertilization_observation_nutrients
      (observation_id, company_id, element_code, element_name, value, unit, status, target_min, target_max, lab_report_code, sample_date)
    SELECT
      v_obs_id, p_company_id,
      (n->>'elementCode'), (n->>'elementName'),
      (n->>'value')::NUMERIC, COALESCE(n->>'unit', '%'),
      CASE WHEN n->>'status' IS NOT NULL THEN (n->>'status')::public.fert_nutrient_status ELSE NULL END,
      (n->>'targetMin')::NUMERIC, (n->>'targetMax')::NUMERIC,
      (n->>'labReportCode'),
      CASE WHEN n->>'sampleDate' IS NOT NULL THEN (n->>'sampleDate')::DATE ELSE NULL END
    FROM jsonb_array_elements(p_nutrients) AS n;
  END IF;

  -- Si es alerta, crear/actualizar alerta
  IF p_is_alert THEN
    INSERT INTO public.fertilization_alerts (plan_id, company_id, observation_id, title, description, severity)
    VALUES (
      p_plan_id, p_company_id, v_obs_id,
      COALESCE(p_title, 'Alerta desde observación'),
      LEFT(p_content, 500),
      CASE WHEN p_severity IS NOT NULL THEN p_severity::public.fert_alert_severity ELSE 'medium' END
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Actualizar contador de observaciones en el plan
  UPDATE public.fertilization_plans SET
    observations_total = (
      SELECT COUNT(*) FROM public.fertilization_observations WHERE plan_id = p_plan_id
    ),
    alerts_active = (
      SELECT COUNT(*) FROM public.fertilization_alerts WHERE plan_id = p_plan_id AND is_resolved = false
    ),
    attachments_total = (
      SELECT COUNT(*) FROM public.fertilization_observation_attachments oa
      JOIN public.fertilization_observations obs ON obs.id = oa.observation_id
      WHERE obs.plan_id = p_plan_id
    ),
    updated_at = timezone('utc', now())
  WHERE id = p_plan_id;

  RETURN jsonb_build_object('observation_id', v_obs_id, 'status', 'OK');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.fertilization_save_observation IS
  'Crea o actualiza una observación con adjuntos y nutrientes. '
  'Si is_alert=true, genera automáticamente una alerta activa en el plan.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. FUNCIÓN RPC: fertilization_complete_application
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fertilization_complete_application(
  p_application_id    UUID,
  p_company_id        UUID,
  p_completion_note   TEXT DEFAULT NULL,
  p_completed_by      TEXT DEFAULT NULL,
  p_dose_applied      NUMERIC DEFAULT NULL,
  p_dose_unit         TEXT DEFAULT NULL,
  p_completed_date    DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- Verificar pertenencia
  SELECT plan_id INTO v_plan_id
  FROM public.fertilization_applications
  WHERE id = p_application_id AND company_id = p_company_id;

  IF v_plan_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Aplicación no encontrada o sin acceso');
  END IF;

  -- Marcar como completada
  UPDATE public.fertilization_applications SET
    status           = 'completed',
    completed_date   = COALESCE(p_completed_date, CURRENT_DATE),
    completed_by     = p_completed_by,
    completion_note  = p_completion_note,
    dose_applied     = COALESCE(p_dose_applied, dose_applied),
    dose_unit        = COALESCE(p_dose_unit, dose_unit),
    updated_at       = timezone('utc', now())
  WHERE id = p_application_id;

  -- Recalcular métricas del plan
  UPDATE public.fertilization_plans SET
    applications_completed = (
      SELECT COUNT(*) FROM public.fertilization_applications
      WHERE plan_id = v_plan_id AND status = 'completed'
    ),
    progress_pct = (
      SELECT ROUND(
        COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC /
        NULLIF(COUNT(*), 0) * 100,
        2
      )
      FROM public.fertilization_applications WHERE plan_id = v_plan_id
    ),
    updated_at = timezone('utc', now())
  WHERE id = v_plan_id;

  RETURN jsonb_build_object('application_id', p_application_id, 'status', 'completed', 'plan_id', v_plan_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.fertilization_complete_application IS
  'Marca una aplicación como completada y recalcula el progreso del plan.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. FUNCIÓN RPC: fertilization_save_plan
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fertilization_save_plan(
  p_company_id        UUID,
  p_plan_id           UUID DEFAULT NULL,
  p_lote_id           UUID DEFAULT NULL,
  p_code              TEXT DEFAULT NULL,
  p_name              TEXT DEFAULT NULL,
  p_version           TEXT DEFAULT 'v1.0',
  p_status            TEXT DEFAULT 'draft',
  p_validity_status   TEXT DEFAULT 'scheduled',
  p_start_date        DATE DEFAULT NULL,
  p_end_date          DATE DEFAULT NULL,
  p_period_label      TEXT DEFAULT NULL,
  p_budget_total      NUMERIC DEFAULT 0,
  p_responsible_name  TEXT DEFAULT NULL,
  p_responsible_user  TEXT DEFAULT NULL,
  p_notes             TEXT DEFAULT NULL,
  p_metadata          JSONB DEFAULT '{}',
  -- Snapshot del lote (desnormalizado para historial)
  p_crop_name         TEXT DEFAULT NULL,
  p_crop_scientific   TEXT DEFAULT NULL,
  p_lot_name          TEXT DEFAULT NULL,
  p_sector_name       TEXT DEFAULT NULL,
  p_farm_name         TEXT DEFAULT NULL,
  p_area_ha           NUMERIC DEFAULT NULL,
  p_soil_type         TEXT DEFAULT NULL,
  p_density           TEXT DEFAULT NULL,
  p_phenological_stage TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  IF p_plan_id IS NOT NULL THEN
    -- Actualizar plan existente
    UPDATE public.fertilization_plans SET
      lote_id              = COALESCE(p_lote_id, lote_id),
      name                 = COALESCE(p_name, name),
      status               = COALESCE(p_status::public.fert_plan_status, status),
      validity_status      = COALESCE(p_validity_status::public.fert_validity_status, validity_status),
      start_date           = COALESCE(p_start_date, start_date),
      end_date             = COALESCE(p_end_date, end_date),
      period_label         = COALESCE(p_period_label, period_label),
      budget_total         = COALESCE(p_budget_total, budget_total),
      responsible_name     = COALESCE(p_responsible_name, responsible_name),
      responsible_user_id  = COALESCE(p_responsible_user, responsible_user_id),
      notes                = COALESCE(p_notes, notes),
      metadata             = COALESCE(p_metadata, metadata),
      phenological_stage   = COALESCE(p_phenological_stage, phenological_stage),
      updated_at           = timezone('utc', now())
    WHERE id = p_plan_id AND company_id = p_company_id
    RETURNING id INTO v_plan_id;
  ELSE
    -- Crear nuevo plan
    INSERT INTO public.fertilization_plans (
      company_id, lote_id, code, name, version, status, validity_status,
      start_date, end_date, period_label, budget_total,
      responsible_name, responsible_user_id, notes, metadata,
      crop_name, crop_scientific, lot_name, sector_name, farm_name,
      area_ha, soil_type, density, phenological_stage
    ) VALUES (
      p_company_id, p_lote_id,
      COALESCE(p_code, 'PF-' || to_char(now(), 'YYYY-MMDD-') || substring(gen_random_uuid()::text, 1, 4)),
      p_name, p_version,
      p_status::public.fert_plan_status,
      p_validity_status::public.fert_validity_status,
      p_start_date, p_end_date, p_period_label, p_budget_total,
      p_responsible_name, p_responsible_user, p_notes,
      COALESCE(p_metadata, '{}'),
      p_crop_name, p_crop_scientific, p_lot_name, p_sector_name, p_farm_name,
      p_area_ha, p_soil_type, p_density, p_phenological_stage
    ) RETURNING id INTO v_plan_id;
  END IF;

  IF v_plan_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Error guardando el plan');
  END IF;

  RETURN jsonb_build_object('plan_id', v_plan_id, 'status', 'OK');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.fertilization_save_plan IS
  'Crea o actualiza un plan de fertilización. Genera código automático si no se provee.';
