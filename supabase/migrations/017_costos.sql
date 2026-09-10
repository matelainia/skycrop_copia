-- ==============================================================================
-- SKYCROP DATABASE V2: 017_costos.sql
-- Descripción: Módulo Financiero (Nóminas de Obreros, Libro de Costos de Lotes)
-- ==============================================================================

-- 1. Tabla de Nóminas
CREATE TABLE IF NOT EXISTS public.nominas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    trabajador_id UUID REFERENCES public.trabajadores(id) ON DELETE CASCADE,
    periodo VARCHAR(50) NOT NULL, -- e.g. '2026-07'
    salario_neto NUMERIC NOT NULL CHECK (salario_neto >= 0),
    horas_extras NUMERIC NOT NULL DEFAULT 0.0 CHECK (horas_extras >= 0),
    retenciones NUMERIC NOT NULL DEFAULT 0.0 CHECK (retenciones >= 0),
    total_neto NUMERIC NOT NULL CHECK (total_neto >= 0),
    estado VARCHAR(50) NOT NULL CHECK (estado IN ('Pendiente', 'Pagado', 'Procesado')),
    fecha_pago DATE,
    metodo_pago VARCHAR(50),
    comentarios TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla de Costos Operacionales del Lote (Centro de Costos)
CREATE TABLE IF NOT EXISTS public.costos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    lote_id UUID REFERENCES public.lotes(id) ON DELETE CASCADE,
    concepto TEXT NOT NULL, -- e.g. 'Insumos', 'Mano de Obra', 'Maquinaria', 'Otros'
    costo NUMERIC NOT NULL CHECK (costo >= 0),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    referencia_tipo TEXT, -- e.g. 'aplicaciones', 'nominas', 'jornadas_maquinaria' (trazabilidad)
    referencia_id UUID, -- ID del registro fuente
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
