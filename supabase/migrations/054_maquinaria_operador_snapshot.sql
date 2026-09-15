-- ==============================================================================
-- SKYCROP DATABASE V2: 054_maquinaria_operador_snapshot.sql
-- Evolución compatible de iniciar_jornada_maquinaria (contrato §2.2: la columna
-- operador_nombre es snapshot histórico y admite texto cuando el operador aún
-- no existe en Talento Humano). La firma 052 exigía operador_id resoluble y
-- caía a 'Sin asignar' perdiendo el texto que la UI actual envía.
-- Cambio: nuevo parámetro opcional p_operador_nombre; si p_operador_id es NULL
-- se conserva el texto como snapshot (trazabilidad intacta, FK NULL = Q2).
-- La UI del paso 9 ofrecerá selector de trabajadores + creación inline; este
-- puente evita romper el flujo actual (regresión paso 7) mientras tanto.
-- Idempotente. Solo staging hasta puerta en verde.
-- ==============================================================================

-- 054-00 PRECONDITIONS (052/053 aplicadas).
DO $pre$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'iniciar_jornada_maquinaria') THEN
    RAISE EXCEPTION '054-00 ABORT: falta iniciar_jornada_maquinaria — aplicar 052 antes';
  END IF;
  RAISE NOTICE '[054-00] OK.';
END $pre$;

-- 054-01 Recrea la función con p_operador_nombre (misma lógica 052-07.2 + snapshot).
DROP FUNCTION IF EXISTS public.iniciar_jornada_maquinaria(UUID,UUID,UUID,TEXT,TIMESTAMPTZ,NUMERIC);

CREATE OR REPLACE FUNCTION public.iniciar_jornada_maquinaria(
  p_maquinaria_id UUID, p_operador_id UUID, p_lote_id UUID, p_labor TEXT,
  p_inicio TIMESTAMPTZ, p_horometro_inicio NUMERIC, p_operador_nombre TEXT DEFAULT NULL
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
    -- Puente paso 8: conserva el texto libre como snapshot histórico (Q2).
    v_trab_nom := COALESCE(NULLIF(btrim(p_operador_nombre), ''), 'Sin asignar');
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
REVOKE ALL ON FUNCTION public.iniciar_jornada_maquinaria(UUID,UUID,UUID,TEXT,TIMESTAMPTZ,NUMERIC,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.iniciar_jornada_maquinaria(UUID,UUID,UUID,TEXT,TIMESTAMPTZ,NUMERIC,TEXT) TO authenticated;
COMMENT ON FUNCTION public.iniciar_jornada_maquinaria(UUID,UUID,UUID,TEXT,TIMESTAMPTZ,NUMERIC,TEXT)
  IS '054: firma con p_operador_nombre snapshot (puente paso 8). Ver contrato §2.2/§8.';

-- 054-02 Postflight.
DO $post$ BEGIN
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'iniciar_jornada_maquinaria' AND p.pronargs = 7;
  IF NOT FOUND THEN RAISE EXCEPTION '054-02 FAIL: firma 7-param no creada'; END IF;
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'iniciar_jornada_maquinaria'
    AND (p.proconfig IS NULL OR NOT (p.proconfig::text LIKE '%search_path%'));
  IF FOUND THEN RAISE EXCEPTION '054-02 FAIL: sin SET search_path'; END IF;
  RAISE NOTICE '[054-02] OK.';
END $post$;

-- ROLLBACK: re-ejecutar 052-07.2 (firma 6-param) tras DROP de esta firma.
