-- ==============================================================================
-- SKYCROP DATABASE V2: 004_profiles.sql
-- Descripción: Tabla de Perfiles de Usuario (Clerk Users Cache)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY, -- Clerk User ID (e.g., 'user_...')
    email public.email_address UNIQUE NOT NULL,
    nombre TEXT,
    apellido TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
