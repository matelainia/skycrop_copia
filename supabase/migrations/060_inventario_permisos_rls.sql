-- ==============================================================================
-- SKYCROP DATABASE V2: 060_inventario_permisos_rls.sql
-- Fase 3 Inventario v2 — permisos granulares (contrato-v2.md §D6).
-- Rama: feat/inventario-ux-v2. Requiere 058 + 059 aplicadas.
--
-- Vocabulario: el de la tabla permisos (006): recurso + accion en español,
-- alineado con el frontend (hasPermission(recurso,'leer'|'crear'|...)).
--   inventory.view       → (inventario, leer)      + (bodegas, leer)*
--   inventory.create     → (inventario, crear)
--   inventory.update     → (inventario, editar)
--   inventory.delete     → (inventario, eliminar)  (suave; físico solo admin)
--   inventory.movements  → (inventario, crear)     (registrar movimiento)
--   inventory.export     → (inventario, leer)      (+ auditoría en endpoint)
--   warehouses.view      → (bodegas, leer)
--   warehouses.manage    → (bodegas, todo)
--   (*) ver un artículo exige ver su bodega (JOIN implícito en UI).
--
-- Seeds (contrato §D6): ingeniero += crear/editar + bodegas leer;
-- supervisor += bodegas leer (movimientos: solo si negocio lo pide);
-- admin/gerente ya cubiertos por (*,todo); resto sin cambios.
-- ==============================================================================

-- ── 1. has_permission(recurso, accion) sobre permisos (respeta * / todo) ─────
CREATE OR REPLACE FUNCTION public.has_permission(p_recurso TEXT, p_accion TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_role TEXT := public.current_role_id();
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.permisos
    WHERE rol_id = v_role
      AND (recurso = p_recurso OR recurso = '*')
      AND (accion = p_accion OR accion IN ('todo', '*'))
  );
END; $$;

REVOKE ALL ON FUNCTION public.has_permission(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT, TEXT) TO authenticated, service_role;

-- ── 2. Seeds de permisos (idempotentes) ──────────────────────────────────────
INSERT INTO public.permisos (rol_id, recurso, accion) VALUES
  ('ingeniero',  'inventario', 'crear'),
  ('ingeniero',  'inventario', 'editar'),
  ('ingeniero',  'bodegas',    'leer'),
  ('supervisor', 'bodegas',    'leer')
ON CONFLICT (rol_id, recurso, accion) DO NOTHING;

-- ── 3. RLS refinado: compañía + permiso (nombres de políticas según 021) ─────
-- inventario (tiene deleted_at → SELECT con borrado suave, se conserva).
DROP POLICY IF EXISTS inventario_select_policy ON public.inventario;
CREATE POLICY inventario_select_policy ON public.inventario FOR SELECT TO authenticated
USING (company_id = public.current_company()
   AND public.has_permission('inventario', 'leer')
   AND (deleted_at IS NULL OR public.current_role_id() = 'administrador' OR deleted_by = public.current_user_id()));

DROP POLICY IF EXISTS inventario_insert_policy ON public.inventario;
CREATE POLICY inventario_insert_policy ON public.inventario FOR INSERT TO authenticated
WITH CHECK (company_id = public.current_company()
        AND public.has_permission('inventario', 'crear'));

DROP POLICY IF EXISTS inventario_update_policy ON public.inventario;
CREATE POLICY inventario_update_policy ON public.inventario FOR UPDATE TO authenticated
USING (company_id = public.current_company()
   AND public.has_permission('inventario', 'editar'))
WITH CHECK (company_id = public.current_company()
        AND public.has_permission('inventario', 'editar'));

DROP POLICY IF EXISTS inventario_delete_policy ON public.inventario;
CREATE POLICY inventario_delete_policy ON public.inventario FOR DELETE TO authenticated
USING (company_id = public.current_company()
   AND public.has_permission('inventario', 'eliminar'));

-- bodegas (sin deleted_at).
DROP POLICY IF EXISTS bodegas_select_policy ON public.bodegas;
CREATE POLICY bodegas_select_policy ON public.bodegas FOR SELECT TO authenticated
USING (company_id = public.current_company()
   AND public.has_permission('bodegas', 'leer'));

DROP POLICY IF EXISTS bodegas_insert_policy ON public.bodegas;
CREATE POLICY bodegas_insert_policy ON public.bodegas FOR INSERT TO authenticated
WITH CHECK (company_id = public.current_company()
        AND public.has_permission('bodegas', 'todo'));

DROP POLICY IF EXISTS bodegas_update_policy ON public.bodegas;
CREATE POLICY bodegas_update_policy ON public.bodegas FOR UPDATE TO authenticated
USING (company_id = public.current_company()
   AND public.has_permission('bodegas', 'todo'))
WITH CHECK (company_id = public.current_company()
        AND public.has_permission('bodegas', 'todo'));

DROP POLICY IF EXISTS bodegas_delete_policy ON public.bodegas;
CREATE POLICY bodegas_delete_policy ON public.bodegas FOR DELETE TO authenticated
USING (company_id = public.current_company()
   AND public.has_permission('bodegas', 'todo'));

-- movimientos: SELECT exige ver inventario. INSERT/UPDATE/DELETE ya revocados
-- en 058 (políticas insert/update/delete quedan como defensa en profundidad y
-- se refinan igual por si se re-otorgan en el futuro).
DROP POLICY IF EXISTS movimientos_inventario_select_policy ON public.movimientos_inventario;
CREATE POLICY movimientos_inventario_select_policy ON public.movimientos_inventario FOR SELECT TO authenticated
USING (company_id = public.current_company()
   AND public.has_permission('inventario', 'leer'));

DROP POLICY IF EXISTS movimientos_inventario_insert_policy ON public.movimientos_inventario;
CREATE POLICY movimientos_inventario_insert_policy ON public.movimientos_inventario FOR INSERT TO authenticated
WITH CHECK (company_id = public.current_company()
        AND public.has_permission('inventario', 'crear'));

DROP POLICY IF EXISTS movimientos_inventario_update_policy ON public.movimientos_inventario;
CREATE POLICY movimientos_inventario_update_policy ON public.movimientos_inventario FOR UPDATE TO authenticated
USING (company_id = public.current_company()
   AND public.has_permission('inventario', 'editar'))
WITH CHECK (company_id = public.current_company()
        AND public.has_permission('inventario', 'editar'));

DROP POLICY IF EXISTS movimientos_inventario_delete_policy ON public.movimientos_inventario;
CREATE POLICY movimientos_inventario_delete_policy ON public.movimientos_inventario FOR DELETE TO authenticated
USING (company_id = public.current_company()
   AND public.has_permission('inventario', 'eliminar'));

-- ── 4. RPC de stock exigen permiso de movimiento ─────────────────────────────
-- (defensa en profundidad: la UI oculta el botón, el backend decide).
-- Se añade al inicio de registrar_movimiento_inventario (058) tras el chequeo
-- de compañía, con: IF NOT public.has_permission('inventario','crear') THEN
-- RAISE EXCEPTION '[PERMISSION] ...'; END IF;
-- NOTA: se aplica como ALTER separado para no reescribir 058 (idempotente).
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
-- (grants de 058 se conservan: CREATE OR REPLACE no los altera.)

-- ==============================================================================
-- ROLLBACK DOCUMENTADO (reversión controlada en staging).
-- ------------------------------------------------------------------------------
-- DELETE FROM public.permisos WHERE (rol_id,recurso,accion) IN
--   (('ingeniero','inventario','crear'),('ingeniero','inventario','editar'),
--    ('ingeniero','bodegas','leer'),('supervisor','bodegas','leer'));
-- DROP FUNCTION IF EXISTS public.has_permission(TEXT, TEXT);
-- -- políticas: re-ejecutar 021_rls.sql §5 (bloque DO de políticas generales).
-- -- registrar_movimiento_inventario: re-ejecutar 058 (versión sin chequeo).
-- ==============================================================================
