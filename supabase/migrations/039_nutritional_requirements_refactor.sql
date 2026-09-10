-- ==============================================================================
-- SKYCROP DATABASE: 039_nutritional_requirements_refactor.sql
-- Descripción: Refactor del motor de fertilización — separación agronómica
--   Necesidad nutricional → Oferta suelo → Déficit → Ajuste → Fertilización → Dosis
--
-- Cambios:
--   1. Extiende fert_calc_requirements con dimensiones paramétricas:
--      variedad, sistema productivo, rango de meta de rendimiento, unidad,
--      distribución %, fuente bibliográfica, versión
--   2. Crea fert_calc_requirement_sources (bibliografía detallada)
--   3. Crea fert_calc_requirement_distributions (distribución por aplicación/etapa)
--   4. Índices + RLS + seeds de ejemplo (estructura, no valores agronómicos reales)
--   5. Vista fert_calc_requirements_enriched para consumo del frontend
--
-- Estrategia: Zero-Downtime — solo ADD COLUMN IF NOT EXISTS y CREATE IF NOT EXISTS
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EXTENDER fert_calc_requirements
-- ─────────────────────────────────────────────────────────────────────────────

-- Variedad del cultivo (ej: CCN-51, ICS-95). NULL = aplica a todas las variedades
ALTER TABLE public.fert_calc_requirements
  ADD COLUMN IF NOT EXISTS variety              VARCHAR(100);

-- Sistema productivo paramétrico
ALTER TABLE public.fert_calc_requirements
  ADD COLUMN IF NOT EXISTS production_system   VARCHAR(30)
    CHECK (production_system IS NULL OR production_system IN (
      'convencional','organico','semiorganico','agroecologico',
      'conventional','organic','semi_organic','agroecological'
    ));

-- Rango de meta de rendimiento al que aplica el requerimiento
ALTER TABLE public.fert_calc_requirements
  ADD COLUMN IF NOT EXISTS yield_min_t_ha      DECIMAL(10,4);
ALTER TABLE public.fert_calc_requirements
  ADD COLUMN IF NOT EXISTS yield_max_t_ha      DECIMAL(10,4);
ALTER TABLE public.fert_calc_requirements
  ADD COLUMN IF NOT EXISTS yield_target_unit   VARCHAR(10) DEFAULT 't/ha';

-- Unidad canónica del requerimiento (kg/ha para macro, g/ha para micro)
ALTER TABLE public.fert_calc_requirements
  ADD COLUMN IF NOT EXISTS unit                VARCHAR(20) DEFAULT 'kg/ha';

-- Distribución del requerimiento dentro del ciclo (% que se aplica en esta etapa)
ALTER TABLE public.fert_calc_requirements
  ADD COLUMN IF NOT EXISTS distribution_pct    DECIMAL(5,2)
    CHECK (distribution_pct IS NULL OR (distribution_pct >= 0 AND distribution_pct <= 100));

-- Campos de trazabilidad científica
ALTER TABLE public.fert_calc_requirements
  ADD COLUMN IF NOT EXISTS source_author       VARCHAR(300);
ALTER TABLE public.fert_calc_requirements
  ADD COLUMN IF NOT EXISTS source_year         INTEGER;
ALTER TABLE public.fert_calc_requirements
  ADD COLUMN IF NOT EXISTS source_document     VARCHAR(500);
ALTER TABLE public.fert_calc_requirements
  ADD COLUMN IF NOT EXISTS source_page         VARCHAR(100);
ALTER TABLE public.fert_calc_requirements
  ADD COLUMN IF NOT EXISTS observations        TEXT;

ALTER TABLE public.fert_calc_requirements
  ADD COLUMN IF NOT EXISTS version             VARCHAR(20) DEFAULT '1.0.0';

-- Flag de activo (mantener compatibilidad con status)
ALTER TABLE public.fert_calc_requirements
  ADD COLUMN IF NOT EXISTS is_active           BOOLEAN DEFAULT true;

-- Metadatos extensibles (por si se quiere guardar extracción por tonelada, eficiencia, etc.)
ALTER TABLE public.fert_calc_requirements
  ADD COLUMN IF NOT EXISTS metadata            JSONB DEFAULT '{}';

-- ─────────────────────────────────────────────────────────────────────────────
-- Sincronizar is_active con status para filas existentes
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.fert_calc_requirements
SET is_active = (status = 'active')
WHERE is_active IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABLA fert_calc_requirement_sources — Bibliografía detallada
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fert_calc_requirement_sources (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id      UUID REFERENCES public.fert_calc_requirements(id) ON DELETE CASCADE,
  -- Agrupación lógica: puede referenciar un conjunto (crop+stage) sin requirement puntual
  crop_id             UUID REFERENCES public.fert_calc_crops(id) ON DELETE CASCADE,
  stage_id            UUID REFERENCES public.fert_calc_phenological_stages(id) ON DELETE SET NULL,
  company_id          UUID REFERENCES public.companies(id) ON DELETE CASCADE,

  methodology         VARCHAR(30) CHECK (methodology IN ('extraction','stage_fixed','stage_yield','balance','dris','custom')),
  source_type         VARCHAR(30) DEFAULT 'bibliographic' CHECK (source_type IN ('bibliographic','field_trial','lab','expert','custom')),
  author              VARCHAR(500),
  year                INTEGER,
  document            VARCHAR(500),
  page                VARCHAR(100),
  doi                 VARCHAR(300),
  url                 TEXT,
  observations        TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABLA fert_calc_requirement_distributions — Distribución por aplicación
-- Permite expresar: requerimiento anual 240 kg K2O → Aplicación1 30% (72), Aplicación2 40% (96), etc.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fert_calc_requirement_distributions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  crop_id             UUID NOT NULL REFERENCES public.fert_calc_crops(id) ON DELETE CASCADE,
  stage_id            UUID REFERENCES public.fert_calc_phenological_stages(id) ON DELETE CASCADE,
  -- si stage_id NULL, la distribución aplica al ciclo completo
  production_system   VARCHAR(30),
  variety             VARCHAR(100),
  yield_min_t_ha      DECIMAL(10,4),
  yield_max_t_ha      DECIMAL(10,4),
  application_label   VARCHAR(100) NOT NULL, -- ej: 'Aplicación 1', 'Establecimiento', 'Floración'
  application_order   INTEGER NOT NULL DEFAULT 1,
  pct                 DECIMAL(5,2) NOT NULL CHECK (pct >= 0 AND pct <= 100),
  notes               TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Índice único con COALESCE (Postgres no permite expresiones en UNIQUE constraint, solo en índice)
CREATE UNIQUE INDEX IF NOT EXISTS ux_fert_calc_dist_unique
  ON public.fert_calc_requirement_distributions (
    crop_id,
    COALESCE(stage_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(company_id, '00000000-0000-0000-0000-000000000001'::uuid),
    application_order
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ÍNDICES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fert_req_variety          ON public.fert_calc_requirements(variety) WHERE variety IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fert_req_production       ON public.fert_calc_requirements(production_system) WHERE production_system IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fert_req_yield            ON public.fert_calc_requirements(yield_min_t_ha, yield_max_t_ha);
CREATE INDEX IF NOT EXISTS idx_fert_req_dist_crop_stage  ON public.fert_calc_requirement_distributions(crop_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_fert_req_sources_crop     ON public.fert_calc_requirement_sources(crop_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_fert_req_sources_company  ON public.fert_calc_requirement_sources(company_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.fert_calc_requirement_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fert_calc_requirement_distributions ENABLE ROW LEVEL SECURITY;

-- Sources: lectura global + company
DO $$ BEGIN
  CREATE POLICY "fert_req_sources_select" ON public.fert_calc_requirement_sources
    FOR SELECT USING (
      company_id IS NULL OR
      company_id IN (SELECT company_id FROM public.company_users WHERE clerk_user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "fert_req_sources_insert" ON public.fert_calc_requirement_sources
    FOR INSERT WITH CHECK (
      company_id IS NULL OR
      company_id IN (SELECT company_id FROM public.company_users WHERE clerk_user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "fert_req_sources_update" ON public.fert_calc_requirement_sources
    FOR UPDATE USING (
      company_id IN (SELECT company_id FROM public.company_users WHERE clerk_user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Distributions: lectura global + company
DO $$ BEGIN
  CREATE POLICY "fert_req_dist_select" ON public.fert_calc_requirement_distributions
    FOR SELECT USING (
      company_id IS NULL OR
      company_id IN (SELECT company_id FROM public.company_users WHERE clerk_user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "fert_req_dist_insert" ON public.fert_calc_requirement_distributions
    FOR INSERT WITH CHECK (
      company_id IN (SELECT company_id FROM public.company_users WHERE clerk_user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. VISTA ENRIQUECIDA (para frontend Paso 2 — Requerimientos Nutricionales)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_fert_calc_requirements_enriched AS
SELECT
  r.id,
  r.crop_id,
  c.name AS crop_name,
  r.stage_id,
  s.name AS stage_name,
  r.nutrient_code,
  n.name AS nutrient_name,
  n.category AS nutrient_category,
  r.amount_kg_ha,
  r.min_amount_kg_ha,
  r.max_amount_kg_ha,
  r.reference_yield,
  r.yield_min_t_ha,
  r.yield_max_t_ha,
  r.yield_target_unit,
  r.variety,
  r.production_system,
  r.unit,
  r.distribution_pct,
  r.methodology,
  r.source,
  r.source_author,
  r.source_year,
  r.source_document,
  r.source_page,
  r.observations,
  r.version,
  r.status,
  r.is_active,
  r.company_id,
  r.metadata,
  r.created_at,
  r.updated_at
FROM public.fert_calc_requirements r
LEFT JOIN public.fert_calc_crops c ON c.id = r.crop_id
LEFT JOIN public.fert_calc_phenological_stages s ON s.id = r.stage_id
LEFT JOIN public.fert_calc_nutrients n ON n.code = r.nutrient_code;

COMMENT ON VIEW public.vw_fert_calc_requirements_enriched IS
  'Vista enriquecida de requerimientos con nombres de cultivo/etapa/nutriente para el Paso 2 del wizard.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. FUNCIÓN RPC: obtener requerimientos filtrados paramétricamente
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fert_calc_get_requirements(
  p_crop_id UUID,
  p_stage_id UUID DEFAULT NULL,
  p_production_system VARCHAR DEFAULT NULL,
  p_variety VARCHAR DEFAULT NULL,
  p_target_yield DECIMAL DEFAULT NULL
)
RETURNS TABLE (
  nutrient_code VARCHAR,
  amount_kg_ha DECIMAL,
  unit VARCHAR,
  distribution_pct DECIMAL,
  methodology VARCHAR,
  source TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.nutrient_code,
    -- Si hay yield referencia, escalar al target (si no, valor directo)
    CASE
      WHEN r.reference_yield IS NOT NULL AND r.reference_yield > 0 AND p_target_yield IS NOT NULL
      THEN (r.amount_kg_ha / r.reference_yield) * p_target_yield
      ELSE r.amount_kg_ha
    END AS amount_kg_ha,
    r.unit,
    r.distribution_pct,
    r.methodology,
    r.source
  FROM public.fert_calc_requirements r
  WHERE r.crop_id = p_crop_id
    AND (p_stage_id IS NULL OR r.stage_id = p_stage_id OR r.stage_id IS NULL)
    AND (p_production_system IS NULL OR r.production_system IS NULL OR r.production_system = p_production_system)
    AND (p_variety IS NULL OR r.variety IS NULL OR r.variety = p_variety)
    AND (p_target_yield IS NULL OR r.yield_min_t_ha IS NULL OR p_target_yield >= r.yield_min_t_ha)
    AND (p_target_yield IS NULL OR r.yield_max_t_ha IS NULL OR p_target_yield <= r.yield_max_t_ha)
    AND r.is_active = true
    AND r.status = 'active'
  ORDER BY r.nutrient_code;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.fert_calc_get_requirements IS
  'Obtiene requerimientos nutricionales escalados según cultivo, etapa, sistema productivo, variedad y meta de rendimiento.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. SEED ESTRUCTURAL DE EJEMPLO (valores ilustrativos, no recomendación agronómica)
-- Solo inserta si no existen — sirve para demostrar la estructura paramétrica
-- ─────────────────────────────────────────────────────────────────────────────
-- Ejemplo cacao distribución 30/40/30 (comentado para no introducir datos agronómicos reales)
-- INSERT INTO public.fert_calc_requirement_distributions (crop_id, application_label, application_order, pct)
-- VALUES
--   ('11111111-0000-0000-0000-000000000001', 'Aplicación 1', 1, 30.00),
--   ('11111111-0000-0000-0000-000000000001', 'Aplicación 2', 2, 40.00),
--   ('11111111-0000-0000-0000-000000000001', 'Aplicación 3', 3, 30.00)
-- ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIN 039
-- ==============================================================================
