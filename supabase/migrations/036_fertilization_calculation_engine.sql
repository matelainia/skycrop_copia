-- ==============================================================================
-- SKYCROP DATABASE: 036_fertilization_calculation_engine.sql
-- Descripción: Motor de Cálculo Determinístico de Fertilización
--
-- Prefijo de tablas: fert_calc_
-- Coexiste con las tablas fertilization_* del módulo de plan operacional (032)
--
-- Tablas creadas:
--   1. fert_calc_crops                    → Catálogo de cultivos
--   2. fert_calc_phenological_stages      → Etapas fenológicas
--   3. fert_calc_nutrients                → Catálogo de nutrientes
--   4. fert_calc_fertilizers              → Catálogo de fertilizantes
--   5. fert_calc_requirements             → Requerimientos nutricionales
--   6. fert_calc_rules                    → Reglas agronómicas
--   7. fert_calc_efficiency_factors       → Factores de eficiencia
--   8. fert_calc_soil_analyses            → Análisis de suelo
--   9. fert_calc_calculations             → Historial de cálculos
--   10. fert_calc_calculation_snapshots   → Snapshots inmutables
--
-- Estrategia: Zero-Downtime — solo crea tablas nuevas
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. fert_calc_crops — Catálogo de cultivos para el motor de cálculo
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fert_calc_crops (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(200) NOT NULL,
    scientific_name     VARCHAR(200),
    family              VARCHAR(100),
    description         TEXT,
    status              VARCHAR(20)  NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'inactive', 'draft')),
    metadata            JSONB        NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. fert_calc_phenological_stages — Etapas fenológicas por cultivo
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fert_calc_phenological_stages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_id             UUID NOT NULL REFERENCES public.fert_calc_crops(id) ON DELETE CASCADE,
    name                VARCHAR(200) NOT NULL,
    description         TEXT,
    stage_order         INTEGER      NOT NULL DEFAULT 1,
    duration_days       INTEGER,
    status              VARCHAR(20)  NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'inactive')),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. fert_calc_nutrients — Catálogo normalizado de nutrientes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fert_calc_nutrients (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                VARCHAR(20)  NOT NULL UNIQUE,  -- 'N', 'P2O5', 'K2O', etc.
    name                VARCHAR(200) NOT NULL,
    formula             VARCHAR(50),
    category            VARCHAR(30)  NOT NULL DEFAULT 'primary_macro'
                            CHECK (category IN ('primary_macro', 'secondary_macro', 'micro')),
    default_unit        VARCHAR(20)  NOT NULL DEFAULT 'mg/kg',
    molecular_weight    DECIMAL(8,4),
    conversion_factors  JSONB        NOT NULL DEFAULT '{}',  -- { "P2O5": 2.2914 }
    description         TEXT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. fert_calc_fertilizers — Catálogo de fertilizantes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fert_calc_fertilizers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    -- company_id NULL = fertilizante global (disponible para todas las empresas)
    commercial_name     VARCHAR(300) NOT NULL,
    manufacturer        VARCHAR(200),
    type                VARCHAR(30)  NOT NULL DEFAULT 'simple'
                            CHECK (type IN ('simple', 'compound', 'complex', 'organic', 'foliar', 'fertigation')),
    -- Composición: { "N": 46.0 } para Urea, { "N": 15, "P2O5": 15, "K2O": 15 } para NPK 15-15-15
    composition         JSONB        NOT NULL DEFAULT '{}',
    density             DECIMAL(8,4),          -- g/cm³ para líquidos
    commercial_unit     VARCHAR(20)  NOT NULL DEFAULT 'kg',
    min_dose_kg_ha      DECIMAL(10,4),
    max_dose_kg_ha      DECIMAL(10,4),
    price_per_kg        DECIMAL(12,4),
    currency            VARCHAR(10)  DEFAULT 'USD',
    status              VARCHAR(20)  NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'inactive')),
    metadata            JSONB        NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. fert_calc_requirements — Requerimientos nutricionales
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fert_calc_requirements (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    -- company_id NULL = requerimiento global (referencia de literatura)
    crop_id             UUID NOT NULL REFERENCES public.fert_calc_crops(id) ON DELETE CASCADE,
    stage_id            UUID REFERENCES public.fert_calc_phenological_stages(id) ON DELETE SET NULL,
    -- stage_id NULL = requerimiento del ciclo completo
    nutrient_code       VARCHAR(20) NOT NULL,  -- 'N', 'P2O5', etc.
    amount_kg_ha        DECIMAL(10,4) NOT NULL CHECK (amount_kg_ha >= 0),
    min_amount_kg_ha    DECIMAL(10,4),
    max_amount_kg_ha    DECIMAL(10,4),
    reference_yield     DECIMAL(10,4),         -- t/ha de referencia para escalar
    methodology         VARCHAR(30)  NOT NULL DEFAULT 'extraction'
                            CHECK (methodology IN ('extraction', 'stage_fixed', 'stage_yield', 'balance', 'dris')),
    source              TEXT,                  -- Referencia bibliográfica
    status              VARCHAR(20)  NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'inactive')),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. fert_calc_rules — Reglas agronómicas configurables
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fert_calc_rules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    -- company_id NULL = regla global SkyCrop
    user_id             TEXT,                  -- user_id del propietario si es regla de usuario
    name                VARCHAR(300) NOT NULL,
    description         TEXT,
    -- Condiciones: [{ "field": "soil_ph", "operator": "lt", "value": 5.5 }]
    conditions          JSONB        NOT NULL DEFAULT '[]',
    condition_logic     VARCHAR(3)   NOT NULL DEFAULT 'AND' CHECK (condition_logic IN ('AND', 'OR')),
    -- Acciones: [{ "type": "correction_factor", "target": "P2O5", "value": 1.3 }]
    actions             JSONB        NOT NULL DEFAULT '[]',
    priority            INTEGER      NOT NULL DEFAULT 1,  -- 1=global, 5=company, 10=user
    scope               VARCHAR(10)  NOT NULL DEFAULT 'global'
                            CHECK (scope IN ('global', 'company', 'user')),
    version             VARCHAR(20)  NOT NULL DEFAULT '1.0.0',
    status              VARCHAR(20)  NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'inactive', 'deprecated', 'draft')),
    crop_id             UUID REFERENCES public.fert_calc_crops(id) ON DELETE SET NULL,
    stage_id            UUID REFERENCES public.fert_calc_phenological_stages(id) ON DELETE SET NULL,
    nutrient_codes      TEXT[]       NOT NULL DEFAULT '{}',
    metadata            JSONB        NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. fert_calc_efficiency_factors — Factores de eficiencia configurables
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fert_calc_efficiency_factors (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    nutrient_code       VARCHAR(20) NOT NULL,
    application_method  VARCHAR(20) NOT NULL DEFAULT 'granular'
                            CHECK (application_method IN ('granular', 'liquid', 'foliar')),
    efficiency          DECIMAL(5,4) NOT NULL CHECK (efficiency > 0 AND efficiency <= 1),
    soil_texture        VARCHAR(20),  -- Si aplica solo para cierta textura
    ph_min              DECIMAL(4,2), -- Si aplica solo en rango de pH
    ph_max              DECIMAL(4,2),
    crop_id             UUID REFERENCES public.fert_calc_crops(id) ON DELETE SET NULL,
    source              TEXT,
    status              VARCHAR(20)  NOT NULL DEFAULT 'active',
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. fert_calc_soil_analyses — Análisis de suelo
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fert_calc_soil_analyses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    lote_id             UUID REFERENCES public.lotes(id) ON DELETE SET NULL,
    user_id             TEXT,
    ph                  DECIMAL(5,2) NOT NULL CHECK (ph >= 0 AND ph <= 14),
    organic_matter      DECIMAL(6,3),  -- %
    cec                 DECIMAL(8,4),  -- cmol/kg
    texture             VARCHAR(30),   -- sandy, loamy, clay, silty, sandy_loam, clay_loam
    -- Nutrientes: { "N": { "value": 2.5, "unit": "%" }, "P": { "value": 12, "unit": "mg/kg" } }
    nutrients           JSONB        NOT NULL DEFAULT '{}',
    lab_name            VARCHAR(200),
    report_code         VARCHAR(100),
    sample_date         DATE,
    report_date         DATE,
    metadata            JSONB        NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. fert_calc_calculations — Historial de cálculos ejecutados
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fert_calc_calculations (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id               TEXT,
    crop_id               UUID REFERENCES public.fert_calc_crops(id) ON DELETE SET NULL,
    stage_id              UUID REFERENCES public.fert_calc_phenological_stages(id) ON DELETE SET NULL,
    lot_id                UUID REFERENCES public.lotes(id) ON DELETE SET NULL,
    soil_analysis_id      UUID REFERENCES public.fert_calc_soil_analyses(id) ON DELETE SET NULL,
    target_yield_t_ha     DECIMAL(10,4),
    methodology           VARCHAR(30),
    calculation_version   VARCHAR(50) NOT NULL,
    status                VARCHAR(20) NOT NULL DEFAULT 'success'
                              CHECK (status IN ('success', 'partial', 'failed')),
    -- Resultado completo en JSON (para consulta rápida sin snapshot)
    result_json           JSONB,
    has_deficits          BOOLEAN NOT NULL DEFAULT false,
    has_surpluses         BOOLEAN NOT NULL DEFAULT false,
    warnings_count        INTEGER NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. fert_calc_calculation_snapshots — Snapshots inmutables
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fert_calc_calculation_snapshots (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_id        UUID NOT NULL REFERENCES public.fert_calc_calculations(id) ON DELETE CASCADE,
    -- Copia exacta de todos los parámetros usados en el cálculo
    snapshot_json         JSONB NOT NULL,  -- input + requirements + balance + doses
    rules_snapshot_json   JSONB NOT NULL DEFAULT '{}',  -- copia de reglas usadas
    engine_version        VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    calculation_version   VARCHAR(50) NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÍNDICES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_fert_calc_stages_crop      ON public.fert_calc_phenological_stages(crop_id);
CREATE INDEX IF NOT EXISTS idx_fert_calc_fertilizers_co   ON public.fert_calc_fertilizers(company_id);
CREATE INDEX IF NOT EXISTS idx_fert_calc_reqs_crop_stage  ON public.fert_calc_requirements(crop_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_fert_calc_rules_company    ON public.fert_calc_rules(company_id, status);
CREATE INDEX IF NOT EXISTS idx_fert_calc_rules_global     ON public.fert_calc_rules(status) WHERE company_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_fert_calc_soil_company     ON public.fert_calc_soil_analyses(company_id);
CREATE INDEX IF NOT EXISTS idx_fert_calc_soil_lote        ON public.fert_calc_soil_analyses(lote_id);
CREATE INDEX IF NOT EXISTS idx_fert_calc_calcs_company    ON public.fert_calc_calculations(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fert_calc_snap_calc        ON public.fert_calc_calculation_snapshots(calculation_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS (Row Level Security)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.fert_calc_crops              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fert_calc_phenological_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fert_calc_nutrients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fert_calc_fertilizers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fert_calc_requirements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fert_calc_rules              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fert_calc_efficiency_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fert_calc_soil_analyses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fert_calc_calculations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fert_calc_calculation_snapshots ENABLE ROW LEVEL SECURITY;

-- Políticas: lectura pública de catálogos globales + acceso de empresa a sus propios datos

-- Cultivos: lectura para todos los autenticados
CREATE POLICY "fert_calc_crops_select" ON public.fert_calc_crops
    FOR SELECT USING (true);

-- Etapas: lectura para todos los autenticados
CREATE POLICY "fert_calc_stages_select" ON public.fert_calc_phenological_stages
    FOR SELECT USING (true);

-- Nutrientes: lectura para todos
CREATE POLICY "fert_calc_nutrients_select" ON public.fert_calc_nutrients
    FOR SELECT USING (true);

-- Fertilizantes: globales (company_id NULL) + propios de la empresa
CREATE POLICY "fert_calc_fertilizers_select" ON public.fert_calc_fertilizers
    FOR SELECT USING (
        company_id IS NULL OR
        company_id IN (
            SELECT company_id FROM public.company_users
            WHERE clerk_user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
        )
    );

-- Requerimientos: globales + propios
CREATE POLICY "fert_calc_requirements_select" ON public.fert_calc_requirements
    FOR SELECT USING (
        company_id IS NULL OR
        company_id IN (
            SELECT company_id FROM public.company_users
            WHERE clerk_user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
        )
    );

-- Reglas: globales + propias de empresa
CREATE POLICY "fert_calc_rules_select" ON public.fert_calc_rules
    FOR SELECT USING (
        company_id IS NULL OR
        company_id IN (
            SELECT company_id FROM public.company_users
            WHERE clerk_user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
        )
    );

-- Eficiencias: globales + propias
CREATE POLICY "fert_calc_efficiency_select" ON public.fert_calc_efficiency_factors
    FOR SELECT USING (
        company_id IS NULL OR
        company_id IN (
            SELECT company_id FROM public.company_users
            WHERE clerk_user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
        )
    );

-- Análisis de suelo: solo la propia empresa
CREATE POLICY "fert_calc_soil_analyses_select" ON public.fert_calc_soil_analyses
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM public.company_users
            WHERE clerk_user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
        )
    );

CREATE POLICY "fert_calc_soil_analyses_insert" ON public.fert_calc_soil_analyses
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.company_users
            WHERE clerk_user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
        )
    );

-- Cálculos: solo la propia empresa
CREATE POLICY "fert_calc_calculations_select" ON public.fert_calc_calculations
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM public.company_users
            WHERE clerk_user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
        )
    );

-- Snapshots: solo si el cálculo pertenece a la empresa
CREATE POLICY "fert_calc_snapshots_select" ON public.fert_calc_calculation_snapshots
    FOR SELECT USING (
        calculation_id IN (
            SELECT id FROM public.fert_calc_calculations
            WHERE company_id IN (
                SELECT company_id FROM public.company_users
                WHERE clerk_user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
            )
        )
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- SEEDS — Datos de referencia iniciales
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Catálogo de nutrientes
INSERT INTO public.fert_calc_nutrients (code, name, formula, category, default_unit, conversion_factors) VALUES
    ('N',    'Nitrógeno',             'N',    'primary_macro',   'mg/kg',   '{}'),
    ('P2O5', 'Fósforo (P₂O₅)',        'P₂O₅', 'primary_macro',   'mg/kg',   '{"P": 0.4364}'),
    ('P',    'Fósforo elemental',     'P',    'primary_macro',   'mg/kg',   '{"P2O5": 2.2914}'),
    ('K2O',  'Potasio (K₂O)',         'K₂O',  'primary_macro',   'cmol/kg', '{"K": 0.8301}'),
    ('K',    'Potasio elemental',     'K',    'primary_macro',   'cmol/kg', '{"K2O": 1.2046}'),
    ('Ca',   'Calcio',               'Ca',   'secondary_macro', 'cmol/kg', '{"CaO": 1.3992}'),
    ('Mg',   'Magnesio',             'Mg',   'secondary_macro', 'cmol/kg', '{"MgO": 1.6583}'),
    ('S',    'Azufre',               'S',    'secondary_macro', 'mg/kg',   '{}'),
    ('Fe',   'Hierro',               'Fe',   'micro',           'mg/kg',   '{}'),
    ('Mn',   'Manganeso',            'Mn',   'micro',           'mg/kg',   '{}'),
    ('Zn',   'Zinc',                 'Zn',   'micro',           'mg/kg',   '{}'),
    ('Cu',   'Cobre',                'Cu',   'micro',           'mg/kg',   '{}'),
    ('B',    'Boro',                 'B',    'micro',           'mg/kg',   '{}'),
    ('Mo',   'Molibdeno',            'Mo',   'micro',           'mg/kg',   '{}')
ON CONFLICT (code) DO NOTHING;

-- 2. Cultivos de referencia
INSERT INTO public.fert_calc_crops (id, name, scientific_name, family, description, status) VALUES
    ('11111111-0000-0000-0000-000000000001', 'Cacao',    'Theobroma cacao',       'Malvaceae',     'Cultivo tropical de referencia', 'active'),
    ('11111111-0000-0000-0000-000000000002', 'Café',     'Coffea arabica',        'Rubiaceae',     'Café arábiga',                  'active'),
    ('11111111-0000-0000-0000-000000000003', 'Maíz',     'Zea mays',              'Poaceae',       'Maíz grano',                    'active'),
    ('11111111-0000-0000-0000-000000000004', 'Arroz',    'Oryza sativa',          'Poaceae',       'Arroz paddy',                   'active'),
    ('11111111-0000-0000-0000-000000000005', 'Aguacate', 'Persea americana',      'Lauraceae',     'Aguacate / Palta',              'active')
ON CONFLICT (id) DO NOTHING;

-- 3. Etapas fenológicas — Cacao (cultivo completo de referencia)
INSERT INTO public.fert_calc_phenological_stages (id, crop_id, name, stage_order, duration_days, description) VALUES
    ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Establecimiento',      1, 90,  'Trasplante y establecimiento en campo'),
    ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'Desarrollo Vegetativo',2, 180, 'Crecimiento de estructura vegetativa'),
    ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'Floración',            3, 30,  'Inducción floral y polinización'),
    ('22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', 'Llenado de Mazorca',   4, 90,  'Desarrollo y llenado del fruto'),
    ('22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001', 'Maduración',           5, 30,  'Maduración y cosecha'),
    ('22222222-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000001', 'Producción (Ciclo)',   6, 365, 'Ciclo productivo completo anual')
ON CONFLICT (id) DO NOTHING;

-- 4. Requerimientos nutricionales — Cacao Producción
-- Fuente: ICCO, FEDECACAO, literatura latinoamericana (valores para 1 t/ha de cacao seco)
-- Referencia: rendimiento de 1 t/ha; escalar para rendimientos distintos
INSERT INTO public.fert_calc_requirements
    (crop_id, stage_id, nutrient_code, amount_kg_ha, min_amount_kg_ha, max_amount_kg_ha, reference_yield, methodology, source)
VALUES
    -- Ciclo completo (stage_id NULL = total anual por tonelada producida)
    ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000006', 'N',    80.0,  60.0,  120.0, 1.0, 'extraction', 'FEDECACAO 2023 / ICCO Guidelines'),
    ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000006', 'P2O5', 30.0,  20.0,   50.0, 1.0, 'extraction', 'FEDECACAO 2023 / ICCO Guidelines'),
    ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000006', 'K2O', 120.0, 80.0,  160.0, 1.0, 'extraction', 'FEDECACAO 2023 / ICCO Guidelines'),
    ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000006', 'Ca',   40.0,  25.0,   60.0, 1.0, 'extraction', 'FEDECACAO 2023'),
    ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000006', 'Mg',   20.0,  12.0,   35.0, 1.0, 'extraction', 'FEDECACAO 2023'),
    ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000006', 'S',    15.0,  10.0,   25.0, 1.0, 'extraction', 'FEDECACAO 2023')
ON CONFLICT DO NOTHING;

-- 5. Fertilizantes globales de referencia
INSERT INTO public.fert_calc_fertilizers (id, company_id, commercial_name, type, composition, commercial_unit, status) VALUES
    ('33333333-0000-0000-0000-000000000001', NULL, 'Urea (46-0-0)',              'simple',   '{"N": 46}',                        'kg', 'active'),
    ('33333333-0000-0000-0000-000000000002', NULL, 'Sulfato de Amonio (21-0-0)','simple',   '{"N": 21, "S": 24}',               'kg', 'active'),
    ('33333333-0000-0000-0000-000000000003', NULL, 'DAP (18-46-0)',             'compound', '{"N": 18, "P2O5": 46}',             'kg', 'active'),
    ('33333333-0000-0000-0000-000000000004', NULL, 'MAP (11-52-0)',             'compound', '{"N": 11, "P2O5": 52}',             'kg', 'active'),
    ('33333333-0000-0000-0000-000000000005', NULL, 'KCl (Cloruro de Potasio)',  'simple',   '{"K2O": 60}',                      'kg', 'active'),
    ('33333333-0000-0000-0000-000000000006', NULL, 'Sulfato de Potasio (0-0-50)','simple', '{"K2O": 50, "S": 18}',             'kg', 'active'),
    ('33333333-0000-0000-0000-000000000007', NULL, 'NPK 15-15-15',             'compound', '{"N": 15, "P2O5": 15, "K2O": 15}', 'kg', 'active'),
    ('33333333-0000-0000-0000-000000000008', NULL, 'NPK 12-24-12',             'compound', '{"N": 12, "P2O5": 24, "K2O": 12}', 'kg', 'active'),
    ('33333333-0000-0000-0000-000000000009', NULL, 'Cal Dolomítica',            'simple',   '{"Ca": 20, "Mg": 10}',             'kg', 'active'),
    ('33333333-0000-0000-0000-000000000010', NULL, 'Sulfato de Calcio (Yeso)', 'simple',   '{"Ca": 23, "S": 18}',              'kg', 'active'),
    ('33333333-0000-0000-0000-000000000011', NULL, 'Nitrato de Calcio',        'simple',   '{"N": 15.5, "Ca": 19}',            'kg', 'active'),
    ('33333333-0000-0000-0000-000000000012', NULL, 'Sulfato de Magnesio (Kieserita)', 'simple', '{"Mg": 17, "S": 22}',         'kg', 'active')
ON CONFLICT (id) DO NOTHING;

-- 6. Reglas agronómicas globales de referencia
INSERT INTO public.fert_calc_rules
    (company_id, name, description, conditions, condition_logic, actions, priority, scope, version, crop_id)
VALUES
    -- Regla: suelo ácido → aumentar dosis de P
    (
        NULL,
        'Ajuste P en suelo ácido',
        'En suelos con pH < 5.5, la fijación de P es alta. Aumentar la dosis un 30%.',
        '[{"field": "soil.pH", "operator": "lt", "value": 5.5}]',
        'AND',
        '[{"type": "correction_factor", "target": "P2O5", "value": 1.3}]',
        1, 'global', '1.0.0', NULL
    ),
    -- Regla: suelo alcalino → alerta de micronutrientes
    (
        NULL,
        'Alerta micronutrientes en suelo alcalino',
        'En suelos con pH > 7.5, la disponibilidad de Fe, Mn, Zn disminuye.',
        '[{"field": "soil.pH", "operator": "gt", "value": 7.5}]',
        'AND',
        '[{"type": "warning", "message": "pH alcalino: considere aplicación foliar de micronutrientes (Fe, Mn, Zn) para mayor eficiencia."}]',
        1, 'global', '1.0.0', NULL
    ),
    -- Regla: cacao en floración → aumentar K
    (
        NULL,
        'Cacao floración: priorizar Potasio',
        'Durante la floración del cacao, el K es crítico para el cuaje del fruto.',
        '[{"field": "stage.name", "operator": "eq", "value": "Floración"}]',
        'AND',
        '[{"type": "correction_factor", "target": "K2O", "value": 1.2}]',
        1, 'global', '1.0.0', '11111111-0000-0000-0000-000000000001'
    )
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- COMENTARIO FINAL
-- ─────────────────────────────────────────────────────────────────────────────
-- Los valores agronómicos son referencias de literatura.
-- Un agrónomo debe validarlos antes de uso en producción.
-- Los fertilizantes y requerimientos pueden crearse por empresa (company_id NOT NULL).
-- ==============================================================================
