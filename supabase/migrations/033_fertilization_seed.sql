-- ==============================================================================
-- SKYCROP DATABASE: 033_fertilization_seed.sql
-- Descripción: Catálogo inicial de productos fertilizantes y datos de prueba
-- ==============================================================================

-- 1. Insertar Catálogo de Productos Fertilizantes Semilla
INSERT INTO public.productos (id, nombre_producto, clase_producto)
VALUES
  (101, 'Urea (46-0-0)', 'fertilizante'),
  (102, 'DAP (18-46-0)', 'fertilizante'),
  (103, 'Cloruro de Potasio - KCl (0-0-60)', 'fertilizante'),
  (104, 'Foliar Nutrimix 20-20-20', 'fertilizante_foliar'),
  (105, 'Foliar Boro & Zinc', 'fertilizante_foliar'),
  (106, 'Cal Agrícola Dolomita', 'enmienda'),
  (107, 'Compost Orgánico Enriquecido', 'organico')
ON CONFLICT (id) DO UPDATE SET
  nombre_producto = EXCLUDED.nombre_producto,
  clase_producto = EXCLUDED.clase_producto;

-- 2. Asegurar secuencia para código correlativo PF-AAAA-####
CREATE SEQUENCE IF NOT EXISTS public.fertilization_plan_code_seq START WITH 1001;

COMMENT ON SEQUENCE public.fertilization_plan_code_seq IS 'Secuencia global para correlativos de planes de fertilización PF-AAAA-####';
