-- ==============================================================================
-- SKYCROP DATABASE V2: 062_inventario_catalogo_d3.sql
-- D3 firmado 2026-09-17 (catalogo-d3.md): 12 categorías de artículo + 8 de
-- bodega. Base = valores DB vigentes (hay datos) + añadidos del demo.
-- Rama: feat/inventario-ux-v2. Sin backfill (solo amplía dominios).
-- ==============================================================================

-- Drop robusto del CHECK previo (Postgres lo guarda como = ANY, no como IN).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.inventario'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%category%'
  LOOP
    EXECUTE format('ALTER TABLE public.inventario DROP CONSTRAINT %I', r.conname);
  END LOOP;
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.bodegas'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%categoria%'
  LOOP
    EXECUTE format('ALTER TABLE public.bodegas DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.inventario ADD CONSTRAINT inventario_category_check CHECK (category IN
  ('Fungicida','Insecticida','Herbicida','Fertilizante','Semilla','Herramienta',
   'EPP','Biológico','Embalaje','Repuesto','Combustible','Agroquímico'));

ALTER TABLE public.bodegas ADD CONSTRAINT bodegas_categoria_check CHECK (categoria IN
  ('Herramientas','Insumos Fitosanitarios','Fertilizantes','Semillas','EPP',
   'Cosecha','General','Combustible'));

-- ==============================================================================
-- ROLLBACK DOCUMENTADO (reversión controlada en staging; solo si no existen
-- filas con las categorías nuevas — verificar antes con el SELECT de abajo).
-- ------------------------------------------------------------------------------
-- SELECT category, count(*) FROM public.inventario GROUP BY 1;
-- SELECT categoria, count(*) FROM public.bodegas GROUP BY 1;
-- ALTER TABLE public.inventario DROP CONSTRAINT inventario_category_check;
-- ALTER TABLE public.inventario ADD CONSTRAINT inventario_category_check CHECK (category IN
--   ('Fungicida','Insecticida','Herbicida','Fertilizante','Semilla','Herramienta','EPP'));
-- ALTER TABLE public.bodegas DROP CONSTRAINT bodegas_categoria_check;
-- ALTER TABLE public.bodegas ADD CONSTRAINT bodegas_categoria_check CHECK (categoria IN
--   ('Herramientas','Insumos Fitosanitarios','Fertilizantes','Semillas','EPP','Cosecha'));
-- ==============================================================================
