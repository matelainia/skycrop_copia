-- ==============================================================================
-- SKYCROP DATABASE V2: 026_adjust_trabajadores_constraints.sql
-- Descripción: Flexibilización de las restricciones CHECK en la tabla trabajadores.
-- Mapea los valores que envía y filtra el frontend de Talento Humano:
--   - estado: permite 'Activa', 'On Leave' (además de 'Activo', 'Inactivo', 'Vacaciones', 'Licencia')
--   - tipo_contrato: permite 'Permanente', 'Temporal', 'Contrato', 'Cosecha' (además de los términos de ley)
-- ==============================================================================

-- 1. Eliminar restricciones antiguas si existen
ALTER TABLE public.trabajadores 
  DROP CONSTRAINT IF EXISTS trabajadores_estado_check,
  DROP CONSTRAINT IF EXISTS trabajadores_tipo_contrato_check;

-- 2. Crear las nuevas restricciones ampliadas compatibles con el frontend y base de datos
ALTER TABLE public.trabajadores
  ADD CONSTRAINT trabajadores_estado_check 
    CHECK (estado IN ('Activo', 'Activa', 'Inactivo', 'Vacaciones', 'Licencia', 'On Leave')),
  ADD CONSTRAINT trabajadores_tipo_contrato_check 
    CHECK (tipo_contrato IN ('Permanente', 'Temporal', 'Contrato', 'Cosecha', 'Termino Fijo', 'Termino Indefinido', 'Prestacion de Servicios', 'Jornal', 'Obra o Labor'));
