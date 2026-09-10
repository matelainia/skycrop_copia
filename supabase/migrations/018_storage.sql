-- ==============================================================================
-- SKYCROP DATABASE V2: 018_storage.sql
-- Descripción: Declaración de Buckets de Almacenamiento en Supabase Storage
-- ==============================================================================

-- Registrar los buckets de almacenamiento si existe el esquema storage de Supabase
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES
    ('recetas', 'recetas', true),
    ('monitoreos', 'monitoreos', true),
    ('certificados', 'certificados', true),
    ('trabajadores', 'trabajadores', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
