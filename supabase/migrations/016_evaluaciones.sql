-- ==============================================================================
-- SKYCROP DATABASE V2: 016_evaluaciones.sql
-- Descripción: Módulo Evaluaciones (Monitoreo Sanitario, Cursos, Capacitaciones)
-- ==============================================================================

-- 1. Tabla de Cursos de Formación
CREATE TABLE IF NOT EXISTS public.cursos_formacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('Fitosanitario', 'Manejo de Agroquímicos', 'Seguridad y Salud', 'Primeros Auxilios', 'Técnico Agrícola')),
    total_horas NUMERIC CHECK (total_horas >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla de Monitoreos Fitosanitarios y Evaluaciones de Campo
CREATE TABLE IF NOT EXISTS public.monitoreos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    lote_id UUID REFERENCES public.lotes(id) ON DELETE CASCADE,
    tipo_monitoreo VARCHAR(50) NOT NULL CHECK (tipo_monitoreo IN ('Sanitario', 'Agronómico', 'Post-Aplicación')),
    fecha_monitoreo TIMESTAMP WITH TIME ZONE NOT NULL,
    responsable VARCHAR(150) NOT NULL,
    incidencia_pct DOUBLE PRECISION DEFAULT 0.0 CHECK (incidencia_pct >= 0 AND incidencia_pct <= 100),
    severidad_pct DOUBLE PRECISION DEFAULT 0.0 CHECK (severidad_pct >= 0 AND severidad_pct <= 100),
    humedad_pct DOUBLE PRECISION CHECK (humedad_pct >= 0 AND humedad_pct <= 100),
    temperatura_c DOUBLE PRECISION,
    plagas_detectadas TEXT,
    enfermedades_detectadas TEXT,
    deficiencias_nutricionales TEXT,
    observaciones TEXT,
    evidencia_foto_url TEXT,
    documento_adjunto_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Registro de Capacitaciones de Trabajadores
CREATE TABLE IF NOT EXISTS public.registros_formacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    trabajador_id UUID REFERENCES public.trabajadores(id) ON DELETE CASCADE,
    curso_id UUID REFERENCES public.cursos_formacion(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    resultado TEXT NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('Aprobado', 'Reprobado', 'Asistió', 'Pendiente')),
    certificado_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
