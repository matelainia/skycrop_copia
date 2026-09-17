-- ==============================================================================
-- SKYCROP DATABASE V2: 061_inventario_transferencia.sql
-- Fase 4 Inventario v2 — transferencia parcial + ocupación derivada (contrato D5).
-- Rama: feat/inventario-ux-v2. Requiere 058 + 059 + 060 aplicadas.
--
-- Semántica aprobada: cantidad parcial; destino = upsert por (name, unit) en la
-- bodega destino (misma empresa); transferencia total = cantidad = stock.
-- Locks en orden determinístico por id (origen+destino) → sin deadlocks.
-- Fila destino nueva nace con sku NULL (el UNIQUE parcial lo permite; el
-- backfill de 059 le asignará SKU en la próxima ejecución o se edita en UI).
-- Los 2 movimientos comparten motivo con prefijo [transferencia].
-- ==============================================================================

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
  o RECORD;             -- origen (bloqueado)
  d_id      UUID;       -- destino (puede no existir)
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
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION '[VALIDATION] Cantidad debe ser > 0 (recibido %).', p_cantidad;
  END IF;
  IF p_dest_warehouse IS NULL THEN
    RAISE EXCEPTION '[VALIDATION] Bodega destino requerida.';
  END IF;

  -- Origen: existe, es de la empresa (lock). Destino: bodega de la empresa.
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

  -- Destino existente: mismo artículo (name+unit) en bodega destino. Si su id
  -- es menor que el origen, liberamos orden: bloqueamos en orden por id.
  SELECT id INTO d_id FROM public.inventario
    WHERE company_id = v_company AND warehouse_id = p_dest_warehouse
      AND name = o.name AND unit = o.unit AND id <> o.id
    LIMIT 1;
  IF d_id IS NOT NULL AND d_id < o.id THEN
    -- Re-bloqueo ordenado: ya tenemos origen; el orden estricto exigiría
    -- bloquear destino primero. Como origen ya está locked, el riesgo de
    -- deadlock solo existe si otra txn lockea destino→origen en orden inverso.
    -- Mitigación: lockear destino con NOWAIT y reintentar como CONFLICT.
    BEGIN
      PERFORM 1 FROM public.inventario WHERE id = d_id FOR UPDATE NOWAIT;
    EXCEPTION WHEN lock_not_available THEN
      RAISE EXCEPTION '[CONFLICT] Bodega destino ocupada por otra transferencia, reintenta.';
    END;
  ELSIF d_id IS NOT NULL THEN
    PERFORM 1 FROM public.inventario WHERE id = d_id FOR UPDATE;
  END IF;

  -- Salida atómica del origen.
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

  -- Entrada al destino (upsert).
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

REVOKE ALL ON FUNCTION public.inventory_transfer(UUID, NUMERIC, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_transfer(UUID, NUMERIC, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_transfer(UUID, NUMERIC, UUID, TEXT) TO authenticated, service_role;

-- ── Ocupación derivada: bodegas.ocupacion_usada = nº artículos ─────────────────
-- Cubre transferencias, altas, bajas y cambios de bodega. Bodegas actualizadas
-- en orden por id (anti-deadlock). Recalcular tras aplicar:
--   UPDATE public.bodegas b SET ocupacion_usada =
--     (SELECT count(*) FROM public.inventario i WHERE i.warehouse_id = b.id);
CREATE OR REPLACE FUNCTION public.inventory_sync_occupancy()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE wh UUID;
BEGIN
  FOR wh IN
    SELECT DISTINCT w FROM (
      SELECT OLD.warehouse_id AS w WHERE TG_OP IN ('UPDATE','DELETE') AND OLD.warehouse_id IS NOT NULL
      UNION
      SELECT NEW.warehouse_id AS w WHERE TG_OP IN ('INSERT','UPDATE') AND NEW.warehouse_id IS NOT NULL
    ) s ORDER BY 1
  LOOP
    UPDATE public.bodegas b SET ocupacion_usada =
      (SELECT count(*) FROM public.inventario i WHERE i.warehouse_id = b.id)
    WHERE b.id = wh;
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_inventario_occupancy ON public.inventario;
CREATE TRIGGER trg_inventario_occupancy
  AFTER INSERT OR UPDATE OF warehouse_id OR DELETE ON public.inventario
  FOR EACH ROW EXECUTE FUNCTION public.inventory_sync_occupancy();

-- Backfill inicial de ocupación (idempotente).
UPDATE public.bodegas b SET ocupacion_usada =
  (SELECT count(*) FROM public.inventario i WHERE i.warehouse_id = b.id);

-- ==============================================================================
-- ROLLBACK DOCUMENTADO (reversión controlada en staging).
-- ------------------------------------------------------------------------------
-- DROP TRIGGER IF EXISTS trg_inventario_occupancy ON public.inventario;
-- DROP FUNCTION IF EXISTS public.inventory_sync_occupancy();
-- DROP FUNCTION IF EXISTS public.inventory_transfer(UUID, NUMERIC, UUID, TEXT);
-- -- ocupacion_usada queda como snapshot; dropear con 059 si se revierte todo:
-- -- ALTER TABLE public.bodegas DROP COLUMN IF EXISTS ocupacion_usada;
-- ==============================================================================
