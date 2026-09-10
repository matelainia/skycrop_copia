-- ==============================================================================
-- SKYCROP DATABASE V2: 014_programaciones.sql
-- Descripción: Módulo Programaciones (Labores Agrícolas, Asignaciones, Cosechas)
-- ==============================================================================

-- 1. Tabla de Labores
CREATE TABLE IF NOT EXISTS public.labores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    tipo TEXT NOT NULL, -- e.g. Poda, Fumigación, Cosecha, Riego
    descripcion TEXT,
    lote TEXT, -- Para compatibilidad heredada (campo texto)
    lote_id UUID REFERENCES public.lotes(id) ON DELETE SET NULL, -- Relación formal
    fecha DATE,
    estado TEXT NOT NULL CHECK (estado IN ('Pendiente', 'En Progreso', 'Completada', 'Cancelada')),
    asignacion TEXT NOT NULL, -- e.g. Cuadrilla, Trabajador Individual
    cuadrilla_id UUID REFERENCES public.cuadrillas(id) ON DELETE SET NULL,
    jornal NUMERIC CHECK (jornal >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Asignación Individual de Trabajadores a Labores
CREATE TABLE IF NOT EXISTS public.labor_trabajadores (
    labor_id UUID NOT NULL REFERENCES public.labores(id) ON DELETE CASCADE,
    trabajador_id UUID NOT NULL REFERENCES public.trabajadores(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    PRIMARY KEY (labor_id, trabajador_id)
);

-- 3. Planificación de Cosechas
CREATE TABLE IF NOT EXISTS public.planificacion_cosechas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    lote_id UUID REFERENCES public.lotes(id) ON DELETE CASCADE,
    fecha_programada DATE NOT NULL,
    produccion_estimada_kg DOUBLE PRECISION CHECK (produccion_estimada_kg >= 0),
    area_programada_ha DOUBLE PRECISION CHECK (area_programada_ha >= 0),
    estado_carencia VARCHAR(50) DEFAULT 'Sin restricciones',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
