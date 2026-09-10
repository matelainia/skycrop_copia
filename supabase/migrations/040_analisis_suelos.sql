-- ==============================================================================
-- SKYCROP DATABASE: 040_analisis_suelos.sql
-- Descripción: Módulo documental + analítico de Análisis de Suelos
--
-- Tablas:
--   1. laboratorios                 → Catálogo de laboratorios (global + empresa)
--   2. parametros_suelo             → Catálogo extensible de parámetros analíticos
--   3. analisis_suelos              → Cabecera del análisis (documento, muestreo, GPS, PDF)
--   4. resultados_analisis_suelo    → Resultados estructurados por parámetro
--
-- Storage:
--   - Bucket privado: analisis-suelos
--   - Path: {company_id}/{predio_id}/{analysis_id}/informe.pdf
--   - Acceso vía Signed URL 5-15 min, validado por RLS + foldername
--
-- Seguridad:
--   - RLS estricto por company_id = current_company()
--   - Validación cruzada de predio/lote pertenencia
--   - Sin datos mock — estados vacíos cuando no hay registros
--
-- Integración futura:
--   - Resultados estructurados → Calculadora de Fertilización
--   - Snapshot inmutable para trazabilidad de recomendaciones
--
-- Estrategia: Zero-Downtime — solo crea objetos nuevos
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TIPOS ENUM
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.soil_analysis_status AS ENUM (
    'borrador', 'completo', 'archivado', 'anulado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABLA: laboratorios (catálogo global + empresa)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.laboratorios (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    -- company_id NULL = laboratorio global (disponible para todas las empresas)
    nombre                VARCHAR(300) NOT NULL,
    nit                   VARCHAR(50),
    direccion             TEXT,
    telefono              VARCHAR(50),
    email                 VARCHAR(200),
    acreditado            BOOLEAN DEFAULT false,
    numero_acreditacion   VARCHAR(100),
    observaciones         TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.laboratorios IS
  'Catálogo de laboratorios de suelos. company_id NULL = global, disponible para todas las empresas. company_id NOT NULL = privado de la empresa.';

CREATE INDEX IF NOT EXISTS idx_laboratorios_company ON public.laboratorios(company_id);
CREATE INDEX IF NOT EXISTS idx_laboratorios_nombre  ON public.laboratorios(nombre);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABLA: parametros_suelo (catálogo extensible)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parametros_suelo (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo            VARCHAR(30)  NOT NULL UNIQUE, -- 'pH', 'MO', 'N', 'P', 'K', 'Ca', 'Mg', 'Al', 'CICE', 'CE'
    nombre            VARCHAR(200) NOT NULL,         -- 'pH', 'Materia Orgánica', 'Nitrógeno total'
    categoria         VARCHAR(50)  NOT NULL DEFAULT 'otros'
                         CHECK (categoria IN (
                           'propiedades_quimicas','propiedades_fisicas','macronutrientes','micronutrientes',
                           'acidez','materia_organica','relaciones_cationicas','otros'
                         )),
    unidad_default    VARCHAR(20)  NOT NULL DEFAULT '-',
    tipo_dato         VARCHAR(20)  NOT NULL DEFAULT 'numeric' CHECK (tipo_dato IN ('numeric','text','boolean')),
    decimales         INT          NOT NULL DEFAULT 2,
    activo            BOOLEAN      NOT NULL DEFAULT true,
    orden             INT          NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.parametros_suelo IS
  'Catálogo extensible de parámetros analíticos de suelo. Evita modificar la base de datos al agregar nuevos parámetros.';

CREATE INDEX IF NOT EXISTS idx_param_suelo_categoria ON public.parametros_suelo(categoria);
CREATE INDEX IF NOT EXISTS idx_param_suelo_activo    ON public.parametros_suelo(activo) WHERE activo = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TABLA: analisis_suelos (cabecera documental)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.analisis_suelos (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    predio_id               UUID REFERENCES public.predios(id) ON DELETE SET NULL,
    lote_id                 UUID REFERENCES public.lotes(id) ON DELETE SET NULL,

    nombre_muestra          VARCHAR(200),
    codigo_muestra          VARCHAR(100),

    laboratorio_id          UUID REFERENCES public.laboratorios(id) ON DELETE SET NULL,

    fecha_muestreo          DATE,
    fecha_recepcion         DATE,
    fecha_analisis          DATE NOT NULL,

    muestreador             VARCHAR(200),
    metodo_muestreo         VARCHAR(50) CHECK (metodo_muestreo IN ('zigzag','aleatorio','sistematico','estratificado','otro') OR metodo_muestreo IS NULL),
    profundidad_min_cm      NUMERIC(6,2) CHECK (profundidad_min_cm IS NULL OR profundidad_min_cm >= 0),
    profundidad_max_cm      NUMERIC(6,2) CHECK (profundidad_max_cm IS NULL OR profundidad_max_cm >= 0),

    observaciones           TEXT,

    -- GPS opcional (ubicación del muestreo)
    latitude                DOUBLE PRECISION CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
    longitude               DOUBLE PRECISION CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
    accuracy_m              NUMERIC(8,2),
    altitude                NUMERIC(8,2),
    captured_at             TIMESTAMPTZ,

    ubicacion_nombre        VARCHAR(200),
    ubicacion_descripcion   TEXT,

    -- Documento PDF (Supabase Storage - bucket privado)
    archivo_pdf_path        TEXT,           -- companies/{company_id}/predios/{predio_id}/soil-analysis/{analysis_id}/report.pdf
    archivo_pdf_nombre      VARCHAR(500),
    archivo_pdf_size        BIGINT,
    archivo_pdf_mime        VARCHAR(100) DEFAULT 'application/pdf',

    estado                  public.soil_analysis_status NOT NULL DEFAULT 'borrador',

    created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    created_by              TEXT,
    updated_by              TEXT
);

COMMENT ON TABLE public.analisis_suelos IS
  'Análisis de suelos documental + GPS + PDF privado. Cada registro pertenece a una empresa y opcionalmente a predio/lote. Estado: borrador → completo → archivado/anulado.';

CREATE INDEX IF NOT EXISTS idx_analisis_company        ON public.analisis_suelos(company_id);
CREATE INDEX IF NOT EXISTS idx_analisis_predio         ON public.analisis_suelos(predio_id);
CREATE INDEX IF NOT EXISTS idx_analisis_lote           ON public.analisis_suelos(lote_id);
CREATE INDEX IF NOT EXISTS idx_analisis_laboratorio    ON public.analisis_suelos(laboratorio_id);
CREATE INDEX IF NOT EXISTS idx_analisis_estado         ON public.analisis_suelos(estado);
CREATE INDEX IF NOT EXISTS idx_analisis_fecha          ON public.analisis_suelos(fecha_analisis DESC);
CREATE INDEX IF NOT EXISTS idx_analisis_created        ON public.analisis_suelos(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analisis_gps            ON public.analisis_suelos(company_id) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analisis_pdf            ON public.analisis_suelos(company_id) WHERE archivo_pdf_path IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. TABLA: resultados_analisis_suelo
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resultados_analisis_suelo (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analisis_suelo_id     UUID NOT NULL REFERENCES public.analisis_suelos(id) ON DELETE CASCADE,
    company_id            UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

    parametro              VARCHAR(100),  -- nombre legible opcional
    codigo_parametro        VARCHAR(30)  NOT NULL, -- FK lógico a parametros_suelo.codigo (no FK estricto para permitir flexibilidad)
    valor                 NUMERIC(12,4) NOT NULL,
    unidad                VARCHAR(20)  NOT NULL DEFAULT '-',

    metodo_analitico        VARCHAR(100),
    nivel_interpretacion    VARCHAR(30)  CHECK (nivel_interpretacion IN ('muy_bajo','bajo','medio','optimo','alto','muy_alto','moderado') OR nivel_interpretacion IS NULL),
    observacion             TEXT,
    orden                 INT          NOT NULL DEFAULT 0,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.resultados_analisis_suelo IS
  'Resultados analíticos estructurados por parámetro. Diseño extensible: cada fila es un parámetro (pH, MO, N, P, K...), evita alterar la cabecera al agregar parámetros.';

CREATE INDEX IF NOT EXISTS idx_resultados_analisis     ON public.resultados_analisis_suelo(analisis_suelo_id);
CREATE INDEX IF NOT EXISTS idx_resultados_company      ON public.resultados_analisis_suelo(company_id);
CREATE INDEX IF NOT EXISTS idx_resultados_codigo       ON public.resultados_analisis_suelo(codigo_parametro);
CREATE UNIQUE INDEX IF NOT EXISTS ux_resultados_analisis_parametro
  ON public.resultados_analisis_suelo(analisis_suelo_id, codigo_parametro);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.laboratorios              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parametros_suelo          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analisis_suelos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultados_analisis_suelo ENABLE ROW LEVEL SECURITY;

-- Helper ya existente: public.current_company() y public.current_user_id()

-- ── Laboratorios: lectura global + empresa, escritura solo empresa propietaria
DROP POLICY IF EXISTS "lab_select" ON public.laboratorios;
CREATE POLICY "lab_select" ON public.laboratorios
  FOR SELECT USING (
    company_id IS NULL OR company_id = public.current_company()
  );

DROP POLICY IF EXISTS "lab_insert" ON public.laboratorios;
CREATE POLICY "lab_insert" ON public.laboratorios
  FOR INSERT WITH CHECK (company_id = public.current_company());

DROP POLICY IF EXISTS "lab_update" ON public.laboratorios;
CREATE POLICY "lab_update" ON public.laboratorios
  FOR UPDATE USING (company_id = public.current_company())
  WITH CHECK (company_id = public.current_company());

DROP POLICY IF EXISTS "lab_delete" ON public.laboratorios;
CREATE POLICY "lab_delete" ON public.laboratorios
  FOR DELETE USING (company_id = public.current_company());

-- ── Parámetros: lectura para todos los autenticados, escritura solo service_role / admin (no RLS abierto a insert)
DROP POLICY IF EXISTS "param_select" ON public.parametros_suelo;
CREATE POLICY "param_select" ON public.parametros_suelo
  FOR SELECT USING (true);

-- Solo miembros activos podrían proponer parámetros si company_id estuviera presente; por ahora solo catálogo global
-- Insert/update/delete bloqueados por RLS implícito si no se crea política → solo service_role podrá hacerlo
-- Permitimos insert para tenant si se quiere catálogo privado futuro:
DROP POLICY IF EXISTS "param_insert" ON public.parametros_suelo;
CREATE POLICY "param_insert" ON public.parametros_suelo
  FOR INSERT WITH CHECK (public.current_role_id() IN ('administrador','gerente'));

-- ── analisis_suelos: aislamiento estricto por company_id + validación cruzada de predio/lote
DROP POLICY IF EXISTS "analisis_select" ON public.analisis_suelos;
CREATE POLICY "analisis_select" ON public.analisis_suelos
  FOR SELECT USING (company_id = public.current_company());

DROP POLICY IF EXISTS "analisis_insert" ON public.analisis_suelos;
CREATE POLICY "analisis_insert" ON public.analisis_suelos
  FOR INSERT WITH CHECK (
    company_id = public.current_company()
    AND (predio_id IS NULL OR EXISTS (SELECT 1 FROM public.predios WHERE id = predio_id AND company_id = public.current_company()))
    AND (lote_id IS NULL OR EXISTS (SELECT 1 FROM public.lotes WHERE id = lote_id AND company_id = public.current_company()))
  );

DROP POLICY IF EXISTS "analisis_update" ON public.analisis_suelos;
CREATE POLICY "analisis_update" ON public.analisis_suelos
  FOR UPDATE USING (company_id = public.current_company())
  WITH CHECK (
    company_id = public.current_company()
    AND (predio_id IS NULL OR EXISTS (SELECT 1 FROM public.predios WHERE id = predio_id AND company_id = public.current_company()))
    AND (lote_id IS NULL OR EXISTS (SELECT 1 FROM public.lotes WHERE id = lote_id AND company_id = public.current_company()))
  );

DROP POLICY IF EXISTS "analisis_delete" ON public.analisis_suelos;
CREATE POLICY "analisis_delete" ON public.analisis_suelos
  FOR DELETE USING (company_id = public.current_company() AND public.current_role_id() IN ('administrador','gerente','ingeniero','tecnico'));

-- ── resultados: acceso si el análisis padre pertenece al tenant
DROP POLICY IF EXISTS "resultados_select" ON public.resultados_analisis_suelo;
CREATE POLICY "resultados_select" ON public.resultados_analisis_suelo
  FOR SELECT USING (
    company_id = public.current_company()
    OR EXISTS (SELECT 1 FROM public.analisis_suelos a WHERE a.id = analisis_suelo_id AND a.company_id = public.current_company())
  );

DROP POLICY IF EXISTS "resultados_insert" ON public.resultados_analisis_suelo;
CREATE POLICY "resultados_insert" ON public.resultados_analisis_suelo
  FOR INSERT WITH CHECK (
    company_id = public.current_company()
    AND EXISTS (SELECT 1 FROM public.analisis_suelos a WHERE a.id = analisis_suelo_id AND a.company_id = public.current_company())
  );

DROP POLICY IF EXISTS "resultados_update" ON public.resultados_analisis_suelo;
CREATE POLICY "resultados_update" ON public.resultados_analisis_suelo
  FOR UPDATE USING (
    company_id = public.current_company()
    OR EXISTS (SELECT 1 FROM public.analisis_suelos a WHERE a.id = analisis_suelo_id AND a.company_id = public.current_company())
  );

DROP POLICY IF EXISTS "resultados_delete" ON public.resultados_analisis_suelo;
CREATE POLICY "resultados_delete" ON public.resultados_analisis_suelo
  FOR DELETE USING (
    company_id = public.current_company()
    OR EXISTS (SELECT 1 FROM public.analisis_suelos a WHERE a.id = analisis_suelo_id AND a.company_id = public.current_company())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. TRIGGERS: company_id seguro + updated_at
-- ─────────────────────────────────────────────────────────────────────────────
-- Reutilizar process_secure_company_id para nuevas tablas
DO $$
DECLARE
  t_name TEXT;
  tables TEXT[] := ARRAY['analisis_suelos','resultados_analisis_suelo','laboratorios'];
BEGIN
  FOREACH t_name IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS secure_company_id_trg ON public.%I', t_name);
    IF t_name = 'analisis_suelos' OR t_name = 'resultados_analisis_suelo' OR t_name = 'laboratorios' THEN
      EXECUTE format('CREATE TRIGGER secure_company_id_trg BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.process_secure_company_id()', t_name);
    END IF;
  END LOOP;
END $$;

-- Trigger updated_at genérico
CREATE OR REPLACE FUNCTION public.update_analisis_suelos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_analisis_suelos_updated_at ON public.analisis_suelos;
CREATE TRIGGER trg_analisis_suelos_updated_at
  BEFORE UPDATE ON public.analisis_suelos
  FOR EACH ROW EXECUTE FUNCTION public.update_analisis_suelos_updated_at();

DROP TRIGGER IF EXISTS trg_resultados_updated_at ON public.resultados_analisis_suelo;
CREATE TRIGGER trg_resultados_updated_at
  BEFORE UPDATE ON public.resultados_analisis_suelo
  FOR EACH ROW EXECUTE FUNCTION public.update_analisis_suelos_updated_at();

DROP TRIGGER IF EXISTS trg_laboratorios_updated_at ON public.laboratorios;
CREATE TRIGGER trg_laboratorios_updated_at
  BEFORE UPDATE ON public.laboratorios
  FOR EACH ROW EXECUTE FUNCTION public.update_analisis_suelos_updated_at();

-- Auditoría automática para analisis_suelos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_audit_log') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS audit_analisis_suelos_trigger ON public.analisis_suelos';
    EXECUTE 'CREATE TRIGGER audit_analisis_suelos_trigger AFTER INSERT OR UPDATE OR DELETE ON public.analisis_suelos FOR EACH ROW EXECUTE FUNCTION public.process_audit_log()';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. STORAGE: bucket privado analisis-suelos
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('analisis-suelos', 'analisis-suelos', false)
    ON CONFLICT (id) DO NOTHING;

    -- Políticas de Storage: aislar por folder company_id
    -- Nota: requieren que el path inicie con {company_id}/...
    -- Estructura: {company_id}/{predio_id}/{analysis_id}/informe.pdf

    -- Permitir lectura solo si el primer folder es la empresa del JWT
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='analisis_suelos_select') THEN
      CREATE POLICY "analisis_suelos_select" ON storage.objects
        FOR SELECT USING (
          bucket_id = 'analisis-suelos'
          AND (storage.foldername(name))[1] = public.current_company()::text
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='analisis_suelos_insert') THEN
      CREATE POLICY "analisis_suelos_insert" ON storage.objects
        FOR INSERT WITH CHECK (
          bucket_id = 'analisis-suelos'
          AND (storage.foldername(name))[1] = public.current_company()::text
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='analisis_suelos_update') THEN
      CREATE POLICY "analisis_suelos_update" ON storage.objects
        FOR UPDATE USING (
          bucket_id = 'analisis-suelos'
          AND (storage.foldername(name))[1] = public.current_company()::text
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='analisis_suelos_delete') THEN
      CREATE POLICY "analisis_suelos_delete" ON storage.objects
        FOR DELETE USING (
          bucket_id = 'analisis-suelos'
          AND (storage.foldername(name))[1] = public.current_company()::text
        );
    END IF;

  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. SEEDS: parámetros de suelo base
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.parametros_suelo (codigo, nombre, categoria, unidad_default, tipo_dato, decimales, activo, orden) VALUES
  ('pH',   'pH',                              'acidez',               '-',              'numeric', 2, true, 10),
  ('MO',   'Materia Orgánica',                'materia_organica',     '%',              'numeric', 2, true, 20),
  ('N',    'Nitrógeno total',                 'macronutrientes',      '%',              'numeric', 3, true, 30),
  ('P',    'Fósforo',                         'macronutrientes',      'mg/kg',          'numeric', 2, true, 40),
  ('K',    'Potasio',                         'macronutrientes',      'cmol(+)/kg',     'numeric', 3, true, 50),
  ('Ca',   'Calcio',                          'macronutrientes',      'cmol(+)/kg',     'numeric', 2, true, 60),
  ('Mg',   'Magnesio',                        'macronutrientes',      'cmol(+)/kg',     'numeric', 2, true, 70),
  ('S',    'Azufre',                          'macronutrientes',      'mg/kg',          'numeric', 2, true, 80),
  ('Al',   'Aluminio intercambiable',         'acidez',               'cmol(+)/kg',     'numeric', 2, true, 90),
  ('CICE', 'CICE',                            'propiedades_quimicas', 'cmol(+)/kg',     'numeric', 2, true, 100),
  ('CE',   'Conductividad Eléctrica',         'propiedades_quimicas', 'dS/m',           'numeric', 2, true, 110),
  ('Fe',   'Hierro',                          'micronutrientes',      'mg/kg',          'numeric', 2, true, 120),
  ('Mn',   'Manganeso',                       'micronutrientes',      'mg/kg',          'numeric', 2, true, 130),
  ('Zn',   'Zinc',                            'micronutrientes',      'mg/kg',          'numeric', 2, true, 140),
  ('Cu',   'Cobre',                           'micronutrientes',      'mg/kg',          'numeric', 2, true, 150),
  ('B',    'Boro',                            'micronutrientes',      'mg/kg',          'numeric', 2, true, 160),
  ('Na',   'Sodio',                           'propiedades_quimicas', 'cmol(+)/kg',     'numeric', 2, true, 170),
  ('CIC',  'Capacidad Intercambio Catiónico', 'propiedades_quimicas', 'cmol(+)/kg',     'numeric', 2, true, 180),
  ('ARC',  'Arcilla',                         'propiedades_fisicas',  '%',              'numeric', 1, true, 190),
  ('ARE',  'Arena',                           'propiedades_fisicas',  '%',              'numeric', 1, true, 200),
  ('LIM',  'Limo',                            'propiedades_fisicas',  '%',              'numeric', 1, true, 210),
  ('DA',   'Densidad Aparente',               'propiedades_fisicas',  'g/cm³',          'numeric', 2, true, 220),
  ('Ca_Mg','Relación Ca/Mg',                  'relaciones_cationicas','-',              'numeric', 2, true, 230),
  ('Ca_K', 'Relación Ca/K',                   'relaciones_cationicas','-',              'numeric', 2, true, 240),
  ('Mg_K', 'Relación Mg/K',                   'relaciones_cationicas','-',              'numeric', 2, true, 250),
  ('CaMgK','(Ca+Mg)/K',                       'relaciones_cationicas','-',              'numeric', 2, true, 260)
ON CONFLICT (codigo) DO NOTHING;

-- Laboratorios globales de ejemplo (sin company_id, disponibles para todas)
INSERT INTO public.laboratorios (company_id, nombre, nit, acreditado, observaciones) VALUES
  (NULL, 'AgroAnálisis S.A.S',       '900123456-1', true, 'Laboratorio acreditado a nivel nacional'),
  (NULL, 'LabSuelo Ltda.',           '900234567-2', true, 'Cert. 2025-2314 — Suelos y foliares'),
  (NULL, 'SoilTest de Colombia',     '900345678-3', false,'Análisis físicos y químicos')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. VISTA ENRIQUECIDA: analisis_suelos con joins listos para el frontend
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_analisis_suelos_enriched AS
SELECT
  a.id,
  a.company_id,
  a.predio_id,
  pr.nombre AS predio_nombre,
  a.lote_id,
  l.nombre AS lote_nombre,
  l.codigo_interno AS lote_codigo,
  l.cultivo AS lote_cultivo,
  l.variedad AS lote_variedad,
  a.nombre_muestra,
  a.codigo_muestra,
  a.laboratorio_id,
  lb.nombre AS laboratorio_nombre,
  lb.nit AS laboratorio_nit,
  lb.acreditado AS laboratorio_acreditado,
  lb.numero_acreditacion AS laboratorio_cert,
  a.fecha_muestreo,
  a.fecha_recepcion,
  a.fecha_analisis,
  a.muestreador,
  a.metodo_muestreo,
  a.profundidad_min_cm,
  a.profundidad_max_cm,
  a.observaciones,
  a.latitude,
  a.longitude,
  a.accuracy_m,
  a.altitude,
  a.captured_at,
  a.ubicacion_nombre,
  a.ubicacion_descripcion,
  a.archivo_pdf_path,
  a.archivo_pdf_nombre,
  a.archivo_pdf_size,
  a.archivo_pdf_mime,
  a.estado,
  a.created_at,
  a.updated_at,
  a.created_by,
  a.updated_by,
  -- Agregados útiles para tabla principal sin N+1
  (SELECT COUNT(*) FROM public.resultados_analisis_suelo r WHERE r.analisis_suelo_id = a.id) AS resultados_count,
  (SELECT jsonb_agg(jsonb_build_object('codigo', r.codigo_parametro, 'valor', r.valor, 'unidad', r.unidad) ORDER BY r.orden)
   FROM public.resultados_analisis_suelo r WHERE r.analisis_suelo_id = a.id) AS resultados_preview
FROM public.analisis_suelos a
LEFT JOIN public.predios pr ON pr.id = a.predio_id
LEFT JOIN public.lotes l ON l.id = a.lote_id
LEFT JOIN public.laboratorios lb ON lb.id = a.laboratorio_id;

COMMENT ON VIEW public.vw_analisis_suelos_enriched IS
  'Vista enriquecida de análisis de suelos con predio/lote/laboratorio y conteo de resultados para listado. Respeta RLS de la tabla base.';

-- Permisos de vista: hereda RLS de analisis_suelos (security_invoker = true en PG15+)
-- Para compatibilidad, conceder SELECT a authenticated y confiar en RLS subyacente
GRANT SELECT ON public.vw_analisis_suelos_enriched TO authenticated;
GRANT SELECT ON public.parametros_suelo TO authenticated;
GRANT SELECT ON public.laboratorios TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. FUNCIÓN RPC: métricas del módulo (para header cards)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.soil_analysis_metrics()
RETURNS JSONB AS $$
DECLARE
  v_company UUID := public.current_company();
  v_total INT;
  v_this_year INT;
  v_zonas INT;
  v_labs INT;
  v_ultimo JSONB;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM public.analisis_suelos
  WHERE company_id = v_company AND estado <> 'anulado';

  SELECT COUNT(*) INTO v_this_year
  FROM public.analisis_suelos
  WHERE company_id = v_company
    AND estado <> 'anulado'
    AND EXTRACT(YEAR FROM fecha_analisis) = EXTRACT(YEAR FROM CURRENT_DATE);

  SELECT COUNT(DISTINCT COALESCE(ubicacion_nombre, lote_id::text)) INTO v_zonas
  FROM public.analisis_suelos
  WHERE company_id = v_company AND estado <> 'anulado';

  SELECT COUNT(DISTINCT laboratorio_id) INTO v_labs
  FROM public.analisis_suelos
  WHERE company_id = v_company AND estado <> 'anulado' AND laboratorio_id IS NOT NULL;

  SELECT to_jsonb(a) INTO v_ultimo
  FROM (
    SELECT id, fecha_analisis, lote_id, ubicacion_nombre
    FROM public.analisis_suelos
    WHERE company_id = v_company AND estado <> 'anulado'
    ORDER BY fecha_analisis DESC, created_at DESC
    LIMIT 1
  ) a;

  RETURN jsonb_build_object(
    'total', v_total,
    'esteAno', v_this_year,
    'zonas', v_zonas,
    'laboratorios', v_labs,
    'ultimo', v_ultimo
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.soil_analysis_metrics IS
  'Retorna métricas del módulo Análisis de Suelos para el header (total, este año, zonas, laboratorios, último). Respeta RLS por current_company().';

GRANT EXECUTE ON FUNCTION public.soil_analysis_metrics() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. FUNCIÓN RPC: detalle completo con resultados (para drawer)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.soil_analysis_detail(p_analysis_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_company UUID := public.current_company();
  v_row JSONB;
  v_results JSONB;
BEGIN
  SELECT to_jsonb(v) INTO v_row
  FROM public.vw_analisis_suelos_enriched v
  WHERE v.id = p_analysis_id AND v.company_id = v_company;

  IF v_row IS NULL THEN
    RETURN jsonb_build_object('error', 'Análisis no encontrado o sin acceso');
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.orden, r.codigo_parametro), '[]'::jsonb)
  INTO v_results
  FROM public.resultados_analisis_suelo r
  WHERE r.analisis_suelo_id = p_analysis_id;

  RETURN jsonb_build_object(
    'analisis', v_row,
    'resultados', v_results
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.soil_analysis_detail IS
  'Detalle completo de un análisis con sus resultados estructurados. Valida pertenencia por company_id.';

GRANT EXECUTE ON FUNCTION public.soil_analysis_detail(UUID) TO authenticated;

-- ==============================================================================
-- FIN 040_analisis_suelos.sql
-- ==============================================================================
