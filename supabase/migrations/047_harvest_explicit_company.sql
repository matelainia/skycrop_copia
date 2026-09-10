-- ==============================================================================
-- SKYCROP 047 H2: overloads con empresa explicita para llamadas service_role
-- Problema: 042 registrar_cosecha/trazabilidad/dashboard son SECURITY INVOKER y
-- derivan empresa de current_company() (JWT). El backend modular llama con
-- supabaseAdmin (service_role sin JWT de usuario): tras 043 (NULL sin fallback)
-- esas RPC levantan 'Empresa no identificada' y el flujo caeria al fallback sin
-- timeline. Las versiones _empresa reciben p_company_id, verifican membresia
-- (rpc_assert_tenant_access) y validan predio/lote. Las originales se conservan
-- para PostgREST directo con JWT de usuario.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.registrar_cosecha_empresa(
  p_company_id UUID,
  p_predio_id UUID,
  p_lote_agricola_id UUID,
  p_cultivo TEXT,
  p_variedad TEXT,
  p_area_cosechada NUMERIC,
  p_cantidad NUMERIC,
  p_unidad TEXT DEFAULT 'kg',
  p_numero_plantas INT DEFAULT NULL,
  p_responsable TEXT DEFAULT NULL,
  p_observaciones TEXT DEFAULT NULL,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_precision_gps NUMERIC DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_user TEXT := COALESCE(p_user_id, public.current_user_id(), 'sistema');
  v_cosecha_id UUID; v_codigo TEXT;
BEGIN
  PERFORM public.rpc_assert_tenant_access(p_company_id, p_user_id);
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'Cantidad debe ser > 0'; END IF;
  IF p_area_cosechada IS NOT NULL AND p_area_cosechada <= 0 THEN RAISE EXCEPTION 'Area debe ser > 0'; END IF;
  IF p_predio_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.predios WHERE id = p_predio_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'Predio no pertenece a la empresa'; END IF;
  IF p_lote_agricola_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.lotes WHERE id = p_lote_agricola_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'Lote agricola no pertenece a la empresa'; END IF;
  v_codigo := public.generar_codigo_cosecha(p_company_id, CURRENT_DATE);
  INSERT INTO public.cosechas(company_id, codigo, predio_id, lote_id, cultivo_variedad, crop, lote,
    area_cosechada, cantidad_cosechada, weight, unidad, numero_plantas, estado,
    responsable_nombre, observaciones, latitud, longitud, precision_gps,
    gps_capturado_en, gps_capturado_por, fecha_cosecha, date)
  VALUES (p_company_id, v_codigo, p_predio_id, p_lote_agricola_id,
    COALESCE(p_variedad, p_cultivo, ''), COALESCE(p_cultivo, p_variedad, ''),
    COALESCE((SELECT codigo_interno FROM public.lotes WHERE id = p_lote_agricola_id), 'SIN-LOTE'),
    p_area_cosechada, p_cantidad, p_cantidad, COALESCE(p_unidad,'kg'), p_numero_plantas, 'REGISTRADA',
    p_responsable, p_observaciones, p_lat, p_lng, p_precision_gps,
    CASE WHEN p_lat IS NOT NULL THEN now() ELSE NULL END,
    CASE WHEN p_lat IS NOT NULL THEN v_user ELSE NULL END, now(), CURRENT_DATE)
  RETURNING id INTO v_cosecha_id;
  IF p_lote_agricola_id IS NOT NULL THEN
    PERFORM public.registrar_historial_actividad(p_company_id, p_lote_agricola_id, 'Cosecha',
      COALESCE(p_responsable, v_user), 'Cosecha '||v_codigo||' registrada: '||p_cantidad||' '||COALESCE(p_unidad,'kg'), NULL);
  END IF;
  RETURN jsonb_build_object('success', true, 'cosecha_id', v_cosecha_id, 'codigo', v_codigo);
END; $$;
REVOKE EXECUTE ON FUNCTION public.registrar_cosecha_empresa(UUID,UUID,UUID,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,INT,TEXT,TEXT,DOUBLE PRECISION,DOUBLE PRECISION,NUMERIC,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_cosecha_empresa(UUID,UUID,UUID,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,INT,TEXT,TEXT,DOUBLE PRECISION,DOUBLE PRECISION,NUMERIC,TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trazabilidad_por_codigo_empresa(p_company_id UUID, p_codigo TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_cosecha RECORD; v_loteprod RECORD; v_result JSONB;
BEGIN
  PERFORM public.rpc_assert_tenant_access(p_company_id, NULL);
  SELECT * INTO v_cosecha FROM public.cosechas WHERE codigo = p_codigo AND company_id = p_company_id;
  IF FOUND THEN
    SELECT jsonb_build_object(
      'tipo','cosecha', 'cosecha', to_jsonb(v_cosecha),
      'predio', (SELECT to_jsonb(p) FROM public.predios p WHERE p.id = v_cosecha.predio_id),
      'lote_agricola', (SELECT to_jsonb(l) FROM public.lotes l WHERE l.id = v_cosecha.lote_id),
      'lotes_producto', (SELECT COALESCE(jsonb_agg(to_jsonb(lp)),'[]'::jsonb) FROM public.lotes_producto lp WHERE lp.cosecha_id = v_cosecha.id),
      'procesos', (SELECT COALESCE(jsonb_agg(to_jsonb(pp) ORDER BY pp.fecha_inicio),'[]'::jsonb) FROM public.procesos_postcosecha pp WHERE pp.cosecha_id = v_cosecha.id),
      'ventas', (SELECT COALESCE(jsonb_agg(to_jsonb(v)),'[]'::jsonb) FROM public.ventas v JOIN public.venta_detalles vd ON vd.venta_id = v.id JOIN public.lotes_producto lp ON lp.id = vd.lote_producto_id WHERE lp.cosecha_id = v_cosecha.id),
      'despachos', (SELECT COALESCE(jsonb_agg(to_jsonb(d)),'[]'::jsonb) FROM public.despachos d WHERE d.lote_producto_id IN (SELECT id FROM public.lotes_producto WHERE cosecha_id = v_cosecha.id))
    ) INTO v_result;
    RETURN v_result;
  END IF;
  SELECT * INTO v_loteprod FROM public.lotes_producto WHERE codigo = p_codigo AND company_id = p_company_id;
  IF FOUND THEN
    SELECT * INTO v_cosecha FROM public.cosechas WHERE id = v_loteprod.cosecha_id;
    SELECT jsonb_build_object(
      'tipo','lote_producto', 'lote_producto', to_jsonb(v_loteprod), 'cosecha', to_jsonb(v_cosecha),
      'predio', (SELECT to_jsonb(p) FROM public.predios p WHERE p.id = v_cosecha.predio_id),
      'lote_agricola', (SELECT to_jsonb(l) FROM public.lotes l WHERE l.id = v_cosecha.lote_id),
      'procesos', (SELECT COALESCE(jsonb_agg(to_jsonb(pp) ORDER BY pp.fecha_inicio),'[]'::jsonb) FROM public.procesos_postcosecha pp WHERE pp.cosecha_id = v_cosecha.id),
      'bodega', (SELECT to_jsonb(b) FROM public.bodegas b WHERE b.id = v_loteprod.bodega_id),
      'ventas', (SELECT COALESCE(jsonb_agg(to_jsonb(v)),'[]'::jsonb) FROM public.ventas v JOIN public.venta_detalles vd ON vd.venta_id = v.id WHERE vd.lote_producto_id = v_loteprod.id),
      'despachos', (SELECT COALESCE(jsonb_agg(to_jsonb(d)),'[]'::jsonb) FROM public.despachos d WHERE d.lote_producto_id = v_loteprod.id)
    ) INTO v_result;
    RETURN v_result;
  END IF;
  RETURN jsonb_build_object('error','Codigo no encontrado');
END; $$;
REVOKE EXECUTE ON FUNCTION public.trazabilidad_por_codigo_empresa(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trazabilidad_por_codigo_empresa(UUID, TEXT) TO authenticated, service_role;
