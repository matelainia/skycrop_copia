-- ==============================================================================
-- SKYCROP DATABASE V2: 048_traceability_events.sql
-- Descripción: Sistema de evidencia productiva inmutable — bitácora oficial del predio.
--   Principio: SkyCrop no registra actividades; genera evidencia verificable.
--   - traceability_events: tabla central solo-lectura (append-only), hash encadenado
--   - RLS multiempresa estricta (SELECT/INSERT por company; sin UPDATE/DELETE)
--   - Trigger inmutabilidad: bloquea UPDATE/DELETE a nivel SQL
--   - RPC registrar_evento_trazabilidad (INVOKER + overload empresa explícita)
--   - RPC verificar_integridad_evento + verificar_cadena_lote
--   - Vista vw_traceability_timeline + bucket storage privado
--   - Integración: no modifica eventos origen; solo consume referencias
-- ==============================================================================

-- ── 0. Pre-requisitos ─────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. Tabla central de eventos inmutables ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.traceability_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- Predio / finca (farm_id canónico; predio_id alias compatibilidad con modelo existente)
  farm_id UUID REFERENCES public.predios(id) ON DELETE SET NULL,
  predio_id UUID REFERENCES public.predios(id) ON DELETE SET NULL,
  lot_id UUID REFERENCES public.lotes(id) ON DELETE SET NULL,
  lote_id UUID REFERENCES public.lotes(id) ON DELETE SET NULL,

  -- Código legible TRZ-YYYY-NNNNNN (único por empresa)
  event_code TEXT,

  -- Clasificación
  event_type TEXT NOT NULL CHECK (event_type IN (
    'fertilization_application', 'sanitary_application', 'sanitary_monitoring',
    'general_monitoring', 'nutrition_monitoring', 'harvest_collection',
    'postharvest_process', 'worker_activity', 'inventory_movement',
    'soil_analysis', 'cultural_labor', 'machinery_operation', 'irrigation',
    'planting', 'pruning', 'other'
  )),
  source_module TEXT NOT NULL CHECK (source_module IN (
    'fertilizacion', 'sanitario', 'monitoreo', 'cosecha', 'postcosecha',
    'personal', 'inventario', 'suelos', 'maquinaria', 'riego', 'sistema'
  )),

  -- Temporalidad: fecha del hecho agrícola vs fecha de registro sistema
  event_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Responsables
  created_by TEXT NOT NULL,               -- clerk_user_id creador lógico (sistema o usuario)
  created_by_name TEXT,                   -- nombre denormalizado para timeline sin joins
  executor_id TEXT,                       -- trabajador / operario ejecutor
  executor_name TEXT,
  role_at_event TEXT,                     -- rol del creador al momento del evento

  -- Ubicación GPS (POINT nativo + columnas dobles para queries rápidas)
  location POINT,
  latitud DOUBLE PRECISION CHECK (latitud IS NULL OR (latitud BETWEEN -90 AND 90)),
  longitud DOUBLE PRECISION CHECK (longitud IS NULL OR (longitud BETWEEN -180 AND 180)),
  precision_gps NUMERIC,
  ubicacion_texto TEXT,

  -- Contenido
  title TEXT NOT NULL,
  description TEXT,
  estado TEXT NOT NULL DEFAULT 'COMPLETADO' CHECK (estado IN (
    'COMPLETADO', 'EN_PROCESO', 'PENDIENTE_SYNC', 'ANULADO_SISTEMA'
  )),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,   -- insumos, dosis, plaga, cantidad, etc.
  attachment_ids UUID[] DEFAULT '{}',
  evidencia_urls TEXT[] DEFAULT '{}',

  -- Origen del dato (nunca se edita el original; solo referencia)
  source_table TEXT,                      -- ej. 'cosechas', 'aplicaciones'
  source_id UUID,                         -- id del registro origen
  source_code TEXT,                       -- código legible origen (COS-..., APL-...)

  -- Cadena de integridad hash (blockchain-lite por empresa+lote)
  previous_hash TEXT,
  event_hash TEXT NOT NULL,
  integrity_status TEXT NOT NULL DEFAULT 'VALIDADO' CHECK (integrity_status IN (
    'VALIDADO', 'PENDIENTE_SYNC', 'COMPROMETIDO'
  )),
  last_verified_at TIMESTAMPTZ,

  immutable BOOLEAN NOT NULL DEFAULT TRUE,
  origin TEXT NOT NULL DEFAULT 'skycrop_core' CHECK (origin IN ('skycrop_core', 'backfill', 'import'))
);

-- Sincronizar alias predio/lote (predio_id <-> farm_id, lote_id <-> lot_id)
-- Se hace en trigger para no romper compatibilidad con spec (farm_id) ni modelo (predio_id).

CREATE INDEX IF NOT EXISTS idx_trz_company_lot_date
  ON public.traceability_events(company_id, lot_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_trz_company_lotealias_date
  ON public.traceability_events(company_id, lote_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_trz_company_type
  ON public.traceability_events(company_id, event_type);
CREATE INDEX IF NOT EXISTS idx_trz_company_module
  ON public.traceability_events(company_id, source_module);
CREATE INDEX IF NOT EXISTS idx_trz_company_code
  ON public.traceability_events(company_id, event_code);
CREATE UNIQUE INDEX IF NOT EXISTS ux_trz_company_code
  ON public.traceability_events(company_id, event_code) WHERE event_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trz_source
  ON public.traceability_events(company_id, source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_trz_company_eventdate
  ON public.traceability_events(company_id, event_date DESC);

-- ── 2. Generador de códigos TRZ-YYYY-NNNNNN por empresa ──────────────────────
CREATE OR REPLACE FUNCTION public.generar_codigo_trazabilidad(p_company_id UUID, p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_year TEXT := EXTRACT(YEAR FROM p_fecha)::TEXT; v_seq INT; v_code TEXT;
BEGIN
  SELECT COALESCE(MAX((regexp_match(event_code, '^TRZ-'||v_year||'-(\d+)$'))[1]::INT), 0) + 1
    INTO v_seq FROM public.traceability_events
    WHERE company_id = p_company_id AND event_code LIKE 'TRZ-'||v_year||'-%';
  IF v_seq IS NULL THEN v_seq := 1; END IF;
  v_code := 'TRZ-'||v_year||'-'||LPAD(v_seq::TEXT, 6, '0');
  WHILE EXISTS (SELECT 1 FROM public.traceability_events WHERE company_id = p_company_id AND event_code = v_code) LOOP
    v_seq := v_seq + 1; v_code := 'TRZ-'||v_year||'-'||LPAD(v_seq::TEXT, 6, '0');
  END LOOP;
  RETURN v_code;
END; $$;

-- ── 3. Cómputo de hash encadenado (SHA-256) ──────────────────────────────────
-- hash = sha256(company|lot|type|module|event_date|created_by|executor|title|metadata|prev)
CREATE OR REPLACE FUNCTION public.compute_traceability_hash(
  p_company_id UUID, p_lot_id UUID, p_event_type TEXT, p_source_module TEXT,
  p_event_date TIMESTAMPTZ, p_created_by TEXT, p_executor TEXT,
  p_title TEXT, p_metadata JSONB, p_previous_hash TEXT
) RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
BEGIN
  RETURN encode(digest(
    COALESCE(p_company_id::TEXT,'') || '|' ||
    COALESCE(p_lot_id::TEXT,'') || '|' ||
    COALESCE(p_event_type,'') || '|' ||
    COALESCE(p_source_module,'') || '|' ||
    COALESCE(p_event_date::TEXT,'') || '|' ||
    COALESCE(p_created_by,'') || '|' ||
    COALESCE(p_executor,'') || '|' ||
    COALESCE(p_title,'') || '|' ||
    COALESCE(p_metadata::TEXT,'{}') || '|' ||
    COALESCE(p_previous_hash,'GENESIS'),
    'sha256'), 'hex');
END; $$;

-- ── 4. Trigger BEFORE INSERT: normaliza alias + código + hash encadenado ─────
CREATE OR REPLACE FUNCTION public.process_traceability_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_prev TEXT;
BEGIN
  -- Normalizar alias predio/farm y lote/lot
  IF NEW.predio_id IS NULL AND NEW.farm_id IS NOT NULL THEN NEW.predio_id := NEW.farm_id; END IF;
  IF NEW.farm_id IS NULL AND NEW.predio_id IS NOT NULL THEN NEW.farm_id := NEW.predio_id; END IF;
  IF NEW.lote_id IS NULL AND NEW.lot_id IS NOT NULL THEN NEW.lote_id := NEW.lot_id; END IF;
  IF NEW.lot_id IS NULL AND NEW.lote_id IS NOT NULL THEN NEW.lot_id := NEW.lote_id; END IF;

  -- Validar tenant lote/predio (fail-closed, reutiliza H1 si existe)
  IF NEW.lot_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.lotes l WHERE l.id = NEW.lot_id AND l.company_id IS NOT DISTINCT FROM NEW.company_id) THEN
    RAISE EXCEPTION 'Lote % no pertenece a la empresa % (traceability).', NEW.lot_id, NEW.company_id USING ERRCODE='42501';
  END IF;
  IF NEW.farm_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.predios p WHERE p.id = NEW.farm_id AND p.company_id IS NOT DISTINCT FROM NEW.company_id) THEN
    RAISE EXCEPTION 'Predio % no pertenece a la empresa % (traceability).', NEW.farm_id, NEW.company_id USING ERRCODE='42501';
  END IF;

  -- Código legible
  IF NEW.event_code IS NULL OR NEW.event_code = '' THEN
    NEW.event_code := public.generar_codigo_trazabilidad(NEW.company_id, COALESCE(NEW.event_date::DATE, CURRENT_DATE));
  END IF;

  -- GPS: sincronizar POINT <-> lat/lng
  IF NEW.location IS NULL AND NEW.latitud IS NOT NULL AND NEW.longitud IS NOT NULL THEN
    NEW.location := point(NEW.longitud, NEW.latitud);
  ELSIF NEW.location IS NOT NULL AND (NEW.latitud IS NULL OR NEW.longitud IS NULL) THEN
    NEW.longitud := NEW.location[0];
    NEW.latitud := NEW.location[1];
  END IF;

  -- Hash encadenado: último evento de la empresa (cadena global por empresa;
  -- el orden por lote se verifica en verificar_cadena_lote)
  SELECT event_hash INTO v_prev FROM public.traceability_events
    WHERE company_id = NEW.company_id
    ORDER BY created_at DESC, id DESC LIMIT 1;
  NEW.previous_hash := v_prev; -- NULL = génesis
  NEW.event_hash := public.compute_traceability_hash(
    NEW.company_id, COALESCE(NEW.lot_id, NEW.lote_id),
    NEW.event_type, NEW.source_module, NEW.event_date,
    NEW.created_by, COALESCE(NEW.executor_id, NEW.executor_name),
    NEW.title, COALESCE(NEW.metadata,'{}'::jsonb), v_prev);
  NEW.immutable := TRUE;
  IF NEW.integrity_status IS NULL THEN NEW.integrity_status := 'VALIDADO'; END IF;
  NEW.last_verified_at := timezone('utc'::text, now());
  IF NEW.created_at IS NULL THEN NEW.created_at := timezone('utc'::text, now()); END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS traceability_insert_trg ON public.traceability_events;
CREATE TRIGGER traceability_insert_trg
  BEFORE INSERT ON public.traceability_events
  FOR EACH ROW EXECUTE FUNCTION public.process_traceability_insert();

-- ── 5. Inmutabilidad: bloquear UPDATE y DELETE a nivel SQL ───────────────────
-- Ni usuarios ni admins pueden mutar. Solo INSERT + SELECT existen.
CREATE OR REPLACE FUNCTION public.process_traceability_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Evento de trazabilidad % es inmutable (origen: %). Use un evento de corrección, no UPDATE/DELETE.', COALESCE(OLD.event_code, OLD.id::TEXT), OLD.source_module USING ERRCODE='25001';
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS traceability_no_update ON public.traceability_events;
CREATE TRIGGER traceability_no_update
  BEFORE UPDATE OR DELETE ON public.traceability_events
  FOR EACH ROW EXECUTE FUNCTION public.process_traceability_immutable();

-- ── 6. RLS: solo SELECT + INSERT del tenant; sin políticas UPDATE/DELETE ─────
ALTER TABLE public.traceability_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS traceability_select_policy ON public.traceability_events;
CREATE POLICY traceability_select_policy ON public.traceability_events
  FOR SELECT TO authenticated USING (company_id = public.current_company());

DROP POLICY IF EXISTS traceability_insert_policy ON public.traceability_events;
CREATE POLICY traceability_insert_policy ON public.traceability_events
  FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company());

-- Sin políticas UPDATE/DELETE => fail-closed aunque el trigger no existiera.
-- service_role (backend) bypassa RLS y es el único escritor vía RPC.

-- Trigger secure_company_id (autocompleta + anti-forgery en escritura directa)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='process_secure_company_id') THEN
    DROP TRIGGER IF EXISTS secure_company_id_trg ON public.traceability_events;
    CREATE TRIGGER secure_company_id_trg BEFORE INSERT OR UPDATE ON public.traceability_events
      FOR EACH ROW EXECUTE FUNCTION public.process_secure_company_id();
  END IF;
END $$;

-- Validación lote/predio tenant (H1)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='process_validate_lote_predio_tenant') THEN
    DROP TRIGGER IF EXISTS validate_lote_predio_trg ON public.traceability_events;
    -- La función H1 lee lote_id/predio_id via jsonb; nuestros alias ya están normalizados.
    CREATE TRIGGER validate_lote_predio_trg BEFORE INSERT OR UPDATE ON public.traceability_events
      FOR EACH ROW EXECUTE FUNCTION public.process_validate_lote_predio_tenant();
  END IF;
END $$;

-- Auditoría automática (solo INSERT, pues UPDATE/DELETE están bloqueados)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='process_audit_log') THEN
    DROP TRIGGER IF EXISTS audit_traceability_events_trigger ON public.traceability_events;
    CREATE TRIGGER audit_traceability_events_trigger
      AFTER INSERT ON public.traceability_events
      FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();
  END IF;
END $$;

-- ── 7. RPC transaccional: registrar evento (INVOKER, usa JWT tenant) ──────────
CREATE OR REPLACE FUNCTION public.registrar_evento_trazabilidad(
  p_lote_id UUID,
  p_event_type TEXT,
  p_source_module TEXT,
  p_title TEXT,
  p_event_date TIMESTAMPTZ DEFAULT now(),
  p_predio_id UUID DEFAULT NULL,
  p_executor_id TEXT DEFAULT NULL,
  p_executor_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_precision_gps NUMERIC DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_source_table TEXT DEFAULT NULL,
  p_source_id UUID DEFAULT NULL,
  p_source_code TEXT DEFAULT NULL,
  p_estado TEXT DEFAULT 'COMPLETADO'
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_company UUID := public.current_company();
  v_user TEXT := public.current_user_id();
  v_user_name TEXT;
  v_id UUID; v_code TEXT;
BEGIN
  IF v_company IS NULL THEN RAISE EXCEPTION 'Empresa no identificada (JWT sin org_id)'; END IF;
  IF p_lote_id IS NULL THEN RAISE EXCEPTION 'lote_id requerido para trazabilidad'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lotes WHERE id = p_lote_id AND company_id = v_company) THEN
    RAISE EXCEPTION 'Lote no pertenece a la empresa'; END IF;
  BEGIN v_user_name := (auth.jwt() ->> 'email'); EXCEPTION WHEN OTHERS THEN v_user_name := v_user; END;
  INSERT INTO public.traceability_events(
    company_id, farm_id, predio_id, lot_id, lote_id,
    event_type, source_module, event_date, created_by, created_by_name,
    executor_id, executor_name, title, description, estado,
    latitud, longitud, precision_gps, metadata,
    source_table, source_id, source_code, origin, event_hash
  ) VALUES (
    v_company, p_predio_id, p_predio_id, p_lote_id, p_lote_id,
    p_event_type, p_source_module, p_event_date, COALESCE(v_user,'sistema'), v_user_name,
    p_executor_id, p_executor_name, p_title, p_description, COALESCE(p_estado,'COMPLETADO'),
    p_lat, p_lng, p_precision_gps, COALESCE(p_metadata,'{}'::jsonb),
    p_source_table, p_source_id, p_source_code, 'skycrop_core', 'pending'
  ) RETURNING id, event_code INTO v_id, v_code;
  RETURN jsonb_build_object('success', true, 'event_id', v_id, 'event_code', v_code);
END; $$;

-- ── 7b. Overload con empresa explícita (service_role / backend verificado) ───
CREATE OR REPLACE FUNCTION public.registrar_evento_trazabilidad_empresa(
  p_company_id UUID,
  p_lote_id UUID,
  p_event_type TEXT,
  p_source_module TEXT,
  p_title TEXT,
  p_event_date TIMESTAMPTZ DEFAULT now(),
  p_predio_id UUID DEFAULT NULL,
  p_created_by TEXT DEFAULT 'sistema',
  p_created_by_name TEXT DEFAULT NULL,
  p_executor_id TEXT DEFAULT NULL,
  p_executor_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_source_table TEXT DEFAULT NULL,
  p_source_id UUID DEFAULT NULL,
  p_source_code TEXT DEFAULT NULL,
  p_estado TEXT DEFAULT 'COMPLETADO'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id UUID; v_code TEXT;
BEGIN
  IF p_company_id IS NULL THEN RAISE EXCEPTION 'p_company_id requerido'; END IF;
  IF p_lote_id IS NULL THEN RAISE EXCEPTION 'lote_id requerido'; END IF;
  INSERT INTO public.traceability_events(
    company_id, farm_id, predio_id, lot_id, lote_id,
    event_type, source_module, event_date, created_by, created_by_name,
    executor_id, executor_name, title, description, estado,
    latitud, longitud, metadata,
    source_table, source_id, source_code, origin, event_hash
  ) VALUES (
    p_company_id, p_predio_id, p_predio_id, p_lote_id, p_lote_id,
    p_event_type, p_source_module, p_event_date,
    COALESCE(p_created_by,'sistema'), p_created_by_name,
    p_executor_id, p_executor_name, p_title, p_description, COALESCE(p_estado,'COMPLETADO'),
    p_lat, p_lng, COALESCE(p_metadata,'{}'::jsonb),
    p_source_table, p_source_id, p_source_code, 'skycrop_core', 'pending'
  ) RETURNING id, event_code INTO v_id, v_code;
  RETURN jsonb_build_object('success', true, 'event_id', v_id, 'event_code', v_code);
END; $$;

-- ── 8. Verificación de integridad ────────────────────────────────────────────
-- Recalcula el hash con previous_hash almacenado y compara.
CREATE OR REPLACE FUNCTION public.verificar_integridad_evento(p_event_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_company UUID := public.current_company(); r RECORD; v_expected TEXT;
BEGIN
  SELECT * INTO r FROM public.traceability_events WHERE id = p_event_id AND company_id = v_company;
  IF NOT FOUND THEN
    -- service_role sin JWT: buscar sin filtro tenant (backend verificado filtra antes)
    IF v_company IS NULL THEN
      SELECT * INTO r FROM public.traceability_events WHERE id = p_event_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('valid', false, 'reason', 'not_found'); END IF;
    ELSE
      RETURN jsonb_build_object('valid', false, 'reason', 'not_found_or_forbidden');
    END IF;
  END IF;
  v_expected := public.compute_traceability_hash(
    r.company_id, COALESCE(r.lot_id, r.lote_id), r.event_type, r.source_module,
    r.event_date, r.created_by, COALESCE(r.executor_id, r.executor_name),
    r.title, COALESCE(r.metadata,'{}'::jsonb), r.previous_hash);
  IF v_expected = r.event_hash THEN
    RETURN jsonb_build_object('valid', true, 'event_code', r.event_code, 'event_hash', r.event_hash, 'previous_hash', r.previous_hash);
  ELSE
    RETURN jsonb_build_object('valid', false, 'reason', 'hash_mismatch',
      'event_code', r.event_code, 'expected', v_expected, 'stored', r.event_hash);
  END IF;
END; $$;

-- Verifica cadena completa de un lote (orden created_at): cada previous_hash debe
-- coincidir con el event_hash anterior y cada hash debe recalcularse bien.
CREATE OR REPLACE FUNCTION public.verificar_cadena_lote(p_lote_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_company UUID := public.current_company();
  r RECORD; v_prev TEXT := NULL; v_expected TEXT;
  v_total INT := 0; v_ok INT := 0; v_bad JSONB := '[]'::jsonb;
BEGIN
  FOR r IN SELECT * FROM public.traceability_events
    WHERE company_id = COALESCE(v_company, company_id)
      AND (lot_id = p_lote_id OR lote_id = p_lote_id)
    ORDER BY created_at ASC, id ASC LOOP
    v_total := v_total + 1;
    v_expected := public.compute_traceability_hash(
      r.company_id, COALESCE(r.lot_id, r.lote_id), r.event_type, r.source_module,
      r.event_date, r.created_by, COALESCE(r.executor_id, r.executor_name),
      r.title, COALESCE(r.metadata,'{}'::jsonb), r.previous_hash);
    IF r.previous_hash IS DISTINCT FROM v_prev OR v_expected != r.event_hash THEN
      v_bad := v_bad || jsonb_build_object('event_code', r.event_code, 'id', r.id);
    ELSE
      v_ok := v_ok + 1;
    END IF;
    v_prev := r.event_hash;
  END LOOP;
  RETURN jsonb_build_object(
    'lot_id', p_lote_id, 'total', v_total, 'valid', v_ok,
    'compromised', v_total - v_ok,
    'integrity_pct', CASE WHEN v_total > 0 THEN ROUND((v_ok::NUMERIC / v_total) * 100, 2) ELSE 100 END,
    'bad_events', v_bad);
END; $$;

-- ── 9. Vista timeline rápido (lote + predio + último estado) ─────────────────
CREATE OR REPLACE VIEW public.vw_traceability_timeline AS
SELECT e.company_id, e.id AS event_id, e.event_code,
  COALESCE(e.lot_id, e.lote_id) AS lote_id,
  COALESCE(e.farm_id, e.predio_id) AS predio_id,
  l.codigo_interno AS lote_codigo, l.nombre AS lote_nombre,
  p.nombre AS predio_nombre,
  e.event_type, e.source_module, e.title, e.description, e.estado,
  e.event_date, e.created_at, e.created_by_name, e.executor_name,
  e.latitud, e.longitud, e.metadata, e.source_table, e.source_code,
  e.event_hash, e.previous_hash, e.integrity_status
FROM public.traceability_events e
LEFT JOIN public.lotes l ON l.id = COALESCE(e.lot_id, e.lote_id)
LEFT JOIN public.predios p ON p.id = COALESCE(e.farm_id, e.predio_id);

-- ── 10. Storage privado para evidencias ──────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='storage' AND table_name='buckets') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('traceability-evidence','traceability-evidence', false)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='storage' AND table_name='objects') THEN
    DROP POLICY IF EXISTS "trz_evidence_select" ON storage.objects;
    CREATE POLICY "trz_evidence_select" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id='traceability-evidence' AND (storage.foldername(name))[1]::TEXT = public.current_company()::TEXT);
    DROP POLICY IF EXISTS "trz_evidence_insert" ON storage.objects;
    CREATE POLICY "trz_evidence_insert" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id='traceability-evidence' AND (storage.foldername(name))[1]::TEXT = public.current_company()::TEXT);
    DROP POLICY IF EXISTS "trz_evidence_update" ON storage.objects;
    CREATE POLICY "trz_evidence_update" ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id='traceability-evidence' AND (storage.foldername(name))[1]::TEXT = public.current_company()::TEXT);
    DROP POLICY IF EXISTS "trz_evidence_delete" ON storage.objects;
    CREATE POLICY "trz_evidence_delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id='traceability-evidence' AND (storage.foldername(name))[1]::TEXT = public.current_company()::TEXT
        AND public.current_role_id() IN ('administrador','gerente'));
  END IF;
END $$;
