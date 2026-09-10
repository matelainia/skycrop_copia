-- ==============================================================================
-- SKYCROP DATABASE: 034_sugerir_plan_ai.sql
-- Descripción: Tablas y constraints para IA Sugerir Plan
-- ==============================================================================

-- 1. Crear tabla requerimientos
CREATE TABLE IF NOT EXISTS public.requerimientos (
    id SERIAL PRIMARY KEY,
    cultivo TEXT NOT NULL,
    etapa TEXT NOT NULL,
    nutrientes_kg_ha JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_cultivo_etapa UNIQUE (cultivo, etapa)
);

-- 2. Crear tabla ai_usage_logs
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_tokens INT DEFAULT 0,
    completion_tokens INT DEFAULT 0,
    cost_usd NUMERIC(10, 6) DEFAULT 0,
    duration_ms INT DEFAULT 0,
    response_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_window ON public.ai_usage_logs (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_request_id ON public.ai_usage_logs (request_id);

-- 3. Seed de requerimientos
INSERT INTO public.requerimientos (cultivo, etapa, nutrientes_kg_ha) VALUES
('Arroz', 'Vegetativo', '{"N": 40, "P": 10, "K": 20}'),
('Arroz', 'Floración', '{"N": 60, "P": 20, "K": 30}'),
('Arroz', 'Llenado', '{"N": 30, "P": 10, "K": 40}'),
('Maíz', 'Vegetativo', '{"N": 50, "P": 20, "K": 20}'),
('Maíz', 'Floración', '{"N": 80, "P": 30, "K": 40}'),
('Maíz', 'Llenado', '{"N": 40, "P": 10, "K": 50}'),
('Café', 'Crecimiento', '{"N": 60, "P": 20, "K": 40}'),
('Café', 'Floración', '{"N": 40, "P": 10, "K": 50}'),
('Café', 'Llenado', '{"N": 80, "P": 20, "K": 80}'),
('Papa', 'Emergencia', '{"N": 40, "P": 30, "K": 20}'),
('Papa', 'Tuberización', '{"N": 80, "P": 50, "K": 80}'),
('Papa', 'Llenado', '{"N": 60, "P": 20, "K": 100}'),
('Aguacate', 'Vegetativo', '{"N": 50, "P": 20, "K": 40}'),
('Aguacate', 'Floración', '{"N": 30, "P": 10, "K": 50}'),
('Aguacate', 'Llenado', '{"N": 60, "P": 15, "K": 80}')
ON CONFLICT (cultivo, etapa) DO UPDATE SET nutrientes_kg_ha = EXCLUDED.nutrientes_kg_ha;
