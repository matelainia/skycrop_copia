-- ==============================================================================
-- SKYCROP STAGING: 052_validacion.sql
-- Verificación post-aplicación de 052_maquinaria_contrato.sql (paso 6 del plan).
-- Devuelve UNA SOLA TABLA de resultados (el editor solo muestra el último
-- resultset). Ejecutar el archivo completo de una vez y copiar todas las filas.
-- Sondas P1–P6 incluidas: son autolimpiables, no dejan residuos.
-- RLS conductual y RPC funcionales requieren JWT de usuario: harness backend
-- (verify_tenant_isolation.js) y --live, no este script.
-- Al terminar, borrar el helper: DROP FUNCTION public.tmp_validar_052();
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.tmp_validar_052()
RETURNS TABLE(seccion TEXT, chequeo TEXT, estado TEXT, detalle TEXT)
LANGUAGE plpgsql SET search_path = public, pg_temp AS $f$
DECLARE
  r RECORD;
  v_falt TEXT[];
  v_maq INT; v_jor INT; v_op INT; v_q3 INT; v_q1 INT; v_q2 INT; v_q4 INT;
  v_id UUID; v_c UUID; v_j UUID;
BEGIN
  -- A. Tablas + RLS + n° policies.
  FOR r IN SELECT v.t AS tab,
      (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename=v.t) AS rls,
      (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=v.t) AS npol
    FROM (VALUES ('maquinaria'),('maquinaria_operaciones'),('maquinaria_mantenimientos'),
                 ('maquinaria_combustible'),('maquinaria_eventos')) AS v(t)
    ORDER BY 1 LOOP
    seccion := 'A'; chequeo := 'tabla ' || r.tab;
    IF r.rls IS TRUE THEN estado := 'PASS'; ELSE estado := 'FAIL'; END IF;
    detalle := 'rls=' || COALESCE(r.rls::text, 'AUSENTE') || ' policies=' || COALESCE(r.npol, 0);
    RETURN NEXT;
  END LOOP;

  -- A2. Columnas canónicas en maquinaria.
  SELECT array_agg(c) INTO v_falt FROM (VALUES
    ('codigo'),('nombre'),('estado'),('tipo'),('horometro_actual'),('activo'),('updated_at')) AS v(c)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='maquinaria' AND column_name=v.c);
  seccion := 'A'; chequeo := 'columnas canonicas';
  IF v_falt IS NOT NULL THEN estado := 'FAIL'; detalle := array_to_string(v_falt, ', ');
  ELSE estado := 'PASS'; detalle := '7/7 presentes'; END IF;
  RETURN NEXT;

  -- B. Conteos migración (solo filas migradas; excluye seed/sondas post-migración).
  SELECT count(*) INTO v_maq FROM public.maquinaria;
  SELECT count(*) INTO v_jor FROM public.jornadas_maquinaria;
  SELECT count(*) INTO v_op FROM public.maquinaria_operaciones WHERE created_by = 'migracion-052';
  SELECT count(*) INTO v_q3 FROM public.jornadas_maquinaria WHERE maquinaria_id IS NULL;
  seccion := 'B'; chequeo := 'conteos migracion';
  IF v_op = v_jor - v_q3 THEN estado := 'PASS'; ELSE estado := 'FAIL'; END IF;
  detalle := 'maquinaria=' || v_maq || ' jornadas=' || v_jor || ' ops=' || v_op || ' q3=' || v_q3;
  RETURN NEXT;

  -- B2. Cuarentenas.
  SELECT count(*) INTO v_q1 FROM public.maquinaria_operaciones WHERE lote_id IS NULL;
  SELECT count(*) INTO v_q2 FROM public.maquinaria_operaciones WHERE operador_id IS NULL;
  SELECT count(*) INTO v_q4 FROM public.maquinaria WHERE tipo = 'Otro';
  seccion := 'B'; chequeo := 'cuarentenas Q1/Q2/Q4';
  estado := 'INFO';
  detalle := 'Q1_lote_NULL=' || v_q1 || ' Q2_operador_NULL=' || v_q2 || ' Q4_tipo_Otro=' || v_q4;
  RETURN NEXT;
  FOR r IN SELECT DISTINCT type AS t, count(*) AS n FROM public.maquinaria
    WHERE tipo = 'Otro' GROUP BY 1 ORDER BY 2 DESC LIMIT 10 LOOP
    seccion := 'B'; chequeo := 'Q4 detalle'; estado := 'INFO';
    detalle := r.t || ' n=' || r.n;
    RETURN NEXT;
  END LOOP;

  -- C. Constraints e índices 052.
  SELECT count(*) INTO v_maq FROM pg_constraint WHERE conname LIKE '%_052';
  seccion := 'C'; chequeo := 'constraints *_052';
  IF v_maq >= 5 THEN estado := 'PASS'; ELSE estado := 'FAIL'; END IF;
  detalle := 'n=' || v_maq || ' esperado>=5';
  RETURN NEXT;
  SELECT count(*) INTO v_maq FROM pg_indexes WHERE schemaname='public' AND indexname LIKE '%_052';
  seccion := 'C'; chequeo := 'indices *_052';
  IF v_maq >= 11 THEN estado := 'PASS'; ELSE estado := 'FAIL'; END IF;
  detalle := 'n=' || v_maq || ' esperado>=11';
  RETURN NEXT;

  -- D. Policies por tabla (una fila por policy).
  FOR r IN SELECT tablename, policyname, cmd::text AS op FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('maquinaria_operaciones','maquinaria_mantenimientos','maquinaria_combustible','maquinaria_eventos')
    ORDER BY 1, 2 LOOP
    seccion := 'D'; chequeo := r.tablename || ' ' || r.policyname; estado := 'INFO'; detalle := r.op;
    RETURN NEXT;
  END LOOP;

  -- E. RPC: seguridad + search_path + grant authenticated + sin PUBLIC/anon.
  FOR r IN SELECT p.proname AS fn, p.prosecdef AS definer,
      (p.proconfig::text LIKE '%search_path%') AS sp,
      EXISTS (SELECT 1 FROM information_schema.role_routine_grants g
        WHERE g.specific_schema='public' AND g.routine_name=p.proname AND g.grantee='authenticated') AS g_auth,
      EXISTS (SELECT 1 FROM information_schema.role_routine_grants g
        WHERE g.specific_schema='public' AND g.routine_name=p.proname AND g.grantee IN ('PUBLIC','anon')) AS g_pub
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname IN
      ('registrar_maquinaria','iniciar_jornada_maquinaria','finalizar_jornada_maquinaria',
       'registrar_combustible_maquinaria','programar_mantenimiento_maquinaria',
       'registrar_mantenimiento_maquinaria_v2','actualizar_horometro_maquinaria',
       'registrar_incidencia_maquinaria','mq_assert_rol')
    ORDER BY 1 LOOP
    seccion := 'E'; chequeo := r.fn;
    IF r.sp AND r.g_auth AND NOT r.g_pub THEN estado := 'PASS'; ELSE estado := 'FAIL'; END IF;
    detalle := CASE WHEN r.definer THEN 'DEFINER' ELSE 'INVOKER' END
      || ' sp=' || r.sp || ' auth=' || r.g_auth || ' public=' || r.g_pub;
    RETURN NEXT;
  END LOOP;

  -- F. Legacy intacto + DEPRECATED.
  FOR r IN SELECT p.proname AS fn,
      (obj_description(p.oid, 'pg_proc') LIKE 'DEPRECATED%') AS dep
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname IN
      ('iniciar_labor_maquinaria','finalizar_labor_maquinaria','registrar_mantenimiento_maquinaria') LOOP
    seccion := 'F'; chequeo := 'legacy ' || r.fn;
    IF r.dep THEN estado := 'PASS'; ELSE estado := 'FAIL'; END IF;
    detalle := 'deprecated=' || r.dep;
    RETURN NEXT;
  END LOOP;

  -- G. Triggers por tabla.
  FOR r IN SELECT event_object_table AS t, count(*) AS n FROM information_schema.triggers
    WHERE trigger_schema='public' AND event_object_table IN
      ('maquinaria','maquinaria_operaciones','maquinaria_mantenimientos','maquinaria_combustible','maquinaria_eventos')
    GROUP BY 1 ORDER BY 1 LOOP
    seccion := 'G'; chequeo := 'triggers ' || r.t; estado := 'INFO'; detalle := 'n=' || r.n;
    RETURN NEXT;
  END LOOP;

  -- H. Vistas + fleet summary.
  FOR r IN SELECT table_name AS v FROM information_schema.views WHERE table_schema='public'
    AND table_name IN ('vw_maquinaria_fleet_summary','vw_maquinaria_analytics') LOOP
    seccion := 'H'; chequeo := 'vista ' || r.v; estado := 'PASS'; detalle := 'existe';
    RETURN NEXT;
  END LOOP;
  FOR r IN SELECT * FROM public.vw_maquinaria_fleet_summary LIMIT 10 LOOP
    seccion := 'H'; chequeo := 'fleet ' || left(r.company_id::text, 8); estado := 'INFO';
    detalle := 'total=' || r.total || ' disp=' || r.disponibles || ' oper=' || r.operando
      || ' mto=' || r.mantenimiento || ' fuera=' || r.fuera_servicio;
    RETURN NEXT;
  END LOOP;

  -- P1: transición inválida Operando → Mantenimiento bloqueada (restaura estado).
  seccion := 'P1'; chequeo := 'transicion invalida bloqueada';
  SELECT id INTO v_id FROM public.maquinaria m WHERE m.estado='Disponible' LIMIT 1;
  IF v_id IS NULL THEN estado := 'SKIP'; detalle := 'sin máquina Disponible';
  ELSE
    UPDATE public.maquinaria SET estado='Operando' WHERE id=v_id;
    BEGIN
      UPDATE public.maquinaria SET estado='Mantenimiento' WHERE id=v_id;
      estado := 'FAIL'; detalle := 'transición permitida';
    EXCEPTION WHEN OTHERS THEN
      estado := 'PASS'; detalle := SQLERRM;
    END;
    UPDATE public.maquinaria SET estado='Disponible' WHERE id=v_id;
  END IF;
  RETURN NEXT;

  -- P2: UPDATE en Finalizada bloqueado.
  seccion := 'P2'; chequeo := 'Finalizada inmutable';
  SELECT id INTO v_id FROM public.maquinaria_operaciones o WHERE o.estado='Finalizada' LIMIT 1;
  IF v_id IS NULL THEN estado := 'SKIP'; detalle := 'sin Finalizadas';
  ELSE
    BEGIN
      UPDATE public.maquinaria_operaciones SET notas='sonda-052' WHERE id=v_id;
      estado := 'FAIL'; detalle := 'UPDATE permitido';
    EXCEPTION WHEN OTHERS THEN
      estado := 'PASS'; detalle := SQLERRM;
    END;
  END IF;
  RETURN NEXT;

  -- P3: UPDATE en eventos bloqueado.
  seccion := 'P3'; chequeo := 'eventos append-only';
  SELECT id INTO v_id FROM public.maquinaria_eventos LIMIT 1;
  IF v_id IS NULL THEN estado := 'SKIP'; detalle := 'sin eventos (conductual en --live)';
  ELSE
    BEGIN
      UPDATE public.maquinaria_eventos SET payload='{}' WHERE id=v_id;
      estado := 'FAIL'; detalle := 'UPDATE permitido';
    EXCEPTION WHEN OTHERS THEN
      estado := 'PASS'; detalle := SQLERRM;
    END;
  END IF;
  RETURN NEXT;

  -- P4: doble jornada bloqueada (autolimpia).
  seccion := 'P4'; chequeo := 'doble jornada bloqueada';
  SELECT id, company_id INTO v_id, v_c FROM public.maquinaria m
  WHERE m.estado='Disponible'
    AND NOT EXISTS (SELECT 1 FROM public.maquinaria_operaciones o WHERE o.maquinaria_id=m.id AND o.estado='En Progreso')
  LIMIT 1;
  IF v_id IS NULL THEN estado := 'SKIP'; detalle := 'sin máquina Disponible libre';
  ELSE
    INSERT INTO public.maquinaria_operaciones
      (company_id, maquinaria_id, operador_nombre, labor, lote_nombre, inicio, horometro_inicio, estado, created_by)
    VALUES (v_c, v_id, 'sonda', 'sonda', 'sonda', now(), 0, 'En Progreso', 'sonda-052')
    RETURNING id INTO v_j;
    BEGIN
      INSERT INTO public.maquinaria_operaciones
        (company_id, maquinaria_id, operador_nombre, labor, lote_nombre, inicio, horometro_inicio, estado, created_by)
      VALUES (v_c, v_id, 'sonda', 'sonda', 'sonda', now(), 0, 'En Progreso', 'sonda-052');
      estado := 'FAIL'; detalle := 'doble En Progreso permitido';
    EXCEPTION WHEN OTHERS THEN
      estado := 'PASS'; detalle := SQLERRM;
    END;
    DELETE FROM public.maquinaria_operaciones WHERE id=v_j;
  END IF;
  RETURN NEXT;

  -- P5: CHECK horómetro (no escribe).
  seccion := 'P5'; chequeo := 'horometro regresivo bloqueado';
  SELECT id, company_id INTO v_id, v_c FROM public.maquinaria LIMIT 1;
  IF v_id IS NULL THEN estado := 'SKIP'; detalle := 'sin maquinaria';
  ELSE
    BEGIN
      INSERT INTO public.maquinaria_operaciones
        (company_id, maquinaria_id, operador_nombre, labor, lote_nombre, inicio, fin,
         horometro_inicio, horometro_fin, estado, created_by)
      VALUES (v_c, v_id, 'sonda', 'sonda', 'sonda', now(), now(), 100, 50, 'Finalizada', 'sonda-052');
      estado := 'FAIL'; detalle := 'regresivo permitido';
    EXCEPTION WHEN OTHERS THEN
      estado := 'PASS'; detalle := SQLERRM;
    END;
  END IF;
  RETURN NEXT;

  -- P6: CHECK combustible (no escribe).
  seccion := 'P6'; chequeo := 'cantidad negativa bloqueada';
  SELECT id, company_id INTO v_id, v_c FROM public.maquinaria LIMIT 1;
  IF v_id IS NULL THEN estado := 'SKIP'; detalle := 'sin maquinaria';
  ELSE
    BEGIN
      INSERT INTO public.maquinaria_combustible
        (company_id, maquinaria_id, cantidad, costo_unitario, costo_total, horometro, created_by)
      VALUES (v_c, v_id, -5, 10, -50, 0, 'sonda-052');
      estado := 'FAIL'; detalle := 'negativa permitida';
    EXCEPTION WHEN OTHERS THEN
      estado := 'PASS'; detalle := SQLERRM;
    END;
  END IF;
  RETURN NEXT;
END $f$;

SELECT * FROM public.tmp_validar_052();

-- Borrar el helper DESPUÉS de copiar los resultados:
-- DROP FUNCTION public.tmp_validar_052();
