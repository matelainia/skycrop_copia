-- ==============================================================================
-- SKYCROP DATABASE V2: 008_predios.sql
-- Descripción: Tabla de Predios (Fincas/Terrenos)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.predios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    ubicacion TEXT,
    area_total_ha NUMERIC CHECK (area_total_ha >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
