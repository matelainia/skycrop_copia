-- ==============================================================================
-- SKYCROP 045: C6 reporte de integridad lote/predio (SOLO LECTURA, sin endurecer)
-- Orden usuario: 1) identificar NULL/huerfanos/cross-empresa 2) reportar
-- 3) resolver 4) despues endurecer. No inventar datos: NULL sigue siendo NULL.
-- Resiliente: la vista se construye SOLO con las tablas/columnas que existan.
-- Si la base no tiene 040/042 (ej. staging incompleto), esas ramas se omiten y
-- el reporte indica cobertura parcial en output.cobertura. No crea
-- traceability_events.
-- ==============================================================================

-- Helper temporal: existe tabla + columnas (se elimina al final del archivo).
CREATE OR REPLACE FUNCTION public._stg_tiene_columnas(p_table TEXT, p_cols TEXT[])
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$ SELECT COALESCE(
  (SELECT array_agg(c.column_name::TEXT) FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.table_name = p_table), '{}') @> p_cols $$;

DO $do$
DECLARE v_sql TEXT := '';
BEGIN
  IF public._stg_tiene_columnas('lotes', ARRAY['company_id','predio_id']) THEN
    v_sql := v_sql || $$SELECT 'lotes.sin_predio', l.id, l.company_id, l.predio_id, NULL::UUID FROM public.lotes l WHERE l.predio_id IS NULL$$ || ' UNION ALL ';
  END IF;
  IF public._stg_tiene_columnas('aplicaciones', ARRAY['company_id','lote_id']) THEN
    v_sql := v_sql || $$SELECT 'aplicaciones.sin_lote', a.id, a.company_id, NULL::UUID, NULL::UUID FROM public.aplicaciones a WHERE a.lote_id IS NULL$$ || ' UNION ALL ';
  END IF;
  IF public._stg_tiene_columnas('monitoreos', ARRAY['company_id','lote_id']) THEN
    v_sql := v_sql || $$SELECT 'monitoreos.sin_lote', m.id, m.company_id, NULL::UUID, NULL::UUID FROM public.monitoreos m WHERE m.lote_id IS NULL$$ || ' UNION ALL ';
  END IF;
  IF public._stg_tiene_columnas('cosechas', ARRAY['company_id','lote_id']) THEN
    v_sql := v_sql || $$SELECT 'cosechas.sin_lote', c.id, c.company_id, NULL::UUID, NULL::UUID FROM public.cosechas c WHERE c.lote_id IS NULL$$ || ' UNION ALL ';
  END IF;
  IF public._stg_tiene_columnas('labores', ARRAY['company_id','lote_id']) THEN
    v_sql := v_sql || $$SELECT 'labores.sin_lote', l.id, l.company_id, NULL::UUID, NULL::UUID FROM public.labores l WHERE l.lote_id IS NULL$$ || ' UNION ALL ';
  END IF;
  IF public._stg_tiene_columnas('costos', ARRAY['company_id','lote_id']) THEN
    v_sql := v_sql || $$SELECT 'costos.sin_lote', c.id, c.company_id, NULL::UUID, NULL::UUID FROM public.costos c WHERE c.lote_id IS NULL$$ || ' UNION ALL ';
  END IF;
  IF public._stg_tiene_columnas('fertilization_plans', ARRAY['company_id','lote_id']) THEN
    v_sql := v_sql || $$SELECT 'fertilization_plans.sin_lote', p.id, p.company_id, NULL::UUID, NULL::UUID FROM public.fertilization_plans p WHERE p.lote_id IS NULL$$ || ' UNION ALL ';
  END IF;
  IF public._stg_tiene_columnas('fertilizacion_recomendaciones', ARRAY['company_id','lote_id']) THEN
    v_sql := v_sql || $$SELECT 'fertilizacion_recomendaciones.sin_lote', r.id, r.company_id, NULL::UUID, NULL::UUID FROM public.fertilizacion_recomendaciones r WHERE r.lote_id IS NULL$$ || ' UNION ALL ';
  END IF;
  IF public._stg_tiene_columnas('analisis_suelos', ARRAY['company_id','predio_id','lote_id']) THEN
    v_sql := v_sql || $$SELECT 'analisis_suelos.sin_predio_lote', a.id, a.company_id, a.predio_id, a.lote_id FROM public.analisis_suelos a WHERE a.predio_id IS NULL AND a.lote_id IS NULL$$ || ' UNION ALL ';
  END IF;
  IF public._stg_tiene_columnas('lotes', ARRAY['company_id','predio_id'])
     AND public._stg_tiene_columnas('predios', ARRAY['company_id']) THEN
    v_sql := v_sql || $$SELECT 'lotes.predio_otra_empresa', l.id, l.company_id, l.predio_id, NULL::UUID FROM public.lotes l JOIN public.predios p ON p.id = l.predio_id AND p.company_id IS DISTINCT FROM l.company_id$$ || ' UNION ALL ';
  END IF;
  IF public._stg_tiene_columnas('aplicaciones', ARRAY['company_id','lote_id'])
     AND public._stg_tiene_columnas('lotes', ARRAY['company_id']) THEN
    v_sql := v_sql || $$SELECT 'aplicaciones.lote_otra_empresa', a.id, a.company_id, a.lote_id, a.lote_id FROM public.aplicaciones a JOIN public.lotes l ON l.id = a.lote_id AND l.company_id IS DISTINCT FROM a.company_id$$ || ' UNION ALL ';
  END IF;
  IF public._stg_tiene_columnas('monitoreos', ARRAY['company_id','lote_id'])
     AND public._stg_tiene_columnas('lotes', ARRAY['company_id']) THEN
    v_sql := v_sql || $$SELECT 'monitoreos.lote_otra_empresa', m.id, m.company_id, m.lote_id, m.lote_id FROM public.monitoreos m JOIN public.lotes l ON l.id = m.lote_id AND l.company_id IS DISTINCT FROM m.company_id$$ || ' UNION ALL ';
  END IF;
  IF public._stg_tiene_columnas('cosechas', ARRAY['company_id','lote_id'])
     AND public._stg_tiene_columnas('lotes', ARRAY['company_id']) THEN
    v_sql := v_sql || $$SELECT 'cosechas.lote_otra_empresa', c.id, c.company_id, c.lote_id, c.lote_id FROM public.cosechas c JOIN public.lotes l ON l.id = c.lote_id AND l.company_id IS DISTINCT FROM c.company_id$$ || ' UNION ALL ';
  END IF;
  IF public._stg_tiene_columnas('lotes_producto', ARRAY['company_id','lote_agricola_id'])
     AND public._stg_tiene_columnas('lotes', ARRAY['company_id']) THEN
    v_sql := v_sql || $$SELECT 'lotes_producto.lote_agricola_otra_empresa', lp.id, lp.company_id, lp.lote_agricola_id, lp.lote_agricola_id FROM public.lotes_producto lp JOIN public.lotes l ON l.id = lp.lote_agricola_id AND l.company_id IS DISTINCT FROM lp.company_id$$ || ' UNION ALL ';
  END IF;

  IF v_sql = '' THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.vw_inconsistencias_cadena AS '
      || 'SELECT NULL::TEXT AS chequeo, NULL::UUID AS registro_id, NULL::UUID AS company_id, '
      || 'NULL::UUID AS ref_id, NULL::UUID AS lote_id WHERE false';
  ELSE
    v_sql := LEFT(v_sql, LENGTH(v_sql) - LENGTH(' UNION ALL '));
    EXECUTE 'CREATE OR REPLACE VIEW public.vw_inconsistencias_cadena AS ' || v_sql;
  END IF;
END $do$;

DROP FUNCTION IF EXISTS public._stg_tiene_columnas(TEXT, TEXT[]);

COMMENT ON VIEW public.vw_inconsistencias_cadena IS
  'C6 045: union solo de ramas cuyas tablas/columnas existen. Columnas: chequeo, registro_id, company_id, ref_id, lote_id.';

CREATE OR REPLACE FUNCTION public.reporte_integridad_lotes()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_company UUID := public.current_company(); v_out JSONB; v_ramas INT;
BEGIN
  SELECT COUNT(*) INTO v_ramas FROM (
    SELECT DISTINCT chequeo FROM public.vw_inconsistencias_cadena) r;
  SELECT json_build_object(
    'company_id', v_company,
    'generado_en', timezone('utc'::text, now()),
    'ramas_activas', v_ramas,
    'cobertura', CASE WHEN v_ramas < 14
      THEN 'PARCIAL: faltan tablas base (ver 001-042). Ramas ausentes no evaluadas.'
      ELSE 'COMPLETA' END,
    'resumen', (SELECT json_agg(t) FROM (
      SELECT chequeo, COUNT(*) AS total FROM public.vw_inconsistencias_cadena
      WHERE company_id = v_company OR (v_company IS NULL AND company_id IS NULL)
      GROUP BY chequeo ORDER BY chequeo) t),
    'nota', 'Resolver registros listados antes de endurecer NOT NULL. No inventar lote/predio.'
  ) INTO v_out;
  RETURN v_out;
END; $$;
REVOKE EXECUTE ON FUNCTION public.reporte_integridad_lotes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reporte_integridad_lotes() TO authenticated, service_role;
