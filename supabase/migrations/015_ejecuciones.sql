-- ==============================================================================
-- SKYCROP DATABASE V2: 015_ejecuciones.sql
-- Descripción: Módulo Ejecuciones (Aplicaciones, Cosechas, Maquinaria, Timeline)
-- ==============================================================================

-- 1. Tabla de Maquinaria
CREATE TABLE IF NOT EXISTS public.maquinaria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    codigo_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- e.g. Tractor, Fumigadora, Motobomba
    status VARCHAR(50) NOT NULL CHECK (status IN ('Disponible', 'Operando', 'Mantenimiento', 'Fuera de Servicio')),
    operator_name VARCHAR(100),
    current_task VARCHAR(100),
    current_lot VARCHAR(100),
    last_maintenance DATE NOT NULL,
    next_maintenance DATE NOT NULL,
    next_maintenance_hours INTEGER NOT NULL CHECK (next_maintenance_hours >= 0),
    hours_of_operation NUMERIC NOT NULL CHECK (hours_of_operation >= 0),
    hours_today NUMERIC NOT NULL CHECK (hours_today >= 0),
    fuel_consumption VARCHAR(50) NOT NULL,
    cost_operator NUMERIC NOT NULL CHECK (cost_operator >= 0),
    cost_fuel NUMERIC NOT NULL CHECK (cost_fuel >= 0),
    cost_maintenance NUMERIC NOT NULL CHECK (cost_maintenance >= 0),
    cost_depreciation NUMERIC NOT NULL CHECK (cost_depreciation >= 0),
    photo_url VARCHAR(255),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    deleted_by TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (company_id, codigo_id)
);

-- 2. Tabla de Aplicaciones Agrícolas
CREATE TABLE IF NOT EXISTS public.aplicaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    lote_id UUID REFERENCES public.lotes(id) ON DELETE CASCADE,
    tipo_aplicacion VARCHAR(50) NOT NULL, -- Fitosanitaria, Nutricional
    tipo_producto VARCHAR(50) NOT NULL, -- Fungicida, Insecticida, Herbicida, Fertilizante, Biológico
    producto_comercial VARCHAR(150) NOT NULL,
    ingrediente_activo VARCHAR(150),
    dosis VARCHAR(50),
    unidad_medida VARCHAR(20),
    volumen_aplicado DOUBLE PRECISION CHECK (volumen_aplicado >= 0),
    metodo_aplicacion VARCHAR(100),
    operario_responsable VARCHAR(150),
    maquinaria_utilizada VARCHAR(150),
    condiciones_climaticas VARCHAR(150),
    fecha_aplicacion TIMESTAMP WITH TIME ZONE NOT NULL,
    costo_aplicacion DOUBLE PRECISION DEFAULT 0.0 CHECK (costo_aplicacion >= 0),
    receta_agronomica_url TEXT,
    registro_ica VARCHAR(100),
    periodo_carencia_dias INTEGER DEFAULT 0 CHECK (periodo_carencia_dias >= 0),
    periodo_reingreso_horas INTEGER DEFAULT 0 CHECK (periodo_reingreso_horas >= 0),
    clasificacion_toxicologica VARCHAR(50),
    residualidad_nivel VARCHAR(50), -- Alto, Medio, Bajo
    estado_programacion TEXT,
    codigo_apl TEXT,
    fecha_ejecucion TIMESTAMP WITH TIME ZONE,
    fecha_fin_carencia TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    deleted_by TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by TEXT
);

-- 3. Tabla de Cosechas Ejecutadas
CREATE TABLE IF NOT EXISTS public.cosechas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    lote TEXT NOT NULL, -- Para compatibilidad heredada
    lote_id UUID REFERENCES public.lotes(id) ON DELETE SET NULL, -- Relación formal
    crop TEXT NOT NULL,
    weight DOUBLE PRECISION NOT NULL CHECK (weight >= 0),
    grade TEXT NOT NULL,
    storage TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Jornadas de Maquinaria
CREATE TABLE IF NOT EXISTS public.jornadas_maquinaria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    maquinaria_id UUID REFERENCES public.maquinaria(id) ON DELETE CASCADE,
    operator VARCHAR(100) NOT NULL,
    lot VARCHAR(100) NOT NULL,
    activity VARCHAR(100) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    start_horometro NUMERIC NOT NULL CHECK (start_horometro >= 0),
    end_horometro NUMERIC CHECK (end_horometro >= 0),
    start_fuel NUMERIC NOT NULL CHECK (start_fuel >= 0),
    end_fuel NUMERIC CHECK (end_fuel >= 0),
    calculated_hours NUMERIC,
    calculated_fuel_consumption NUMERIC,
    calculated_cost NUMERIC,
    notes TEXT,
    status VARCHAR(50) NOT NULL CHECK (status IN ('En Progreso', 'Finalizada')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Historial Cronológico de Actividades del Lote (Timeline)
CREATE TABLE IF NOT EXISTS public.historial_actividades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    lote_id UUID REFERENCES public.lotes(id) ON DELETE CASCADE,
    tipo_actividad VARCHAR(100) NOT NULL, -- e.g. Aplicación, Siembra, Cosecha, Monitoreo
    fecha_actividad TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    responsable VARCHAR(150),
    observaciones TEXT,
    resultados TEXT,
    documentos_urls TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
