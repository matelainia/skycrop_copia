-- ==============================================================================
-- SKYCROP DATABASE: 030_protocol_normalized_entities.sql
-- Descripción: Normaliza los componentes del Protocolo de Evaluación.
--
-- Reemplaza el almacenamiento JSONB (variables/umbrales/reglas dentro de
-- protocolos_evaluacion) por entidades relacionales dedicadas:
--
--   protocolo_variables  →  Cada variable de campo del protocolo
--   protocolo_escalas    →  Rangos de color por nivel para variables numéricas/escala
--   protocolo_umbrales   →  Condiciones de alerta SI [var] [op] [val] → [nivel]
--   protocolo_reglas     →  Automatizaciones SI/ENTONCES
--
-- Ventajas:
--   - Consultas independientes por entidad
--   - Reutilización de escalas entre protocolos
--   - Trazabilidad individual de cambios
--   - Soporte nativo para reportes, clonación y entrenamiento IA
--
-- Incluye:
--   - Creación de tablas con FK, CHECK y auditoría
--   - RLS consistente con el resto del esquema
--   - Índices de búsqueda
--   - Script de migración PL/pgSQL idempotente desde columnas JSONB existentes
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. VARIABLES DEL PROTOCOLO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.protocolo_variables (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocolo_id    UUID NOT NULL REFERENCES public.protocolos_evaluacion(id) ON DELETE CASCADE,
    clave           VARCHAR(100) NOT NULL,       -- Identificador técnico: "frutos_enfermos"
    etiqueta        VARCHAR(200) NOT NULL,       -- Nombre legible: "Frutos Enfermos"
    tipo            VARCHAR(50)  NOT NULL        -- Número, Decimal, Texto, Escala, Booleano, Lista, Imagen, GPS, Fecha, Hora
        CHECK (tipo IN ('Número','Decimal','Texto','Escala','Booleano','Lista','Imagen','GPS','Fecha','Hora')),
    unidad          VARCHAR(100),                -- Ej: "frutos", "%" , "°C"
    obligatorio     BOOLEAN NOT NULL DEFAULT true,
    orden           SMALLINT NOT NULL DEFAULT 0, -- Orden de aparición en el formulario
    min_valor       DOUBLE PRECISION,            -- Validación mínima para tipos numéricos
    max_valor       DOUBLE PRECISION,            -- Validación máxima para tipos numéricos
    opciones        JSONB DEFAULT '[]'::jsonb,   -- Para tipo "Lista": ["Sí","No"] o ["A","B","C"]
    opciones_escala JSONB DEFAULT '[]'::jsonb,   -- Para tipo "Escala": ["0-Sin daño","1-Leve","2-Moderado"]
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    UNIQUE (protocolo_id, clave)
);

COMMENT ON TABLE  public.protocolo_variables               IS 'Variables individuales de campo de un protocolo de evaluación. Cada variable define qué mide el evaluador y cómo (tipo de dato, validaciones, unidades).';
COMMENT ON COLUMN public.protocolo_variables.clave         IS 'Identificador técnico único dentro del protocolo. Se usa como clave en los JSONB de valores_evaluacion. Ej: frutos_enfermos, incidencia_pct.';
COMMENT ON COLUMN public.protocolo_variables.tipo          IS 'Tipo de dato del campo. Determina el control visual en el formulario de campo.';
COMMENT ON COLUMN public.protocolo_variables.opciones      IS 'Opciones válidas para tipo Lista. Array JSON de strings.';
COMMENT ON COLUMN public.protocolo_variables.opciones_escala IS 'Opciones válidas para tipo Escala. Array JSON de strings con etiquetas ordinales.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ESCALAS DE COLOR POR VARIABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.protocolo_escalas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocolo_id    UUID NOT NULL REFERENCES public.protocolos_evaluacion(id) ON DELETE CASCADE,
    variable_id     UUID NOT NULL REFERENCES public.protocolo_variables(id) ON DELETE CASCADE,
    variable_clave  VARCHAR(100) NOT NULL,   -- Redundante de protocolo_variables.clave, facilita queries
    nivel           VARCHAR(50)  NOT NULL    -- Bajo, Medio, Alto, Crítico
        CHECK (nivel IN ('Bajo','Medio','Alto','Crítico')),
    min_val         DOUBLE PRECISION,        -- Rango mínimo (NULL = sin límite inferior)
    max_val         DOUBLE PRECISION,        -- Rango máximo (NULL = sin límite superior)
    color           VARCHAR(20) NOT NULL,    -- Hex del color de la etiqueta: #15803d
    bg_color        VARCHAR(40),             -- Hex del background: rgba(21,128,61,0.12)
    orden           SMALLINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    UNIQUE (variable_id, nivel)
);

COMMENT ON TABLE  public.protocolo_escalas            IS 'Rangos de color que categorizan los valores registrados para una variable. Permite visualizar semáforos de riesgo en informes y dashboard.';
COMMENT ON COLUMN public.protocolo_escalas.nivel      IS 'Nivel de riesgo representado. Determina el color visual: Bajo=verde, Medio=amarillo, Alto=naranja, Crítico=rojo.';
COMMENT ON COLUMN public.protocolo_escalas.min_val    IS 'Valor mínimo del rango inclusivo. NULL = desde -infinito.';
COMMENT ON COLUMN public.protocolo_escalas.max_val    IS 'Valor máximo del rango exclusivo. NULL = hasta +infinito.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. UMBRALES DE ALERTA DEL PROTOCOLO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.protocolo_umbrales (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocolo_id    UUID NOT NULL REFERENCES public.protocolos_evaluacion(id) ON DELETE CASCADE,
    variable_clave  VARCHAR(100) NOT NULL,   -- Referencia la clave de protocolo_variables
    operador        VARCHAR(5)   NOT NULL
        CHECK (operador IN ('>','<','>=','<=','=','!=')),
    valor           DOUBLE PRECISION NOT NULL,
    nivel_riesgo    VARCHAR(20)  NOT NULL
        CHECK (nivel_riesgo IN ('Bajo','Medio','Alto','Crítico')),
    mensaje         TEXT,                    -- Texto descriptivo mostrado al alcanzar el umbral
    activo          BOOLEAN NOT NULL DEFAULT true,
    orden           SMALLINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

COMMENT ON TABLE  public.protocolo_umbrales             IS 'Condiciones de alerta del protocolo. Cuando un valor de evaluación supera el umbral se activa la alerta con el nivel de riesgo correspondiente.';
COMMENT ON COLUMN public.protocolo_umbrales.variable_clave IS 'Clave técnica de la variable del protocolo sobre la que aplica el umbral. Debe existir en protocolo_variables para ese protocolo.';
COMMENT ON COLUMN public.protocolo_umbrales.operador    IS 'Operador de comparación: > mayor, < menor, >= mayor o igual, <= menor o igual, = igual, != diferente.';
COMMENT ON COLUMN public.protocolo_umbrales.nivel_riesgo IS 'Nivel de alerta que se activa: Bajo, Medio, Alto o Crítico.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. REGLAS AUTOMÁTICAS DEL PROTOCOLO (SI/ENTONCES)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.protocolo_reglas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocolo_id    UUID NOT NULL REFERENCES public.protocolos_evaluacion(id) ON DELETE CASCADE,
    -- Condición: SI [variable_clave] [operador] [valor]
    variable_clave  VARCHAR(100) NOT NULL,
    operador        VARCHAR(5)   NOT NULL
        CHECK (operador IN ('>','<','>=','<=','=','!=')),
    valor           TEXT         NOT NULL,   -- TEXT para soportar valores numéricos o de escala
    -- Acción: ENTONCES [accion]
    accion          VARCHAR(100) NOT NULL
        CHECK (accion IN (
            'Crear alerta',
            'Crear tarea',
            'Enviar notificación',
            'Recomendar intervención',
            'Cambiar estado del lote',
            'Registrar incidencia'
        )),
    mensaje         TEXT,                    -- Mensaje opcional de la acción
    activo          BOOLEAN NOT NULL DEFAULT true,
    orden           SMALLINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

COMMENT ON TABLE  public.protocolo_reglas            IS 'Reglas automáticas SI/ENTONCES definidas en el protocolo. Permiten disparar acciones (alertas, tareas, notificaciones) cuando los valores evaluados cumplen una condición.';
COMMENT ON COLUMN public.protocolo_reglas.valor      IS 'Valor de comparación como texto. Para tipos numéricos contiene el número; para escala, la etiqueta del nivel.';
COMMENT ON COLUMN public.protocolo_reglas.accion     IS 'Acción a ejecutar cuando la condición es verdadera.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ÍNDICES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_prot_vars_protocolo    ON public.protocolo_variables(protocolo_id);
CREATE INDEX IF NOT EXISTS idx_prot_vars_clave        ON public.protocolo_variables(protocolo_id, clave);
CREATE INDEX IF NOT EXISTS idx_prot_escalas_variable  ON public.protocolo_escalas(variable_id);
CREATE INDEX IF NOT EXISTS idx_prot_escalas_protocolo ON public.protocolo_escalas(protocolo_id);
CREATE INDEX IF NOT EXISTS idx_prot_umbrales_protocolo ON public.protocolo_umbrales(protocolo_id);
CREATE INDEX IF NOT EXISTS idx_prot_reglas_protocolo   ON public.protocolo_reglas(protocolo_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.protocolo_variables  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocolo_escalas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocolo_umbrales   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocolo_reglas     ENABLE ROW LEVEL SECURITY;

-- Lectura pública autenticada (misma política que protocolos_evaluacion)
CREATE POLICY "protocolo_variables_select"  ON public.protocolo_variables  FOR SELECT TO authenticated USING (true);
CREATE POLICY "protocolo_escalas_select"    ON public.protocolo_escalas    FOR SELECT TO authenticated USING (true);
CREATE POLICY "protocolo_umbrales_select"   ON public.protocolo_umbrales   FOR SELECT TO authenticated USING (true);
CREATE POLICY "protocolo_reglas_select"     ON public.protocolo_reglas     FOR SELECT TO authenticated USING (true);

-- Escritura solo service_role (acceso desde backend con supabaseAdmin)
CREATE POLICY "protocolo_variables_write"   ON public.protocolo_variables  FOR ALL   TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "protocolo_escalas_write"     ON public.protocolo_escalas    FOR ALL   TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "protocolo_umbrales_write"    ON public.protocolo_umbrales   FOR ALL   TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "protocolo_reglas_write"      ON public.protocolo_reglas     FOR ALL   TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. MIGRACIÓN DE DATOS EXISTENTES (JSONB → Tablas Relacionales)
--    Idempotente: solo inserta si no existen registros para ese protocolo.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    r_protocolo  RECORD;
    r_variable   RECORD;
    r_escala     RECORD;
    r_umbral     RECORD;
    r_regla      RECORD;
    v_id         UUID;
    v_orden      SMALLINT;
    nivel_map    JSONB := '{
        "Bajo":    {"color": "#15803d", "bg": "rgba(21,128,61,0.12)"},
        "Medio":   {"color": "#a16207", "bg": "rgba(234,179,8,0.12)"},
        "Alto":    {"color": "#c2410c", "bg": "rgba(249,115,22,0.12)"},
        "Crítico": {"color": "#dc2626", "bg": "rgba(220,38,38,0.12)"}
    }'::jsonb;
BEGIN
    -- Iterar sobre todos los protocolos con columnas JSONB pobladas
    FOR r_protocolo IN
        SELECT id, variables, umbrales, reglas
        FROM public.protocolos_evaluacion
        WHERE variables IS NOT NULL AND jsonb_array_length(variables) > 0
    LOOP
        -- Saltar si ya fue migrado (idempotencia)
        IF EXISTS (
            SELECT 1 FROM public.protocolo_variables WHERE protocolo_id = r_protocolo.id LIMIT 1
        ) THEN
            CONTINUE;
        END IF;

        v_orden := 0;

        -- ── Migrar Variables ──────────────────────────────────────────────
        FOR r_variable IN
            SELECT * FROM jsonb_array_elements(r_protocolo.variables) AS v(elem)
        LOOP
            -- Insertar variable
            INSERT INTO public.protocolo_variables (
                protocolo_id, clave, etiqueta, tipo, unidad,
                obligatorio, orden, min_valor, max_valor,
                opciones, opciones_escala
            ) VALUES (
                r_protocolo.id,
                r_variable.elem->>'clave',
                COALESCE(r_variable.elem->>'etiqueta', r_variable.elem->>'clave'),
                CASE
                    WHEN r_variable.elem->>'tipo' IN ('Número','Decimal','Texto','Escala','Booleano','Lista','Imagen','GPS','Fecha','Hora')
                    THEN r_variable.elem->>'tipo'
                    ELSE 'Texto'
                END,
                r_variable.elem->>'unidad',
                COALESCE((r_variable.elem->>'obligatorio')::boolean, true),
                v_orden,
                (r_variable.elem->>'min')::double precision,
                (r_variable.elem->>'max')::double precision,
                COALESCE(r_variable.elem->'opciones',   '[]'::jsonb),
                COALESCE(r_variable.elem->'escala',     '[]'::jsonb)
            )
            RETURNING id INTO v_id;

            v_orden := v_orden + 1;

            -- ── Migrar Escalas de color para variables numéricas/escala ──
            -- Si el JSONB tenía escalas_config embebidas en el protocolo (por clave)
            -- Nota: escalas_config era un JSONB {clave: [{nivel, color, min, max}]}
            -- Se intenta también desde la columna umbrales con nivel_riesgo como fallback
            IF (r_variable.elem->>'tipo') IN ('Número','Decimal','Escala') THEN
                DECLARE
                    niveles_default TEXT[] := ARRAY['Bajo','Medio','Alto','Crítico'];
                    n_nivel TEXT;
                    n_orden SMALLINT := 0;
                BEGIN
                    FOREACH n_nivel IN ARRAY niveles_default LOOP
                        -- Solo insertar niveles por defecto si no existe ya para esta variable
                        IF NOT EXISTS (
                            SELECT 1 FROM public.protocolo_escalas
                            WHERE variable_id = v_id AND nivel = n_nivel
                        ) THEN
                            INSERT INTO public.protocolo_escalas (
                                protocolo_id, variable_id, variable_clave,
                                nivel, min_val, max_val, color, bg_color, orden
                            ) VALUES (
                                r_protocolo.id,
                                v_id,
                                r_variable.elem->>'clave',
                                n_nivel,
                                NULL, NULL,  -- rangos vacíos; el usuario los definirá en el editor
                                (nivel_map->n_nivel->>'color'),
                                (nivel_map->n_nivel->>'bg'),
                                n_orden
                            );
                        END IF;
                        n_orden := n_orden + 1;
                    END LOOP;
                END;
            END IF;
        END LOOP;

        -- ── Migrar Umbrales ───────────────────────────────────────────────
        IF r_protocolo.umbrales IS NOT NULL AND jsonb_array_length(r_protocolo.umbrales) > 0 THEN
            FOR r_umbral IN
                SELECT * FROM jsonb_array_elements(r_protocolo.umbrales) AS u(elem)
            LOOP
                INSERT INTO public.protocolo_umbrales (
                    protocolo_id, variable_clave, operador,
                    valor, nivel_riesgo, mensaje
                ) VALUES (
                    r_protocolo.id,
                    r_umbral.elem->>'variable_clave',
                    COALESCE(r_umbral.elem->>'operador', '>'),
                    COALESCE((r_umbral.elem->>'valor')::double precision, 0),
                    CASE
                        WHEN r_umbral.elem->>'nivel_riesgo' IN ('Bajo','Medio','Alto','Crítico')
                        THEN r_umbral.elem->>'nivel_riesgo'
                        ELSE 'Medio'
                    END,
                    r_umbral.elem->>'mensaje'
                );
            END LOOP;
        END IF;

        -- ── Migrar Reglas ─────────────────────────────────────────────────
        IF r_protocolo.reglas IS NOT NULL AND jsonb_array_length(r_protocolo.reglas) > 0 THEN
            FOR r_regla IN
                SELECT * FROM jsonb_array_elements(r_protocolo.reglas) AS rg(elem)
            LOOP
                INSERT INTO public.protocolo_reglas (
                    protocolo_id, variable_clave, operador,
                    valor, accion, mensaje
                ) VALUES (
                    r_protocolo.id,
                    r_regla.elem->>'variable_clave',
                    COALESCE(r_regla.elem->>'operador', '>'),
                    COALESCE(r_regla.elem->>'valor', '0'),
                    CASE
                        WHEN r_regla.elem->>'accion' IN (
                            'Crear alerta','Crear tarea','Enviar notificación',
                            'Recomendar intervención','Cambiar estado del lote','Registrar incidencia'
                        )
                        THEN r_regla.elem->>'accion'
                        ELSE 'Crear alerta'
                    END,
                    r_regla.elem->>'mensaje'
                );
            END LOOP;
        END IF;

    END LOOP;

    RAISE NOTICE '[030] Migración JSONB → Entidades relacionales completada.';
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. FUNCIÓN AUXILIAR: Obtener protocolo completo ensamblado
--    Retorna un objeto JSON con el protocolo + sus entidades relacionales.
--    Utilizada por el backend para el endpoint GET /protocolos/:id
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_protocolo_completo(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_resultado JSONB;
BEGIN
    SELECT jsonb_build_object(
        'protocolo',  row_to_json(p.*),
        'variables',  COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id',              v.id,
                    'clave',           v.clave,
                    'etiqueta',        v.etiqueta,
                    'tipo',            v.tipo,
                    'unidad',          v.unidad,
                    'obligatorio',     v.obligatorio,
                    'orden',           v.orden,
                    'min_valor',       v.min_valor,
                    'max_valor',       v.max_valor,
                    'opciones',        v.opciones,
                    'opciones_escala', v.opciones_escala,
                    'escalas',         COALESCE((
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'id',        e.id,
                                'nivel',     e.nivel,
                                'min_val',   e.min_val,
                                'max_val',   e.max_val,
                                'color',     e.color,
                                'bg_color',  e.bg_color,
                                'orden',     e.orden
                            ) ORDER BY e.orden
                        )
                        FROM public.protocolo_escalas e
                        WHERE e.variable_id = v.id
                    ), '[]'::jsonb)
                ) ORDER BY v.orden
            )
            FROM public.protocolo_variables v
            WHERE v.protocolo_id = p.id
        ), '[]'::jsonb),
        'umbrales', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id',           u.id,
                    'variable_clave', u.variable_clave,
                    'operador',     u.operador,
                    'valor',        u.valor,
                    'nivel_riesgo', u.nivel_riesgo,
                    'mensaje',      u.mensaje,
                    'activo',       u.activo
                ) ORDER BY u.orden
            )
            FROM public.protocolo_umbrales u
            WHERE u.protocolo_id = p.id AND u.activo = true
        ), '[]'::jsonb),
        'reglas', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id',             r.id,
                    'variable_clave', r.variable_clave,
                    'operador',       r.operador,
                    'valor',          r.valor,
                    'accion',         r.accion,
                    'mensaje',        r.mensaje,
                    'activo',         r.activo
                ) ORDER BY r.orden
            )
            FROM public.protocolo_reglas r
            WHERE r.protocolo_id = p.id AND r.activo = true
        ), '[]'::jsonb)
    )
    INTO v_resultado
    FROM public.protocolos_evaluacion p
    WHERE p.id = p_id;

    RETURN v_resultado;
END;
$$;

COMMENT ON FUNCTION public.get_protocolo_completo IS 'Retorna el protocolo de evaluación completamente ensamblado: cabecera + variables + escalas + umbrales + reglas en un único objeto JSONB. Elimina la necesidad de N queries desde el backend.';
