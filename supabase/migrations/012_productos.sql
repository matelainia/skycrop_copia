-- ==============================================================================
-- SKYCROP DATABASE V2: 012_productos.sql
-- Descripción: Catálogo de Productos Insumos (Fitosanitarios/Nutricionales)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.productos (
    id BIGINT PRIMARY KEY, -- ID del producto (generalmente asignado del registro nacional o secuencia)
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE, -- NULL indica producto del catálogo global ICA
    nombre_producto TEXT NOT NULL,
    reg_ica TEXT,
    ingrediente_activo TEXT,
    concentracion TEXT,
    categoria_toxicologica TEXT,
    clase_producto TEXT,
    tipo_formulacion TEXT,
    codigo_frac TEXT,
    codigo_irac TEXT,
    codigo_hrac TEXT,
    grupo_quimico TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
