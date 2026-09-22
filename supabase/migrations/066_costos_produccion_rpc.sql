-- ==============================================================================
-- SKYCROP DATABASE V2: 066_costos_produccion_rpc.sql
-- Módulo Costos de Producción — NÚCLEO TRANSACCIONAL (sin adaptadores).
-- Rama: draft/costos-produccion. NO aplicar en producción.
-- Requiere: 065 (columnas §2.1/entry_hash/vistas security_invoker/grants).
--
-- §0 de este archivo repite los ALTER de 065 de forma idempotente para que
-- dev (donde 065 ya se aplicó antes del ajuste) converja sin reset.
-- §0b migra las 18 FKs dimensionales a ON DELETE RESTRICT (decisión §1-FINAL).
--
-- ── Decisión Escenario A/B (§3.2): PATRÓN 047 ─────────────────────────────
-- Las RPC reciben p_company_id + p_user_id EXPLÍCITOS (nunca payload.company_id)
-- y arrancan con PERFORM rpc_assert_tenant_access(p_company_id, p_user_id):
--   * Llamada con JWT de usuario  → valida membresía en company_users (anti-IDOR).
--   * Llamada service_role / sin JWT (backend supabaseAdmin) → no-op, porque el
--     backend ya resolvió el tenant desde el JWT verificado (resolveTenant) y
--     jamás acepta company_id del cliente.
-- Adicional: costos_private_require_perm() exige has_permission('costos',acción)
-- en TODA llamada a RPC pública. El adaptador (067) NO usa las públicas: usa
-- los cores privados costos_private_*_core (misma lógica, asserts de tenant
-- intactos, sin chequeo de rol porque la acción operativa ya fue autorizada).
-- Los cores están revocados para PUBLIC/anon/authenticated (P0 §2): solo
-- triggers owner-context, service_role y otras DEFINER pueden invocarlos.
-- Ninguna función confía en company_id del payload.
-- Enmienda 067 en allocate: operación sin lote → nivel máquina indirecto
-- (direct/inferred/indirect), ver cuerpo §4.
--
-- ── Política anti-doble-conteo maquinaria/combustible (§11) ─────────────────
-- machine_usage EXCLUYE combustible por defecto (usa operador+mantenimiento+
-- depreciación por hora). fuel_consumption vive aparte. Si un adaptador usa
-- maquinaria_operaciones.costo_total, debe marcar payload.use_operation_total=true
-- y el motor guarda metadata.fuel_policy='included_in_operation_total'.
-- Los adaptadores NUNCA deben emitir machine_usage + fuel_consumption para la
-- misma operación sin política explícita.
--
-- ── business_date (§4.1) ────────────────────────────────────────────────────
-- COALESCE(payload.business_date, (occurred_at AT TIME ZONE 'America/Bogota')::date).
-- Pendiente definir estrategia timezone multiempresa (asumido COP/Colombia).
--
-- ── Espejo legacy ───────────────────────────────────────────────────────────
-- 066 NO escribe en public.costos (§6.5). El espejo se activará en adaptadores.
--
-- ── Códigos de error (mapeo HTTP en backend/modules/costs) ─────────────────
-- costos/validation_failed→400, costos/unauthorized→401, costos/forbidden→403,
-- costos/event_not_found→404, costos/duplicate_event→409, costos/invalid_status→409,
-- costos/closed_period→409, costos/missing_price→422, costos/fx_missing→422,
-- costos/unallocatable→422, costos/invalid_source→422, costos/not_implemented→501.
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- §0 · Convergencia idempotente (dev con 065 pre-ajuste). Re-ejecutable.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.costos_eventos
  ADD COLUMN IF NOT EXISTS valued_unit_price NUMERIC,
  ADD COLUMN IF NOT EXISTS valued_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS valued_currency CHAR(3) NOT NULL DEFAULT 'COP',
  ADD COLUMN IF NOT EXISTS valued_fx_rate NUMERIC NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS amount_base NUMERIC,
  ADD COLUMN IF NOT EXISTS valued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS allocated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payload_hash TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'costos_eventos_valued_amount_chk') THEN
    ALTER TABLE public.costos_eventos ADD CONSTRAINT costos_eventos_valued_amount_chk CHECK (valued_amount IS NULL OR valued_amount >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'costos_eventos_amount_base_chk') THEN
    ALTER TABLE public.costos_eventos ADD CONSTRAINT costos_eventos_amount_base_chk CHECK (amount_base IS NULL OR amount_base >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'costos_eventos_valued_fx_chk') THEN
    ALTER TABLE public.costos_eventos ADD CONSTRAINT costos_eventos_valued_fx_chk CHECK (valued_fx_rate > 0);
  END IF;
END $$;
ALTER TABLE public.costos_entradas ADD COLUMN IF NOT EXISTS entry_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_costos_entradas_entry_hash
  ON public.costos_entradas (company_id, source_event_id, entry_hash)
  WHERE entry_hash IS NOT NULL;

-- §0b · Convergencia FKs → RESTRICT (decisión §1-FINAL en 065 §10b).
-- Dev con 065 pre-ajuste tiene SET NULL con nombres auto {tabla}_{col}_fkey.
-- Re-ejecutable: en bases ya-RESTRICT hace DROP+ADD idéntico (sin datos no bloquea).
-- Si alguna tabla tiene filas referenciadas huérfanas el ADD falla a propósito:
-- resolver el huérfano, no debilitar el constraint.
DO $$ DECLARE
  t TEXT;
  d TEXT[];
  dims TEXT[][] := ARRAY[
    ['predio_id','predios'],['lote_id','lotes'],['labor_id','labores'],
    ['operacion_id','maquinaria_operaciones'],['maquinaria_id','maquinaria'],
    ['inventario_id','inventario'],['trabajador_id','trabajadores'],
    ['cosecha_id','cosechas'],['venta_id','ventas']];
BEGIN
  FOREACH t IN ARRAY ARRAY['costos_eventos','costos_entradas'] LOOP
    FOREACH d SLICE 1 IN ARRAY dims LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_' || d[1] || '_fkey');
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON DELETE RESTRICT',
        t, t || '_' || d[1] || '_fkey', d[1], d[2]);
    END LOOP;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- §1 · Helpers privados (NO ejecutables por roles normales; solo anidados
-- desde RPCs DEFINER del owner + service_role directo).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.costos_private_require_perm(p_recurso TEXT, p_accion TEXT)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_claims TEXT; v_role TEXT;
BEGIN
  v_claims := NULLIF(current_setting('request.jwt.claims', true), '');
  IF v_claims IS NULL THEN RETURN; END IF; -- backend interno sin JWT (compat 037)
  v_role := (v_claims::jsonb)->>'role';
  IF v_role = 'service_role' THEN RETURN; END IF; -- backend: tenant ya verificado en app
  IF NOT public.has_permission(p_recurso, p_accion) THEN
    RAISE EXCEPTION 'costos/forbidden: rol sin permiso %/%', p_recurso, p_accion USING ERRCODE = '42501';
  END IF;
END; $$;

-- NOTA P0 (§2 contrato): el mecanismo previo de bandera transaction-local
-- costos.adapter fue ELIMINADO. El adaptador usa los cores privados
-- (revocados para authenticated/anon/PUBLIC); las RPC públicas exigen
-- permiso siempre. No queda ninguna referencia a set_config/GUC en costos.

-- NOTA HASH (incidente dev 2026-09-21): hashes de deduplicación, no
-- criptográficos: md5() del core (siempre visible) en vez de digest() de
-- pgcrypto, cuyo esquema varía por entorno y rompía con search_path
-- endurecido. 048 tiene el mismo riesgo latente: revisar fuera de este módulo.
CREATE OR REPLACE FUNCTION public.costos_private_payload_hash(p_payload JSONB)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN md5(COALESCE(p_payload::text, ''));
END; $$;

CREATE OR REPLACE FUNCTION public.costos_private_valuation_hash(
  p_company_id UUID, p_event_id UUID, p_version INT,
  p_unit_price NUMERIC, p_amount NUMERIC, p_currency TEXT, p_fx NUMERIC)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN md5(
    COALESCE(p_company_id::text,'') || '|' || COALESCE(p_event_id::text,'') || '|' || COALESCE(p_version::text,'') || '|' ||
    COALESCE(p_unit_price::text,'') || '|' || COALESCE(p_amount::text,'') || '|' || COALESCE(p_currency,'') || '|' || COALESCE(p_fx::text,''));
END; $$;

CREATE OR REPLACE FUNCTION public.costos_private_entry_hash(
  p_company_id UUID, p_event_id UUID, p_kind TEXT, p_class TEXT,
  p_amount_base NUMERIC, p_method TEXT, p_quality TEXT, p_valuation_hash TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN md5(
    COALESCE(p_company_id::text,'') || '|' || COALESCE(p_event_id::text,'') || '|' || COALESCE(p_kind,'') || '|' ||
    COALESCE(p_class,'') || '|' || COALESCE(p_amount_base::text,'') || '|' || COALESCE(p_method,'') || '|' ||
    COALESCE(p_quality,'') || '|' || COALESCE(p_valuation_hash,''));
END; $$;

CREATE OR REPLACE FUNCTION public.costos_private_create_issue(
  p_company_id UUID, p_event_id UUID, p_type TEXT, p_severity TEXT, p_msg TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.costos_issues
    WHERE company_id = p_company_id
      AND source_event_id IS NOT DISTINCT FROM p_event_id
      AND issue_type = p_type AND status = 'open' LIMIT 1;
  IF FOUND THEN RETURN v_id; END IF; -- anti-spam: un open por (evento,tipo)
  INSERT INTO public.costos_issues (company_id, source_event_id, issue_type, severity, message)
    VALUES (p_company_id, p_event_id, p_type, p_severity, p_msg) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.costos_private_assert_period_open(p_company_id UUID, p_bizdate DATE)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.costos_periodos
             WHERE company_id = p_company_id AND status = 'closed'
               AND p_bizdate BETWEEN period_start AND period_end) THEN
    RAISE EXCEPTION 'costos/closed_period: fecha % en periodo cerrado', p_bizdate;
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public.costos_private_require_perm(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.costos_private_payload_hash(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.costos_private_valuation_hash(UUID, UUID, INT, NUMERIC, NUMERIC, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.costos_private_entry_hash(UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.costos_private_create_issue(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.costos_private_assert_period_open(UUID, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.costos_private_register_core(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.costos_private_value_core(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.costos_private_allocate_core(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.costos_private_post_core(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.costos_private_require_perm(TEXT, TEXT) TO service_role;
GRANT ALL ON FUNCTION public.costos_private_payload_hash(JSONB) TO service_role;
GRANT ALL ON FUNCTION public.costos_private_valuation_hash(UUID, UUID, INT, NUMERIC, NUMERIC, TEXT, NUMERIC) TO service_role;
GRANT ALL ON FUNCTION public.costos_private_entry_hash(UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT) TO service_role;
GRANT ALL ON FUNCTION public.costos_private_create_issue(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT ALL ON FUNCTION public.costos_private_assert_period_open(UUID, DATE) TO service_role;
GRANT ALL ON FUNCTION public.costos_private_register_core(UUID, TEXT, JSONB) TO service_role;
GRANT ALL ON FUNCTION public.costos_private_value_core(UUID, TEXT, UUID) TO service_role;
GRANT ALL ON FUNCTION public.costos_private_allocate_core(UUID, TEXT, UUID) TO service_role;
GRANT ALL ON FUNCTION public.costos_private_post_core(UUID, TEXT, UUID) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- §2 · costos_register_event — hecho bruto idempotente (no valoriza/publica)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.costos_private_register_core(
  p_company_id UUID, p_user_id TEXT, p_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_mod TEXT; v_ent TEXT; v_sid UUID; v_ver INT; v_type TEXT;
  v_occ TIMESTAMPTZ; v_biz DATE; v_cur CHAR(3); v_fx NUMERIC;
  v_qty NUMERIC; v_pup NUMERIC; v_pamt NUMERIC;
  v_phash TEXT; v_ev_id UUID; v_ev_status TEXT; v_created BOOL := true;
  v_issues JSONB := '[]'::jsonb;
  v_uuid_re TEXT := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  k TEXT; v TEXT;
BEGIN
  PERFORM public.rpc_assert_tenant_access(p_company_id, p_user_id);
  IF p_company_id IS NULL THEN RAISE EXCEPTION 'costos/validation_failed: p_company_id requerido'; END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'costos/validation_failed: payload JSONB objeto requerido';
  END IF;

  v_mod := NULLIF(p_payload->>'source_module', '');
  v_ent := NULLIF(p_payload->>'source_entity', '');
  v_type := NULLIF(p_payload->>'event_type', '');
  IF v_mod NOT IN ('labores','maquinaria','combustible','mantenimiento','inventario','aplicaciones','fertilization','nominas','cosecha','ventas','finanzas','manual') THEN
    RAISE EXCEPTION 'costos/validation_failed: source_module inválido: %', v_mod;
  END IF;
  IF v_ent IS NULL OR length(v_ent) > 120 THEN RAISE EXCEPTION 'costos/validation_failed: source_entity requerido (máx 120)'; END IF;
  IF (p_payload->>'source_id') IS NULL OR (p_payload->>'source_id') !~ v_uuid_re THEN
    RAISE EXCEPTION 'costos/validation_failed: source_id UUID requerido';
  END IF;
  v_sid := (p_payload->>'source_id')::uuid;
  v_ver := COALESCE(NULLIF(p_payload->>'source_version','')::int, 1);
  IF v_ver < 1 THEN RAISE EXCEPTION 'costos/validation_failed: source_version >= 1'; END IF;
  IF v_type NOT IN ('input_consumption','labor_usage','machine_usage','fuel_consumption','maintenance_cost','external_service','depreciation','overhead_expense','harvest_output','sale_revenue','estimated_revenue','other_income','other_expense','correction') THEN
    RAISE EXCEPTION 'costos/validation_failed: event_type inválido: %', v_type;
  END IF;
  BEGIN v_occ := (p_payload->>'occurred_at')::timestamptz;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'costos/validation_failed: occurred_at timestamptz requerido'; END;
  IF v_occ IS NULL THEN RAISE EXCEPTION 'costos/validation_failed: occurred_at requerido'; END IF;
  BEGIN v_biz := COALESCE((p_payload->>'business_date')::date, (v_occ AT TIME ZONE 'America/Bogota')::date);
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'costos/validation_failed: business_date inválido'; END;

  v_cur := UPPER(COALESCE(NULLIF(p_payload->>'currency',''), 'COP'));
  IF v_cur !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'costos/validation_failed: currency CHAR(3)'; END IF;
  v_fx := COALESCE(NULLIF(p_payload->>'fx_rate','')::numeric, 1);
  IF v_fx <= 0 THEN RAISE EXCEPTION 'costos/validation_failed: fx_rate > 0'; END IF;
  IF p_payload ? 'quantity' AND (p_payload->>'quantity') IS NOT NULL THEN
    v_qty := (p_payload->>'quantity')::numeric;
    IF v_qty IS NULL OR (v_qty <= 0 AND v_type <> 'correction') THEN
      RAISE EXCEPTION 'costos/validation_failed: quantity debe ser > 0';
    END IF;
  END IF;
  IF p_payload ? 'provided_unit_price' AND (p_payload->>'provided_unit_price') IS NOT NULL THEN
    v_pup := (p_payload->>'provided_unit_price')::numeric;
    IF v_pup < 0 THEN RAISE EXCEPTION 'costos/validation_failed: provided_unit_price >= 0'; END IF;
  END IF;
  IF p_payload ? 'provided_amount' AND (p_payload->>'provided_amount') IS NOT NULL THEN
    v_pamt := (p_payload->>'provided_amount')::numeric;
    IF v_pamt < 0 THEN RAISE EXCEPTION 'costos/validation_failed: provided_amount >= 0'; END IF;
  END IF;
  -- UUIDs dimensionales (si vienen, deben ser UUID válidas).
  FOR k IN SELECT unnest(ARRAY['predio_id','lote_id','labor_id','operacion_id','maquinaria_id','inventario_id','trabajador_id','cosecha_id','venta_id']) LOOP
    v := p_payload->>k;
    IF v IS NOT NULL AND v <> '' AND v !~ v_uuid_re THEN
      RAISE EXCEPTION 'costos/validation_failed: dimensión % no es UUID', k;
    END IF;
  END LOOP;

  PERFORM public.costos_private_assert_period_open(p_company_id, v_biz);
  v_phash := public.costos_private_payload_hash(p_payload);

  INSERT INTO public.costos_eventos (
    company_id, source_module, source_entity, source_id, source_version, event_type,
    occurred_at, business_date, predio_id, lote_id, labor_id, operacion_id, maquinaria_id,
    inventario_id, trabajador_id, cosecha_id, venta_id, quantity, source_unit,
    provided_unit_price, provided_amount, currency, fx_rate, status,
    idempotency_key, payload_hash, payload, created_by)
  VALUES (
    p_company_id, v_mod, v_ent, v_sid, v_ver, v_type, v_occ, v_biz,
    NULLIF(p_payload->>'predio_id','')::uuid, NULLIF(p_payload->>'lote_id','')::uuid,
    NULLIF(p_payload->>'labor_id','')::uuid, NULLIF(p_payload->>'operacion_id','')::uuid,
    NULLIF(p_payload->>'maquinaria_id','')::uuid, NULLIF(p_payload->>'inventario_id','')::uuid,
    NULLIF(p_payload->>'trabajador_id','')::uuid, NULLIF(p_payload->>'cosecha_id','')::uuid,
    NULLIF(p_payload->>'venta_id','')::uuid, v_qty, NULLIF(p_payload->>'source_unit',''),
    v_pup, v_pamt, v_cur, v_fx, 'received',
    NULLIF(p_payload->>'idempotency_key',''), v_phash, p_payload, p_user_id)
  ON CONFLICT (company_id, source_module, source_entity, source_id, source_version, event_type)
  DO NOTHING RETURNING id, status INTO v_ev_id, v_ev_status;

  IF v_ev_id IS NULL THEN -- duplicado natural: devolver existente (idempotencia)
    v_created := false;
    SELECT id, status, payload_hash INTO v_ev_id, v_ev_status, v FROM public.costos_eventos
      WHERE company_id = p_company_id AND source_module = v_mod AND source_entity = v_ent
        AND source_id = v_sid AND source_version = v_ver AND event_type = v_type;
    IF v IS DISTINCT FROM v_phash THEN
      PERFORM public.costos_private_create_issue(p_company_id, v_ev_id, 'duplicate_event', 'medium',
        'Evento re-registrado con payload distinto (idempotency_key o contenido cambió). Se conserva el original.');
      v_issues := v_issues || jsonb_build_object('type','duplicate_event','message','payload distinto al original');
    END IF;
  ELSE
    -- Sin dimensión productiva (salvo overhead/manual) → issue visible, no bloqueo.
    IF NOT (v_mod IN ('finanzas','manual') OR v_type = 'overhead_expense') AND
       (p_payload->>'predio_id' IS NULL AND p_payload->>'lote_id' IS NULL AND p_payload->>'labor_id' IS NULL AND
        p_payload->>'operacion_id' IS NULL AND p_payload->>'maquinaria_id' IS NULL AND p_payload->>'inventario_id' IS NULL AND
        p_payload->>'trabajador_id' IS NULL AND p_payload->>'cosecha_id' IS NULL AND p_payload->>'venta_id' IS NULL) THEN
      PERFORM public.costos_private_create_issue(p_company_id, v_ev_id, 'missing_dimension', 'medium',
        'Evento sin dimensión productiva (lote/labor/maquinaria/etc). Quedará pendiente de asignación.');
      v_issues := v_issues || jsonb_build_object('type','missing_dimension','message','sin dimensión productiva');
    END IF;
  END IF;

  RETURN jsonb_build_object('event_id', v_ev_id, 'status', v_ev_status, 'created', v_created, 'issues', v_issues);
END; $$;

-- Entrada pública API: exige permiso fino. El adaptador (067) usa el core
-- privado, revocado para authenticated/anon/PUBLIC (P0 §2).
CREATE OR REPLACE FUNCTION public.costos_register_event(
  p_company_id UUID, p_user_id TEXT, p_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.costos_private_require_perm('costos', 'crear');
  RETURN public.costos_private_register_core(p_company_id, p_user_id, p_payload);
END; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- §3 · costos_value_event — valorización conservadora (nunca $0 silencioso)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.costos_private_value_core(
  p_company_id UUID, p_user_id TEXT, p_event_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  e RECORD; v_prov NUMERIC; v_up NUMERIC; v_amt NUMERIC; v_cur CHAR(3); v_fx NUMERIC;
  v_base NUMERIC; v_vhash TEXT; v_meta JSONB := '{}'::jsonb;
  r RECORD; v_rate NUMERIC; v_horas NUMERIC; v_use_total BOOL := false;
BEGIN
  PERFORM public.rpc_assert_tenant_access(p_company_id, p_user_id);
  SELECT * INTO e FROM public.costos_eventos WHERE id = p_event_id AND company_id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'costos/event_not_found: evento % no existe en tu empresa', p_event_id; END IF;
  IF e.status IN ('posted','reversed','invalid','ignored') THEN
    RAISE EXCEPTION 'costos/invalid_status: evento en estado % no valorizable', e.status;
  END IF;
  IF e.status = 'allocated' THEN
    RETURN jsonb_build_object('event_id', e.id, 'status', e.status, 'valued', false, 'note', 'ya valorizado/asignado');
  END IF;

  -- Monto declarado genérico: provided_amount, si no quantity*provided_unit_price.
  v_prov := e.provided_amount;
  IF v_prov IS NULL AND e.quantity IS NOT NULL AND e.provided_unit_price IS NOT NULL THEN
    v_prov := e.quantity * e.provided_unit_price;
  END IF;
  v_cur := COALESCE(e.currency, 'COP'); v_fx := COALESCE(e.fx_rate, 1);

  CASE e.event_type
    WHEN 'harvest_output' THEN -- no monetario: alimenta denominadores ($/kg)
      UPDATE public.costos_eventos SET valued_at = now(), status = 'priced',
        payload = payload || jsonb_build_object('non_monetary', true), updated_at = now()
        WHERE id = e.id;
      RETURN jsonb_build_object('event_id', e.id, 'status', 'priced', 'valued', true, 'non_monetary', true);

    WHEN 'machine_usage' THEN
      v_use_total := COALESCE((e.payload->>'use_operation_total')::boolean, false);
      IF e.operacion_id IS NOT NULL THEN
        SELECT horas, costo_total, maquinaria_id, lote_id INTO r
          FROM public.maquinaria_operaciones WHERE id = e.operacion_id AND company_id = p_company_id;
        IF NOT FOUND THEN
          PERFORM public.costos_private_create_issue(p_company_id, e.id, 'invalid_source', 'high', 'operacion_id no pertenece a tu empresa o no existe');
          UPDATE public.costos_eventos SET status='invalid', updated_at=now() WHERE id=e.id;
          RETURN jsonb_build_object('event_id', e.id, 'status', 'invalid', 'valued', false);
        END IF;
        v_horas := r.horas;
        IF e.lote_id IS NULL AND r.lote_id IS NOT NULL THEN
          UPDATE public.costos_eventos SET lote_id = r.lote_id, maquinaria_id = COALESCE(e.maquinaria_id, r.maquinaria_id), updated_at = now() WHERE id = e.id;
          e.lote_id := r.lote_id; e.maquinaria_id := COALESCE(e.maquinaria_id, r.maquinaria_id);
        END IF;
        IF v_use_total AND r.costo_total IS NOT NULL THEN
          v_amt := r.costo_total; v_meta := jsonb_build_object('fuel_policy','included_in_operation_total','source','maquinaria_operaciones.costo_total');
        ELSE -- tarifa horaria SIN combustible (anti-doble-conteo §11)
          SELECT COALESCE(costo_operador_hora,0)+COALESCE(costo_mantenimiento_hora,0)+COALESCE(costo_depreciacion_hora,0)
            INTO v_rate FROM public.maquinaria WHERE id = COALESCE(r.maquinaria_id, e.maquinaria_id) AND company_id = p_company_id;
          IF v_horas IS NULL OR v_horas <= 0 THEN
            PERFORM public.costos_private_create_issue(p_company_id, e.id, 'invalid_source', 'medium', 'Operación sin horas registradas; no valorizable');
            UPDATE public.costos_eventos SET status='pending_price', updated_at=now() WHERE id=e.id;
            RETURN jsonb_build_object('event_id', e.id, 'status', 'pending_price', 'valued', false);
          END IF;
          IF v_rate IS NULL OR v_rate <= 0 THEN
            PERFORM public.costos_private_create_issue(p_company_id, e.id, 'missing_price', 'high', 'Maquinaria sin tarifa hora (operador+mantenimiento+depreciación). Configurar costos_tarifas o maquinaria.');
            UPDATE public.costos_eventos SET status='pending_price', updated_at=now() WHERE id=e.id;
            RETURN jsonb_build_object('event_id', e.id, 'status', 'pending_price', 'valued', false);
          END IF;
          v_amt := v_horas * v_rate; v_meta := jsonb_build_object('fuel_policy','separate','horas',v_horas,'rate_hora',v_rate);
        END IF;
      ELSIF v_prov IS NOT NULL THEN v_amt := v_prov; v_meta := jsonb_build_object('source','provided');
      ELSE
        PERFORM public.costos_private_create_issue(p_company_id, e.id, 'missing_price', 'high', 'machine_usage sin operacion_id ni monto declarado');
        UPDATE public.costos_eventos SET status='pending_price', updated_at=now() WHERE id=e.id;
        RETURN jsonb_build_object('event_id', e.id, 'status', 'pending_price', 'valued', false);
      END IF;

    WHEN 'fuel_consumption' THEN
      IF e.source_entity = 'maquinaria_combustible' THEN
        SELECT cantidad, costo_unitario, costo_total INTO r
          FROM public.maquinaria_combustible WHERE id = e.source_id AND company_id = p_company_id;
        IF NOT FOUND THEN
          PERFORM public.costos_private_create_issue(p_company_id, e.id, 'invalid_source', 'high', 'Registro de combustible no pertenece a tu empresa');
          UPDATE public.costos_eventos SET status='invalid', updated_at=now() WHERE id=e.id;
          RETURN jsonb_build_object('event_id', e.id, 'status', 'invalid', 'valued', false);
        END IF;
        v_amt := COALESCE(r.costo_total, r.cantidad * r.costo_unitario);
        v_meta := jsonb_build_object('cantidad',r.cantidad,'costo_unitario',r.costo_unitario);
      ELSIF v_prov IS NOT NULL THEN v_amt := v_prov; v_meta := jsonb_build_object('source','provided');
      ELSE
        PERFORM public.costos_private_create_issue(p_company_id, e.id, 'missing_price', 'high', 'Combustible sin costo_unitario/costo_total');
        UPDATE public.costos_eventos SET status='pending_price', updated_at=now() WHERE id=e.id;
        RETURN jsonb_build_object('event_id', e.id, 'status', 'pending_price', 'valued', false);
      END IF;

    WHEN 'maintenance_cost' THEN
      IF e.source_entity = 'maquinaria_mantenimientos' THEN
        SELECT costo, estado INTO r FROM public.maquinaria_mantenimientos WHERE id = e.source_id AND company_id = p_company_id;
        IF NOT FOUND THEN
          PERFORM public.costos_private_create_issue(p_company_id, e.id, 'invalid_source', 'high', 'Mantenimiento no pertenece a tu empresa');
          UPDATE public.costos_eventos SET status='invalid', updated_at=now() WHERE id=e.id;
          RETURN jsonb_build_object('event_id', e.id, 'status', 'invalid', 'valued', false);
        END IF;
        IF r.estado = 'Cancelado' THEN
          PERFORM public.costos_private_create_issue(p_company_id, e.id, 'invalid_source', 'medium', 'Mantenimiento cancelado; no genera costo');
          UPDATE public.costos_eventos SET status='invalid', updated_at=now() WHERE id=e.id;
          RETURN jsonb_build_object('event_id', e.id, 'status', 'invalid', 'valued', false);
        END IF;
        IF r.costo IS NULL THEN
          PERFORM public.costos_private_create_issue(p_company_id, e.id, 'missing_price', 'medium', 'Mantenimiento sin costo registrado');
          UPDATE public.costos_eventos SET status='pending_price', updated_at=now() WHERE id=e.id;
          RETURN jsonb_build_object('event_id', e.id, 'status', 'pending_price', 'valued', false);
        END IF;
        v_amt := r.costo; v_meta := jsonb_build_object('mantenimiento_estado', r.estado);
      ELSIF v_prov IS NOT NULL THEN v_amt := v_prov; v_meta := jsonb_build_object('source','provided');
      ELSE
        PERFORM public.costos_private_create_issue(p_company_id, e.id, 'missing_price', 'medium', 'Mantenimiento sin costo');
        UPDATE public.costos_eventos SET status='pending_price', updated_at=now() WHERE id=e.id;
        RETURN jsonb_build_object('event_id', e.id, 'status', 'pending_price', 'valued', false);
      END IF;

    WHEN 'labor_usage' THEN -- conservador §4.3.4: solo montos explícitos o nómina
      IF v_prov IS NOT NULL THEN v_amt := v_prov; v_meta := jsonb_build_object('source','provided');
      ELSIF e.source_entity = 'nominas' THEN
        SELECT total_neto INTO r FROM public.nominas WHERE id = e.source_id AND company_id = p_company_id;
        IF NOT FOUND OR r.total_neto IS NULL THEN
          PERFORM public.costos_private_create_issue(p_company_id, e.id, 'missing_price', 'high', 'Nómina sin total_neto o fuera de tu empresa');
          UPDATE public.costos_eventos SET status='pending_price', updated_at=now() WHERE id=e.id;
          RETURN jsonb_build_object('event_id', e.id, 'status', 'pending_price', 'valued', false);
        END IF;
        v_amt := r.total_neto; v_meta := jsonb_build_object('source','nominas.total_neto');
      ELSE
        PERFORM public.costos_private_create_issue(p_company_id, e.id, 'missing_price', 'high', 'Mano de obra sin monto (jornal no se prorratea solo; faltan horas/trabajadores/cargas)');
        UPDATE public.costos_eventos SET status='pending_price', updated_at=now() WHERE id=e.id;
        RETURN jsonb_build_object('event_id', e.id, 'status', 'pending_price', 'valued', false);
      END IF;

    WHEN 'input_consumption' THEN
      IF v_prov IS NOT NULL THEN v_amt := v_prov; v_meta := jsonb_build_object('source','provided');
      ELSIF e.source_entity = 'aplicaciones' THEN
        SELECT costo_aplicacion INTO r FROM public.aplicaciones WHERE id = e.source_id AND company_id = p_company_id;
        IF NOT FOUND OR r.costo_aplicacion IS NULL THEN
          PERFORM public.costos_private_create_issue(p_company_id, e.id, 'missing_price', 'high', 'Aplicación sin costo_aplicacion o fuera de tu empresa');
          UPDATE public.costos_eventos SET status='pending_price', updated_at=now() WHERE id=e.id;
          RETURN jsonb_build_object('event_id', e.id, 'status', 'pending_price', 'valued', false);
        END IF;
        v_amt := r.costo_aplicacion; v_meta := jsonb_build_object('source','aplicaciones.costo_aplicacion');
      ELSIF e.source_entity = 'fertilization_plan_items' THEN
        SELECT total_cost, unit_cost INTO r FROM public.fertilization_plan_items WHERE id = e.source_id AND company_id = p_company_id;
        IF NOT FOUND THEN
          PERFORM public.costos_private_create_issue(p_company_id, e.id, 'invalid_source', 'high', 'Ítem de fertilización fuera de tu empresa');
          UPDATE public.costos_eventos SET status='invalid', updated_at=now() WHERE id=e.id;
          RETURN jsonb_build_object('event_id', e.id, 'status', 'invalid', 'valued', false);
        END IF;
        v_amt := COALESCE(r.total_cost, CASE WHEN r.unit_cost IS NOT NULL AND e.quantity IS NOT NULL THEN r.unit_cost * e.quantity END);
        IF v_amt IS NULL THEN
          PERFORM public.costos_private_create_issue(p_company_id, e.id, 'missing_price', 'high', 'Ítem sin total_cost/unit_cost');
          UPDATE public.costos_eventos SET status='pending_price', updated_at=now() WHERE id=e.id;
          RETURN jsonb_build_object('event_id', e.id, 'status', 'pending_price', 'valued', false);
        END IF;
        v_meta := jsonb_build_object('source','fertilization_plan_items');
      ELSE
        PERFORM public.costos_private_create_issue(p_company_id, e.id, 'missing_price', 'high', 'Insumo sin costo (sin provided_amount ni fuente con precio)');
        UPDATE public.costos_eventos SET status='pending_price', updated_at=now() WHERE id=e.id;
        RETURN jsonb_build_object('event_id', e.id, 'status', 'pending_price', 'valued', false);
      END IF;

    WHEN 'sale_revenue' THEN
      SELECT id, total, moneda, estado INTO r FROM public.ventas
        WHERE id = COALESCE(e.venta_id, CASE WHEN e.source_entity='ventas' THEN e.source_id END)
          AND company_id = p_company_id;
      IF NOT FOUND THEN
        PERFORM public.costos_private_create_issue(p_company_id, e.id, 'invalid_source', 'high', 'Venta no pertenece a tu empresa');
        UPDATE public.costos_eventos SET status='invalid', updated_at=now() WHERE id=e.id;
        RETURN jsonb_build_object('event_id', e.id, 'status', 'invalid', 'valued', false);
      END IF;
      IF r.estado NOT IN ('CONFIRMADA','PREPARACION','DESPACHADA','ENTREGADA') THEN
        PERFORM public.costos_private_create_issue(p_company_id, e.id, 'invalid_source', 'medium', 'Venta en estado ' || r.estado || '; solo confirmadas generan ingreso');
        UPDATE public.costos_eventos SET status='invalid', updated_at=now() WHERE id=e.id;
        RETURN jsonb_build_object('event_id', e.id, 'status', 'invalid', 'valued', false);
      END IF;
      v_amt := NULLIF(r.total, 0);
      IF v_amt IS NULL THEN SELECT COALESCE(sum(total),0) INTO v_amt FROM public.venta_detalles WHERE venta_id = r.id AND company_id = p_company_id; END IF;
      IF v_amt IS NULL OR v_amt <= 0 THEN
        PERFORM public.costos_private_create_issue(p_company_id, e.id, 'missing_price', 'medium', 'Venta confirmada sin total valorizable');
        UPDATE public.costos_eventos SET status='pending_price', updated_at=now() WHERE id=e.id;
        RETURN jsonb_build_object('event_id', e.id, 'status', 'pending_price', 'valued', false);
      END IF;
      v_cur := UPPER(COALESCE(r.moneda, 'COP')); v_meta := jsonb_build_object('venta_estado', r.estado);

    WHEN 'estimated_revenue' THEN
      IF v_prov IS NULL THEN
        PERFORM public.costos_private_create_issue(p_company_id, e.id, 'missing_price', 'medium', 'Estimación sin monto ni precio explícito');
        UPDATE public.costos_eventos SET status='pending_price', updated_at=now() WHERE id=e.id;
        RETURN jsonb_build_object('event_id', e.id, 'status', 'pending_price', 'valued', false);
      END IF;
      v_amt := v_prov; v_meta := jsonb_build_object('estimated', true);

    ELSE -- external_service, depreciation, overhead_expense, other_*
      IF v_prov IS NULL THEN
        PERFORM public.costos_private_create_issue(p_company_id, e.id, 'missing_price', 'medium', 'Sin monto declarado para ' || e.event_type);
        UPDATE public.costos_eventos SET status='pending_price', updated_at=now() WHERE id=e.id;
        RETURN jsonb_build_object('event_id', e.id, 'status', 'pending_price', 'valued', false);
      END IF;
      v_amt := v_prov; v_meta := jsonb_build_object('source','provided');
  END CASE;

  -- FX: moneda distinta sin tasa explícita → fx_missing (nunca asumir 1).
  IF v_cur <> 'COP' AND v_fx = 1 AND NOT (e.payload ? 'fx_rate') THEN
    PERFORM public.costos_private_create_issue(p_company_id, e.id, 'fx_missing', 'high', 'Moneda ' || v_cur || ' sin fx_rate explícito');
    UPDATE public.costos_eventos SET status='pending_price', valued_currency=v_cur, updated_at=now() WHERE id=e.id;
    RETURN jsonb_build_object('event_id', e.id, 'status', 'pending_price', 'valued', false);
  END IF;
  v_base := v_amt * v_fx;
  v_up := CASE WHEN e.quantity IS NOT NULL AND e.quantity > 0 THEN v_amt / e.quantity ELSE e.provided_unit_price END;
  v_vhash := public.costos_private_valuation_hash(p_company_id, e.id, e.source_version, v_up, v_amt, v_cur, v_fx);

  UPDATE public.costos_eventos SET valued_unit_price = v_up, valued_amount = v_amt,
    valued_currency = v_cur, valued_fx_rate = v_fx, amount_base = v_base,
    valuation_hash = v_vhash, valued_at = now(), status = 'priced',
    payload = payload || jsonb_build_object('valuation', v_meta), updated_at = now()
    WHERE id = e.id;
  RETURN jsonb_build_object('event_id', e.id, 'status', 'priced', 'valued', true,
    'valued_amount', v_amt, 'currency', v_cur, 'amount_base', v_base, 'valuation_hash', v_vhash);
END; $$;

CREATE OR REPLACE FUNCTION public.costos_value_event(
  p_company_id UUID, p_user_id TEXT, p_event_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.costos_private_require_perm('costos', 'crear');
  RETURN public.costos_private_value_core(p_company_id, p_user_id, p_event_id);
END; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- §4 · costos_allocate_event — asignación simple y segura (sin prorrateos)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.costos_private_allocate_core(
  p_company_id UUID, p_user_id TEXT, p_event_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE e RECORD; v_method TEXT; v_quality TEXT; v_direct TEXT := 'direct'; r RECORD;
BEGIN
  PERFORM public.rpc_assert_tenant_access(p_company_id, p_user_id);
  SELECT * INTO e FROM public.costos_eventos WHERE id = p_event_id AND company_id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'costos/event_not_found: evento % no existe en tu empresa', p_event_id; END IF;
  IF e.status IN ('posted','reversed','invalid','ignored') THEN
    RAISE EXCEPTION 'costos/invalid_status: evento en estado % no asignable', e.status;
  END IF;
  IF e.status = 'allocated' THEN
    RETURN jsonb_build_object('event_id', e.id, 'status', 'allocated', 'allocated', false, 'note', 'ya asignado');
  END IF;
  IF e.status NOT IN ('priced','validated','received') THEN
    RAISE EXCEPTION 'costos/invalid_status: valorizar antes de asignar (estado %)', e.status;
  END IF;

  IF e.labor_id IS NOT NULL OR e.lote_id IS NOT NULL OR e.predio_id IS NOT NULL
     OR e.cosecha_id IS NOT NULL OR e.venta_id IS NOT NULL THEN
    v_method := 'direct'; v_quality := 'direct'; v_direct := 'direct'; -- §5.1
  ELSIF e.operacion_id IS NOT NULL THEN -- §5.2 inferida por operación
    SELECT lote_id, maquinaria_id INTO r FROM public.maquinaria_operaciones
      WHERE id = e.operacion_id AND company_id = p_company_id;
    IF r.lote_id IS NOT NULL THEN
      UPDATE public.costos_eventos SET lote_id = r.lote_id,
        maquinaria_id = COALESCE(e.maquinaria_id, r.maquinaria_id), updated_at = now() WHERE id = e.id;
      e.lote_id := r.lote_id;
      v_method := 'direct'; v_quality := 'inferred'; v_direct := 'direct';
    ELSE
      -- Enmienda 067 (operación Q1 sin lote): costo a nivel máquina, indirecto
      -- agrícola. Visible pero jamás atribuido a un lote. quality inferred
      -- porque la máquina se deriva de la operación, no de etiquetado directo.
      UPDATE public.costos_eventos SET
        maquinaria_id = COALESCE(e.maquinaria_id, r.maquinaria_id), updated_at = now() WHERE id = e.id;
      v_method := 'direct'; v_quality := 'inferred'; v_direct := 'indirect';
    END IF;
  ELSIF e.maquinaria_id IS NOT NULL THEN -- §5.3 costo a nivel máquina (indirecto agrícola)
    v_method := 'direct'; v_quality := 'direct'; v_direct := 'indirect';
  ELSE -- §5.4 sin dimensión
    PERFORM public.costos_private_create_issue(p_company_id, e.id, 'unallocatable', 'medium', 'Evento sin dimensión asignable');
    UPDATE public.costos_eventos SET status='pending_allocation', updated_at=now() WHERE id=e.id;
    RETURN jsonb_build_object('event_id', e.id, 'status', 'pending_allocation', 'allocated', false);
  END IF;

  -- Completar predio desde lote cuando falte (fuente confiable: lotes).
  IF e.lote_id IS NOT NULL AND e.predio_id IS NULL THEN
    SELECT predio_id INTO r FROM public.lotes WHERE id = e.lote_id AND company_id = p_company_id;
    IF r.predio_id IS NOT NULL THEN
      UPDATE public.costos_eventos SET predio_id = r.predio_id, updated_at = now() WHERE id = e.id;
    END IF;
  END IF;

  UPDATE public.costos_eventos SET allocated_at = now(), status = 'allocated',
    payload = payload || jsonb_build_object('allocation',
      jsonb_build_object('method', v_method, 'quality', v_quality, 'directness', v_direct)),
    updated_at = now() WHERE id = e.id;
  RETURN jsonb_build_object('event_id', e.id, 'status', 'allocated', 'allocated', true,
    'method', v_method, 'quality', v_quality, 'directness', v_direct);
END; $$;

CREATE OR REPLACE FUNCTION public.costos_allocate_event(
  p_company_id UUID, p_user_id TEXT, p_event_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.costos_private_require_perm('costos', 'crear');
  RETURN public.costos_private_allocate_core(p_company_id, p_user_id, p_event_id);
END; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- §5 · costos_post_event — publicación transaccional idempotente
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.costos_private_post_core(
  p_company_id UUID, p_user_id TEXT, p_event_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  e RECORD; v_kind TEXT; v_class TEXT; v_behav TEXT := 'variable'; v_dir TEXT;
  v_alloc JSONB; v_ehash TEXT; v_entry_id UUID; v_existing UUID;
BEGIN
  PERFORM public.rpc_assert_tenant_access(p_company_id, p_user_id);
  SELECT * INTO e FROM public.costos_eventos WHERE id = p_event_id AND company_id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'costos/event_not_found: evento % no existe en tu empresa', p_event_id; END IF;
  IF e.status = 'posted' THEN
    RETURN jsonb_build_object('event_id', e.id, 'status', 'posted', 'posted', false, 'entries', '[]'::jsonb);
  END IF;
  IF e.status = 'reversed' THEN RAISE EXCEPTION 'costos/invalid_status: evento reversado no republicable'; END IF;
  IF e.status NOT IN ('allocated','priced') THEN
    RAISE EXCEPTION 'costos/invalid_status: evento en estado % no publicable (requiere allocated)', e.status;
  END IF;
  PERFORM public.costos_private_assert_period_open(p_company_id, e.business_date);

  -- harvest_output: producción sin monto → posted sin entradas (§4.3.7).
  IF e.event_type = 'harvest_output' THEN
    UPDATE public.costos_eventos SET status='posted', posted_at=now(),
      payload = payload || jsonb_build_object('posted_without_entries', true), updated_at=now() WHERE id=e.id;
    RETURN jsonb_build_object('event_id', e.id, 'status', 'posted', 'posted', true, 'entries', '[]'::jsonb, 'note', 'non_monetary');
  END IF;
  IF e.valued_amount IS NULL OR e.amount_base IS NULL THEN
    RAISE EXCEPTION 'costos/invalid_status: evento sin valorización (estado %)', e.status;
  END IF;

  v_alloc := COALESCE(e.payload->'allocation', '{}'::jsonb);
  CASE e.event_type
    WHEN 'input_consumption'  THEN v_kind:='cost';    v_class:='input';
    WHEN 'labor_usage'        THEN v_kind:='cost';    v_class:='labor';
    WHEN 'machine_usage'      THEN v_kind:='cost';    v_class:='machinery_usage';
    WHEN 'fuel_consumption'   THEN v_kind:='cost';    v_class:='fuel';
    WHEN 'maintenance_cost'   THEN v_kind:='cost';    v_class:='maintenance';
    WHEN 'depreciation'       THEN v_kind:='cost';    v_class:='depreciation'; v_behav:='fixed';
    WHEN 'external_service'   THEN v_kind:='expense'; v_class:='service';
    WHEN 'overhead_expense'   THEN v_kind:='expense'; v_class:='overhead';     v_behav:='fixed';
    WHEN 'sale_revenue'       THEN v_kind:='revenue'; v_class:='revenue';
    WHEN 'estimated_revenue'  THEN v_kind:='revenue'; v_class:='revenue';
    WHEN 'other_income'       THEN v_kind:='revenue'; v_class:='other';
    WHEN 'other_expense'      THEN v_kind:='expense'; v_class:='other';
    WHEN 'correction'         THEN v_kind:='adjustment'; v_class:='other';
    ELSE RAISE EXCEPTION 'costos/validation_failed: event_type sin mapeo contable: %', e.event_type;
  END CASE;
  v_dir := COALESCE(v_alloc->>'directness',
    CASE WHEN COALESCE(v_alloc->>'quality','direct') IN ('direct','inferred') THEN 'direct' ELSE 'indirect' END);

  v_ehash := public.costos_private_entry_hash(p_company_id, e.id, v_kind, v_class,
    e.amount_base, COALESCE(v_alloc->>'method','direct'), COALESCE(v_alloc->>'quality','direct'), e.valuation_hash);
  SELECT id INTO v_existing FROM public.costos_entradas
    WHERE company_id = p_company_id AND source_event_id = e.id AND entry_hash = v_ehash;
  IF FOUND THEN
    UPDATE public.costos_eventos SET status='posted', posted_at=COALESCE(posted_at, now()), updated_at=now() WHERE id=e.id;
    RETURN jsonb_build_object('event_id', e.id, 'status', 'posted', 'posted', false,
      'entries', jsonb_build_array(jsonb_build_object('id', v_existing, 'deduplicated', true)));
  END IF;

  INSERT INTO public.costos_entradas (
    company_id, source_event_id, entry_kind, cost_class, cost_behavior, directness,
    predio_id, lote_id, labor_id, operacion_id, maquinaria_id, inventario_id, trabajador_id,
    cosecha_id, venta_id, occurred_at, business_date, quantity, unit, unit_price,
    amount_original, currency, fx_rate, amount_base, sign,
    allocation_method, allocation_quality, status, valuation_hash, entry_hash, created_by)
  VALUES (
    p_company_id, e.id, v_kind, v_class, v_behav, v_dir,
    e.predio_id, e.lote_id, e.labor_id, e.operacion_id, e.maquinaria_id, e.inventario_id,
    e.trabajador_id, e.cosecha_id, e.venta_id, e.occurred_at, e.business_date,
    e.quantity, e.source_unit, e.valued_unit_price,
    e.valued_amount, e.valued_currency, e.valued_fx_rate, e.amount_base, 1,
    COALESCE(v_alloc->>'method','direct'), COALESCE(v_alloc->>'quality','direct'),
    'posted', e.valuation_hash, v_ehash, p_user_id)
  RETURNING id INTO v_entry_id;

  -- §6.5: SIN espejo en public.costos (se activará en adaptadores).
  UPDATE public.costos_eventos SET status='posted', posted_at=now(), updated_at=now() WHERE id=e.id;
  RETURN jsonb_build_object('event_id', e.id, 'status', 'posted', 'posted', true,
    'entries', jsonb_build_array(jsonb_build_object('id', v_entry_id, 'entry_hash', v_ehash, 'amount_base', e.amount_base)));
END; $$;

CREATE OR REPLACE FUNCTION public.costos_post_event(
  p_company_id UUID, p_user_id TEXT, p_event_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.costos_private_require_perm('costos', 'crear');
  RETURN public.costos_private_post_core(p_company_id, p_user_id, p_event_id);
END; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- §6 · costos_reverse_event — reverso auditable (nunca borra)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.costos_reverse_event(
  p_company_id UUID, p_user_id TEXT, p_event_id UUID, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE e RECORD; r RECORD; v_n INT := 0; v_ehash TEXT;
BEGIN
  PERFORM public.rpc_assert_tenant_access(p_company_id, p_user_id);
  PERFORM public.costos_private_require_perm('costos', 'eliminar');
  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'costos/validation_failed: reason obligatorio (mín. 5 caracteres)';
  END IF;
  SELECT * INTO e FROM public.costos_eventos WHERE id = p_event_id AND company_id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'costos/event_not_found: evento % no existe en tu empresa', p_event_id; END IF;
  IF e.status = 'reversed' THEN
    RETURN jsonb_build_object('event_id', e.id, 'status', 'reversed', 'reversed', false);
  END IF;
  IF e.status <> 'posted' THEN
    RAISE EXCEPTION 'costos/invalid_status: solo eventos posted son reversables (estado %)', e.status;
  END IF;

  FOR r IN SELECT * FROM public.costos_entradas
           WHERE source_event_id = e.id AND company_id = p_company_id
             AND status = 'posted' AND entry_kind <> 'reversal' FOR UPDATE LOOP
    v_ehash := public.costos_private_entry_hash(p_company_id, e.id, 'reversal', r.cost_class,
      r.amount_base, COALESCE(r.allocation_method,'direct'), COALESCE(r.allocation_quality,'direct'),
      COALESCE(r.valuation_hash,'') || '|reversal');
    INSERT INTO public.costos_entradas (
      company_id, source_event_id, entry_kind, cost_class, cost_behavior, directness,
      cost_item_id, predio_id, lote_id, labor_id, operacion_id, maquinaria_id, inventario_id,
      trabajador_id, cosecha_id, venta_id, occurred_at, business_date, quantity, unit, unit_price,
      amount_original, currency, fx_rate, amount_base, sign,
      allocation_method, allocation_quality, status, valuation_hash, entry_hash, reason, created_by)
    VALUES (
      p_company_id, e.id, 'reversal', r.cost_class, r.cost_behavior, r.directness,
      r.cost_item_id, r.predio_id, r.lote_id, r.labor_id, r.operacion_id, r.maquinaria_id, r.inventario_id,
      r.trabajador_id, r.cosecha_id, r.venta_id, r.occurred_at, r.business_date, r.quantity, r.unit, r.unit_price,
      r.amount_original, r.currency, r.fx_rate, r.amount_base, -1,
      r.allocation_method, r.allocation_quality, 'posted', r.valuation_hash, v_ehash, p_reason, p_user_id)
    ON CONFLICT DO NOTHING;
    v_n := v_n + 1;
  END LOOP;

  UPDATE public.costos_eventos SET status='reversed', updated_at=now() WHERE id=e.id;
  RETURN jsonb_build_object('event_id', e.id, 'status', 'reversed', 'reversed', true, 'reversal_entries', v_n);
END; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- §7 · costos_recalculate — STUB seguro (§8): valida permiso, no escribe
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.costos_recalculate(
  p_company_id UUID, p_user_id TEXT, p_scope JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.rpc_assert_tenant_access(p_company_id, p_user_id);
  PERFORM public.costos_private_require_perm('costos', 'editar');
  RETURN jsonb_build_object('status', 'not_implemented',
    'message', 'Recalculation will be implemented in a later phase (valuation_hash/entry_hash ya reservados)');
END; $$;

-- ── Grants RPCs ──────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.costos_register_event(UUID, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.costos_register_event(UUID, TEXT, JSONB) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.costos_value_event(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.costos_value_event(UUID, TEXT, UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.costos_allocate_event(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.costos_allocate_event(UUID, TEXT, UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.costos_post_event(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.costos_post_event(UUID, TEXT, UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.costos_reverse_event(UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.costos_reverse_event(UUID, TEXT, UUID, TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.costos_recalculate(UUID, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.costos_recalculate(UUID, TEXT, JSONB) TO authenticated, service_role;

-- ==============================================================================
-- ROLLBACK DOCUMENTADO (dev/staging; NUNCA prod sin backup + aprobación):
--   DROP FUNCTION IF EXISTS public.costos_recalculate(UUID, TEXT, JSONB);
--   DROP FUNCTION IF EXISTS public.costos_reverse_event(UUID, TEXT, UUID, TEXT);
--   DROP FUNCTION IF EXISTS public.costos_post_event(UUID, TEXT, UUID);
--   DROP FUNCTION IF EXISTS public.costos_allocate_event(UUID, TEXT, UUID);
--   DROP FUNCTION IF EXISTS public.costos_value_event(UUID, TEXT, UUID);
--   DROP FUNCTION IF EXISTS public.costos_register_event(UUID, TEXT, JSONB);
--   DROP FUNCTION IF EXISTS public.costos_private_assert_period_open(UUID, DATE);
--   DROP FUNCTION IF EXISTS public.costos_private_register_core(UUID, TEXT, JSONB);
--   DROP FUNCTION IF EXISTS public.costos_private_value_core(UUID, TEXT, UUID);
--   DROP FUNCTION IF EXISTS public.costos_private_allocate_core(UUID, TEXT, UUID);
--   DROP FUNCTION IF EXISTS public.costos_private_post_core(UUID, TEXT, UUID);
--   DROP FUNCTION IF EXISTS public.costos_private_create_issue(UUID, UUID, TEXT, TEXT, TEXT);
--   DROP FUNCTION IF EXISTS public.costos_private_entry_hash(UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT);
--   DROP FUNCTION IF EXISTS public.costos_private_valuation_hash(UUID, UUID, INT, NUMERIC, NUMERIC, TEXT, NUMERIC);
--   DROP FUNCTION IF EXISTS public.costos_private_payload_hash(JSONB);
--   DROP FUNCTION IF EXISTS public.costos_private_require_perm(TEXT, TEXT);
--   -- §0 es convergencia (columnas de 065): revertir con rollback de 065.
-- ==============================================================================
