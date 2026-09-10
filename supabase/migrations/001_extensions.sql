-- ==============================================================================
-- SKYCROP DATABASE V2: 001_extensions.sql
-- Descripción: Habilitación de extensiones y tabla de versionamiento de esquema
-- ==============================================================================

-- 1. Habilitar Extensiones Necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabla de Versionamiento del Esquema de Base de Datos
CREATE TABLE IF NOT EXISTS public.schema_versions (
    version VARCHAR(50) PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Registrar versión inicial V2.0.0
INSERT INTO public.schema_versions (version, description)
VALUES ('2.0.0', 'Esquema Base CORE y Estructura Modular V2')
ON CONFLICT (version) DO NOTHING;
