-- ==============================================================================
-- SKYCROP DATABASE V2: 063_inventario_guard_quantity.sql
-- Cierra el bypass detectado en staging 2026-09-17: un UPDATE directo puso
-- quantity 10→0 sin fila de kardex (audit_logs 02:19:34). La RPC leyó 0 y
-- respondió [CONFLICT]: correcto, pero el bypass no debe existir.
--
-- Regla: quantity SOLO cambia vía RPC. Las 3 funciones fijan el flag de
-- sesión app.inventory_rpc (solo fijable desde SQL directo o DEFINER; por
-- REST/PostgREST no hay SET LOCAL, así que el UPDATE directo vía API queda
-- bloqueado). INSERT con stock inicial sigue permitido (altas por UI).
-- Mantenimiento manual: SET LOCAL app.inventory_rpc = '1' como service_role.
-- Rama: feat/inventario-ux-v2. Requiere 058–061 (cuerpos idénticos + 1 línea).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.inventario_guard_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.quantity IS DISTINCT FROM OLD.quantity
     AND current_setting('app.inventory_rpc', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION '[PERMISSION] El stock solo cambia vía movimientos (RPC). UPDATE directo bloqueado.';
  END IF;
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.inventario_guard_quantity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventario_guard_quantity() FROM anon;
GRANT EXECUTE ON FUNCTION public.inventario_guard_quantity() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_inventario_guard_quantity ON public.inventario;
CREATE TRIGGER trg_inventario_guard_quantity
  BEFORE UPDATE OF quantity ON public.inventario
  FOR EACH ROW EXECUTE FUNCTION public.inventario_guard_quantity();

-- ── Flag en registrar_movimiento_inventario (cuerpo 060 + 1 línea) ─────────────
CREATE OR REPLACE FUNCTION public.registrar_movimiento_inventario(
  p_item_id       UUID,
  p_cantidad      NUMERIC,
  p_tipo          VARCHAR,
  p_motivo        TEXT,
  p_warehouse_id  UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_company UUID := public.current_company();
  v_user    TEXT := public.current_user_id();
  v_antes   NUMERIC;
  v_despues NUMERIC;
  v_wh      UUID;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION '[PERMISSION] Sin compañía en sesión.';
  END IF;
  IF NOT public.has_permission('inventario', 'crear') THEN
    RAISE EXCEPTION '[PERMISSION] Tu rol no puede registrar movimientos de inventario.';
  END IF;
  PERFORM set_config('app.inventory_rpc', '1', true);
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION '[VALIDATION] Cantidad debe ser > 0 (recibido %).', p_cantidad;
  END IF;
  IF p_tipo NOT IN ('entrada', 'salida', 'ajuste') THEN
    RAISE EXCEPTION '[VALIDATION] Tipo no válido: %. Esperado entrada|salida|ajuste.', p_tipo;
  END IF;

  SELECT quantity, warehouse_id INTO v_antes, v_wh
    FROM public.inventario
    WHERE id = p_item_id AND company_id = v_company
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[NOT_FOUND] Insumo no encontrado en el stock de tu empresa.';
  END IF;

  IF p_warehouse_id IS NOT NULL THEN
    PERFORM 1 FROM public.bodegas WHERE id = p_warehouse_id AND company_id = v_company;
    IF NOT FOUND THEN
      RAISE EXCEPTION '[VALIDATION] La bodega indicada no pertenece a tu empresa.';
    END IF;
    v_wh := p_warehouse_id;
  END IF;

  IF p_tipo = 'entrada' THEN
    UPDATE public.inventario SET quantity = quantity + p_cantidad
      WHERE id = p_item_id AND company_id = v_company
      RETURNING quantity INTO v_despues;
  ELSIF p_tipo = 'salida' THEN
    UPDATE public.inventario SET quantity = quantity - p_cantidad
      WHERE id = p_item_id AND company_id = v_company AND quantity >= p_cantidad
      RETURNING quantity INTO v_despues;
    IF NOT FOUND THEN
      RAISE EXCEPTION '[CONFLICT] Stock insuficiente: disponible %, solicitado %.', v_antes, p_cantidad;
    END IF;
  ELSE
    IF p_cantidad = v_antes THEN
      RETURN jsonb_build_object('success', true, 'antes', v_antes, 'despues', v_antes,
                                'cantidad', 0, 'tipo', 'ajuste', 'sin_cambios', true);
    END IF;
    UPDATE public.inventario SET quantity = p_cantidad
      WHERE id = p_item_id AND company_id = v_company
      RETURNING quantity INTO v_despues;
  END IF;

  INSERT INTO public.movimientos_inventario
    (company_id, item_id, cantidad, tipo, antes, despues, motivo, usuario_id, warehouse_id)
  VALUES
    (v_company, p_item_id,
     CASE WHEN p_tipo = 'ajuste' THEN abs(p_cantidad - v_antes) ELSE p_cantidad END,
     p_tipo, v_antes, v_despues, NULLIF(p_motivo, ''), v_user, v_wh);

  RETURN jsonb_build_object('success', true, 'antes', v_antes, 'despues', v_despues,
                            'cantidad', p_cantidad, 'tipo', p_tipo);
END; $$;

-- ── Flag en consumir_inventario_por_aplicacion (cuerpo 058 + 1 línea) ──────────
CREATE OR REPLACE FUNCTION public.consumir_inventario_por_aplicacion(
  p_company_id     UUID,
  p_item_id        UUID,
  p_cantidad       NUMERIC,
  p_usuario_id     TEXT,
  p_warehouse_id   UUID,
  p_lote_id        UUID,
  p_referencia_id  UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_antes NUMERIC;
  v_despues NUMERIC;
  v_item_name TEXT;
  v_min_qty NUMERIC;
  v_unit TEXT;
  v_result JSONB;
BEGIN
  PERFORM public.rpc_assert_tenant_access(p_company_id, p_usuario_id);
  PERFORM set_config('app.inventory_rpc', '1', true);

  SELECT quantity, name, min_quantity, unit INTO v_antes, v_item_name, v_min_qty, v_unit
  FROM public.inventario
  WHERE id = p_item_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Artículo no encontrado en el inventario.';
  END IF;

  UPDATE public.inventario
  SET quantity = quantity - p_cantidad
  WHERE id = p_item_id AND company_id = p_company_id AND quantity >= p_cantidad
  RETURNING quantity INTO v_despues;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[CONFLICT] Stock insuficiente para %: solicitado %, disponible %.', v_item_name, p_cantidad, v_antes;
  END IF;

  INSERT INTO public.movimientos_inventario (
    company_id, item_id, cantidad, tipo, antes, despues, motivo, usuario_id, warehouse_id
  ) VALUES (
    p_company_id, p_item_id, p_cantidad, 'salida', v_antes, v_despues, 'Consumo en Aplicación Agrícola', p_usuario_id, p_warehouse_id
  );

  IF v_despues < v_min_qty THEN
    INSERT INTO public.alertas (company_id, tipo, mensaje)
    VALUES (
      p_company_id,
      'STOCK_MINIMO',
      'Alerta: El stock de ' || v_item_name || ' (' || v_despues || ' ' || v_unit || ') es inferior al mínimo de ' || v_min_qty || ' ' || v_unit || '.'
    );
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'antes', v_antes,
    'despues', v_despues,
    'item', v_item_name
  );

  RETURN v_result;
END; $$;

-- ── Flag en inventory_transfer (cuerpo 061 + 1 línea) ─────────────────────────
CREATE OR REPLACE FUNCTION public.inventory_transfer(
  p_item_id         UUID,
  p_cantidad        NUMERIC,
  p_dest_warehouse  UUID,
  p_motivo          TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_company UUID := public.current_company();
  v_user    TEXT := public.current_user_id();
  o RECORD;
  d_id      UUID;
  d_antes   NUMERIC;
  d_despues NUMERIC;
  o_despues NUMERIC;
  v_motivo  TEXT;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION '[PERMISSION] Sin compañía en sesión.';
  END IF;
  IF NOT public.has_permission('inventario', 'crear') THEN
    RAISE EXCEPTION '[PERMISSION] Tu rol no puede registrar movimientos de inventario.';
  END IF;
  PERFORM set_config('app.inventory_rpc', '1', true);
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION '[VALIDATION] Cantidad debe ser > 0 (recibido %).', p_cantidad;
  END IF;
  IF p_dest_warehouse IS NULL THEN
    RAISE EXCEPTION '[VALIDATION] Bodega destino requerida.';
  END IF;

  SELECT * INTO o FROM public.inventario
    WHERE id = p_item_id AND company_id = v_company FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[NOT_FOUND] Insumo no encontrado en el stock de tu empresa.';
  END IF;
  PERFORM 1 FROM public.bodegas WHERE id = p_dest_warehouse AND company_id = v_company;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[VALIDATION] La bodega destino no pertenece a tu empresa.';
  END IF;
  IF p_dest_warehouse = o.warehouse_id THEN
    RAISE EXCEPTION '[VALIDATION] Origen y destino deben ser bodegas distintas.';
  END IF;

  SELECT id INTO d_id FROM public.inventario
    WHERE company_id = v_company AND warehouse_id = p_dest_warehouse
      AND name = o.name AND unit = o.unit AND id <> o.id
    LIMIT 1;
  IF d_id IS NOT NULL AND d_id < o.id THEN
    BEGIN
      PERFORM 1 FROM public.inventario WHERE id = d_id FOR UPDATE NOWAIT;
    EXCEPTION WHEN lock_not_available THEN
      RAISE EXCEPTION '[CONFLICT] Bodega destino ocupada por otra transferencia, reintenta.';
    END;
  ELSIF d_id IS NOT NULL THEN
    PERFORM 1 FROM public.inventario WHERE id = d_id FOR UPDATE;
  END IF;

  UPDATE public.inventario SET quantity = quantity - p_cantidad
    WHERE id = o.id AND company_id = v_company AND quantity >= p_cantidad
    RETURNING quantity INTO o_despues;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[CONFLICT] Stock insuficiente en origen: disponible %, solicitado %.', o.quantity, p_cantidad;
  END IF;

  v_motivo := '[transferencia] ' || COALESCE(NULLIF(p_motivo, ''), 'sin motivo');
  INSERT INTO public.movimientos_inventario
    (company_id, item_id, cantidad, tipo, antes, despues, motivo, usuario_id, warehouse_id)
  VALUES
    (v_company, o.id, p_cantidad, 'salida', o.quantity, o_despues, v_motivo, v_user, o.warehouse_id);

  IF d_id IS NOT NULL THEN
    UPDATE public.inventario SET quantity = quantity + p_cantidad
      WHERE id = d_id AND company_id = v_company
      RETURNING quantity INTO d_despues;
    SELECT quantity - p_cantidad INTO d_antes FROM public.inventario WHERE id = d_id;
  ELSE
    INSERT INTO public.inventario
      (company_id, name, category, quantity, unit, min_quantity, warehouse_id, lote, registro_ica, comentarios)
    VALUES
      (v_company, o.name, o.category, p_cantidad, o.unit, o.min_quantity, p_dest_warehouse,
       o.lote, o.registro_ica, o.comentarios)
    RETURNING id, quantity INTO d_id, d_despues;
    d_antes := 0;
  END IF;
  INSERT INTO public.movimientos_inventario
    (company_id, item_id, cantidad, tipo, antes, despues, motivo, usuario_id, warehouse_id)
  VALUES
    (v_company, d_id, p_cantidad, 'entrada', d_antes, d_despues, v_motivo, v_user, p_dest_warehouse);

  RETURN jsonb_build_object('success', true,
    'origen', jsonb_build_object('id', o.id, 'antes', o.quantity, 'despues', o_despues),
    'destino', jsonb_build_object('id', d_id, 'antes', d_antes, 'despues', d_despues));
END; $$;

-- (grants de 058/061 se conservan: CREATE OR REPLACE no los altera.)

-- ==============================================================================
-- ROLLBACK DOCUMENTADO (reversión controlada en staging).
-- ------------------------------------------------------------------------------
-- DROP TRIGGER IF EXISTS trg_inventario_guard_quantity ON public.inventario;
-- DROP FUNCTION IF EXISTS public.inventario_guard_quantity();
-- -- RPCs: re-ejecutar 058 + 060 + 061 (versiones sin set_config).
-- ==============================================================================
