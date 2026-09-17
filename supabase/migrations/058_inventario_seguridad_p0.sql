-- ==============================================================================
-- SKYCROP DATABASE V2: 058_inventario_seguridad_p0.sql
-- Hotfix P0 Inventario y Bodegas (rama fix/inventario-seguridad-p0)
-- Aprobado: S1+S2+S3. Alcance: SOLO seguridad, cero cambios de UX.
--
-- S1: revoke de escrituras directas a movimientos_inventario (solo RPC escribe).
--     Impacto verificado (grep 2026-09-16): frontend solo SELECT + rpc()
--     (inventoryMovementService.js:5,22); backend solo SELECT vía service_role
--     (SupabaseTraceabilityRepository.js:620-628, bypass RLS, no afectado).
--     Las 2 funciones INVOKER que insertan (registrar_movimiento_inventario,
--     registrar_movimiento_bodega) se convierten a DEFINER en esta misma
--     migración; consumir_inventario_por_aplicacion ya era DEFINER.
-- S2: integridad cross-tenant declarativa (FK compuesta por companyía).
--     Pre-chequeo de huérfanos: la migración FALLA con reporte si existen
--     (nunca borrado automático; decidir aparte y reintentar).
-- S3: RPC atómica con lock de fila + salida condicional (sin stock negativo).
--     Hallazgo que la motiva: la v1 usaba GREATEST(0, antes-cantidad) → dos
--     salidas concurrentes tenían éxito silencioso y el stock quedaba en 0.
--     Se añade tipo 'ajuste' (conteo físico absoluto, ya permitido por el
--     CHECK de 042). 'transferencia' parcial queda para Fase 4 (upsert destino
--     + doble lock; ver contrato-v2 D5).
--
-- PREFLIGHT STAGING (solo lectura, ejecutar antes de aplicar):
--   SELECT (SELECT count(*) FROM public.inventario) AS inv,
--          (SELECT count(*) FROM public.bodegas) AS bod,
--          (SELECT count(*) FROM public.movimientos_inventario) AS mov;
--   -- huérfanos que bloquearían S2:
--   SELECT 'inv_bodega' AS caso, count(*) FROM public.inventario i
--    LEFT JOIN public.bodegas b ON b.id = i.warehouse_id
--    WHERE i.warehouse_id IS NOT NULL AND b.id IS NULL;
--   SELECT 'inv_bodega_tenant' AS caso, count(*) FROM public.inventario i
--    JOIN public.bodegas b ON b.id = i.warehouse_id
--    WHERE b.company_id <> i.company_id;
--   SELECT 'mov_item' AS caso, count(*) FROM public.movimientos_inventario m
--    LEFT JOIN public.inventario i ON i.id = m.item_id
--    WHERE i.id IS NULL;
--   SELECT 'mov_item_tenant' AS caso, count(*) FROM public.movimientos_inventario m
--    JOIN public.inventario i ON i.id = m.item_id
--    WHERE i.company_id <> m.company_id;
--   SELECT 'mov_bodega_tenant' AS caso, count(*) FROM public.movimientos_inventario m
--    JOIN public.bodegas b ON b.id = m.warehouse_id
--    WHERE b.company_id <> m.company_id;
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- S1 · Solo RPC escribe movimientos (SELECT sigue abierto por RLS vigente)
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE INSERT, UPDATE, DELETE ON public.movimientos_inventario FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.movimientos_inventario FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.movimientos_inventario FROM PUBLIC;

-- ─────────────────────────────────────────────────────────────────────────────
-- S2 · Pre-chequeo de huérfanos (falla con reporte, no borra nada)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  c_inv_bodega        INT;
  c_inv_bodega_tenant INT;
  c_mov_item          INT;
  c_mov_item_tenant   INT;
  c_mov_bodega_tenant INT;
BEGIN
  SELECT count(*) INTO c_inv_bodega FROM public.inventario i
    LEFT JOIN public.bodegas b ON b.id = i.warehouse_id
    WHERE i.warehouse_id IS NOT NULL AND b.id IS NULL;
  SELECT count(*) INTO c_inv_bodega_tenant FROM public.inventario i
    JOIN public.bodegas b ON b.id = i.warehouse_id
    WHERE b.company_id <> i.company_id;
  SELECT count(*) INTO c_mov_item FROM public.movimientos_inventario m
    LEFT JOIN public.inventario i ON i.id = m.item_id
    WHERE i.id IS NULL;
  SELECT count(*) INTO c_mov_item_tenant FROM public.movimientos_inventario m
    JOIN public.inventario i ON i.id = m.item_id
    WHERE i.company_id <> m.company_id;
  SELECT count(*) INTO c_mov_bodega_tenant FROM public.movimientos_inventario m
    JOIN public.bodegas b ON b.id = m.warehouse_id
    WHERE b.company_id <> m.company_id;

  IF (c_inv_bodega + c_inv_bodega_tenant + c_mov_item + c_mov_item_tenant + c_mov_bodega_tenant) > 0 THEN
    RAISE EXCEPTION 'S2 BLOQUEADO por huérfanos: inv_bodega=% inv_bodega_tenant=% mov_item=% mov_item_tenant=% mov_bodega_tenant=%. Ver docs/inventario/hotfix-p0.md §rollback.',
      c_inv_bodega, c_inv_bodega_tenant, c_mov_item, c_mov_item_tenant, c_mov_bodega_tenant;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- S2 · UNIQUEs tenant + FKs compuestas (idempotente: DROP IF EXISTS + ADD)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.bodegas DROP CONSTRAINT IF EXISTS uq_bodegas_company_id;
ALTER TABLE public.bodegas ADD CONSTRAINT uq_bodegas_company_id UNIQUE (company_id, id);

ALTER TABLE public.inventario DROP CONSTRAINT IF EXISTS uq_inventario_company_id;
ALTER TABLE public.inventario ADD CONSTRAINT uq_inventario_company_id UNIQUE (company_id, id);

ALTER TABLE public.inventario DROP CONSTRAINT IF EXISTS fk_inventario_bodega_tenant;
ALTER TABLE public.inventario ADD CONSTRAINT fk_inventario_bodega_tenant
  FOREIGN KEY (company_id, warehouse_id) REFERENCES public.bodegas (company_id, id)
  ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
-- NOTA: warehouse_id NULL salta la FK (bodega sin asignar permitido, igual que hoy).

ALTER TABLE public.movimientos_inventario DROP CONSTRAINT IF EXISTS fk_mov_item_tenant;
ALTER TABLE public.movimientos_inventario ADD CONSTRAINT fk_mov_item_tenant
  FOREIGN KEY (company_id, item_id) REFERENCES public.inventario (company_id, id)
  ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE public.movimientos_inventario DROP CONSTRAINT IF EXISTS fk_mov_warehouse_tenant;
ALTER TABLE public.movimientos_inventario ADD CONSTRAINT fk_mov_warehouse_tenant
  FOREIGN KEY (company_id, warehouse_id) REFERENCES public.bodegas (company_id, id)
  ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

-- ─────────────────────────────────────────────────────────────────────────────
-- S3 · registrar_movimiento_inventario atómica (entrada/salida/ajuste)
-- Firma idéntica a la v1: el frontend actual (adjustStock) sigue funcionando.
-- Contrato de errores por prefijo: [VALIDATION] [PERMISSION] [NOT_FOUND] [CONFLICT]
-- ─────────────────────────────────────────────────────────────────────────────
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
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION '[VALIDATION] Cantidad debe ser > 0 (recibido %).', p_cantidad;
  END IF;
  IF p_tipo NOT IN ('entrada', 'salida', 'ajuste') THEN
    RAISE EXCEPTION '[VALIDATION] Tipo no válido: %. Esperado entrada|salida|ajuste.', p_tipo;
  END IF;

  -- Lock de fila + verificación de tenant (una sola lectura).
  SELECT quantity, warehouse_id INTO v_antes, v_wh
    FROM public.inventario
    WHERE id = p_item_id AND company_id = v_company
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[NOT_FOUND] Insumo no encontrado en el stock de tu empresa.';
  END IF;

  -- Bodega efectiva: la del parámetro si se indica (pertenencia verificada),
  -- si no, la del artículo. La FK compuesta S2 es la garantía final.
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
    -- Salida condicional atómica: 0 filas = conflicto (concurrencia o stock).
    UPDATE public.inventario SET quantity = quantity - p_cantidad
      WHERE id = p_item_id AND company_id = v_company AND quantity >= p_cantidad
      RETURNING quantity INTO v_despues;
    IF NOT FOUND THEN
      RAISE EXCEPTION '[CONFLICT] Stock insuficiente: disponible %, solicitado %.', v_antes, p_cantidad;
    END IF;
  ELSE -- ajuste: p_cantidad es el conteo físico absoluto.
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

REVOKE ALL ON FUNCTION public.registrar_movimiento_inventario(UUID, NUMERIC, VARCHAR, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_movimiento_inventario(UUID, NUMERIC, VARCHAR, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_movimiento_inventario(UUID, NUMERIC, VARCHAR, TEXT, UUID) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- S3 · consumir_inventario_por_aplicacion: mismo endurecimiento (era DEFINER
-- con TOCTOU: SELECT sin lock + UPDATE sin condición). Firma intacta.
-- ─────────────────────────────────────────────────────────────────────────────
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

REVOKE ALL ON FUNCTION public.consumir_inventario_por_aplicacion(UUID, UUID, NUMERIC, TEXT, UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consumir_inventario_por_aplicacion(UUID, UUID, NUMERIC, TEXT, UUID, UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.consumir_inventario_por_aplicacion(UUID, UUID, NUMERIC, TEXT, UUID, UUID, UUID) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- S1 (impacto) · registrar_movimiento_bodega pasa a DEFINER: tras el REVOKE,
-- su INSERT interno fallaría como INVOKER. Además se corrige el item
-- placeholder (antes: SELECT sin company + sin guard NOT FOUND).
-- Comportamiento y firma intactos; transferencia parcial real → Fase 4.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_movimiento_bodega(
  p_lote_producto_id UUID,
  p_bodega_id UUID,
  p_cantidad NUMERIC,
  p_tipo TEXT,
  p_motivo TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_company UUID:=public.current_company(); v_user TEXT:=public.current_user_id();
  v_actual NUMERIC; v_nuevo NUMERIC; v_lote RECORD; v_item UUID;
BEGIN
  IF v_company IS NULL THEN RAISE EXCEPTION '[PERMISSION] Sin compañía en sesión.'; END IF;
  IF p_tipo NOT IN ('entrada','salida','transferencia','transformacion','merma','reserva','ajuste','ajuste_calidad') THEN RAISE EXCEPTION 'Tipo movimiento inválido: %', p_tipo; END IF;
  IF p_cantidad IS NULL OR p_cantidad <=0 THEN RAISE EXCEPTION 'Cantidad debe ser >0'; END IF;
  SELECT * INTO v_lote FROM public.lotes_producto WHERE id=p_lote_producto_id AND company_id=v_company FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote producto no encontrado'; END IF;
  IF p_bodega_id IS NOT NULL THEN
    PERFORM 1 FROM public.bodegas WHERE id=p_bodega_id AND company_id=v_company;
    IF NOT FOUND THEN RAISE EXCEPTION '[VALIDATION] La bodega destino no pertenece a tu empresa.'; END IF;
  END IF;
  v_actual:=v_lote.peso_actual;
  IF p_tipo IN ('salida','merma','reserva') THEN
    IF v_actual < p_cantidad THEN RAISE EXCEPTION 'Stock insuficiente lote %: disponible %, solicitado %', v_lote.codigo, v_actual, p_cantidad; END IF;
    v_nuevo:=v_actual - p_cantidad;
  ELSIF p_tipo='entrada' THEN
    v_nuevo:=v_actual + p_cantidad;
  ELSE
    v_nuevo:=v_actual;
  END IF;
  UPDATE public.lotes_producto SET peso_actual=v_nuevo, merma_acumulada = CASE WHEN p_tipo='merma' THEN COALESCE(merma_acumulada,0)+p_cantidad ELSE merma_acumulada END, bodega_id=COALESCE(p_bodega_id, bodega_id), estado = CASE WHEN p_tipo='merma' AND v_nuevo=0 THEN 'MERMADO' WHEN p_tipo='entrada' THEN 'ALMACENADO' ELSE estado END, updated_at=now() WHERE id=p_lote_producto_id;
  SELECT id INTO v_item FROM public.inventario WHERE company_id=v_company LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION '[VALIDATION] La empresa no tiene artículos de inventario para referenciar el movimiento.'; END IF;
  INSERT INTO public.movimientos_inventario(company_id, item_id, cantidad, tipo, antes, despues, motivo, usuario_id, warehouse_id, lote_producto_id, cosecha_id)
  VALUES (v_company, v_item, p_cantidad, p_tipo, v_actual, v_nuevo, COALESCE(p_motivo, 'Movimiento bodega lote '||v_lote.codigo), v_user, p_bodega_id, p_lote_producto_id, v_lote.cosecha_id);
  RETURN jsonb_build_object('success',true,'antes',v_actual,'despues',v_nuevo,'lote',v_lote.codigo);
EXCEPTION WHEN OTHERS THEN RAISE; END; $$;

REVOKE ALL ON FUNCTION public.registrar_movimiento_bodega(UUID, UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_movimiento_bodega(UUID, UUID, NUMERIC, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_movimiento_bodega(UUID, UUID, NUMERIC, TEXT, TEXT) TO authenticated, service_role;

-- ==============================================================================
-- ROLLBACK DOCUMENTADO (no ejecutar salvo reversión controlada en staging).
-- Orden inverso. La v1 de registrar_movimiento_inventario se restaura
-- re-ejecutando 022_functions.sql §4.4 (tenía GREATEST: solo como puente,
-- reintroduce el bug de concurrencia; preferir forward-fix).
-- ------------------------------------------------------------------------------
-- GRANT INSERT, UPDATE, DELETE ON public.movimientos_inventario TO authenticated;
-- ALTER TABLE public.movimientos_inventario DROP CONSTRAINT IF EXISTS fk_mov_warehouse_tenant;
-- ALTER TABLE public.movimientos_inventario DROP CONSTRAINT IF EXISTS fk_mov_item_tenant;
-- ALTER TABLE public.inventario DROP CONSTRAINT IF EXISTS fk_inventario_bodega_tenant;
-- ALTER TABLE public.inventario DROP CONSTRAINT IF EXISTS uq_inventario_company_id;
-- ALTER TABLE public.bodegas DROP CONSTRAINT IF EXISTS uq_bodegas_company_id;
-- -- funciones: re-ejecutar 022 §4.4 + 037 §4/5 + 042 §11.3 (versiones previas).
-- ==============================================================================
