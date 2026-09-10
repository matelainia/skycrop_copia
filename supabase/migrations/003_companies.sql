-- ==============================================================================
-- SKYCROP DATABASE V2: 003_companies.sql
-- Descripción: Tabla principal de Empresas (Tenants)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_org_id TEXT UNIQUE NOT NULL, -- Clerk Organization ID (e.g., 'org_...')
    nombre TEXT NOT NULL,
    slug TEXT,
    nit TEXT,
    telefono public.phone_number,
    correo public.email_address,
    direccion TEXT,
    logo TEXT,
    estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
