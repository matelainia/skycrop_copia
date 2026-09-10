-- ============================================================================
-- SNAPSHOT de esquema para diff prod vs staging. Solo SELECT. Ejecutar en ambos,
-- exportar CSV y: diff prod_schema.csv staging_schema.csv
-- El diff debe contener EXACTAMENTE los objetos 043-047, nada mas.
-- ============================================================================
-- 1. Policies (con definicion completa: USING / WITH CHECK importan)
SELECT 'POLICY' AS kind,
  schemaname || '.' || tablename || '.' || policyname AS name,
  ('FOR ' || cmd || ' TO ' || roles::TEXT || ' USING (' || COALESCE(qual,'') || ') WITH CHECK (' || COALESCE(with_check,'') || ')') AS def
FROM pg_policies WHERE schemaname = 'public'
UNION ALL
-- 2. Funciones (nombre + argumentos + search_path/config)
SELECT 'FUNCTION',
  n.nspname || '.' || p.proname || '(' || pg_get_function_arguments(p.oid) || ')',
  COALESCE((SELECT STRING_AGG(setconfig, ';' ORDER BY setconfig)
    FROM pg_proc_config(p.oid)), '')
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
UNION ALL
-- 3. Triggers de usuario (tabla + evento + funcion)
SELECT 'TRIGGER',
  tgrelid::regclass::TEXT || '.' || tgname,
  pg_get_triggerdef(oid)::TEXT
FROM pg_trigger WHERE NOT tgisinternal
  AND tgrelid::regclass::TEXT LIKE 'public.%'
UNION ALL
-- 4. Indices + constraints unicos
SELECT 'INDEX', schemaname || '.' || indexname, indexdef
FROM pg_indexes WHERE schemaname = 'public'
ORDER BY 1, 2;
