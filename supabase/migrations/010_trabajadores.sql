-- ==============================================================================
-- SKYCROP DATABASE V2: 010_trabajadores.sql
-- Descripción: Módulo RRHH (Trabajadores, Cuadrillas de Trabajo)
-- ==============================================================================

-- 1. Tabla de Trabajadores
CREATE TABLE IF NOT EXISTS public.trabajadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    nombres TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    identificacion TEXT NOT NULL,
    edad INTEGER CHECK (edad >= 0),
    fecha_nacimiento DATE,
    fecha_contratacion DATE,
    tipo_contrato TEXT NOT NULL CHECK (tipo_contrato IN ('Termino Fijo', 'Termino Indefinido', 'Prestacion de Servicios', 'Jornal', 'Obra o Labor')),
    rh_sanguineo TEXT,
    tipo_eps TEXT,
    tipo_arl TEXT,
    contacto_telefonico TEXT,
    contacto_emergencia TEXT,
    foto TEXT,
    copia_contrato_name TEXT,
    rol TEXT NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('Activo', 'Inactivo', 'Vacaciones', 'Licencia')),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    deleted_by TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (company_id, identificacion)
);

-- 2. Tabla de Cuadrillas
CREATE TABLE IF NOT EXISTS public.cuadrillas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Miembros de Cuadrillas
CREATE TABLE IF NOT EXISTS public.cuadrilla_miembros (
    cuadrilla_id UUID NOT NULL REFERENCES public.cuadrillas(id) ON DELETE CASCADE,
    trabajador_id UUID NOT NULL REFERENCES public.trabajadores(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    PRIMARY KEY (cuadrilla_id, trabajador_id)
);
