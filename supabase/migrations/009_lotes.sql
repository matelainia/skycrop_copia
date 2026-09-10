-- ==============================================================================
-- SKYCROP DATABASE V2: 009_lotes.sql
-- Descripción: Tabla de Lotes (Parcelas de Cultivo)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.lotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    predio_id UUID REFERENCES public.predios(id) ON DELETE SET NULL,
    codigo_interno VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    cultivo VARCHAR(100) NOT NULL,
    variedad VARCHAR(100),
    fecha_siembra DATE,
    estado_fenologico VARCHAR(100),
    sistema_productivo VARCHAR(100),
    responsable_tecnico VARCHAR(150),
    observaciones TEXT,
    geom public.geometry(Geometry, 4326), -- PostGIS Geometry
    area_ha DOUBLE PRECISION CHECK (area_ha >= 0),
    perimetro_m DOUBLE PRECISION CHECK (perimetro_m >= 0),
    centroide_lat DOUBLE PRECISION,
    centroide_lng DOUBLE PRECISION,
    estado_sanitario VARCHAR(50) DEFAULT 'excelente' CHECK (estado_sanitario IN ('excelente', 'bueno', 'regular', 'bajo', 'sin_datos')),
    ndvi_actual DOUBLE PRECISION DEFAULT 0.75,
    carencia_activa BOOLEAN DEFAULT false,
    fecha_fin_carencia TIMESTAMP WITH TIME ZONE,
    producto_carencia TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    deleted_by TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (company_id, codigo_interno)
);

-- Crear el índice espacial para las búsquedas geográficas de PostGIS
CREATE INDEX IF NOT EXISTS lotes_geom_idx ON public.lotes USING GIST (geom);
