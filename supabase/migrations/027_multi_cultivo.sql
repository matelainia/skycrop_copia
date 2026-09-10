-- ==============================================================================
-- SKYCROP DATABASE V2: 027_multi_cultivo.sql
-- Descripción: Base de Conocimiento Agronómica Multi-Cultivo
--              Implementa el dominio completo: cultivos, estados fenológicos,
--              objetos de evaluación, protocolos versionados, umbrales dinámicos,
--              motor de reglas y tratamientos por ingrediente activo.
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CATÁLOGO MAESTRO DE CULTIVOS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cultivos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_comun    VARCHAR(100)  NOT NULL,
    nombre_cientifico VARCHAR(150),
    familia_botanica  VARCHAR(100),
    ciclo_productivo  VARCHAR(100), -- Ej: 'Perenne', 'Anual', 'Semestral'
    descripcion     TEXT,
    foto_url        TEXT,
    estado          VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    created_by      TEXT,
    updated_by      TEXT
);

COMMENT ON TABLE public.cultivos IS 'Catálogo maestro de cultivos soportados por SkyCrop. Agregar un nuevo cultivo aquí lo activa en todo el sistema sin modificar el frontend.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ESTADOS FENOLÓGICOS POR CULTIVO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.estados_fenologicos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cultivo_id  UUID NOT NULL REFERENCES public.cultivos(id) ON DELETE CASCADE,
    nombre      VARCHAR(100) NOT NULL,  -- Ej: 'Floración', 'Fructificación'
    descripcion TEXT,
    orden       INTEGER DEFAULT 0,      -- Para ordenar las etapas cronológicamente
    estado      VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    created_by  TEXT,
    updated_by  TEXT,
    UNIQUE (cultivo_id, nombre)
);

COMMENT ON TABLE public.estados_fenologicos IS 'Etapas fenológicas de cada cultivo. La etapa del lote determina qué objetos de evaluación y protocolos aplican.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. OBJETOS DE EVALUACIÓN (reemplaza "organismos")
--    Abarca: plagas, enfermedades, malezas, fisiopatías, daños abióticos,
--    deficiencias nutricionales, estrés hídrico, daño por granizo, etc.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.objetos_evaluacion (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_comun    VARCHAR(150) NOT NULL,
    nombre_cientifico VARCHAR(200),
    categoria       VARCHAR(50) NOT NULL CHECK (categoria IN (
        'Insecto',
        'Ácaro',
        'Nematodo',
        'Molusco',
        'Mamífero',
        'Maleza',
        'Enfermedad Fúngica',
        'Enfermedad Bacteriana',
        'Enfermedad Viral',
        'Deficiencia Nutricional',
        'Daño Fisiológico',
        'Daño Abiótico',
        'Variable Productiva',
        'Otro'
    )),
    subcategoria    VARCHAR(100),  -- Ej: 'Moniliasis', 'Escoba de Bruja'
    descripcion     TEXT,
    sintomas        TEXT,
    foto_url        TEXT,
    estado          VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    created_by      TEXT,
    updated_by      TEXT
);

COMMENT ON TABLE public.objetos_evaluacion IS 'Catálogo universal de entidades evaluables: plagas, enfermedades, malezas, fisiopatías, daños abióticos, deficiencias. Concepto más amplio que "organismo".';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RELACIÓN CULTIVO → OBJETO DE EVALUACIÓN (por estado fenológico)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cultivo_objetos (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cultivo_id            UUID NOT NULL REFERENCES public.cultivos(id) ON DELETE CASCADE,
    objeto_evaluacion_id  UUID NOT NULL REFERENCES public.objetos_evaluacion(id) ON DELETE CASCADE,
    estado_fenologico_id  UUID REFERENCES public.estados_fenologicos(id) ON DELETE SET NULL,
    -- NULL en estado_fenologico_id = aplica en todas las etapas
    relevancia            VARCHAR(20) DEFAULT 'normal' CHECK (relevancia IN ('critica', 'alta', 'normal', 'baja')),
    notas                 TEXT,
    activo                BOOLEAN NOT NULL DEFAULT true,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    UNIQUE (cultivo_id, objeto_evaluacion_id, estado_fenologico_id)
);

COMMENT ON TABLE public.cultivo_objetos IS 'Relaciona qué objetos de evaluación aplican a cada cultivo y etapa fenológica. Permite que el formulario se construya automáticamente.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PROTOCOLOS DE EVALUACIÓN (VERSIONADOS)
--    Las variables son JSONB para soportar campos totalmente configurables.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.protocolos_evaluacion (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    objeto_evaluacion_id UUID NOT NULL REFERENCES public.objetos_evaluacion(id) ON DELETE CASCADE,
    cultivo_id           UUID REFERENCES public.cultivos(id) ON DELETE CASCADE,
    estado_fenologico_id UUID REFERENCES public.estados_fenologicos(id) ON DELETE SET NULL,
    version              VARCHAR(20) NOT NULL DEFAULT '1.0',
    vigencia_desde       DATE NOT NULL DEFAULT CURRENT_DATE,
    vigencia_hasta       DATE,           -- NULL = protocolo vigente actualmente
    variables            JSONB NOT NULL, -- Array de definiciones de variables de campo
    -- Estructura de cada variable en el JSONB:
    -- {
    --   "clave": "frutos_enfermos",
    --   "etiqueta": "Frutos Enfermos",
    --   "tipo": "number",          -- "number" | "scale" | "text" | "boolean"
    --   "unidad": "frutos",
    --   "min": 0, "max": 1000,
    --   "obligatorio": true,
    --   "escala": null             -- Sólo para tipo "scale": ["Ausente","Bajo","Medio","Alto"]
    -- },
    -- {
    --   "clave": "nivel_dano",
    --   "etiqueta": "Nivel de Daño Visual",
    --   "tipo": "scale",
    --   "unidad": null,
    --   "escala": ["0 - Sin daño", "1 - Leve", "2 - Moderado", "3 - Grave", "4 - Muy grave"]
    -- }
    frecuencia_dias      INTEGER,  -- Días entre monitoreos recomendados
    tamanio_muestra      INTEGER,  -- Número de plantas/puntos a evaluar
    metodologia          TEXT,
    estado               VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'obsoleto')),
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    created_by           TEXT,
    updated_by           TEXT
);

COMMENT ON TABLE public.protocolos_evaluacion IS 'Define las variables de campo para cada objeto de evaluación, con versionado completo. Las evaluaciones históricas quedan vinculadas a su versión exacta para garantizar trazabilidad.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. UMBRALES ECONÓMICOS DINÁMICOS (multi-variable)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.umbrales_economicos (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    objeto_evaluacion_id UUID NOT NULL REFERENCES public.objetos_evaluacion(id) ON DELETE CASCADE,
    cultivo_id           UUID REFERENCES public.cultivos(id) ON DELETE CASCADE,
    estado_fenologico_id UUID REFERENCES public.estados_fenologicos(id) ON DELETE SET NULL,
    variedad             VARCHAR(100),  -- NULL = aplica a todas las variedades
    region               VARCHAR(100),  -- NULL = aplica a todas las regiones
    variable_clave       VARCHAR(100) NOT NULL, -- Ej: 'incidencia_pct', 'frutos_enfermos'
    operador             VARCHAR(10)  NOT NULL CHECK (operador IN ('>', '<', '>=', '<=', '=')),
    valor_critico        DOUBLE PRECISION NOT NULL,
    nivel_riesgo         VARCHAR(20) NOT NULL CHECK (nivel_riesgo IN ('bajo', 'medio', 'alto', 'critico')),
    mensaje_alerta       TEXT NOT NULL,
    recomendacion_inmediata TEXT,
    activo               BOOLEAN NOT NULL DEFAULT true,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    created_by           TEXT,
    updated_by           TEXT
);

COMMENT ON TABLE public.umbrales_economicos IS 'Umbrales económicos dinámicos: soportan múltiples variables de condición (variedad, región, etapa fenológica) en lugar de un único valor fijo.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. MOTOR DE REGLAS AGRONÓMICAS
--    Condición JSONB → Acción (alerta, recomendación, notificación)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reglas_agronomicas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cultivo_id  UUID REFERENCES public.cultivos(id) ON DELETE CASCADE,
    nombre      VARCHAR(200) NOT NULL,
    descripcion TEXT,
    -- Condiciones en JSONB. Ejemplo:
    -- [
    --   {"variable": "incidencia_pct", "operador": ">", "valor": 18},
    --   {"variable": "weather.rain_forecast", "operador": "=", "valor": true}
    -- ]
    condiciones JSONB NOT NULL,
    operador_logico VARCHAR(5) NOT NULL DEFAULT 'AND' CHECK (operador_logico IN ('AND', 'OR')),
    -- Acción a ejecutar cuando se cumplan las condiciones
    accion_tipo VARCHAR(50) NOT NULL CHECK (accion_tipo IN (
        'alerta_roja',
        'alerta_amarilla',
        'alerta_azul',
        'notificacion',
        'recomendacion_automatica'
    )),
    accion_datos JSONB, -- Datos adicionales: mensaje, nivel de prioridad, destinatarios, etc.
    activo       BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    created_by   TEXT,
    updated_by   TEXT
);

COMMENT ON TABLE public.reglas_agronomicas IS 'Motor de reglas: define condiciones y acciones automatizadas. Permite generar alertas, notificaciones y recomendaciones basadas en los valores de una evaluación o en el clima.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. TRATAMIENTOS POR INGREDIENTE ACTIVO (no por producto comercial)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.objeto_tratamientos (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    objeto_evaluacion_id UUID NOT NULL REFERENCES public.objetos_evaluacion(id) ON DELETE CASCADE,
    tipo_control         VARCHAR(50) NOT NULL CHECK (tipo_control IN (
        'Cultural',
        'Biológico',
        'Químico',
        'Mecánico',
        'Preventivo'
    )),
    ingrediente_activo   VARCHAR(200), -- Sólo para control Químico/Biológico. Ej: 'Clorotalonil', 'Trichoderma harzianum'
    codigo_frac          VARCHAR(20),  -- Fungicide Resistance Action Committee
    codigo_irac          VARCHAR(20),  -- Insecticide Resistance Action Committee
    codigo_hrac          VARCHAR(20),  -- Herbicide Resistance Action Committee
    dosis_recomendada    VARCHAR(100), -- Ej: '2.0 L/ha'
    intervalo_dias       INTEGER,      -- Intervalo mínimo entre aplicaciones
    descripcion          TEXT NOT NULL, -- Descripción del control a implementar
    precauciones         TEXT,
    activo               BOOLEAN NOT NULL DEFAULT true,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    created_by           TEXT,
    updated_by           TEXT
);

COMMENT ON TABLE public.objeto_tratamientos IS 'Tratamientos por ingrediente activo (no marca comercial). El sistema buscará los productos disponibles en bodega que coincidan con el ingrediente activo recomendado.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. ALTERACIONES A TABLAS EXISTENTES
-- ─────────────────────────────────────────────────────────────────────────────

-- 9a. lotes: agregar cultivo_id (relación al catálogo maestro)
ALTER TABLE public.lotes
    ADD COLUMN IF NOT EXISTS cultivo_id UUID REFERENCES public.cultivos(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.lotes.cultivo_id IS 'Referencia al catálogo maestro de cultivos. La columna cultivo (VARCHAR) se conserva por compatibilidad.';

-- 9b. monitoreos: enriquecer con protocolo versionado, objeto y valores dinámicos
ALTER TABLE public.monitoreos
    ADD COLUMN IF NOT EXISTS protocolo_version_id UUID REFERENCES public.protocolos_evaluacion(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS objeto_evaluacion_id  UUID REFERENCES public.objetos_evaluacion(id)  ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS valores_evaluacion    JSONB,
    ADD COLUMN IF NOT EXISTS created_by            TEXT,
    ADD COLUMN IF NOT EXISTS updated_by            TEXT,
    ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now());

COMMENT ON COLUMN public.monitoreos.protocolo_version_id IS 'Versión exacta del protocolo utilizado en esta evaluación. Garantiza trazabilidad histórica aunque el protocolo evolucione.';
COMMENT ON COLUMN public.monitoreos.valores_evaluacion IS 'JSON de valores ingresados según las variables del protocolo: {"frutos_enfermos": 45, "frutos_evaluados": 200, "nivel_dano": "Moderado"}';

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. ÍNDICES DE RENDIMIENTO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cultivo_objetos_cultivo     ON public.cultivo_objetos(cultivo_id);
CREATE INDEX IF NOT EXISTS idx_cultivo_objetos_objeto      ON public.cultivo_objetos(objeto_evaluacion_id);
CREATE INDEX IF NOT EXISTS idx_cultivo_objetos_estado_fen  ON public.cultivo_objetos(estado_fenologico_id);
CREATE INDEX IF NOT EXISTS idx_protocolos_objeto           ON public.protocolos_evaluacion(objeto_evaluacion_id);
CREATE INDEX IF NOT EXISTS idx_protocolos_cultivo          ON public.protocolos_evaluacion(cultivo_id);
CREATE INDEX IF NOT EXISTS idx_protocolos_vigente          ON public.protocolos_evaluacion(vigencia_hasta) WHERE vigencia_hasta IS NULL;
CREATE INDEX IF NOT EXISTS idx_umbrales_objeto             ON public.umbrales_economicos(objeto_evaluacion_id);
CREATE INDEX IF NOT EXISTS idx_umbrales_cultivo            ON public.umbrales_economicos(cultivo_id);
CREATE INDEX IF NOT EXISTS idx_monitoreos_objeto           ON public.monitoreos(objeto_evaluacion_id);
CREATE INDEX IF NOT EXISTS idx_monitoreos_protocolo        ON public.monitoreos(protocolo_version_id);
CREATE INDEX IF NOT EXISTS idx_lotes_cultivo_id            ON public.lotes(cultivo_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. POLÍTICAS RLS
-- ─────────────────────────────────────────────────────────────────────────────

-- Las tablas de catálogo (cultivos, estados_fenologicos, objetos_evaluacion,
-- protocolos_evaluacion, umbrales_economicos, reglas_agronomicas, objeto_tratamientos)
-- son de lectura pública para cualquier usuario autenticado.
-- La escritura queda reservada para service_role (administración).

ALTER TABLE public.cultivos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estados_fenologicos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objetos_evaluacion    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cultivo_objetos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocolos_evaluacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.umbrales_economicos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reglas_agronomicas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objeto_tratamientos   ENABLE ROW LEVEL SECURITY;

-- Lectura para todos los usuarios autenticados
CREATE POLICY "cultivos_lectura_publica"              ON public.cultivos              FOR SELECT TO authenticated USING (true);
CREATE POLICY "estados_fenologicos_lectura_publica"   ON public.estados_fenologicos   FOR SELECT TO authenticated USING (true);
CREATE POLICY "objetos_evaluacion_lectura_publica"    ON public.objetos_evaluacion    FOR SELECT TO authenticated USING (true);
CREATE POLICY "cultivo_objetos_lectura_publica"       ON public.cultivo_objetos       FOR SELECT TO authenticated USING (true);
CREATE POLICY "protocolos_lectura_publica"            ON public.protocolos_evaluacion FOR SELECT TO authenticated USING (true);
CREATE POLICY "umbrales_lectura_publica"              ON public.umbrales_economicos   FOR SELECT TO authenticated USING (true);
CREATE POLICY "reglas_lectura_publica"                ON public.reglas_agronomicas    FOR SELECT TO authenticated USING (true);
CREATE POLICY "tratamientos_lectura_publica"          ON public.objeto_tratamientos   FOR SELECT TO authenticated USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. DATOS SEMILLA: CULTIVOS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.cultivos (id, nombre_comun, nombre_cientifico, familia_botanica, ciclo_productivo, descripcion)
VALUES
    ('11111111-0000-0000-0000-000000000001', 'Cacao',    'Theobroma cacao',       'Malvaceae',    'Perenne',    'Cultivo tropical de alta importancia económica para la producción de chocolate.'),
    ('11111111-0000-0000-0000-000000000002', 'Café',     'Coffea arabica',         'Rubiaceae',    'Perenne',    'Principal cultivo de exportación de Colombia.'),
    ('11111111-0000-0000-0000-000000000003', 'Palma',    'Elaeis guineensis',     'Arecaceae',    'Perenne',    'Cultivo oleaginoso de ciclo largo.'),
    ('11111111-0000-0000-0000-000000000004', 'Banano',   'Musa paradisiaca',      'Musaceae',     'Perenne',    'Cultivo de exportación. Sensible a Sigatoka negra.'),
    ('11111111-0000-0000-0000-000000000005', 'Maíz',     'Zea mays',              'Poaceae',      'Anual',      'Cereal de ciclo corto ampliamente cultivado.'),
    ('11111111-0000-0000-0000-000000000006', 'Arroz',    'Oryza sativa',          'Poaceae',      'Anual',      'Cultivo de ciclo corto, requiere alta humedad.'),
    ('11111111-0000-0000-0000-000000000007', 'Aguacate', 'Persea americana',      'Lauraceae',    'Perenne',    'Frutal de ciclo largo con alta demanda internacional.'),
    ('11111111-0000-0000-0000-000000000008', 'Cítricos', 'Citrus spp.',           'Rutaceae',     'Perenne',    'Grupo de frutales cítricos: naranja, mandarina, limón.'),
    ('11111111-0000-0000-0000-000000000009', 'Soya',     'Glycine max',           'Fabaceae',     'Anual',      'Oleaginosa de ciclo corto.'),
    ('11111111-0000-0000-0000-000000000010', 'Girasol',  'Helianthus annuus',     'Asteraceae',   'Anual',      'Oleaginosa de ciclo corto con alto contenido de aceite.')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. DATOS SEMILLA: ESTADOS FENOLÓGICOS DE CACAO Y CAFÉ
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.estados_fenologicos (id, cultivo_id, nombre, orden)
VALUES
    -- Cacao
    ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Establecimiento',   1),
    ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'Crecimiento',       2),
    ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'Floración',         3),
    ('22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', 'Fructificación',    4),
    ('22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001', 'Maduración',        5),
    ('22222222-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000001', 'Cosecha',           6),
    -- Café
    ('22222222-0000-0000-0000-000000000011', '11111111-0000-0000-0000-000000000002', 'Almácigo',          1),
    ('22222222-0000-0000-0000-000000000012', '11111111-0000-0000-0000-000000000002', 'Desarrollo',        2),
    ('22222222-0000-0000-0000-000000000013', '11111111-0000-0000-0000-000000000002', 'Floración',         3),
    ('22222222-0000-0000-0000-000000000014', '11111111-0000-0000-0000-000000000002', 'Fruto Verde',       4),
    ('22222222-0000-0000-0000-000000000015', '11111111-0000-0000-0000-000000000002', 'Maduración',        5),
    ('22222222-0000-0000-0000-000000000016', '11111111-0000-0000-0000-000000000002', 'Cosecha',           6)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. DATOS SEMILLA: OBJETOS DE EVALUACIÓN (Cacao)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.objetos_evaluacion (id, nombre_comun, nombre_cientifico, categoria, subcategoria, descripcion)
VALUES
    ('33333333-0000-0000-0000-000000000001', 'Monilia', 'Moniliophthora roreri',      'Enfermedad Fúngica',    'Moniliasis',        'Principal enfermedad fúngica del cacao. Afecta directamente los frutos.'),
    ('33333333-0000-0000-0000-000000000002', 'Escoba de Bruja', 'Moniliophthora perniciosa', 'Enfermedad Fúngica', 'Escoba de Bruja', 'Enfermedad que causa proliferación anormal de brotes.'),
    ('33333333-0000-0000-0000-000000000003', 'Monalonion', 'Monalonion dissimulatum',  'Insecto',               'Hemíptero',         'Insecto perforador que daña frutos y cojines florales del cacao.'),
    ('33333333-0000-0000-0000-000000000004', 'Trips del Cacao', 'Selenothrips rubrocinctus', 'Insecto',          'Trips',             'Insecto que causa raspado y bronceado en hojas y frutos jóvenes.'),
    ('33333333-0000-0000-0000-000000000005', 'Carmenta', 'Carmenta foraseminis',       'Insecto',               'Barrenador',        'Barrenador de semillas del cacao, con daño interno poco visible.'),
    ('33333333-0000-0000-0000-000000000006', 'Estrés Hídrico Cacao', null,             'Daño Abiótico',         'Sequía',            'Déficit hídrico que afecta la productividad y la calidad del fruto.'),
    ('33333333-0000-0000-0000-000000000007', 'Deficiencia de Potasio', null,           'Deficiencia Nutricional', 'Macronutriente',  'Deficiencia que afecta el desarrollo del fruto y la calidad del grano.'),
    -- Café
    ('33333333-0000-0000-0000-000000000011', 'Roya del Café', 'Hemileia vastatrix',   'Enfermedad Fúngica',    'Roya',              'Principal enfermedad fúngica del café. Afecta hojas con pústulas anaranjadas.'),
    ('33333333-0000-0000-0000-000000000012', 'Broca del Café', 'Hypothenemus hampei', 'Insecto',               'Barrenador',        'Insecto que perfora y se reproduce dentro del grano de café.'),
    ('33333333-0000-0000-0000-000000000013', 'Llagas Radicales', 'Rosellinia bunodes', 'Enfermedad Fúngica',   'Pudrición Radicular','Enfermedad que afecta el sistema radicular del café.')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. DATOS SEMILLA: RELACIONES CULTIVO → OBJETO POR ETAPA (Cacao)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.cultivo_objetos (cultivo_id, objeto_evaluacion_id, estado_fenologico_id, relevancia)
VALUES
    -- Monilia aplica principalmente en Fructificación, Maduración y Cosecha
    ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000004', 'critica'),
    ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000005', 'critica'),
    ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000006', 'alta'),
    -- Escoba de Bruja aplica desde Floración
    ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000003', 'alta'),
    ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000004', 'alta'),
    -- Monalonion aplica en todas las etapas (NULL = todas)
    ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000003', NULL, 'alta'),
    -- Trips en Floración y Fructificación
    ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000003', 'normal'),
    ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000004', 'normal'),
    -- Carmenta en Fructificación y Maduración
    ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000004', 'normal'),
    ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000005', 'alta'),
    -- Café
    ('11111111-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000011', NULL, 'critica'),
    ('11111111-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000012', '22222222-0000-0000-0000-000000000015', 'critica'),
    ('11111111-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000012', '22222222-0000-0000-0000-000000000016', 'critica'),
    ('11111111-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000013', NULL, 'alta')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. DATOS SEMILLA: PROTOCOLOS DE EVALUACIÓN
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.protocolos_evaluacion
    (id, objeto_evaluacion_id, cultivo_id, estado_fenologico_id, version, variables, frecuencia_dias, tamanio_muestra)
VALUES
    -- Protocolo: Monilia en Cacao (Fructificación) v1.0
    (
        '44444444-0000-0000-0000-000000000001',
        '33333333-0000-0000-0000-000000000001',
        '11111111-0000-0000-0000-000000000001',
        '22222222-0000-0000-0000-000000000004',
        '1.0',
        '[
            {"clave": "frutos_evaluados",  "etiqueta": "Frutos Evaluados",  "tipo": "number", "unidad": "frutos", "min": 1, "max": 2000, "obligatorio": true,  "escala": null},
            {"clave": "frutos_enfermos",   "etiqueta": "Frutos Enfermos",   "tipo": "number", "unidad": "frutos", "min": 0, "max": 2000, "obligatorio": true,  "escala": null},
            {"clave": "frutos_mumificados","etiqueta": "Frutos Mumificados","tipo": "number", "unidad": "frutos", "min": 0, "max": 2000, "obligatorio": false, "escala": null},
            {"clave": "estado_fruto",      "etiqueta": "Estado Sanitario del Fruto", "tipo": "scale", "unidad": null, "min": null, "max": null, "obligatorio": true,
             "escala": ["0 - Sin síntomas", "1 - Mancha inicial", "2 - Esporulación leve", "3 - Esporulación severa", "4 - Fruto perdido"]},
            {"clave": "temperatura_c",     "etiqueta": "Temperatura",       "tipo": "number", "unidad": "°C",    "min": 15, "max": 45, "obligatorio": false, "escala": null},
            {"clave": "humedad_pct",       "etiqueta": "Humedad Relativa",  "tipo": "number", "unidad": "%",     "min": 0,  "max": 100,"obligatorio": false, "escala": null},
            {"clave": "observaciones",     "etiqueta": "Observaciones",     "tipo": "text",   "unidad": null,    "min": null,"max": null,"obligatorio": false, "escala": null}
        ]'::jsonb,
        7, 100
    ),
    -- Protocolo: Monalonion en Cacao (todas las etapas) v1.0
    (
        '44444444-0000-0000-0000-000000000002',
        '33333333-0000-0000-0000-000000000003',
        '11111111-0000-0000-0000-000000000001',
        NULL,
        '1.0',
        '[
            {"clave": "adultos_por_arbol", "etiqueta": "Adultos por Árbol",  "tipo": "number", "unidad": "adultos/árbol", "min": 0, "max": 500, "obligatorio": true,  "escala": null},
            {"clave": "ninfas_por_arbol",  "etiqueta": "Ninfas por Árbol",   "tipo": "number", "unidad": "ninfas/árbol",  "min": 0, "max": 500, "obligatorio": true,  "escala": null},
            {"clave": "huevos_por_arbol",  "etiqueta": "Masas de Huevos",    "tipo": "number", "unidad": "masas/árbol",   "min": 0, "max": 200, "obligatorio": false, "escala": null},
            {"clave": "frutos_danados",    "etiqueta": "Frutos Dañados",     "tipo": "number", "unidad": "frutos",        "min": 0, "max": 2000,"obligatorio": true,  "escala": null},
            {"clave": "nivel_infestacion", "etiqueta": "Nivel de Infestación","tipo": "scale", "unidad": null, "min": null, "max": null, "obligatorio": true,
             "escala": ["Ausente", "Bajo (< 2 adultos/árbol)", "Medio (2-5 adultos/árbol)", "Alto (> 5 adultos/árbol)", "Muy Alto (plaga generalizada)"]},
            {"clave": "observaciones",     "etiqueta": "Observaciones",      "tipo": "text",   "unidad": null, "min": null, "max": null, "obligatorio": false, "escala": null}
        ]'::jsonb,
        14, 50
    ),
    -- Protocolo: Roya del Café v1.0
    (
        '44444444-0000-0000-0000-000000000003',
        '33333333-0000-0000-0000-000000000011',
        '11111111-0000-0000-0000-000000000002',
        NULL,
        '1.0',
        '[
            {"clave": "hojas_evaluadas",   "etiqueta": "Hojas Evaluadas",   "tipo": "number", "unidad": "hojas",   "min": 1, "max": 1000, "obligatorio": true,  "escala": null},
            {"clave": "hojas_infectadas",  "etiqueta": "Hojas Infectadas",  "tipo": "number", "unidad": "hojas",   "min": 0, "max": 1000, "obligatorio": true,  "escala": null},
            {"clave": "severidad_visual",  "etiqueta": "Severidad Visual",  "tipo": "scale",  "unidad": null, "min": null, "max": null, "obligatorio": true,
             "escala": ["0 - Sin síntomas", "1 - 1 a 5 pústulas/hoja", "2 - 6 a 15 pústulas/hoja", "3 - 16 a 30 pústulas/hoja", "4 - > 30 pústulas o defoliación"]},
            {"clave": "defoliacion_pct",   "etiqueta": "Defoliación",       "tipo": "number", "unidad": "%",       "min": 0, "max": 100, "obligatorio": false, "escala": null},
            {"clave": "observaciones",     "etiqueta": "Observaciones",     "tipo": "text",   "unidad": null, "min": null, "max": null, "obligatorio": false, "escala": null}
        ]'::jsonb,
        14, 100
    ),
    -- Protocolo: Broca del Café v1.0
    (
        '44444444-0000-0000-0000-000000000004',
        '33333333-0000-0000-0000-000000000012',
        '11111111-0000-0000-0000-000000000002',
        NULL,
        '1.0',
        '[
            {"clave": "frutos_muestreados","etiqueta": "Frutos Muestreados","tipo": "number", "unidad": "frutos", "min": 1, "max": 500, "obligatorio": true,  "escala": null},
            {"clave": "frutos_brocados",   "etiqueta": "Frutos Brocados",   "tipo": "number", "unidad": "frutos", "min": 0, "max": 500, "obligatorio": true,  "escala": null},
            {"clave": "tipo_dano",         "etiqueta": "Tipo de Daño",      "tipo": "scale",  "unidad": null, "min": null, "max": null, "obligatorio": true,
             "escala": ["A - Perfil externo", "B - Entrada entre 0-30%", "C - Entrada > 30% sin huevo", "D - Huevos presentes", "E - Larvas o pupas"]},
            {"clave": "observaciones",     "etiqueta": "Observaciones",     "tipo": "text",   "unidad": null, "min": null, "max": null, "obligatorio": false, "escala": null}
        ]'::jsonb,
        14, 100
    )
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. DATOS SEMILLA: UMBRALES ECONÓMICOS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.umbrales_economicos
    (objeto_evaluacion_id, cultivo_id, estado_fenologico_id, variable_clave, operador, valor_critico, nivel_riesgo, mensaje_alerta, recomendacion_inmediata)
VALUES
    -- Monilia: Incidencia > 15% en Fructificación → alto
    ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000004',
     'incidencia_pct', '>', 15, 'alto',
     '¡Alerta fitosanitaria! Incidencia de Monilia supera el 15%. Intervención inmediata requerida.',
     'Realizar remoción sanitaria de frutos enfermos y aplicar control químico con cobre preventivo.'),
    -- Monilia: Incidencia > 25% en Fructificación → crítico
    ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000004',
     'incidencia_pct', '>', 25, 'critico',
     '⚠️ CRÍTICO: Incidencia de Monilia supera el 25%. Riesgo de pérdida total de cosecha.',
     'Suspender fermentación y secar el material enfermo. Ejecutar plan de manejo de emergencia.'),
    -- Monalonion: > 5 adultos/árbol → crítico
    ('33333333-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', NULL,
     'adultos_por_arbol', '>', 5, 'critico',
     '¡Umbral crítico de Monalonion! Más de 5 adultos por árbol detectados.',
     'Aplicar control químico sistémico y revisar lotes adyacentes.'),
    -- Roya del Café: Incidencia > 10% → alto
    ('33333333-0000-0000-0000-000000000011', '11111111-0000-0000-0000-000000000002', NULL,
     'incidencia_pct', '>', 10, 'alto',
     'Incidencia de Roya supera el 10%. Realizar aplicación preventiva.',
     'Aplicar fungicida sistémico triazol o estrobilurina. Revisar condiciones de humedad.'),
    -- Broca del Café: > 5% → alto
    ('33333333-0000-0000-0000-000000000012', '11111111-0000-0000-0000-000000000002', NULL,
     'incidencia_pct', '>', 5, 'alto',
     'Infestación de Broca supera el 5%. Aplicar control biológico o trampeo intensivo.',
     'Instalar trampas Beauveria bassiana y revisar cronograma de cosecha.')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 18. DATOS SEMILLA: TRATAMIENTOS POR INGREDIENTE ACTIVO
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.objeto_tratamientos
    (objeto_evaluacion_id, tipo_control, ingrediente_activo, codigo_frac, dosis_recomendada, intervalo_dias, descripcion)
VALUES
    -- Monilia: Control Cultural
    ('33333333-0000-0000-0000-000000000001', 'Cultural', null, null, null, null, 'Remoción y destrucción de frutos enfermos (moniliasis). Mínimo 2 veces por semana durante epidemia.'),
    -- Monilia: Control Químico con Cobre
    ('33333333-0000-0000-0000-000000000001', 'Químico', 'Cobre (oxicloruro)', 'M1', '3.0 L/ha', 10, 'Aplicación preventiva de oxicloruro de cobre. Cubre ampliamente la superficie del fruto.'),
    -- Monilia: Control Biológico
    ('33333333-0000-0000-0000-000000000001', 'Biológico', 'Trichoderma harzianum', null, '5.0 kg/ha', 14, 'Aplicación de biocontrolador a base de Trichoderma harzianum para reducir fuentes de inóculo.'),
    -- Monalonion: Control Químico
    ('33333333-0000-0000-0000-000000000003', 'Químico', 'Imidacloprid', 'IRAC-4A', '0.5 L/ha', 21, 'Insecticida sistémico neonicotinoide. Effective contre adultes y ninfas. Rotar FRAC.'),
    ('33333333-0000-0000-0000-000000000003', 'Químico', 'Thiamethoxam', 'IRAC-4A', '0.3 L/ha', 21, 'Alternativa neonicotinoide para rotación con imidacloprid.'),
    -- Roya: Químico
    ('33333333-0000-0000-0000-000000000011', 'Químico', 'Tebuconazol', 'FRAC-3', '0.75 L/ha', 21, 'Fungicida triazol sistémico contra Roya del café. Alta eficacia curativa.'),
    ('33333333-0000-0000-0000-000000000011', 'Químico', 'Azoxistrobin', 'FRAC-11', '0.5 L/ha', 21, 'Estrobilurina preventiva. Rotar con triazoles para evitar resistencia.'),
    -- Broca: Biológico
    ('33333333-0000-0000-0000-000000000012', 'Biológico', 'Beauveria bassiana', null, '1.0 kg/ha', 14, 'Hongo entomopatógeno para control de Broca. Aplicar en horas de baja radiación.')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 19. DATOS SEMILLA: REGLAS AGRONÓMICAS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.reglas_agronomicas (cultivo_id, nombre, condiciones, operador_logico, accion_tipo, accion_datos)
VALUES
    (
        '11111111-0000-0000-0000-000000000001',
        'Alerta Roja Monilia + Lluvia Pronosticada',
        '[{"variable": "incidencia_pct", "operador": ">", "valor": 18}, {"variable": "humedad_pct", "operador": ">=", "valor": 85}]'::jsonb,
        'AND',
        'alerta_roja',
        '{"titulo": "ALERTA ROJA: Condiciones óptimas para explosión de Monilia", "mensaje": "Incidencia superior al 18% con humedad >= 85%. Riesgo de pérdida de cosecha en las próximas 72h.", "prioridad": "urgente"}'::jsonb
    ),
    (
        '11111111-0000-0000-0000-000000000002',
        'Alerta Roya Café - Incidencia Alta',
        '[{"variable": "incidencia_pct", "operador": ">", "valor": 10}]'::jsonb,
        'AND',
        'alerta_amarilla',
        '{"titulo": "Alerta de Roya: Supera umbral del 10%", "mensaje": "Programar aplicación fungicida en los próximos 5 días.", "prioridad": "alta"}'::jsonb
    )
ON CONFLICT DO NOTHING;
