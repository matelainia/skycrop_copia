-- ==============================================================================
-- SKYCROP DATABASE: 029_protocol_enhancements.sql
-- Descripción: Extiende la tabla protocolos_evaluacion con los campos necesarios
--              para el sistema de protocolos configurables y data-driven.
--
-- Nuevos campos:
--   nombre              → Nombre descriptivo del protocolo
--   tipo_monitoreo      → Sanitario, Productivo, Preventivo, etc.
--   unidad_muestreo     → Árbol, Planta, Fruto, Hoja, etc.
--   metodo_seleccion    → Aleatorio simple, Sistemático, Dirigido, Estratificado
--   estados_fenologicos_ids → Array de IDs de etapas donde aplica el protocolo
--   umbrales            → JSONB: rangos de color/alerta por variable (dentro del protocolo)
--   reglas              → JSONB: reglas SI/ENTONCES específicas del protocolo
--   audit_comentario    → Comentario libre de auditoría al guardar/publicar
--
-- Cambios de constraint:
--   estado → amplía de ('activo','inactivo','obsoleto') a
--            ('borrador','activo','archivado','obsoleto')
-- ==============================================================================

-- 1. Agregar columnas nuevas

ALTER TABLE public.protocolos_evaluacion
  ADD COLUMN IF NOT EXISTS nombre               VARCHAR(200),
  ADD COLUMN IF NOT EXISTS tipo_monitoreo       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS unidad_muestreo      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS metodo_seleccion     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS estados_fenologicos_ids UUID[],
  ADD COLUMN IF NOT EXISTS umbrales             JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reglas               JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS audit_comentario     TEXT;

COMMENT ON COLUMN public.protocolos_evaluacion.nombre IS 'Nombre descriptivo del protocolo. Ej: "Monilia - Protocolo Interno v1"';
COMMENT ON COLUMN public.protocolos_evaluacion.tipo_monitoreo IS 'Tipo de monitoreo: Sanitario, Productivo, Preventivo, Seguimiento';
COMMENT ON COLUMN public.protocolos_evaluacion.unidad_muestreo IS 'Unidad de muestreo: Árbol, Planta, Fruto, Hoja, Rama, Mazorca, etc.';
COMMENT ON COLUMN public.protocolos_evaluacion.metodo_seleccion IS 'Método de selección de la muestra: Aleatorio simple, Sistemático, Dirigido, Estratificado';
COMMENT ON COLUMN public.protocolos_evaluacion.estados_fenologicos_ids IS 'Array de UUIDs de estados fenológicos donde aplica el protocolo. NULL = todos.';
COMMENT ON COLUMN public.protocolos_evaluacion.umbrales IS 'Umbrales de alerta definidos dentro del protocolo. Estructura: [{variable_clave, operador, valor, nivel_riesgo, color, etiqueta}]';
COMMENT ON COLUMN public.protocolos_evaluacion.reglas IS 'Reglas automáticas SI/ENTONCES del protocolo. Estructura: [{condiciones:[{variable,operador,valor}], operador_logico, accion_tipo, accion_mensaje}]';
COMMENT ON COLUMN public.protocolos_evaluacion.audit_comentario IS 'Comentario de auditoría ingresado por el usuario al guardar o publicar el protocolo.';

-- 2. Actualizar el CHECK de estado para incluir borrador y archivado
--    Primero se elimina el constraint existente y se agrega el nuevo.

ALTER TABLE public.protocolos_evaluacion
  DROP CONSTRAINT IF EXISTS protocolos_evaluacion_estado_check;

ALTER TABLE public.protocolos_evaluacion
  ADD CONSTRAINT protocolos_evaluacion_estado_check
  CHECK (estado IN ('borrador', 'activo', 'archivado', 'obsoleto'));

-- 3. Actualizar el valor por defecto del estado de 'activo' a 'borrador'
ALTER TABLE public.protocolos_evaluacion
  ALTER COLUMN estado SET DEFAULT 'borrador';

-- 4. Actualizar las variables JSONB existentes para incluir los nuevos campos de escalas/umbrales
-- (las variables ya en BD siguen siendo válidas, los nuevos campos son opcionales)

-- 5. Índices adicionales para búsqueda en la biblioteca
CREATE INDEX IF NOT EXISTS idx_protocolos_estado    ON public.protocolos_evaluacion(estado);
CREATE INDEX IF NOT EXISTS idx_protocolos_nombre    ON public.protocolos_evaluacion USING gin(to_tsvector('spanish', coalesce(nombre, '')));
CREATE INDEX IF NOT EXISTS idx_protocolos_created_by ON public.protocolos_evaluacion(created_by);
