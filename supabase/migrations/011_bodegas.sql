-- ==============================================================================
-- SKYCROP DATABASE V2: 011_bodegas.sql
-- Descripción: Módulo Almacenamiento (Bodegas, Silos/Tanques de Carga)
-- ==============================================================================

-- 1. Tabla de Bodegas Físicas
CREATE TABLE IF NOT EXISTS public.bodegas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    sector VARCHAR(100) NOT NULL,
    coordenada_x NUMERIC,
    coordenada_y NUMERIC,
    categoria VARCHAR(100) NOT NULL CHECK (categoria IN ('Herramientas', 'Insumos Fitosanitarios', 'Fertilizantes', 'Semillas', 'EPP', 'Cosecha')),
    responsable_id UUID REFERENCES public.trabajadores(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla de Dispositivos de Almacenamiento con Variables de Control (Silos, Cámaras, etc.)
CREATE TABLE IF NOT EXISTS public.almacenamientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    temp DOUBLE PRECISION NOT NULL,
    humidity DOUBLE PRECISION NOT NULL,
    max_capacity DOUBLE PRECISION NOT NULL CHECK (max_capacity >= 0),
    current_load DOUBLE PRECISION NOT NULL CHECK (current_load >= 0),
    unit TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT chk_capacity CHECK (current_load <= max_capacity)
);
