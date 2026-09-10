-- ============================================================================
-- C6: clasificacion de inconsistencias historicas. Solo SELECT.
-- Regla: no inventar valores; lo no determinable queda documentado aqui.
-- ============================================================================
WITH base AS (
  SELECT chequeo, registro_id, company_id, ref_id, lote_id
  FROM public.vw_inconsistencias_cadena
),
sev AS (
  SELECT b.*,
    CASE
      WHEN chequeo LIKE '%otra_empresa%' THEN 'CRITICA'
      WHEN chequeo IN ('aplicaciones.sin_lote','cosechas.sin_lote','monitoreos.sin_lote',
        'fertilization_plans.sin_lote','fertilizacion_recomendaciones.sin_lote') THEN 'ALTA'
      WHEN chequeo IN ('lotes.sin_predio','labores.sin_lote','costos.sin_lote',
        'analisis_suelos.sin_predio_lote') THEN 'MEDIA'
      ELSE 'BAJA'
    END AS severidad
  FROM base b
)
SELECT severidad, chequeo, COUNT(*) AS total,
  ARRAY_AGG(registro_id) FILTER (WHERE registro_id IS NOT NULL) AS muestra_ids
FROM sev GROUP BY 1, 2 ORDER BY
  CASE severidad WHEN 'CRITICA' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 ELSE 4 END,
  chequeo;

-- Resumen compuerta C6: CRITICA + ALTA deben ser 0 para planificar endurecimiento.
SELECT (SELECT COUNT(*) FROM public.vw_inconsistencias_cadena
  WHERE chequeo LIKE '%otra_empresa%') AS criticas,
  (SELECT COUNT(*) FROM public.vw_inconsistencias_cadena
  WHERE chequeo IN ('aplicaciones.sin_lote','cosechas.sin_lote','monitoreos.sin_lote',
    'fertilization_plans.sin_lote','fertilizacion_recomendaciones.sin_lote')) AS altas;
