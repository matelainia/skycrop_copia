-- ==============================================================================
-- SKYCROP DATABASE V2: 052_maquinaria_contrato.sql
-- Descripción: Release de esquema del contrato congelado de Maquinaria
--              (docs/maquinaria/contrato-tecnico.md + matriz-permisos.md +
--               plan-migracion.md). SOLO REDACCIÓN — no aplicar fuera de staging
--              sin backup + preflight + puerta de producción en verde.
--
-- Base verificada: 015_ejecuciones.sql (maquinaria, jornadas_maquinaria),
--   022_functions.sql (3 RPC legacy + secure_company_id + audit),
--   021_rls.sql (RLS generado), 020_indexes.sql, 006_permissions.sql,
--   005_roles.sql, 043 (contexto NULL fail-closed + search_path), 041 (hardening),
--   047 (patrón RPC _empresa + REVOKE/GRANT), 048 (patrón SET search_path).
--
-- Reglas de este release:
--   a) Idempotente: IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE.
--   b) No elimina estructuras legacy. Legacy queda operativo + marcado DEPRECATED.
--   c) Si detecta datos no mapeables de forma inequívoca, ABORTA (EXCEPTION)
--      antes de modificar datos, salvo cuarentenas definidas en §052-04.
--   d) Fases internas 00-10. Cada fase RAISE NOTICE auditable.
-- ==============================================================================

-- ══════════════════════════════════════════════════════════════════════════════
-- 052-00 PRECONDITIONS (solo lectura; cero escrituras; aborta si base incompleta)
-- ══════════════════════════════════════════════════════════════════════════════
DO $pre$ DECLARE
  v_missing TEXT[] := '{}';
BEGIN
  RAISE NOTICE '[052-00] Preconditions: verificando base 015/022/021 + contrato...';
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='maquinaria') THEN v_missing := v_missing || 'maquinaria'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='jornadas_maquinaria') THEN v_missing := v_missing || 'jornadas_maquinaria'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='lotes') THEN v_missing := v_missing || 'lotes'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='trabajadores') THEN v_missing := v_missing || 'trabajadores'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='companies') THEN v_missing := v_missing || 'companies'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='costos') THEN v_missing := v_missing || 'costos'; END IF;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION '052-00 ABORT: tablas base faltantes: % (aplicar 001-025 antes)', array_to_string(v_missing, ', ');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='current_company') THEN
    RAISE EXCEPTION '052-00 ABORT: falta public.current_company() (021/043 no aplicadas)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='registrar_costo_lote') THEN
    RAISE EXCEPTION '052-00 ABORT: falta public.registrar_costo_lote() (022 no aplicada)';
  END IF;
  -- Bloqueantes de datos: NULL company, códigos duplicados, estados/horómetros imposibles.
  PERFORM 1 FROM public.maquinaria WHERE company_id IS NULL LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION '052-00 ABORT: maquinaria con company_id NULL (sanear antes)'; END IF;
  PERFORM 1 FROM public.jornadas_maquinaria WHERE company_id IS NULL LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION '052-00 ABORT: jornadas_maquinaria con company_id NULL (sanear antes)'; END IF;
  PERFORM 1 FROM (
    SELECT company_id, upper(btrim(codigo_id)) AS c, count(*) FROM public.maquinaria
    GROUP BY 1, 2 HAVING count(*) > 1
  ) d LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION '052-00 ABORT: códigos duplicados (company, upper(codigo_id)) sin mapeo inequívoco'; END IF;
  PERFORM 1 FROM public.maquinaria
    WHERE status NOT IN ('Disponible','Operando','Mantenimiento','Fuera de Servicio') LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION '052-00 ABORT: maquinaria.status fuera del dominio canónico (sanear antes)'; END IF;
  PERFORM 1 FROM public.jornadas_maquinaria
    WHERE status NOT IN ('En Progreso','Finalizada') LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION '052-00 ABORT: jornadas.status fuera de dominio (sanear antes)'; END IF;
  PERFORM 1 FROM public.jornadas_maquinaria WHERE start_horometro < 0 OR (end_horometro IS NOT NULL AND end_horometro < 0) LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION '052-00 ABORT: horómetros negativos en jornadas (sanear antes)'; END IF;
  -- Jornadas activas duplicadas por máquina: el índice parcial §2.2 las rechazaría.
  PERFORM 1 FROM (
    SELECT maquinaria_id, count(*) FROM public.jornadas_maquinaria
    WHERE status='En Progreso' AND maquinaria_id IS NOT NULL
    GROUP BY 1 HAVING count(*) > 1
  ) d LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION '052-00 ABORT: JORNADA_ACTIVA_DUPLICADA en origen (resolver manualmente: 1 En Progreso por máquina)'; END IF;
  RAISE NOTICE '[052-00] OK: base completa, sin bloqueantes.';
END $pre$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 052-01 CREATE STRUCTURE (tablas nuevas + columnas canónicas, sin romper legacy)
-- ══════════════════════════════════════════════════════════════════════════════
-- 01a. Columnas canónicas en maquinaria (legacy intacto).
ALTER TABLE public.maquinaria ADD COLUMN IF NOT EXISTS codigo VARCHAR(50);
ALTER TABLE public.maquinaria ADD COLUMN IF NOT EXISTS nombre VARCHAR(100);
ALTER TABLE public.maquinaria ADD COLUMN IF NOT EXISTS estado VARCHAR(30) DEFAULT 'Disponible';
ALTER TABLE public.maquinaria ADD COLUMN IF NOT EXISTS tipo VARCHAR(50);
ALTER TABLE public.maquinaria ADD COLUMN IF NOT EXISTS marca VARCHAR(100);
ALTER TABLE public.maquinaria ADD COLUMN IF NOT EXISTS modelo VARCHAR(100);
ALTER TABLE public.maquinaria ADD COLUMN IF NOT EXISTS serial VARCHAR(100);
ALTER TABLE public.maquinaria ADD COLUMN IF NOT EXISTS placa VARCHAR(20);
ALTER TABLE public.maquinaria ADD COLUMN IF NOT EXISTS anio INT;
ALTER TABLE public.maquinaria ADD COLUMN IF NOT EXISTS capacidad NUMERIC;
ALTER TABLE public.maquinaria ADD COLUMN IF NOT EXISTS unidad_capacidad VARCHAR(20);
ALTER TABLE public.maquinaria ADD COLUMN IF NOT EXISTS fecha_adquisicion DATE;
ALTER TABLE public.maquinaria ADD COLUMN IF NOT EXISTS horometro_actual NUMERIC DEFAULT 0;
ALTER TABLE public.maquinaria ADD COLUMN IF NOT EXISTS costo_operador_hora NUMERIC DEFAULT 0;
ALTER TABLE public.maquinaria ADD COLUMN IF NOT EXISTS costo_combustible_hora NUMERIC DEFAULT 0;
ALTER TABLE public.maquinaria ADD COLUMN IF NOT EXISTS costo_mantenimiento_hora NUMERIC DEFAULT 0;
ALTER TABLE public.maquinaria ADD COLUMN IF NOT EXISTS costo_depreciacion_hora NUMERIC DEFAULT 0;
ALTER TABLE public.maquinaria ADD COLUMN IF NOT EXISTS image_url VARCHAR(255);
ALTER TABLE public.maquinaria ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;
ALTER TABLE public.maquinaria ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 01b. Tablas objetivo (§2.2–2.5 del contrato).
CREATE TABLE IF NOT EXISTS public.maquinaria_operaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  maquinaria_id UUID NOT NULL REFERENCES public.maquinaria(id) ON DELETE RESTRICT,
  operador_id UUID REFERENCES public.trabajadores(id) ON DELETE SET NULL,
  operador_nombre VARCHAR(100) NOT NULL,
  labor VARCHAR(100) NOT NULL,
  lote_id UUID REFERENCES public.lotes(id) ON DELETE SET NULL,
  lote_nombre VARCHAR(100) NOT NULL,
  inicio TIMESTAMPTZ NOT NULL,
  fin TIMESTAMPTZ,
  horometro_inicio NUMERIC NOT NULL CHECK (horometro_inicio >= 0),
  horometro_fin NUMERIC CHECK (horometro_fin >= 0),
  horas NUMERIC CHECK (horas IS NULL OR horas >= 0),
  combustible_l NUMERIC CHECK (combustible_l IS NULL OR combustible_l >= 0),
  costo_total NUMERIC CHECK (costo_total IS NULL OR costo_total >= 0),
  estado VARCHAR(20) NOT NULL DEFAULT 'En Progreso'
    CHECK (estado IN ('En Progreso','Finalizada','Cancelada')),
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL,
  CONSTRAINT chk_mqop_fin CHECK (fin IS NULL OR fin >= inicio),
  CONSTRAINT chk_mqop_hor CHECK (horometro_fin IS NULL OR horometro_fin >= horometro_inicio)
);

CREATE TABLE IF NOT EXISTS public.maquinaria_mantenimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  maquinaria_id UUID NOT NULL REFERENCES public.maquinaria(id) ON DELETE RESTRICT,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('Preventivo','Correctivo')),
  estado VARCHAR(20) NOT NULL DEFAULT 'Programado'
    CHECK (estado IN ('Programado','En ejecucion','Completado','Vencido','Cancelado')),
  descripcion TEXT NOT NULL,
  fecha_programada DATE NOT NULL,
  fecha_ejecucion DATE,
  horometro NUMERIC NOT NULL CHECK (horometro >= 0),
  costo NUMERIC NOT NULL DEFAULT 0 CHECK (costo >= 0),
  proveedor VARCHAR(150),
  responsable TEXT,
  motivo_cancelacion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL,
  executed_at TIMESTAMPTZ,
  executed_by TEXT
);

CREATE TABLE IF NOT EXISTS public.maquinaria_combustible (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  maquinaria_id UUID NOT NULL REFERENCES public.maquinaria(id) ON DELETE RESTRICT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  cantidad NUMERIC NOT NULL CHECK (cantidad > 0),
  unidad VARCHAR(10) NOT NULL DEFAULT 'L' CHECK (unidad IN ('L','gal')),
  costo_unitario NUMERIC NOT NULL CHECK (costo_unitario >= 0),
  costo_total NUMERIC NOT NULL CHECK (costo_total >= 0),
  horometro NUMERIC NOT NULL CHECK (horometro >= 0),
  operador_id UUID REFERENCES public.trabajadores(id) ON DELETE SET NULL,
  proveedor VARCHAR(150),
  observacion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.maquinaria_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  maquinaria_id UUID NOT NULL REFERENCES public.maquinaria(id) ON DELETE CASCADE,
  tipo_evento VARCHAR(40) NOT NULL CHECK (tipo_evento IN
    ('REGISTRO','EDICION','CAMBIO_ESTADO','JORNADA_INICIO','JORNADA_FIN','JORNADA_CANCELADA',
     'COMBUSTIBLE','MANTENIMIENTO_PROGRAMADO','MANTENIMIENTO_EJECUTADO',
     'HOROMETRO_CORRECCION','INCIDENCIA','RETIRO','REHABILITACION')),
  entidad_tipo VARCHAR(40),
  entidad_id UUID,
  usuario_id TEXT NOT NULL,
  rol TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 01c. Verificación inmediata fail-fast: si algún ALTER/CREATE de 01 no persistió
-- (editor por secciones, lock, error intermedio), abortar aquí y no en 02+.
DO $ver01$ DECLARE v_falt TEXT[] := '{}'; t TEXT; BEGIN
  SELECT COALESCE(array_agg(c), '{}') INTO v_falt FROM (VALUES
    ('codigo'),('nombre'),('estado'),('marca'),('modelo'),('serial'),('placa'),
    ('anio'),('capacidad'),('unidad_capacidad'),('fecha_adquisicion'),('horometro_actual'),
    ('costo_operador_hora'),('costo_combustible_hora'),('costo_mantenimiento_hora'),
    ('costo_depreciacion_hora'),('image_url'),('activo'),('updated_at'),('tipo')) AS v(c)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'maquinaria' AND column_name = v.c);
  FOREACH t IN ARRAY ARRAY['maquinaria_operaciones','maquinaria_mantenimientos','maquinaria_combustible','maquinaria_eventos'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      v_falt := v_falt || ('tabla:' || t);
    END IF;
  END LOOP;
  IF cardinality(v_falt) > 0 THEN
    RAISE EXCEPTION '052-01 ABORT: estructura no persistida (%) — re-ejecutar 052-01 completa; si un ALTER falla aislado, reportar su error exacto',
      array_to_string(v_falt, ', ');
  END IF;
  RAISE NOTICE '[052-01] OK: columnas canónicas + 4 tablas verificadas.';
END $ver01$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 052-02 CONSTRAINTS / INDEXES (contrato §2.6; parcial único anti doble jornada)
-- ══════════════════════════════════════════════════════════════════════════════
DO $c$ DECLARE v_falt TEXT[];
BEGIN
  -- Guarda anti-ejecución por secciones: 02 exige columnas creadas en 01.
  SELECT array_agg(c) INTO v_falt FROM (VALUES
    ('codigo'),('nombre'),('estado'),('tipo'),('anio'),('horometro_actual')) AS v(c)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'maquinaria' AND column_name = v.c);
  IF v_falt IS NOT NULL THEN
    RAISE EXCEPTION '052-02 ABORT: columnas canónicas faltantes (%) — aplicar fase 052-01 completa; no ejecutar 052 por secciones',
      array_to_string(v_falt, ', ');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_maquinaria_estado_052') THEN
    ALTER TABLE public.maquinaria ADD CONSTRAINT chk_maquinaria_estado_052
      CHECK (estado IN ('Disponible','Operando','Mantenimiento','Fuera de servicio'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_maquinaria_tipo_052') THEN
    ALTER TABLE public.maquinaria ADD CONSTRAINT chk_maquinaria_tipo_052
      CHECK (tipo IS NULL OR tipo IN ('Tractor','Cosechadora','Pulverizadora','Implemento','Camion','Vehiculo','Motocultor','Otro'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_maquinaria_anio_052') THEN
    ALTER TABLE public.maquinaria ADD CONSTRAINT chk_maquinaria_anio_052
      CHECK (anio IS NULL OR (anio BETWEEN 1950 AND 2100));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_maquinaria_horo_052') THEN
    ALTER TABLE public.maquinaria ADD CONSTRAINT chk_maquinaria_horo_052
      CHECK (horometro_actual IS NULL OR horometro_actual >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='uq_maquinaria_company_codigo_052') THEN
    ALTER TABLE public.maquinaria ADD CONSTRAINT uq_maquinaria_company_codigo_052 UNIQUE (company_id, codigo);
  END IF;
END $c$;

CREATE INDEX IF NOT EXISTS idx_maquinaria_company_estado_052 ON public.maquinaria (company_id, estado);
CREATE INDEX IF NOT EXISTS idx_maquinaria_company_codigo_052 ON public.maquinaria (company_id, codigo);
CREATE INDEX IF NOT EXISTS idx_mqop_company_maq_052 ON public.maquinaria_operaciones (company_id, maquinaria_id);
CREATE INDEX IF NOT EXISTS idx_mqop_company_inicio_052 ON public.maquinaria_operaciones (company_id, inicio DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mqop_activa_052 ON public.maquinaria_operaciones (maquinaria_id) WHERE estado = 'En Progreso';
CREATE INDEX IF NOT EXISTS idx_mqmto_company_maq_052 ON public.maquinaria_mantenimientos (company_id, maquinaria_id);
CREATE INDEX IF NOT EXISTS idx_mqmto_company_fecha_052 ON public.maquinaria_mantenimientos (company_id, fecha_programada);
CREATE INDEX IF NOT EXISTS idx_mqfuel_company_maq_052 ON public.maquinaria_combustible (company_id, maquinaria_id);
CREATE INDEX IF NOT EXISTS idx_mqfuel_company_fecha_052 ON public.maquinaria_combustible (company_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_mqev_company_maq_052 ON public.maquinaria_eventos (company_id, maquinaria_id);
CREATE INDEX IF NOT EXISTS idx_mqev_company_created_052 ON public.maquinaria_eventos (company_id, created_at DESC);

-- ══════════════════════════════════════════════════════════════════════════════
-- 052-03 DATA BACKFILL (maestro canónico; legacy intacto; cuarentenas definidas)
-- ══════════════════════════════════════════════════════════════════════════════
-- 03a. Maestro: codigo/nombre/estado/horómetro/costos/imagen desde legacy.
-- Guarda anti-ejecución por secciones: 03 exige tablas creadas en 01.
DO $pre03$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['maquinaria_operaciones','maquinaria_mantenimientos','maquinaria_combustible','maquinaria_eventos'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      RAISE EXCEPTION '052-03 ABORT: falta tabla % — aplicar fase 052-01 completa; no ejecutar 052 por secciones', t;
    END IF;
  END LOOP;
END $pre03$;
UPDATE public.maquinaria m SET
  codigo = upper(btrim(COALESCE(m.codigo, m.codigo_id))),
  nombre = COALESCE(m.nombre, m.name),
  tipo = COALESCE(m.tipo,
    CASE WHEN m.type IN ('Tractor','Cosechadora','Pulverizadora','Implemento','Camion','Vehiculo','Motocultor','Otro')
      THEN m.type ELSE 'Otro' END),
  estado = COALESCE(m.estado,
    CASE m.status
      WHEN 'Disponible' THEN 'Disponible'
      WHEN 'Operando' THEN 'Operando'
      WHEN 'Mantenimiento' THEN 'Mantenimiento'
      WHEN 'Fuera de Servicio' THEN 'Fuera de servicio'
      ELSE 'Disponible' END),
  horometro_actual = COALESCE(m.horometro_actual, m.hours_of_operation, 0),
  costo_operador_hora = COALESCE(m.costo_operador_hora, m.cost_operator, 0),
  costo_combustible_hora = COALESCE(m.costo_combustible_hora, m.cost_fuel, 0),
  costo_mantenimiento_hora = COALESCE(m.costo_mantenimiento_hora, m.cost_maintenance, 0),
  costo_depreciacion_hora = COALESCE(m.costo_depreciacion_hora, m.cost_depreciation, 0),
  image_url = COALESCE(m.image_url, m.photo_url),
  activo = COALESCE(m.activo, m.deleted_at IS NULL, true),
  updated_at = COALESCE(m.updated_at, now())
WHERE m.codigo IS NULL OR m.nombre IS NULL OR m.estado IS NULL OR m.horometro_actual IS NULL;

-- 03b. Operaciones desde jornadas_maquinaria. CUARENTENAS DEFINIDAS:
--   Q1 lote sin match (nombre/codigo_interno + company) -> lote_id NULL (fila migra igual).
--   Q2 operador sin match (nombres+apellidos + company) -> operador_id NULL (snapshot conserva texto).
--   Q3 jornadas con maquinaria_id NULL -> NO migran (nuevo modelo exige máquina); se cuentan en §052-04.
--   Q4 type legacy fuera del dominio canónico (p.ej. Fumigadora/Motobomba citados en 015)
--      -> tipo='Otro'; se cuenta en §052-04, sin abortar.
INSERT INTO public.maquinaria_operaciones
  (id, company_id, maquinaria_id, operador_id, operador_nombre, labor, lote_id, lote_nombre,
   inicio, fin, horometro_inicio, horometro_fin, horas, combustible_l, costo_total, estado, notas,
   created_at, created_by)
SELECT
  j.id, j.company_id, j.maquinaria_id,
  (SELECT t.id FROM public.trabajadores t
     WHERE t.company_id = j.company_id
       AND btrim(t.nombres || ' ' || t.apellidos) ILIKE btrim(j.operator) LIMIT 1),
  j.operator, j.activity,
  (SELECT l.id FROM public.lotes l
     WHERE l.company_id = j.company_id
       AND (l.nombre ILIKE btrim(j.lot) OR l.codigo_interno ILIKE btrim(j.lot)) LIMIT 1),
  j.lot, j.start_time, j.end_time, j.start_horometro, j.end_horometro,
  j.calculated_hours, j.calculated_fuel_consumption, j.calculated_cost,
  CASE j.status WHEN 'En Progreso' THEN 'En Progreso' ELSE 'Finalizada' END,
  j.notes, j.created_at, 'migracion-052'
FROM public.jornadas_maquinaria j
WHERE j.maquinaria_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- 052-04 DATA VALIDATION (post-backfill; aborta si pérdida no explicada)
-- ══════════════════════════════════════════════════════════════════════════════
DO $val$ DECLARE
  v_maq INT; v_maq_sin_codigo INT; v_jor INT; v_jor_sin_maq INT; v_op INT;
  v_q1 INT; v_q2 INT; v_q4 INT;
BEGIN
  SELECT count(*) INTO v_maq FROM public.maquinaria;
  SELECT count(*) INTO v_maq_sin_codigo FROM public.maquinaria WHERE codigo IS NULL OR estado IS NULL OR horometro_actual IS NULL;
  IF v_maq_sin_codigo > 0 THEN
    RAISE EXCEPTION '052-04 ABORT: % maquinaria sin canónico completo (codigo/estado/horometro)', v_maq_sin_codigo;
  END IF;
  SELECT count(*) INTO v_jor FROM public.jornadas_maquinaria;
  SELECT count(*) INTO v_jor_sin_maq FROM public.jornadas_maquinaria WHERE maquinaria_id IS NULL;
  SELECT count(*) INTO v_op FROM public.maquinaria_operaciones;
  IF v_op <> v_jor - v_jor_sin_maq THEN
    RAISE EXCEPTION '052-04 ABORT: pérdida no explicada (jornadas=% ops=% sin_maq=% Q3)', v_jor, v_op, v_jor_sin_maq;
  END IF;
  SELECT count(*) INTO v_q1 FROM public.maquinaria_operaciones WHERE lote_id IS NULL;
  SELECT count(*) INTO v_q2 FROM public.maquinaria_operaciones WHERE operador_id IS NULL;
  SELECT count(*) INTO v_q4 FROM public.maquinaria WHERE tipo = 'Otro';
  RAISE NOTICE '[052-04] maquinaria=% ops_migradas=% (Q1 lote_id NULL=% Q2 operador_id NULL=% Q3 sin máquina no migradas=%, Q4 tipo=Otro %)',
    v_maq, v_op, v_q1, v_q2, v_jor_sin_maq, v_q4;
  -- Endurecer NOT NULL del maestro solo si el backfill quedó completo.
  IF v_maq_sin_codigo = 0 THEN
    ALTER TABLE public.maquinaria ALTER COLUMN codigo SET NOT NULL;
    ALTER TABLE public.maquinaria ALTER COLUMN nombre SET NOT NULL;
    ALTER TABLE public.maquinaria ALTER COLUMN estado SET NOT NULL;
    ALTER TABLE public.maquinaria ALTER COLUMN horometro_actual SET NOT NULL;
  END IF;
END $val$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 052-05 RLS (USING + WITH CHECK por operación; sin UPDATE/DELETE en inmutables)
-- ══════════════════════════════════════════════════════════════════════════════
-- Guarda anti-ejecución por secciones: 05 exige tablas creadas en 01.
DO $pre05$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['maquinaria_operaciones','maquinaria_mantenimientos','maquinaria_combustible','maquinaria_eventos'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      RAISE EXCEPTION '052-05 ABORT: falta tabla % — aplicar fases 052-01 a 052-04 completas; no ejecutar 052 por secciones', t;
    END IF;
  END LOOP;
END $pre05$;
ALTER TABLE public.maquinaria_operaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maquinaria_mantenimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maquinaria_combustible ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maquinaria_eventos ENABLE ROW LEVEL SECURITY;

-- Operaciones: lectura/insert tenant; update solo En Progreso; delete solo En Progreso + admin.
DROP POLICY IF EXISTS mqop_select_policy ON public.maquinaria_operaciones;
CREATE POLICY mqop_select_policy ON public.maquinaria_operaciones FOR SELECT TO authenticated
  USING (company_id = public.current_company());
DROP POLICY IF EXISTS mqop_insert_policy ON public.maquinaria_operaciones;
CREATE POLICY mqop_insert_policy ON public.maquinaria_operaciones FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company());
DROP POLICY IF EXISTS mqop_update_policy ON public.maquinaria_operaciones;
CREATE POLICY mqop_update_policy ON public.maquinaria_operaciones FOR UPDATE TO authenticated
  USING (company_id = public.current_company() AND estado = 'En Progreso')
  WITH CHECK (company_id = public.current_company() AND estado IN ('En Progreso','Finalizada','Cancelada'));
DROP POLICY IF EXISTS mqop_delete_policy ON public.maquinaria_operaciones;
CREATE POLICY mqop_delete_policy ON public.maquinaria_operaciones FOR DELETE TO authenticated
  USING (company_id = public.current_company() AND estado = 'En Progreso'
    AND public.current_role_id() = 'administrador');

-- Mantenimientos: sin DELETE; UPDATE solo Programado/En ejecucion.
DROP POLICY IF EXISTS mqmto_select_policy ON public.maquinaria_mantenimientos;
CREATE POLICY mqmto_select_policy ON public.maquinaria_mantenimientos FOR SELECT TO authenticated
  USING (company_id = public.current_company());
DROP POLICY IF EXISTS mqmto_insert_policy ON public.maquinaria_mantenimientos;
CREATE POLICY mqmto_insert_policy ON public.maquinaria_mantenimientos FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company());
DROP POLICY IF EXISTS mqmto_update_policy ON public.maquinaria_mantenimientos;
CREATE POLICY mqmto_update_policy ON public.maquinaria_mantenimientos FOR UPDATE TO authenticated
  USING (company_id = public.current_company() AND estado IN ('Programado','En ejecucion'))
  WITH CHECK (company_id = public.current_company());

-- Combustible y eventos: append-only (sin UPDATE/DELETE para ningún rol).
DROP POLICY IF EXISTS mqfuel_select_policy ON public.maquinaria_combustible;
CREATE POLICY mqfuel_select_policy ON public.maquinaria_combustible FOR SELECT TO authenticated
  USING (company_id = public.current_company());
DROP POLICY IF EXISTS mqfuel_insert_policy ON public.maquinaria_combustible;
CREATE POLICY mqfuel_insert_policy ON public.maquinaria_combustible FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company());
DROP POLICY IF EXISTS mqev_select_policy ON public.maquinaria_eventos;
CREATE POLICY mqev_select_policy ON public.maquinaria_eventos FOR SELECT TO authenticated
  USING (company_id = public.current_company());
DROP POLICY IF EXISTS mqev_insert_policy ON public.maquinaria_eventos;
CREATE POLICY mqev_insert_policy ON public.maquinaria_eventos FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company());

-- Higiene de roles en tablas nuevas (RLS ya niega a anon, se hace explícito).
REVOKE ALL ON TABLE public.maquinaria_operaciones FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.maquinaria_mantenimientos FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.maquinaria_combustible FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.maquinaria_eventos FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.maquinaria_operaciones TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.maquinaria_mantenimientos TO authenticated;
GRANT SELECT, INSERT ON TABLE public.maquinaria_combustible TO authenticated;
GRANT SELECT, INSERT ON TABLE public.maquinaria_eventos TO authenticated;
GRANT ALL ON TABLE public.maquinaria_operaciones TO service_role;
GRANT ALL ON TABLE public.maquinaria_mantenimientos TO service_role;
GRANT ALL ON TABLE public.maquinaria_combustible TO service_role;
GRANT ALL ON TABLE public.maquinaria_eventos TO service_role;

-- Secure company_id en las 4 tablas nuevas (mismo trigger zero-trust 022).
DO $trg$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['maquinaria_operaciones','maquinaria_mantenimientos','maquinaria_combustible','maquinaria_eventos'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS secure_company_id_trg ON public.%I', t);
    EXECUTE format('CREATE TRIGGER secure_company_id_trg BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.process_secure_company_id()', t);
  END LOOP;
END $trg$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 052-06 GRANTS (funciones §052-07; patrón 041/047/048)
-- (Se aplican junto a cada función; este bloque documenta la norma.)
--   REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon;
--   GRANT EXECUTE ... TO authenticated (+ service_role solo en DEFINER).
-- ══════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════════
-- 052-07 RPC (firmas congeladas contrato §8; errores estables para mapeo UI)
-- ══════════════════════════════════════════════════════════════════════════════
-- Helper interno de rol (no pública): aborta si el rol no está autorizado.
CREATE OR REPLACE FUNCTION public.mq_assert_rol(p_permitidos TEXT[])
RETURNS VOID LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $fn$
BEGIN
  IF NOT (public.current_role_id() = ANY (p_permitidos)) THEN
    RAISE EXCEPTION 'ACCESO_DENEGADO: rol % sin permiso para esta operación', public.current_role_id() USING ERRCODE='42501';
  END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.mq_assert_rol(TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mq_assert_rol(TEXT[]) TO authenticated, service_role;

-- 07.1 registrar_maquinaria
CREATE OR REPLACE FUNCTION public.registrar_maquinaria(
  p_codigo TEXT, p_nombre TEXT, p_tipo TEXT,
  p_marca TEXT DEFAULT NULL, p_modelo TEXT DEFAULT NULL,
  p_serial TEXT DEFAULT NULL, p_placa TEXT DEFAULT NULL,
  p_anio INT DEFAULT NULL, p_fecha_adquisicion DATE DEFAULT NULL,
  p_horometro_inicial NUMERIC DEFAULT 0
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE v_c UUID := public.current_company(); v_u TEXT := public.current_user_id(); v_id UUID;
BEGIN
  IF v_c IS NULL THEN RAISE EXCEPTION 'ACCESO_DENEGADO: empresa no identificada'; END IF;
  PERFORM public.mq_assert_rol(ARRAY['administrador','gerente','supervisor']);
  IF btrim(COALESCE(p_codigo,'')) = '' OR btrim(COALESCE(p_nombre,'')) = '' THEN
    RAISE EXCEPTION 'ESTADO_INVALIDO: codigo y nombre son obligatorios'; END IF;
  IF p_horometro_inicial IS NULL OR p_horometro_inicial < 0 THEN
    RAISE EXCEPTION 'HOROMETRO_REGRESIVO: horómetro inicial debe ser >= 0'; END IF;
  INSERT INTO public.maquinaria (company_id, codigo_id, codigo, name, nombre, type, tipo, status, estado,
      marca, modelo, serial, placa, anio, fecha_adquisicion,
      hours_of_operation, horometro_actual, hours_today,
      fuel_consumption, last_maintenance, next_maintenance,
      next_maintenance_hours, cost_operator, cost_fuel, cost_maintenance, cost_depreciation,
      costo_operador_hora, costo_combustible_hora, costo_mantenimiento_hora, costo_depreciacion_hora)
  VALUES (v_c, upper(btrim(p_codigo)), upper(btrim(p_codigo)), btrim(p_nombre), btrim(p_nombre),
      COALESCE(p_tipo,'Tractor'), COALESCE(p_tipo,'Tractor'), 'Disponible', 'Disponible',
      p_marca, p_modelo, p_serial, p_placa, p_anio, p_fecha_adquisicion,
      p_horometro_inicial, p_horometro_inicial, 0,
      '0 L/h', CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days',
      250, 0, 0, 0, 0, 0, 0, 0, 0)
  RETURNING id INTO v_id;
  INSERT INTO public.maquinaria_eventos (company_id, maquinaria_id, tipo_evento, entidad_tipo, entidad_id, usuario_id, rol, payload)
  VALUES (v_c, v_id, 'REGISTRO', 'maquinaria', v_id, v_u, public.current_role_id(), jsonb_build_object('codigo', upper(btrim(p_codigo))));
  RETURN jsonb_build_object('success', true, 'maquinaria_id', v_id);
END $fn$;
REVOKE ALL ON FUNCTION public.registrar_maquinaria(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,INT,DATE,NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_maquinaria(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,INT,DATE,NUMERIC) TO authenticated;

-- 07.2 iniciar_jornada (transacción + lock anti concurrencia)
CREATE OR REPLACE FUNCTION public.iniciar_jornada_maquinaria(
  p_maquinaria_id UUID, p_operador_id UUID, p_lote_id UUID, p_labor TEXT,
  p_inicio TIMESTAMPTZ, p_horometro_inicio NUMERIC
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE v_c UUID := public.current_company(); v_u TEXT := public.current_user_id();
  v_est TEXT; v_horo NUMERIC; v_op UUID; v_lote_nom TEXT; v_trab_nom TEXT; v_op_id UUID;
BEGIN
  IF v_c IS NULL THEN RAISE EXCEPTION 'ACCESO_DENEGADO: empresa no identificada'; END IF;
  PERFORM public.mq_assert_rol(ARRAY['administrador','gerente','supervisor','operario']);
  -- NOTA: no existe vínculo usuario↔trabajador en el esquema; operario queda
  -- autorizado por rol y auditado por usuario. Restringir por asignación queda
  -- pendiente de ese vínculo (ver contrato §8).
  SELECT estado, COALESCE(horometro_actual, hours_of_operation, 0) INTO v_est, v_horo FROM public.maquinaria
    WHERE id = p_maquinaria_id AND company_id = v_c FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCESO_DENEGADO: maquinaria fuera del tenant'; END IF;
  IF v_est <> 'Disponible' THEN RAISE EXCEPTION 'MAQUINA_NO_OPERABLE: estado % no permite iniciar jornada', v_est; END IF;
  IF EXISTS (SELECT 1 FROM public.maquinaria_operaciones WHERE maquinaria_id = p_maquinaria_id AND estado = 'En Progreso') THEN
    RAISE EXCEPTION 'JORNADA_ACTIVA_EXISTE: la máquina ya tiene una jornada En Progreso'; END IF;
  IF p_horometro_inicio < v_horo THEN
    RAISE EXCEPTION 'HOROMETRO_REGRESIVO: inicio % < actual %', p_horometro_inicio, v_horo; END IF;
  SELECT nombre INTO v_lote_nom FROM public.lotes WHERE id = p_lote_id AND company_id = v_c;
  IF NOT FOUND OR v_lote_nom IS NULL THEN RAISE EXCEPTION 'LOTE_FUERA_DE_TENANT: lote no pertenece a la empresa'; END IF;
  IF p_operador_id IS NOT NULL THEN
    SELECT btrim(nombres || ' ' || apellidos) INTO v_trab_nom FROM public.trabajadores
      WHERE id = p_operador_id AND company_id = v_c;
    IF NOT FOUND OR v_trab_nom IS NULL THEN RAISE EXCEPTION 'OPERADOR_FUERA_DE_TENANT: operador no pertenece a la empresa'; END IF;
    v_op_id := p_operador_id;
  ELSE
    v_trab_nom := 'Sin asignar';
  END IF;
  INSERT INTO public.maquinaria_operaciones
    (company_id, maquinaria_id, operador_id, operador_nombre, labor, lote_id, lote_nombre,
     inicio, horometro_inicio, estado, created_by)
  VALUES (v_c, p_maquinaria_id, v_op_id, v_trab_nom, p_labor, p_lote_id, v_lote_nom,
     COALESCE(p_inicio, now()), p_horometro_inicio, 'En Progreso', v_u)
  RETURNING id INTO v_op;
  UPDATE public.maquinaria SET estado = 'Operando', status = 'Operando', updated_at = now()
    WHERE id = p_maquinaria_id;
  INSERT INTO public.maquinaria_eventos (company_id, maquinaria_id, tipo_evento, entidad_tipo, entidad_id, usuario_id, rol, payload)
  VALUES (v_c, p_maquinaria_id, 'JORNADA_INICIO', 'maquinaria_operaciones', v_op, v_u, public.current_role_id(),
    jsonb_build_object('operacion_id', v_op, 'lote_id', p_lote_id, 'horometro_inicio', p_horometro_inicio));
  RETURN jsonb_build_object('success', true, 'operacion_id', v_op);
END $fn$;
REVOKE ALL ON FUNCTION public.iniciar_jornada_maquinaria(UUID,UUID,UUID,TEXT,TIMESTAMPTZ,NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.iniciar_jornada_maquinaria(UUID,UUID,UUID,TEXT,TIMESTAMPTZ,NUMERIC) TO authenticated;

-- 07.3 finalizar_jornada (costo a lote por lote_id, no por nombre)
CREATE OR REPLACE FUNCTION public.finalizar_jornada_maquinaria(
  p_operacion_id UUID, p_fin TIMESTAMPTZ, p_horometro_fin NUMERIC,
  p_combustible_l NUMERIC DEFAULT NULL, p_notas TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE v_c UUID := public.current_company(); v_u TEXT := public.current_user_id();
  v_op RECORD; v_horas NUMERIC; v_costo NUMERIC; v_horo_act NUMERIC;
BEGIN
  IF v_c IS NULL THEN RAISE EXCEPTION 'ACCESO_DENEGADO: empresa no identificada'; END IF;
  PERFORM public.mq_assert_rol(ARRAY['administrador','gerente','supervisor','operario']);
  SELECT * INTO v_op FROM public.maquinaria_operaciones
    WHERE id = p_operacion_id AND company_id = v_c FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCESO_DENEGADO: operación fuera del tenant'; END IF;
  IF v_op.estado <> 'En Progreso' THEN RAISE EXCEPTION 'ESTADO_INVALIDO: solo En Progreso puede finalizarse'; END IF;
  IF p_fin < v_op.inicio THEN RAISE EXCEPTION 'ESTADO_INVALIDO: fin anterior al inicio'; END IF;
  IF p_horometro_fin < v_op.horometro_inicio THEN
    RAISE EXCEPTION 'HOROMETRO_REGRESIVO: fin % < inicio %', p_horometro_fin, v_op.horometro_inicio; END IF;
  IF p_combustible_l IS NOT NULL AND p_combustible_l < 0 THEN
    RAISE EXCEPTION 'COMBUSTIBLE_INVALIDO: combustible debe ser >= 0'; END IF;
  v_horas := p_horometro_fin - v_op.horometro_inicio;
  SELECT (COALESCE(costo_operador_hora,cost_operator,0) + COALESCE(costo_combustible_hora,cost_fuel,0)
        + COALESCE(costo_mantenimiento_hora,cost_maintenance,0) + COALESCE(costo_depreciacion_hora,cost_depreciation,0)),
         COALESCE(horometro_actual, hours_of_operation, 0)
    INTO v_costo, v_horo_act FROM public.maquinaria WHERE id = v_op.maquinaria_id;
  v_costo := v_horas * COALESCE(v_costo, 0);
  UPDATE public.maquinaria_operaciones SET fin = p_fin, horometro_fin = p_horometro_fin,
      horas = v_horas, combustible_l = p_combustible_l, costo_total = v_costo,
      notas = p_notas, estado = 'Finalizada'
    WHERE id = p_operacion_id;
  UPDATE public.maquinaria SET estado = 'Disponible', status = 'Disponible',
      horometro_actual = GREATEST(COALESCE(v_horo_act,0), p_horometro_fin),
      hours_of_operation = GREATEST(COALESCE(v_horo_act,0), p_horometro_fin),
      hours_today = v_horas, updated_at = now()
    WHERE id = v_op.maquinaria_id;
  IF v_op.lote_id IS NOT NULL THEN
    PERFORM public.registrar_costo_lote(v_c, v_op.lote_id, 'Maquinaria', v_costo,
      (COALESCE(p_fin, now()))::date, 'maquinaria_operaciones', p_operacion_id,
      'Uso de maquinaria: ' || v_op.labor || ' (' || v_horas || ' h)');
  END IF;
  INSERT INTO public.maquinaria_eventos (company_id, maquinaria_id, tipo_evento, entidad_tipo, entidad_id, usuario_id, rol, payload)
  VALUES (v_c, v_op.maquinaria_id, 'JORNADA_FIN', 'maquinaria_operaciones', p_operacion_id, v_u, public.current_role_id(),
    jsonb_build_object('horas', v_horas, 'costo', v_costo, 'combustible_l', p_combustible_l));
  RETURN jsonb_build_object('success', true, 'horas', v_horas, 'costo', v_costo);
END $fn$;
REVOKE ALL ON FUNCTION public.finalizar_jornada_maquinaria(UUID,TIMESTAMPTZ,NUMERIC,NUMERIC,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_jornada_maquinaria(UUID,TIMESTAMPTZ,NUMERIC,NUMERIC,TEXT) TO authenticated;

-- 07.4 registrar_combustible
CREATE OR REPLACE FUNCTION public.registrar_combustible_maquinaria(
  p_maquinaria_id UUID, p_fecha TIMESTAMPTZ, p_cantidad NUMERIC, p_unidad TEXT,
  p_costo_unitario NUMERIC, p_horometro NUMERIC, p_operador_id UUID DEFAULT NULL,
  p_proveedor TEXT DEFAULT NULL, p_observacion TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE v_c UUID := public.current_company(); v_u TEXT := public.current_user_id();
  v_horo NUMERIC; v_last NUMERIC; v_total NUMERIC; v_id UUID;
BEGIN
  IF v_c IS NULL THEN RAISE EXCEPTION 'ACCESO_DENEGADO: empresa no identificada'; END IF;
  PERFORM public.mq_assert_rol(ARRAY['administrador','gerente','supervisor','operario']);
  SELECT COALESCE(horometro_actual, hours_of_operation, 0) INTO v_horo FROM public.maquinaria
    WHERE id = p_maquinaria_id AND company_id = v_c;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCESO_DENEGADO: maquinaria fuera del tenant'; END IF;
  SELECT max(horometro) INTO v_last FROM public.maquinaria_combustible WHERE maquinaria_id = p_maquinaria_id;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'COMBUSTIBLE_INVALIDO: cantidad debe ser > 0'; END IF;
  IF p_costo_unitario IS NULL OR p_costo_unitario < 0 THEN RAISE EXCEPTION 'COMBUSTIBLE_INVALIDO: costo unitario debe ser >= 0'; END IF;
  IF p_horometro < GREATEST(v_horo, COALESCE(v_last, 0)) THEN
    RAISE EXCEPTION 'HOROMETRO_REGRESIVO: % < último válido %', p_horometro, GREATEST(v_horo, COALESCE(v_last,0)); END IF;
  IF p_fecha > now() + INTERVAL '1 hour' THEN RAISE EXCEPTION 'COMBUSTIBLE_INVALIDO: fecha futura'; END IF;
  IF p_operador_id IS NOT NULL AND NOT EXISTS
    (SELECT 1 FROM public.trabajadores WHERE id = p_operador_id AND company_id = v_c) THEN
    RAISE EXCEPTION 'OPERADOR_FUERA_DE_TENANT: operador no pertenece a la empresa'; END IF;
  v_total := p_cantidad * p_costo_unitario;
  INSERT INTO public.maquinaria_combustible
    (company_id, maquinaria_id, fecha, cantidad, unidad, costo_unitario, costo_total,
     horometro, operador_id, proveedor, observacion, created_by)
  VALUES (v_c, p_maquinaria_id, COALESCE(p_fecha, now()), p_cantidad, COALESCE(p_unidad,'L'),
     p_costo_unitario, v_total, p_horometro, p_operador_id, p_proveedor, p_observacion, v_u)
  RETURNING id INTO v_id;
  UPDATE public.maquinaria SET horometro_actual = GREATEST(COALESCE(horometro_actual,0), p_horometro),
      hours_of_operation = GREATEST(COALESCE(hours_of_operation,0), p_horometro), updated_at = now()
    WHERE id = p_maquinaria_id;
  INSERT INTO public.maquinaria_eventos (company_id, maquinaria_id, tipo_evento, entidad_tipo, entidad_id, usuario_id, rol, payload)
  VALUES (v_c, p_maquinaria_id, 'COMBUSTIBLE', 'maquinaria_combustible', v_id, v_u, public.current_role_id(),
    jsonb_build_object('cantidad', p_cantidad, 'costo_total', v_total, 'horometro', p_horometro));
  RETURN jsonb_build_object('success', true, 'registro_id', v_id, 'costo_total', v_total);
END $fn$;
REVOKE ALL ON FUNCTION public.registrar_combustible_maquinaria(UUID,TIMESTAMPTZ,NUMERIC,TEXT,NUMERIC,NUMERIC,UUID,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_combustible_maquinaria(UUID,TIMESTAMPTZ,NUMERIC,TEXT,NUMERIC,NUMERIC,UUID,TEXT,TEXT) TO authenticated;

-- 07.5 programar_mantenimiento
CREATE OR REPLACE FUNCTION public.programar_mantenimiento_maquinaria(
  p_maquinaria_id UUID, p_tipo TEXT, p_descripcion TEXT, p_fecha_programada DATE,
  p_horometro_ref NUMERIC, p_iniciar_ejecucion BOOLEAN DEFAULT false
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE v_c UUID := public.current_company(); v_u TEXT := public.current_user_id(); v_id UUID;
BEGIN
  IF v_c IS NULL THEN RAISE EXCEPTION 'ACCESO_DENEGADO: empresa no identificada'; END IF;
  PERFORM public.mq_assert_rol(ARRAY['administrador','gerente','supervisor']);
  IF NOT EXISTS (SELECT 1 FROM public.maquinaria WHERE id = p_maquinaria_id AND company_id = v_c) THEN
    RAISE EXCEPTION 'ACCESO_DENEGADO: maquinaria fuera del tenant'; END IF;
  IF p_tipo NOT IN ('Preventivo','Correctivo') THEN RAISE EXCEPTION 'MANTENIMIENTO_INVALIDO: tipo debe ser Preventivo|Correctivo'; END IF;
  IF btrim(COALESCE(p_descripcion,'')) = '' THEN RAISE EXCEPTION 'MANTENIMIENTO_INVALIDO: descripcion obligatoria'; END IF;
  INSERT INTO public.maquinaria_mantenimientos
    (company_id, maquinaria_id, tipo, estado, descripcion, fecha_programada, horometro, created_by)
  VALUES (v_c, p_maquinaria_id, p_tipo,
    CASE WHEN p_iniciar_ejecucion THEN 'En ejecucion' ELSE 'Programado' END,
    btrim(p_descripcion), p_fecha_programada, p_horometro_ref, v_u)
  RETURNING id INTO v_id;
  IF p_iniciar_ejecucion THEN
    UPDATE public.maquinaria SET estado='Mantenimiento', status='Mantenimiento', updated_at=now()
      WHERE id = p_maquinaria_id;
  END IF;
  INSERT INTO public.maquinaria_eventos (company_id, maquinaria_id, tipo_evento, entidad_tipo, entidad_id, usuario_id, rol, payload)
  VALUES (v_c, p_maquinaria_id, 'MANTENIMIENTO_PROGRAMADO', 'maquinaria_mantenimientos', v_id, v_u, public.current_role_id(),
    jsonb_build_object('tipo', p_tipo, 'fecha_programada', p_fecha_programada));
  RETURN jsonb_build_object('success', true, 'mantenimiento_id', v_id);
END $fn$;
REVOKE ALL ON FUNCTION public.programar_mantenimiento_maquinaria(UUID,TEXT,TEXT,DATE,NUMERIC,BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.programar_mantenimiento_maquinaria(UUID,TEXT,TEXT,DATE,NUMERIC,BOOLEAN) TO authenticated;

-- 07.6 registrar_mantenimiento (DEFINER: escribe evento + estado)
CREATE OR REPLACE FUNCTION public.registrar_mantenimiento_maquinaria_v2(
  p_mantenimiento_id UUID, p_fecha_ejecucion DATE, p_horometro NUMERIC,
  p_costo NUMERIC DEFAULT 0, p_proveedor TEXT DEFAULT NULL, p_responsable TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_c UUID := public.current_company(); v_u TEXT := public.current_user_id();
  v_row RECORD; v_horo NUMERIC;
BEGIN
  IF v_c IS NULL THEN RAISE EXCEPTION 'ACCESO_DENEGADO: empresa no identificada'; END IF;
  PERFORM public.mq_assert_rol(ARRAY['administrador','gerente','supervisor','operario']);
  SELECT * INTO v_row FROM public.maquinaria_mantenimientos
    WHERE id = p_mantenimiento_id AND company_id = v_c FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCESO_DENEGADO: mantenimiento fuera del tenant'; END IF;
  IF v_row.estado NOT IN ('Programado','En ejecucion') THEN
    RAISE EXCEPTION 'MANTENIMIENTO_INVALIDO: estado % no ejecutable', v_row.estado; END IF;
  IF p_costo IS NULL OR p_costo < 0 THEN RAISE EXCEPTION 'MANTENIMIENTO_INVALIDO: costo debe ser >= 0'; END IF;
  SELECT COALESCE(horometro_actual, hours_of_operation, 0) INTO v_horo FROM public.maquinaria WHERE id = v_row.maquinaria_id;
  IF p_horometro < 0 THEN RAISE EXCEPTION 'HOROMETRO_REGRESIVO: horómetro debe ser >= 0'; END IF;
  UPDATE public.maquinaria_mantenimientos SET estado='Completado', fecha_ejecucion=p_fecha_ejecucion,
      horometro=GREATEST(horometro, p_horometro), costo=p_costo, proveedor=COALESCE(p_proveedor, proveedor),
      responsable=COALESCE(p_responsable, responsable), executed_at=now(), executed_by=v_u
    WHERE id = p_mantenimiento_id;
  UPDATE public.maquinaria SET estado='Disponible', status='Disponible',
      horometro_actual=GREATEST(COALESCE(v_horo,0), p_horometro),
      hours_of_operation=GREATEST(COALESCE(v_horo,0), p_horometro),
      updated_at=now()
    WHERE id = v_row.maquinaria_id;
  INSERT INTO public.maquinaria_eventos (company_id, maquinaria_id, tipo_evento, entidad_tipo, entidad_id, usuario_id, rol, payload)
  VALUES (v_c, v_row.maquinaria_id, 'MANTENIMIENTO_EJECUTADO', 'maquinaria_mantenimientos', p_mantenimiento_id, v_u, public.current_role_id(),
    jsonb_build_object('costo', p_costo, 'horometro', p_horometro));
  RETURN jsonb_build_object('success', true, 'mantenimiento_id', p_mantenimiento_id);
END $fn$;
REVOKE ALL ON FUNCTION public.registrar_mantenimiento_maquinaria_v2(UUID,DATE,NUMERIC,NUMERIC,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_mantenimiento_maquinaria_v2(UUID,DATE,NUMERIC,NUMERIC,TEXT,TEXT) TO authenticated, service_role;

-- 07.7 actualizar_horometro (lectura: monótona; corrección: motivo + admin/gerente)
CREATE OR REPLACE FUNCTION public.actualizar_horometro_maquinaria(
  p_maquinaria_id UUID, p_horometro NUMERIC, p_modo TEXT DEFAULT 'lectura', p_motivo TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_c UUID := public.current_company(); v_u TEXT := public.current_user_id(); v_horo NUMERIC;
BEGIN
  IF v_c IS NULL THEN RAISE EXCEPTION 'ACCESO_DENEGADO: empresa no identificada'; END IF;
  SELECT COALESCE(horometro_actual, hours_of_operation, 0) INTO v_horo FROM public.maquinaria
    WHERE id = p_maquinaria_id AND company_id = v_c FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCESO_DENEGADO: maquinaria fuera del tenant'; END IF;
  IF p_horometro IS NULL OR p_horometro < 0 THEN RAISE EXCEPTION 'HOROMETRO_REGRESIVO: debe ser >= 0'; END IF;
  IF p_modo = 'correccion' THEN
    PERFORM public.mq_assert_rol(ARRAY['administrador','gerente']);
    IF btrim(COALESCE(p_motivo,'')) = '' THEN RAISE EXCEPTION 'ESTADO_INVALIDO: la corrección exige motivo'; END IF;
  ELSE
    PERFORM public.mq_assert_rol(ARRAY['administrador','gerente','supervisor','operario']);
    IF p_horometro < v_horo THEN
      RAISE EXCEPTION 'HOROMETRO_REGRESIVO: lectura % < actual % (usar modo correccion con motivo)', p_horometro, v_horo; END IF;
  END IF;
  UPDATE public.maquinaria SET horometro_actual=p_horometro, hours_of_operation=p_horometro, updated_at=now()
    WHERE id = p_maquinaria_id;
  INSERT INTO public.maquinaria_eventos (company_id, maquinaria_id, tipo_evento, usuario_id, rol, payload)
  VALUES (v_c, p_maquinaria_id, CASE WHEN p_modo='correccion' THEN 'HOROMETRO_CORRECCION' ELSE 'EDICION' END,
    v_u, public.current_role_id(), jsonb_build_object('antes', v_horo, 'despues', p_horometro, 'modo', p_modo, 'motivo', p_motivo));
  RETURN jsonb_build_object('success', true, 'horometro_actual', p_horometro);
END $fn$;
REVOKE ALL ON FUNCTION public.actualizar_horometro_maquinaria(UUID,NUMERIC,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actualizar_horometro_maquinaria(UUID,NUMERIC,TEXT,TEXT) TO authenticated, service_role;

-- 07.8 registrar_incidencia (crítica bloquea jornadas pasando a Mantenimiento)
CREATE OR REPLACE FUNCTION public.registrar_incidencia_maquinaria(
  p_maquinaria_id UUID, p_severidad TEXT, p_descripcion TEXT, p_fuera_de_servicio BOOLEAN DEFAULT false
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE v_c UUID := public.current_company(); v_u TEXT := public.current_user_id(); v_eid UUID; v_nuevo TEXT := NULL;
BEGIN
  IF v_c IS NULL THEN RAISE EXCEPTION 'ACCESO_DENEGADO: empresa no identificada'; END IF;
  PERFORM public.mq_assert_rol(ARRAY['administrador','gerente','supervisor','operario']);
  IF NOT EXISTS (SELECT 1 FROM public.maquinaria WHERE id = p_maquinaria_id AND company_id = v_c) THEN
    RAISE EXCEPTION 'ACCESO_DENEGADO: maquinaria fuera del tenant'; END IF;
  IF p_severidad NOT IN ('leve','grave','critica') THEN RAISE EXCEPTION 'ESTADO_INVALIDO: severidad leve|grave|critica'; END IF;
  IF btrim(COALESCE(p_descripcion,'')) = '' THEN RAISE EXCEPTION 'ESTADO_INVALIDO: descripcion obligatoria'; END IF;
  IF p_severidad = 'critica' THEN v_nuevo := CASE WHEN p_fuera_de_servicio THEN 'Fuera de servicio' ELSE 'Mantenimiento' END; END IF;
  IF v_nuevo IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.maquinaria_operaciones WHERE maquinaria_id = p_maquinaria_id AND estado='En Progreso') THEN
      RAISE EXCEPTION 'MAQUINA_NO_OPERABLE: existe jornada En Progreso; finalizarla antes del cambio de estado'; END IF;
    UPDATE public.maquinaria SET estado=v_nuevo,
      status=CASE WHEN v_nuevo='Fuera de servicio' THEN 'Fuera de Servicio' ELSE 'Mantenimiento' END,
      updated_at=now() WHERE id = p_maquinaria_id;
  END IF;
  INSERT INTO public.maquinaria_eventos (company_id, maquinaria_id, tipo_evento, usuario_id, rol, payload)
  VALUES (v_c, p_maquinaria_id, 'INCIDENCIA', v_u, public.current_role_id(),
    jsonb_build_object('severidad', p_severidad, 'descripcion', btrim(p_descripcion), 'nuevo_estado', v_nuevo))
  RETURNING id INTO v_eid;
  RETURN jsonb_build_object('success', true, 'evento_id', v_eid, 'nuevo_estado', v_nuevo);
END $fn$;
REVOKE ALL ON FUNCTION public.registrar_incidencia_maquinaria(UUID,TEXT,TEXT,BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_incidencia_maquinaria(UUID,TEXT,TEXT,BOOLEAN) TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- 052-08 LEGACY COMPATIBILITY (wrappers intactos, marcados DEPRECATED)
-- ══════════════════════════════════════════════════════════════════════════════
-- Firmas exactas vía regprocedure: robusto ante VARCHAR/TEXT en el catálogo.
DO $dep$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN
      ('iniciar_labor_maquinaria','finalizar_labor_maquinaria','registrar_mantenimiento_maquinaria') LOOP
    EXECUTE format('COMMENT ON FUNCTION %s IS %L', r.sig,
      'DEPRECATED 052: usar las RPC contrato §8 (iniciar/finalizar_jornada_maquinaria, programar/registrar_mantenimiento_maquinaria_v2). Wrapper conservado para regresión; no añadir funcionalidad.');
  END LOOP;
  RAISE NOTICE '[052-08] Legacy DEPRECATED marcado, sin redefinir firmas.';
END $dep$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 052-09 IMMUTABILITY / TRIGGERS (transiciones + históricos + updated_at + sync)
-- ══════════════════════════════════════════════════════════════════════════════
-- Guarda anti-ejecución por secciones: 09 exige tablas de 01 y columnas de 03.
DO $pre09$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['maquinaria_operaciones','maquinaria_mantenimientos','maquinaria_combustible','maquinaria_eventos'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      RAISE EXCEPTION '052-09 ABORT: falta tabla % — aplicar fases 052-01 a 052-08 completas; no ejecutar 052 por secciones', t;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='maquinaria' AND column_name='estado') THEN
    RAISE EXCEPTION '052-09 ABORT: falta columna maquinaria.estado — aplicar fases 052-01 a 052-08 completas';
  END IF;
END $pre09$;
-- 09a. Transiciones de estado permitidas (contrato §3).
CREATE OR REPLACE FUNCTION public.mq_check_transicion_estado()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    IF NOT (
      (OLD.estado='Disponible' AND NEW.estado IN ('Operando','Mantenimiento','Fuera de servicio')) OR
      (OLD.estado='Operando' AND NEW.estado='Disponible') OR
      (OLD.estado='Mantenimiento' AND NEW.estado IN ('Disponible','Fuera de servicio')) OR
      (OLD.estado='Fuera de servicio' AND NEW.estado='Disponible')) THEN
      RAISE EXCEPTION 'ESTADO_INVALIDO: transición % → % no permitida', OLD.estado, NEW.estado;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS mq_estado_trg ON public.maquinaria;
CREATE TRIGGER mq_estado_trg BEFORE UPDATE OF estado ON public.maquinaria
  FOR EACH ROW EXECUTE FUNCTION public.mq_check_transicion_estado();

-- 09b. Sincronía legacy status ↔ estado (doble sentido, anti-recursión).
CREATE OR REPLACE FUNCTION public.mq_sync_status_estado()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    NEW.status := CASE NEW.estado WHEN 'Disponible' THEN 'Disponible' WHEN 'Operando' THEN 'Operando'
      WHEN 'Mantenimiento' THEN 'Mantenimiento' WHEN 'Fuera de servicio' THEN 'Fuera de Servicio' ELSE NEW.status END;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.estado := CASE NEW.status WHEN 'Disponible' THEN 'Disponible' WHEN 'Operando' THEN 'Operando'
      WHEN 'Mantenimiento' THEN 'Mantenimiento' WHEN 'Fuera de Servicio' THEN 'Fuera de servicio' ELSE NEW.estado END;
  END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS mq_sync_status_trg ON public.maquinaria;
CREATE TRIGGER mq_sync_status_trg BEFORE UPDATE OF estado, status ON public.maquinaria
  FOR EACH ROW EXECUTE FUNCTION public.mq_sync_status_estado();

-- 09c. Inmutabilidad de históricos + eventos append-only.
CREATE OR REPLACE FUNCTION public.mq_block_historico()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
BEGIN
  IF TG_TABLE_NAME = 'maquinaria_eventos' THEN
    RAISE EXCEPTION 'HISTORICO_INMUTABLE: % no admite % (usar evento de corrección)', TG_TABLE_NAME, TG_OP;
  ELSIF TG_TABLE_NAME = 'maquinaria_combustible' THEN
    RAISE EXCEPTION 'HISTORICO_INMUTABLE: combustible no admite % (nueva fila de ajuste)', TG_OP;
  ELSIF TG_TABLE_NAME = 'maquinaria_operaciones' AND OLD.estado IN ('Finalizada','Cancelada') THEN
    RAISE EXCEPTION 'HISTORICO_INMUTABLE: operación % no admite %', OLD.estado, TG_OP;
  ELSIF TG_TABLE_NAME = 'maquinaria_mantenimientos' AND OLD.estado IN ('Completado','Vencido','Cancelado') THEN
    RAISE EXCEPTION 'HISTORICO_INMUTABLE: mantenimiento % no admite %', OLD.estado, TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $fn$;
DROP TRIGGER IF EXISTS mq_immutable_op_trg ON public.maquinaria_operaciones;
CREATE TRIGGER mq_immutable_op_trg BEFORE UPDATE OR DELETE ON public.maquinaria_operaciones
  FOR EACH ROW EXECUTE FUNCTION public.mq_block_historico();
DROP TRIGGER IF EXISTS mq_immutable_mto_trg ON public.maquinaria_mantenimientos;
CREATE TRIGGER mq_immutable_mto_trg BEFORE UPDATE OR DELETE ON public.maquinaria_mantenimientos
  FOR EACH ROW EXECUTE FUNCTION public.mq_block_historico();
DROP TRIGGER IF EXISTS mq_immutable_fuel_trg ON public.maquinaria_combustible;
CREATE TRIGGER mq_immutable_fuel_trg BEFORE UPDATE OR DELETE ON public.maquinaria_combustible
  FOR EACH ROW EXECUTE FUNCTION public.mq_block_historico();
DROP TRIGGER IF EXISTS mq_immutable_ev_trg ON public.maquinaria_eventos;
CREATE TRIGGER mq_immutable_ev_trg BEFORE UPDATE OR DELETE ON public.maquinaria_eventos
  FOR EACH ROW EXECUTE FUNCTION public.mq_block_historico();
-- UPDATE permitido en operaciones En Progreso y mantenimientos Programado/En ejecucion
-- pasa RLS (§052-05); el trigger solo bloquea filas cerradas. Combustible/eventos: bloqueo total.

-- 09d. Auditoría automática: incluir las 4 tablas nuevas en process_audit_log (022:307-317).
DO $aud$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['maquinaria_operaciones','maquinaria_mantenimientos','maquinaria_combustible','maquinaria_eventos'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I_trigger ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER audit_%I_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.process_audit_log()', t, t);
  END LOOP;
END $aud$;

-- 09e. Vistas analytics contractuales (§12): solo lectura, security_invoker.
CREATE OR REPLACE VIEW public.vw_maquinaria_fleet_summary
WITH (security_invoker = true) AS
SELECT company_id,
  count(*) AS total,
  count(*) FILTER (WHERE estado='Disponible') AS disponibles,
  count(*) FILTER (WHERE estado='Operando') AS operando,
  count(*) FILTER (WHERE estado='Mantenimiento') AS mantenimiento,
  count(*) FILTER (WHERE estado='Fuera de servicio') AS fuera_servicio
FROM public.maquinaria WHERE deleted_at IS NULL GROUP BY company_id;
REVOKE ALL ON TABLE public.vw_maquinaria_fleet_summary FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.vw_maquinaria_fleet_summary TO authenticated, service_role;

CREATE OR REPLACE VIEW public.vw_maquinaria_analytics
WITH (security_invoker = true) AS
SELECT m.company_id, m.id AS maquinaria_id, m.codigo, m.estado,
  COALESCE(o.horas,0) AS horas_periodo, COALESCE(f.litros,0) AS litros_periodo,
  COALESCE(f.costo_fuel,0) + COALESCE(mt.costo_mto,0) AS costo_periodo,
  CASE WHEN COALESCE(o.horas,0) > 0 THEN (COALESCE(f.litros,0) / o.horas) END AS l_h,
  CASE WHEN COALESCE(o.horas,0) > 0 THEN ((COALESCE(f.costo_fuel,0) + COALESCE(mt.costo_mto,0)) / o.horas) END AS costo_hora,
  COALESCE(mtv.vencidos,0) AS mantenimientos_vencidos
FROM public.maquinaria m
LEFT JOIN (SELECT maquinaria_id, sum(horas) AS horas FROM public.maquinaria_operaciones
  WHERE estado='Finalizada' AND inicio >= now() - INTERVAL '30 days' GROUP BY 1) o ON o.maquinaria_id = m.id
LEFT JOIN (SELECT maquinaria_id, sum(cantidad) AS litros, sum(costo_total) AS costo_fuel
  FROM public.maquinaria_combustible WHERE fecha >= now() - INTERVAL '30 days' GROUP BY 1) f ON f.maquinaria_id = m.id
LEFT JOIN (SELECT maquinaria_id, sum(costo) AS costo_mto
  FROM public.maquinaria_mantenimientos WHERE estado='Completado' GROUP BY 1) mt ON mt.maquinaria_id = m.id
LEFT JOIN (SELECT m2.maquinaria_id, count(*) AS vencidos
  FROM public.maquinaria_mantenimientos m2
  WHERE m2.estado='Programado' AND (m2.fecha_programada < CURRENT_DATE
    OR m2.horometro < COALESCE((SELECT mm.horometro_actual FROM public.maquinaria mm WHERE mm.id = m2.maquinaria_id), 0))
  GROUP BY 1) mtv ON mtv.maquinaria_id = m.id
WHERE m.deleted_at IS NULL;
REVOKE ALL ON TABLE public.vw_maquinaria_analytics FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.vw_maquinaria_analytics TO authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════════════
-- 052-10 POSTFLIGHT (verificación; EXCEPTION en fallos duros, NOTICE en cuarentenas)
-- ══════════════════════════════════════════════════════════════════════════════
DO $post$ DECLARE v TEXT;
BEGIN
  RAISE NOTICE '[052-10] Postflight...';
  FOR v IN SELECT unnest(ARRAY['maquinaria_operaciones','maquinaria_mantenimientos','maquinaria_combustible','maquinaria_eventos']) LOOP
    PERFORM 1 FROM pg_tables WHERE schemaname='public' AND tablename=v;
    IF NOT FOUND THEN RAISE EXCEPTION '052-10 FAIL: falta tabla %', v; END IF;
    PERFORM 1 FROM pg_tables WHERE schemaname='public' AND tablename=v AND rowsecurity;
    IF NOT FOUND THEN RAISE EXCEPTION '052-10 FAIL: RLS deshabilitado en %', v; END IF;
  END LOOP;
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='maquinaria_eventos' AND policyname='mqev_insert_policy';
  IF NOT FOUND THEN RAISE EXCEPTION '052-10 FAIL: policies 052-05 no aplicadas'; END IF;
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='iniciar_jornada_maquinaria';
  IF NOT FOUND THEN RAISE EXCEPTION '052-10 FAIL: RPC 052-07 no creadas'; END IF;
  -- Funciones nuevas deben tener search_path + grants mínimos.
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN
      ('registrar_maquinaria','iniciar_jornada_maquinaria','finalizar_jornada_maquinaria',
       'registrar_combustible_maquinaria','programar_mantenimiento_maquinaria',
       'registrar_mantenimiento_maquinaria_v2','actualizar_horometro_maquinaria','registrar_incidencia_maquinaria')
    AND (p.proconfig IS NULL OR NOT (p.proconfig::text LIKE '%search_path%'));
  IF FOUND THEN RAISE EXCEPTION '052-10 FAIL: RPC sin SET search_path'; END IF;
  -- Legacy intacto.
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='iniciar_labor_maquinaria';
  IF NOT FOUND THEN RAISE EXCEPTION '052-10 FAIL: legacy iniciar_labor_maquinaria eliminada (052 no debe borrar legacy)'; END IF;
  RAISE NOTICE '[052-10] OK: esquema + RLS + RPC + legacy. Regresión pendiente (paso 7 del plan) antes de repositorios/UI.';
END $post$;

-- ROLLBACK DOCUMENTADO (no ejecutar salvo reversión controlada en staging):
--   1) DROP VIEW vw_maquinaria_analytics, vw_maquinaria_fleet_summary;
--   2) DROP TRIGGER + FUNCTION mq_* (09a-09c) y audit_* de las 4 tablas (09d);
--   3) Quitar COMMENTS DEPRECATED (08); las RPC 07 se eliminan con DROP FUNCTION IF EXISTS <firma>;
--      helper mq_assert_rol al final;
--   4) DROP POLICY 052-05; DROP TRIGGER secure_company_id_trg en las 4 tablas;
--   5) DROP TABLE nuevas en orden: eventos → combustible → mantenimientos → operaciones;
--   6) ALTER TABLE maquinaria DROP CONSTRAINT chk/uq *_052 + DROP COLUMN nuevas
--      (codigo, estado, ...). Legacy (codigo_id, status, ...) nunca se tocó.
