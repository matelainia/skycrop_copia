-- ==============================================================================
-- SKYCROP DATABASE V2: 002_types.sql
-- Descripción: Dominios y Tipos Personalizados de Validación
-- ==============================================================================

-- Dominio para validar correos electrónicos mediante expresión regular
CREATE DOMAIN public.email_address AS TEXT
CHECK (
    VALUE ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$'
);

-- Dominio para validar números telefónicos básicos
CREATE DOMAIN public.phone_number AS TEXT
CHECK (
    VALUE ~* '^\+?[0-9\s\-()]{7,20}$'
);
