-- ============================================================================
-- STAGING CHECKS 043-047. Solo SELECT (salvo el bloque 043.D de lectura sin JWT).
-- Uso: ejecutar por bloques en el SQL Editor de STAGING tras cada migracion.
-- Cada fila: check_name | expected | actual | status. Todo debe ser PASS.
-- ============================================================================

-- ── 043.A C3: sin fallback semilla ──────────────────────────────────────────
SELECT '043.A1 current_company sin JWT devuelve NULL' AS check_name,
  'NULL' AS expected, COALESCE(public.current_company()::TEXT, 'NULL') AS actual,
  CASE WHEN public.current_company() IS NULL THEN 'PASS' ELSE 'FAIL' END AS status
UNION ALL
SELECT '043.A2 current_user_id sin JWT devuelve NULL',
  'NULL', COALESCE(public.current_user_id(), 'NULL'),
  CASE WHEN public.current_user_id() IS NULL THEN 'PASS' ELSE 'FAIL' END;

-- ── 043.B C3: grants (anon revocado en helpers) ─────────────────────────────
SELECT '043.B1 anon ejecuta current_company' AS check_name,
  'f' AS expected, has_function_privilege('anon', 'public.current_company()', 'EXECUTE')::TEXT AS actual,
  CASE WHEN NOT has_function_privilege('anon', 'public.current_company()', 'EXECUTE') THEN 'PASS' ELSE 'FAIL' END AS status
UNION ALL
SELECT '043.B2 anon ejecuta current_user_id',
  'f', has_function_privilege('anon', 'public.current_user_id()', 'EXECUTE')::TEXT,
  CASE WHEN NOT has_function_privilege('anon', 'public.current_user_id()', 'EXECUTE') THEN 'PASS' ELSE 'FAIL' END AS status;

-- ── 043.C C1: RLS recomendaciones ───────────────────────────────────────────
SELECT '043.C1 policies fert_rec (4)' AS check_name, '4' AS expected,
  COUNT(*)::TEXT AS actual,
  CASE WHEN COUNT(*) = 4 THEN 'PASS' ELSE 'FAIL' END AS status
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fertilizacion_recomendaciones'
UNION ALL
SELECT '043.C2 policies fert_rec_detalle (4)', '4', COUNT(*)::TEXT,
  CASE WHEN COUNT(*) = 4 THEN 'PASS' ELSE 'FAIL' END
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fertilizacion_recomendacion_detalle'
UNION ALL
SELECT '043.C3 unique global code eliminado', '0', COUNT(*)::TEXT,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM pg_constraint WHERE conname = 'fertilizacion_recomendaciones_code_key'
UNION ALL
SELECT '043.C4 unique(company,code) existe', '1', COUNT(*)::TEXT,
  CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END
FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_fert_rec_company_code';

-- ── 043.D C2: snapshots/events con tenant ───────────────────────────────────
SELECT '043.D1 eval SELECT policies (7)' AS check_name, '7' AS expected,
  COUNT(*)::TEXT AS actual,
  CASE WHEN COUNT(*) = 7 THEN 'PASS' ELSE 'FAIL' END AS status
FROM pg_policies WHERE schemaname = 'public'
  AND tablename IN ('evaluation_snapshots','evaluation_snapshot_variables','evaluation_snapshot_rules',
    'evaluation_snapshot_thresholds','evaluation_snapshot_alerts',
    'evaluation_snapshot_recommendations','evaluation_events')
  AND cmd = 'SELECT'
UNION ALL
SELECT '043.D2 ningun USING(true) en eval SELECT', '0', COUNT(*)::TEXT,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM pg_policies WHERE schemaname = 'public'
  AND tablename IN ('evaluation_snapshots','evaluation_snapshot_variables','evaluation_snapshot_rules',
    'evaluation_snapshot_thresholds','evaluation_snapshot_alerts',
    'evaluation_snapshot_recommendations','evaluation_events')
  AND cmd = 'SELECT' AND qual = 'true';

-- ── 043.E H1: triggers ──────────────────────────────────────────────────────
SELECT '043.E1 validate_lote_predio_trg (>=10 tablas)' AS check_name, '>=10' AS expected,
  COUNT(DISTINCT tgrelid::regclass::TEXT)::TEXT AS actual,
  CASE WHEN COUNT(DISTINCT tgrelid::regclass) >= 10 THEN 'PASS' ELSE 'FAIL' END AS status
FROM pg_trigger WHERE tgname = 'validate_lote_predio_trg' AND NOT tgisinternal;

-- ── 044.A C4: audit append-only ─────────────────────────────────────────────
SELECT '044.A1 columnas tabla/registro_id/metadata' AS check_name, '3' AS expected,
  COUNT(*)::TEXT AS actual,
  CASE WHEN COUNT(*) = 3 THEN 'PASS' ELSE 'FAIL' END AS status
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'audit_logs'
  AND column_name IN ('tabla','registro_id','metadata')
UNION ALL
SELECT '044.A2 policies audit_logs (solo SELECT+INSERT)', 'SELECT,INSERT',
  STRING_AGG(cmd::TEXT, ',' ORDER BY cmd::TEXT),
  CASE WHEN COUNT(*) = 2
    AND BOOL_AND(cmd::TEXT IN ('SELECT','INSERT')) THEN 'PASS' ELSE 'FAIL' END
FROM (SELECT DISTINCT cmd FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'audit_logs') p
UNION ALL
SELECT '044.A3 trigger inmutable existe', '1', COUNT(*)::TEXT,
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END
FROM pg_trigger WHERE tgname = 'audit_logs_immutable_trg' AND NOT tgisinternal;

-- ── 044.B C5: RPC reescrita ─────────────────────────────────────────────────
SELECT '044.B1 guardar_evaluacion_completa usa esquema 019' AS check_name,
  'contiene modulo+tablas sin detalles' AS expected,
  CASE WHEN prosrc LIKE '%modulo%' AND prosrc LIKE '%audit_logs%'
    AND prosrc NOT LIKE '%detalles%' THEN 'ok' ELSE 'revisar' END AS actual,
  CASE WHEN prosrc LIKE '%modulo%' AND prosrc LIKE '%audit_logs%'
    AND prosrc NOT LIKE '%detalles%' THEN 'PASS' ELSE 'FAIL' END AS status
FROM pg_proc WHERE proname = 'guardar_evaluacion_completa';

-- ── 045 C6: reporte ─────────────────────────────────────────────────────────
SELECT '045.1 vista+funcion reporte' AS check_name, '2' AS expected,
  (COUNT(*)::TEXT) AS actual,
  CASE WHEN COUNT(*) = 2 THEN 'PASS' ELSE 'FAIL' END AS status
FROM (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='vw_inconsistencias_cadena'
  UNION ALL SELECT 1 FROM pg_proc WHERE proname='reporte_integridad_lotes') x;

-- ── 046 atomicos ────────────────────────────────────────────────────────────
SELECT '046.1 tabla contadores + 6 generadores con serie' AS check_name,
  'tabla=1, fns=6' AS expected,
  'tabla=' || (SELECT COUNT(*)::TEXT FROM pg_tables WHERE schemaname='public' AND tablename='codigo_contadores')
  || ', fns=' || (SELECT COUNT(*)::TEXT FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'generar_codigo\_%'
    AND p.prosrc LIKE '%reservar_codigo_serie%') AS actual,
  CASE WHEN (SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND tablename='codigo_contadores') = 1
    AND (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname LIKE 'generar_codigo\_%'
      AND p.prosrc LIKE '%reservar_codigo_serie%') = 6 THEN 'PASS' ELSE 'FAIL' END AS status;

-- ── 047 H2 overloads ────────────────────────────────────────────────────────
SELECT '047.1 overloads _empresa existen' AS check_name, '2' AS expected,
  COUNT(*)::TEXT AS actual,
  CASE WHEN COUNT(*) = 2 THEN 'PASS' ELSE 'FAIL' END AS status
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('registrar_cosecha_empresa','trazabilidad_por_codigo_empresa');
