-- ==============================================================================
-- SKYCROP DATABASE V2: 067_costos_adaptador_maquinaria.sql
-- Primer adaptador del motor de costos: Maquinaria / Operaciones.
-- Rama: draft/costos-produccion. NO aplicar en producción. Requiere 065 + 066.
--
-- ── CONTRATO DEL ADAPTADOR ─────────────────────────────────────────────────
-- Qué se emite:
--   maquinaria_operaciones (estado→Finalizada) → machine_usage
--   maquinaria_combustible (INSERT)            → fuel_consumption
--   maquinaria_mantenimientos (estado→Completado) → maintenance_cost
-- Cuándo: triggers AFTER ROW (transición exacta de estado / inserción).
--   El flujo operativo NUNCA se rompe por costos: toda emisión va envuelta en
--   EXCEPTION → WARNING (best-effort, patrón eventBus del backend).
-- Política de combustible (§11/066):
--   machine_usage EXCLUYE combustible (horas × operador+mantenimiento+
--   depreciación; el adaptador NO pasa use_operation_total).
--   El costo_total legacy de la operación SÍ incluye combustible y se conserva
--   tal cual para display/compat, pero NO alimenta el ledger (se guarda como
--   payload.legacy_costo_total informativo). Diferencia legacy-vs-ledger
--   conocida y aceptada: el ledger valora combustible por cargas reales
--   (maquinaria_combustible.costo_unitario), no por tarifa estimada.
-- Idempotencia: clave natural (maquinaria/<entidad>/<id>/v1/<tipo>); re-fires
--   devuelven el evento existente; value/allocate/post son idempotentes.
--   Si una operación se edita y re-finaliza, la primera valuación se conserva
--   (valuation_hash reservado para la fase de recálculo).
-- Sin lote (cuarentena Q1): el evento porta operacion_id + maquinaria_id;
--   allocate enmendado (066/067) lo deja a nivel máquina indirecto
--   (method direct, quality inferred, directness indirect). Visible, jamás
--   atribuido a un lote.
-- Sin lote NO hay traceability_events (exige lote_id): el costo queda en el
--   ledger + issues; con lote se escribe evidencia best-effort.
-- Legacy intacto: NO se toca finalizar_jornada_maquinaria (052) ni
--   registrar_costo_lote; el espejo legacy sigue escribiendo 'Maquinaria'.
--   066 §6.5 sigue vigente: el adaptador NO escribe en public.costos.
-- Permisos (P0 §2): el adaptador usa los cores privados
--   costos_private_*_core (066), revocados para PUBLIC/anon/authenticated.
--   El trigger corre DEFINER (owner); el tenant sale de NEW.company_id +
--   rpc_assert_tenant_access valida membresía con el JWT de la sesión.
--   La acción operativa ya fue autorizada (mq_assert_rol). Las RPC públicas
--   siguen exigiendo costos/crear. Sin banderas GUC: no existe ningún
--   mecanismo seteable por usuario para omitir permisos (verificado en
--   verify-costos: check no_guc_backdoor).
-- Fallos visibles (P1): WARNING + issue adapter_failure persistente (nunca
--   solo WARNING). Cambios post-cierre → issue source_changed_after_post;
--   DELETE de fuente costeada → BLOQUEADO con error explícito.
-- Combustible (§5): si la operación declara combustible_l > 0 y no existe
--   carga de la misma máquina en la ventana (horómetro, fallback fecha) →
--   issue missing_fuel_data. El costo NUNCA se presenta como completo sin
--   esa evidencia: metadata operation_combustible_l + fuel_link_available.
-- Invocación manual de funciones trigger → rechazada (pg_trigger_depth()).
-- Borrado de empresa con historia: el guard bloquea la cascada mientras
-- existan eventos (posted/reversed). Limpieza dev prescrita: borrar primero
-- costos_entradas → costos_eventos → costos_issues → traceability_events de
-- la compañía y luego la compañía (ver tests gated). Nunca relajar el guard.
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- §0 · Nuevos issue_type del adaptador (idempotente; 065 ya aplicada en dev).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.costos_issues DROP CONSTRAINT IF EXISTS costos_issues_issue_type_check;
  ALTER TABLE public.costos_issues DROP CONSTRAINT IF EXISTS costos_issues_issue_type_chk;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'costos_issues_issue_type_chk') THEN
    ALTER TABLE public.costos_issues ADD CONSTRAINT costos_issues_issue_type_chk CHECK (issue_type IN (
      'missing_price','missing_dimension','invalid_unit','fx_missing',
      'unallocatable','duplicate_event','closed_period','invalid_source',
      'missing_period','adapter_failure','source_changed_after_post',
      'missing_fuel_data','other'));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- §1 · Driver tolerante: value → allocate → post (estados pending = normal).
-- Re-fires sobre estados terminales (posted/reversed/invalid/ignored) son
-- no-op: el ledger no se muta (§9 idempotencia).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.costos_adapter_drive(
  p_company_id UUID, p_user_id TEXT, p_event_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v JSONB; v_st TEXT;
BEGIN
  SELECT status INTO v_st FROM public.costos_eventos
    WHERE id = p_event_id AND company_id = p_company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'costos/event_not_found: evento % no existe', p_event_id; END IF;
  IF v_st IN ('posted', 'reversed', 'invalid', 'ignored') THEN
    RETURN jsonb_build_object('driven', false, 'stage', 'terminal', 'status', v_st);
  END IF;
  v := public.costos_private_value_core(p_company_id, p_user_id, p_event_id);
  IF (v->>'status') NOT IN ('priced', 'allocated', 'posted') THEN
    RETURN jsonb_build_object('driven', false, 'stage', 'value', 'result', v);
  END IF;
  IF (v->>'status') = 'posted' THEN
    RETURN jsonb_build_object('driven', true, 'stage', 'already_posted', 'result', v);
  END IF;
  v := public.costos_private_allocate_core(p_company_id, p_user_id, p_event_id);
  IF (v->>'status') <> 'allocated' THEN
    RETURN jsonb_build_object('driven', false, 'stage', 'allocate', 'result', v);
  END IF;
  v := public.costos_private_post_core(p_company_id, p_user_id, p_event_id);
  RETURN jsonb_build_object('driven', true, 'stage', 'post', 'result', v);
END; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- §2 · Emisor best-effort con evidencia persistente de fallo (P1).
-- NUNCA propaga excepción al flujo operativo; el fallo deja issue
-- adapter_failure (además del WARNING) para el panel de pendientes.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.costos_adapter_emit(
  p_company_id UUID, p_user_id TEXT, p_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_reg JSONB; v_drv JSONB; v_eid UUID;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN jsonb_build_object('emitted', false, 'reason', 'sin company_id');
  END IF;
  v_reg := public.costos_private_register_core(p_company_id, p_user_id, p_payload);
  v_eid := (v_reg->>'event_id')::uuid;
  v_drv := public.costos_adapter_drive(p_company_id, p_user_id, v_eid);
  RETURN jsonb_build_object('emitted', true, 'event_id', v_eid, 'registered', v_reg, 'driven', v_drv);
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.costos_issues (company_id, source_event_id, issue_type, severity, message)
      VALUES (p_company_id, NULL, 'adapter_failure', 'high',
        'Adaptador ' || COALESCE(p_payload->>'adapter', '?') || ' falló: ' || SQLERRM);
  EXCEPTION WHEN OTHERS THEN
    NULL; -- ni el issue pudo persistirse: solo queda el WARNING
  END;
  RAISE WARNING 'costos/adapter: emisión fallida, operación intacta: %', SQLERRM;
  RETURN jsonb_build_object('emitted', false, 'error', SQLERRM);
END; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- §3 · Operación finalizada → machine_usage (+ trazabilidad con lote)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.costos_trg_operacion_finalizada()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_res JSONB; v_posted BOOL; v_amount TEXT; v_eid UUID;
  v_fuel_ok BOOL := false;
BEGIN
  IF pg_trigger_depth() = 0 THEN
    RAISE EXCEPTION 'costos/forbidden_adapter_context: invocación manual fuera de trigger';
  END IF;
  v_res := public.costos_adapter_emit(NEW.company_id, COALESCE(public.current_user_id(), 'sistema'),
    jsonb_build_object(
      'source_module', 'maquinaria', 'source_entity', 'maquinaria_operaciones',
      'source_id', NEW.id, 'source_version', 1, 'event_type', 'machine_usage',
      'occurred_at', COALESCE(NEW.fin, now()),
      'lote_id', NEW.lote_id, 'maquinaria_id', NEW.maquinaria_id, 'operacion_id', NEW.id,
      'quantity', NEW.horas, 'source_unit', 'h',
      'adapter', 'maquinaria_operaciones', 'fuel_policy', 'separate',
      'legacy_costo_total', NEW.costo_total, 'labor', NEW.labor,
      'operation_combustible_l', NEW.combustible_l));
  v_eid := NULLIF(v_res->>'event_id', '')::uuid;
  -- Cobertura de combustible (§5): carga misma máquina en ventana de la
  -- operación (horómetro; fallback rango de fechas). Sin vínculo directo
  -- operación↔carga no hay matching exacto: esto es heurística documentada.
  IF NEW.combustible_l IS NOT NULL AND NEW.combustible_l > 0 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.maquinaria_combustible f
      WHERE f.company_id = NEW.company_id AND f.maquinaria_id = NEW.maquinaria_id
        AND ( (NEW.horometro_inicio IS NOT NULL AND NEW.horometro_fin IS NOT NULL
               AND f.horometro BETWEEN NEW.horometro_inicio AND NEW.horometro_fin)
           OR (f.fecha BETWEEN NEW.inicio AND COALESCE(NEW.fin, now())) )
    ) INTO v_fuel_ok;
    IF NOT v_fuel_ok AND v_eid IS NOT NULL THEN
      PERFORM public.costos_private_create_issue(NEW.company_id, v_eid,
        'missing_fuel_data', 'medium',
        'Operación declara ' || NEW.combustible_l || ' L sin carga vinculada en ventana; costo combustible ausente o a nivel máquina.');
    END IF;
    IF v_eid IS NOT NULL THEN
      UPDATE public.costos_eventos
        SET payload = payload || jsonb_build_object('fuel_link_available', v_fuel_ok),
            updated_at = now()
        WHERE id = v_eid AND company_id = NEW.company_id;
    END IF;
  END IF;
  -- Trazabilidad best-effort: solo con lote y post efectivo.
  BEGIN
    v_posted := COALESCE((v_res #>> '{driven,result,posted}')::boolean, false);
    IF NEW.lote_id IS NOT NULL AND v_posted THEN
      v_amount := v_res #>> '{driven,result,entries,0,amount_base}';
      PERFORM public.registrar_evento_trazabilidad_empresa(
        NEW.company_id, NEW.lote_id, 'other', 'costos',
        'Costo maquinaria publicado',
        COALESCE(NEW.fin, now()), NULL, COALESCE(public.current_user_id(), 'sistema'), NULL,
        NULL, NEW.operador_nombre,
        'Operación ' || COALESCE(NEW.labor, '') || ' (' || COALESCE(NEW.horas, 0) || ' h)',
        NULL, NULL,
        jsonb_build_object('amount_base', v_amount, 'moneda', 'COP',
          'fuel_policy', 'separate', 'fuel_link_available', v_fuel_ok,
          'operation_combustible_l', NEW.combustible_l, 'operacion_id', NEW.id),
        'maquinaria_operaciones', NEW.id, NULL, 'COMPLETADO');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'costos/adapter: trazabilidad omitida: %', SQLERRM;
  END;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_costos_op_finalizada ON public.maquinaria_operaciones;
CREATE TRIGGER trg_costos_op_finalizada
  AFTER UPDATE OF estado ON public.maquinaria_operaciones
  FOR EACH ROW
  WHEN (OLD.estado IS DISTINCT FROM NEW.estado AND NEW.estado = 'Finalizada')
  EXECUTE FUNCTION public.costos_trg_operacion_finalizada();

-- ─────────────────────────────────────────────────────────────────────────────
-- §4 · Carga de combustible → fuel_consumption (nivel máquina, indirecto)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.costos_trg_combustible_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF pg_trigger_depth() = 0 THEN
    RAISE EXCEPTION 'costos/forbidden_adapter_context: invocación manual fuera de trigger';
  END IF;
  PERFORM public.costos_adapter_emit(NEW.company_id, COALESCE(public.current_user_id(), 'sistema'),
    jsonb_build_object(
      'source_module', 'combustible', 'source_entity', 'maquinaria_combustible',
      'source_id', NEW.id, 'source_version', 1, 'event_type', 'fuel_consumption',
      'occurred_at', COALESCE(NEW.fecha, now()),
      'maquinaria_id', NEW.maquinaria_id, 'trabajador_id', NEW.operador_id,
      'quantity', NEW.cantidad, 'source_unit', NEW.unidad,
      'adapter', 'maquinaria_combustible',
      'horometro', NEW.horometro, 'proveedor', NEW.proveedor));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_costos_combustible ON public.maquinaria_combustible;
CREATE TRIGGER trg_costos_combustible
  AFTER INSERT ON public.maquinaria_combustible
  FOR EACH ROW
  EXECUTE FUNCTION public.costos_trg_combustible_insert();

-- ─────────────────────────────────────────────────────────────────────────────
-- §5 · Mantenimiento completado → maintenance_cost (nivel máquina, indirecto)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.costos_trg_mantenimiento_completado()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF pg_trigger_depth() = 0 THEN
    RAISE EXCEPTION 'costos/forbidden_adapter_context: invocación manual fuera de trigger';
  END IF;
  PERFORM public.costos_adapter_emit(NEW.company_id, COALESCE(public.current_user_id(), 'sistema'),
    jsonb_build_object(
      'source_module', 'mantenimiento', 'source_entity', 'maquinaria_mantenimientos',
      'source_id', NEW.id, 'source_version', 1, 'event_type', 'maintenance_cost',
      'occurred_at', COALESCE(NEW.executed_at, now()),
      'maquinaria_id', NEW.maquinaria_id,
      'adapter', 'maquinaria_mantenimientos',
      'tipo', NEW.tipo, 'proveedor', NEW.proveedor));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_costos_mantenimiento ON public.maquinaria_mantenimientos;
CREATE TRIGGER trg_costos_mantenimiento
  AFTER UPDATE OF estado ON public.maquinaria_mantenimientos
  FOR EACH ROW
  WHEN (OLD.estado IS DISTINCT FROM NEW.estado AND NEW.estado = 'Completado')
  EXECUTE FUNCTION public.costos_trg_mantenimiento_completado();

-- ─────────────────────────────────────────────────────────────────────────────
-- §6 · Guardia post-cierre (P1 §4/§6 + cierre terminal): UPDATE de fuente
-- costeada → issue; DELETE de fuente costeada → BLOQUEO; transición fuera de
-- estado terminal con costo VIGENTE (posted) → BLOQUEO. Flujo de corrección:
-- reversar el evento (API/RPC) y luego editar: con evento reversed se permite.
-- BEFORE: en el finalize no hay evento aún → no-op.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.costos_trg_fuente_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_ent TEXT := TG_ARGV[0]; v_costed BOOL; v_changed BOOL := false; v_ev UUID; v_st TEXT;
BEGIN
  IF pg_trigger_depth() = 0 THEN
    RAISE EXCEPTION 'costos/forbidden_adapter_context: invocación manual fuera de trigger';
  END IF;
  IF TG_OP = 'DELETE' THEN
    SELECT EXISTS (SELECT 1 FROM public.costos_eventos
      WHERE company_id = OLD.company_id AND source_entity = v_ent AND source_id = OLD.id
        AND status IN ('posted', 'reversed')) INTO v_costed;
    IF v_costed THEN
      RAISE EXCEPTION 'costos/source_locked: % con costo publicado no borrable (usar reverso/anulación)', v_ent;
    END IF;
    RETURN OLD;
  END IF;
  SELECT id, status INTO v_ev, v_st FROM public.costos_eventos
    WHERE company_id = NEW.company_id AND source_entity = v_ent AND source_id = OLD.id
      AND status IN ('posted', 'reversed') ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;
  -- Transición terminal con costo vigente: bloqueo. Reversed = corrección en
  -- curso → permitido (el ledger ya está en neto cero para ese evento).
  IF v_st = 'posted' AND v_ent = 'maquinaria_operaciones'
     AND OLD.estado = 'Finalizada' AND NEW.estado IS DISTINCT FROM OLD.estado THEN
    RAISE EXCEPTION 'costos/source_locked: operación Finalizada con costo publicado no admite cambio a % (reversar evento % primero)',
      NEW.estado, v_ev;
  END IF;
  IF v_st = 'posted' AND v_ent = 'maquinaria_mantenimientos'
     AND OLD.estado = 'Completado' AND NEW.estado IS DISTINCT FROM OLD.estado THEN
    RAISE EXCEPTION 'costos/source_locked: mantenimiento Completado con costo publicado no admite cambio a % (reversar evento % primero)',
      NEW.estado, v_ev;
  END IF;
  IF v_st <> 'posted' THEN RETURN NEW; END IF; -- reversed: corrección en curso
  CASE v_ent
    WHEN 'maquinaria_operaciones' THEN v_changed :=
      NEW.horas IS DISTINCT FROM OLD.horas OR NEW.lote_id IS DISTINCT FROM OLD.lote_id OR
      NEW.maquinaria_id IS DISTINCT FROM OLD.maquinaria_id OR NEW.costo_total IS DISTINCT FROM OLD.costo_total OR
      NEW.combustible_l IS DISTINCT FROM OLD.combustible_l OR NEW.estado IS DISTINCT FROM OLD.estado;
    WHEN 'maquinaria_combustible' THEN v_changed :=
      NEW.cantidad IS DISTINCT FROM OLD.cantidad OR NEW.costo_unitario IS DISTINCT FROM OLD.costo_unitario OR
      NEW.costo_total IS DISTINCT FROM OLD.costo_total OR NEW.maquinaria_id IS DISTINCT FROM OLD.maquinaria_id;
    WHEN 'maquinaria_mantenimientos' THEN v_changed :=
      NEW.costo IS DISTINCT FROM OLD.costo OR NEW.maquinaria_id IS DISTINCT FROM OLD.maquinaria_id OR
      NEW.estado IS DISTINCT FROM OLD.estado;
    ELSE v_changed := true;
  END CASE;
  IF v_changed THEN
    BEGIN
      PERFORM public.costos_private_create_issue(NEW.company_id, v_ev, 'source_changed_after_post', 'high',
        'Fuente ' || v_ent || ' modificada tras costo publicado; el ledger conserva la valuación original.');
    EXCEPTION WHEN OTHERS THEN NULL; END;
    RAISE WARNING 'costos/source_changed_after_post: % % modificado tras publicación', v_ent, OLD.id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_costos_guard_op ON public.maquinaria_operaciones;
CREATE TRIGGER trg_costos_guard_op
  BEFORE UPDATE OR DELETE ON public.maquinaria_operaciones
  FOR EACH ROW EXECUTE FUNCTION public.costos_trg_fuente_guard('maquinaria_operaciones');
DROP TRIGGER IF EXISTS trg_costos_guard_comb ON public.maquinaria_combustible;
CREATE TRIGGER trg_costos_guard_comb
  BEFORE UPDATE OR DELETE ON public.maquinaria_combustible
  FOR EACH ROW EXECUTE FUNCTION public.costos_trg_fuente_guard('maquinaria_combustible');
DROP TRIGGER IF EXISTS trg_costos_guard_mant ON public.maquinaria_mantenimientos;
CREATE TRIGGER trg_costos_guard_mant
  BEFORE UPDATE OR DELETE ON public.maquinaria_mantenimientos
  FOR EACH ROW EXECUTE FUNCTION public.costos_trg_fuente_guard('maquinaria_mantenimientos');

-- ── Grants: disparo por triggers (owner) + service_role; sin acceso directo ──
REVOKE ALL ON FUNCTION public.costos_adapter_drive(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.costos_adapter_emit(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.costos_trg_operacion_finalizada() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.costos_trg_combustible_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.costos_trg_mantenimiento_completado() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.costos_trg_fuente_guard() FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.costos_adapter_drive(UUID, TEXT, UUID) TO service_role;
GRANT ALL ON FUNCTION public.costos_adapter_emit(UUID, TEXT, JSONB) TO service_role;
GRANT ALL ON FUNCTION public.costos_trg_operacion_finalizada() TO service_role;
GRANT ALL ON FUNCTION public.costos_trg_combustible_insert() TO service_role;
GRANT ALL ON FUNCTION public.costos_trg_mantenimiento_completado() TO service_role;
GRANT ALL ON FUNCTION public.costos_trg_fuente_guard() TO service_role;

-- ==============================================================================
-- ROLLBACK DOCUMENTADO (dev/staging; NUNCA prod sin backup + aprobación):
--   DROP TRIGGER IF EXISTS trg_costos_guard_op ON public.maquinaria_operaciones;
--   DROP TRIGGER IF EXISTS trg_costos_guard_comb ON public.maquinaria_combustible;
--   DROP TRIGGER IF EXISTS trg_costos_guard_mant ON public.maquinaria_mantenimientos;
--   DROP TRIGGER IF EXISTS trg_costos_mantenimiento ON public.maquinaria_mantenimientos;
--   DROP TRIGGER IF EXISTS trg_costos_combustible ON public.maquinaria_combustible;
--   DROP TRIGGER IF EXISTS trg_costos_op_finalizada ON public.maquinaria_operaciones;
--   DROP FUNCTION IF EXISTS public.costos_trg_fuente_guard();
--   DROP FUNCTION IF EXISTS public.costos_trg_mantenimiento_completado();
--   DROP FUNCTION IF EXISTS public.costos_trg_combustible_insert();
--   DROP FUNCTION IF EXISTS public.costos_trg_operacion_finalizada();
--   DROP FUNCTION IF EXISTS public.costos_adapter_emit(UUID, TEXT, JSONB);
--   DROP FUNCTION IF EXISTS public.costos_adapter_drive(UUID, TEXT, UUID);
--   ALTER TABLE public.costos_issues DROP CONSTRAINT IF EXISTS costos_issues_issue_type_chk;
--   -- (el check auto-nombre de 065 se restaura re-aplicando 065 o con ADD explícito)
--   -- Los eventos/entradas ya generados se conservan (ledger); reversarlos vía
--   -- costos_reverse_event si el rollback exige neto cero.
-- ==============================================================================
