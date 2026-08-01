-- =============================================================================
-- Migración: Arquitectura de Indicadores Agronómicos
-- Fecha: 2026-07-28
-- Descripción:
--   Introduce el concepto de Indicador Agronómico como entidad de primer nivel
--   en los protocolos de evaluación. Las escalas pasan a interpretar indicadores
--   calculados (no variables crudas), soportando múltiples estrategias de cálculo
--   extensibles (Patrón Strategy) y escalas contextuales.
-- =============================================================================

-- 1. Tabla principal de indicadores del protocolo
CREATE TABLE IF NOT EXISTS protocolo_indicadores (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  protocolo_id          UUID NOT NULL REFERENCES protocolos_evaluacion(id) ON DELETE CASCADE,
  clave                 VARCHAR(100) NOT NULL,
  nombre                VARCHAR(255) NOT NULL,
  descripcion           TEXT,
  unidad                VARCHAR(100),   -- '%', 'Insectos/árbol', 'Índice', 'mm/día', etc.
  decimales             INTEGER DEFAULT 2,
  -- Estrategia de cálculo (abierta, extensible vía StrategyRegistry)
  estrategia_tipo       VARCHAR(100) NOT NULL DEFAULT 'absoluto',
  -- Configuración JSON de la estrategia (numerador, denominador, pesos, expresión de fórmula, etc.)
  configuracion         JSONB DEFAULT '{}',
  orden                 INTEGER DEFAULT 0,
  activo                BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(protocolo_id, clave)
);

COMMENT ON TABLE protocolo_indicadores IS
  'Indicadores agronómicos calculados de un protocolo. Entidad de primer nivel que interpreta combinaciones de variables capturadas en campo mediante estrategias de cálculo configurables (porcentaje, promedio, índice ponderado, fórmulas, etc.).';

COMMENT ON COLUMN protocolo_indicadores.estrategia_tipo IS
  'Clave registrada en el StrategyRegistry del backend. Ejemplos: absoluto, porcentaje, promedio, indice_ponderado, formula. Añadir nuevas estrategias no requiere modificar esta tabla.';

COMMENT ON COLUMN protocolo_indicadores.configuracion IS
  'Parámetros específicos de la estrategia en JSONB. Ejemplos: {"numerador": "plantas_enfermas", "denominador": "plantas_evaluadas"} para porcentaje; {"expresion": "(a + b) / c * 100", "variables": {"a": "v1"}} para fórmulas personalizadas.';

-- 2. Tabla de mapeo entre indicador y variables que lo alimentan
CREATE TABLE IF NOT EXISTS protocolo_indicador_variables (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  indicador_id          UUID NOT NULL REFERENCES protocolo_indicadores(id) ON DELETE CASCADE,
  variable_id           UUID NOT NULL REFERENCES protocolo_variables(id) ON DELETE CASCADE,
  -- Rol semántico de esta variable en el cálculo del indicador
  rol                   VARCHAR(100) DEFAULT 'entrada',  -- 'numerador', 'denominador', 'ponderador', 'parametro', 'entrada'
  alias                 VARCHAR(100),                    -- alias usado en expresiones de fórmulas
  created_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(indicador_id, variable_id)
);

COMMENT ON TABLE protocolo_indicador_variables IS
  'Mapeo N-a-M entre indicadores y variables. Permite que un indicador consuma múltiples variables con roles semánticos distintos (numerador, denominador, etc.).';

-- 3. Evolución de la tabla de escalas para vincularlas al indicador (no a la variable cruda)
-- Primero añadir la columna si no existe:
ALTER TABLE protocolo_escalas
  ADD COLUMN IF NOT EXISTS indicador_id UUID REFERENCES protocolo_indicadores(id) ON DELETE CASCADE;

-- Columna de contexto opcional para escalas contextuales:
-- { "estado_fenologico": "floración", "variedad": "Manzano Gala", "zona": "ladera_norte" }
ALTER TABLE protocolo_escalas
  ADD COLUMN IF NOT EXISTS contexto JSONB DEFAULT NULL;

COMMENT ON COLUMN protocolo_escalas.indicador_id IS
  'Indicador al que pertenece esta escala. NULL en protocolos legados (migración automática).';

COMMENT ON COLUMN protocolo_escalas.contexto IS
  'Contexto operativo opcional para activar esta escala específica. Si NULL, aplica siempre. Si definido, el EvaluationEngine la prioriza sobre la escala general cuando el contexto coincide.';

-- 4. Migración automática de protocolos legados
-- Se crea un indicador "espejo" por cada variable numérica existente con estrategia absoluta.
-- Así los protocolos existentes siguen funcionando sin cambios.

INSERT INTO protocolo_indicadores (
  protocolo_id, clave, nombre, descripcion, unidad,
  decimales, estrategia_tipo, configuracion, orden
)
SELECT
  pv.protocolo_id,
  CONCAT('ind_', pv.clave)                             AS clave,
  COALESCE(pv.etiqueta, pv.clave)                      AS nombre,
  'Migrado automáticamente desde variable de captura'   AS descripcion,
  pv.unidad                                            AS unidad,
  2                                                    AS decimales,
  'absoluto'                                           AS estrategia_tipo,
  jsonb_build_object('variable_fuente', pv.clave)      AS configuracion,
  pv.orden
FROM protocolo_variables pv
WHERE pv.tipo IN ('Número', 'Decimal', 'Escala')
ON CONFLICT (protocolo_id, clave) DO NOTHING;

-- Mapear las variables migradas a sus indicadores espejo
INSERT INTO protocolo_indicador_variables (indicador_id, variable_id, rol, alias)
SELECT
  pi.id AS indicador_id,
  pv.id AS variable_id,
  'entrada' AS rol,
  pv.clave  AS alias
FROM protocolo_indicadores pi
JOIN protocolo_variables pv
  ON pv.protocolo_id = pi.protocolo_id
  AND CONCAT('ind_', pv.clave) = pi.clave
  AND pi.estrategia_tipo = 'absoluto'
ON CONFLICT (indicador_id, variable_id) DO NOTHING;

-- Crear índices de performance
CREATE INDEX IF NOT EXISTS idx_protocolo_indicadores_protocolo_id
  ON protocolo_indicadores(protocolo_id);

CREATE INDEX IF NOT EXISTS idx_protocolo_indicador_variables_indicador
  ON protocolo_indicador_variables(indicador_id);

CREATE INDEX IF NOT EXISTS idx_protocolo_escalas_indicador_id
  ON protocolo_escalas(indicador_id);
