-- ==============================================================================
-- SKYCROP: verificación 065 + 066 — §10.1 schema + §10.2 RLS (parte automatizable)
-- Uso (dev/staging, rol con lectura de catálogos, p. ej. service_role):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/scripts/verify-costos-065-066.sql
-- Solo lectura (cero escrituras). El aislamiento SELECT entre companies con JWT
-- de usuario (§10.2 manual) va al final como pasos guiados: requiere 2 tokens.
-- ==============================================================================

CREATE TEMP TABLE IF NOT EXISTS costos_checks(check_id TEXT PRIMARY KEY, ok BOOLEAN, detail TEXT);
DELETE FROM costos_checks;

-- ── 10.0 · Dependencias base (037/041/060): sin esto las RPCs fallan en runtime ──
INSERT INTO costos_checks
SELECT 'base_rpc_assert', count(*) = 1, 'rpc_assert_tenant_access(UUID,TEXT) existe'
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'rpc_assert_tenant_access'
  AND pg_get_function_identity_arguments(p.oid) = 'p_company_id uuid, p_user_id text';
INSERT INTO costos_checks
SELECT 'base_assert_fixed', count(*) = 1, 'rpc_assert sin bug text->>unknown (068)'
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'rpc_assert_tenant_access'
  AND pg_get_functiondef(p.oid) NOT LIKE '%v_claims := v_claims::jsonb%';
INSERT INTO costos_checks
SELECT 'no_bare_digest', count(*) = 0, 'funciones costos con digest() de pgcrypto'
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'costos\_%' ESCAPE '\'
  AND pg_get_functiondef(p.oid) LIKE '%digest(%';
INSERT INTO costos_checks
SELECT 'base_tenant_fns', count(*) = 3, 'current_company/current_role_id/has_permission existen'
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('current_company', 'current_role_id', 'has_permission');

-- ── 10.1a · 11 tablas ────────────────────────────────────────────────────────
INSERT INTO costos_checks
SELECT 'tablas_11', count(*) = 11, 'tablas costos_* = ' || count(*)::text
FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'costos\_%' ESCAPE '\';

-- ── 10.1b · company_id en las 10 tenant (def es global) ──────────────────────
INSERT INTO costos_checks
SELECT 'company_id_10', count(*) = 10, 'con company_id = ' || count(*)::text
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'company_id' AND table_name IN (
  'costos_categorias','costos_items','costos_tarifas','costos_eventos','costos_entradas',
  'costos_reglas_asignacion','costos_presupuestos','costos_issues','costos_periodos',
  'costos_indicadores_snapshots');

-- ── 10.1c · columnas §2.1 + entry_hash §2.2 ──────────────────────────────────
INSERT INTO costos_checks
SELECT 'cols_valorizacion', count(*) = 8, 'valued_*/payload_hash = ' || count(*)::text
FROM information_schema.columns
WHERE table_schema='public' AND table_name='costos_eventos'
  AND column_name IN ('valued_unit_price','valued_amount','valued_currency','valued_fx_rate','amount_base','valued_at','allocated_at','payload_hash');
INSERT INTO costos_checks
SELECT 'col_entry_hash', count(*) = 1, 'entry_hash existe'
FROM information_schema.columns
WHERE table_schema='public' AND table_name='costos_entradas' AND column_name='entry_hash';

-- ── 10.1d · unicidades: natural, idemkey parcial, entry_hash parcial ─────────
INSERT INTO costos_checks
SELECT 'uq_natural', count(*) >= 1, 'constraints uq/naturales en eventos'
FROM pg_constraint WHERE conrelid='public.costos_eventos'::regclass AND contype='u';
INSERT INTO costos_checks
SELECT 'uq_idemkey_parcial', count(*) = 1, 'uq_costos_eventos_idemkey parcial'
FROM pg_indexes WHERE schemaname='public' AND indexname='uq_costos_eventos_idemkey' AND indexdef LIKE '%WHERE%';
INSERT INTO costos_checks
SELECT 'uq_entry_hash_parcial', count(*) = 1, 'uq_costos_entradas_entry_hash parcial'
FROM pg_indexes WHERE schemaname='public' AND indexname='uq_costos_entradas_entry_hash' AND indexdef LIKE '%WHERE%';

-- ── 10.1e · checks de estados ────────────────────────────────────────────────
INSERT INTO costos_checks
SELECT 'checks_estados', count(*) >= 4, 'checks estado/tipo/fx/sign'
FROM pg_constraint WHERE conrelid IN ('public.costos_eventos'::regclass,'public.costos_entradas'::regclass)
  AND contype='c';

-- ── 10.1f · RLS activo en las 11 ─────────────────────────────────────────────
INSERT INTO costos_checks
SELECT 'rls_11', count(*) = 11, 'tablas con RLS = ' || count(*)::text
FROM pg_tables t JOIN pg_class c ON c.relname = t.tablename AND c.relnamespace='public'::regnamespace
WHERE t.schemaname='public' AND t.tablename LIKE 'costos\_%' ESCAPE '\' AND c.relrowsecurity;

-- ── 10.1g · policies: 11 SELECT + bloqueos de escritura ──────────────────────
INSERT INTO costos_checks
SELECT 'pol_select_11', count(*) >= 11, 'policies SELECT costos_* = ' || count(*)::text
FROM pg_policies WHERE schemaname='public' AND tablename LIKE 'costos\_%' ESCAPE '\' AND cmd='SELECT' AND policyname LIKE '%select%';
INSERT INTO costos_checks
SELECT 'pol_bloqueo', count(*) >= 12, 'policies no_direct_* = ' || count(*)::text
FROM pg_policies WHERE schemaname='public' AND tablename LIKE 'costos\_%' ESCAPE '\' AND policyname LIKE '%no_direct%';

-- ── 10.1h · vistas security_invoker (§2.3) ───────────────────────────────────
INSERT INTO costos_checks
SELECT 'vistas_invoker', count(*) = 3, 'vistas con security_invoker=true = ' || count(*)::text
FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='v'
  AND relname IN ('v_costo_labor_resumen','v_costo_lote_resumen','v_costo_clase_resumen')
  AND 'security_invoker=true' = ANY(reloptions);

-- ── 10.1i · funciones 066 (6 públicas + 6 privadas) ──────────────────────────
INSERT INTO costos_checks
SELECT 'rpc_publicas_6', count(*) = 6, 'RPCs públicas = ' || count(*)::text
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
  ('costos_register_event','costos_value_event','costos_allocate_event','costos_post_event','costos_reverse_event','costos_recalculate');
INSERT INTO costos_checks
SELECT 'rpc_privadas_10', count(*) = 10, 'helpers privados + cores = ' || count(*)::text
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
  'costos_private_require_perm', 'costos_private_payload_hash',
  'costos_private_valuation_hash', 'costos_private_entry_hash',
  'costos_private_create_issue', 'costos_private_assert_period_open',
  'costos_private_register_core', 'costos_private_value_core',
  'costos_private_allocate_core', 'costos_private_post_core');

-- ── 10.1j · DEFINER + search_path en RPCs ────────────────────────────────────
INSERT INTO costos_checks
SELECT 'rpc_definer_path', count(*) = 22, 'DEFINER con search_path (16×066 + 6×067) = ' || count(*)::text
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND (p.proname LIKE 'costos\_%' ESCAPE '\')
  AND p.prosecdef AND array_to_string(p.proconfig,' ') LIKE '%search_path%';

-- ── 10.1k · grants ledger: service_role sin UPDATE/DELETE en entradas ────────
INSERT INTO costos_checks
SELECT 'grants_ledger', count(*) = 0, 'privilegios UPDATE/DELETE service_role en entradas = ' || count(*)::text
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='costos_entradas' AND grantee='service_role'
  AND privilege_type IN ('UPDATE','DELETE');

-- ── 10.1l · seeds ────────────────────────────────────────────────────────────
INSERT INTO costos_checks
SELECT 'seed_permisos', count(*) >= 6, 'permisos recurso=costos = ' || count(*)::text
FROM public.permisos WHERE recurso='costos';
INSERT INTO costos_checks
SELECT 'seed_indicadores', count(*) >= 16, 'indicadores globales = ' || count(*)::text
FROM public.costos_indicadores_def;

-- ── 10.1m · compat: public.costos + registrar_costo_lote intactos ────────────
INSERT INTO costos_checks
SELECT 'compat_costos', count(*) >= 7, 'columnas legacy costos = ' || count(*)::text
FROM information_schema.columns
WHERE table_schema='public' AND table_name='costos'
  AND column_name IN ('id','company_id','lote_id','concepto','costo','fecha','referencia_tipo','referencia_id');
INSERT INTO costos_checks
SELECT 'compat_rpc_legacy', count(*) = 1, 'registrar_costo_lote existe'
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='registrar_costo_lote';

-- ── 10.1n · FKs dimensionales RESTRICT (§1-FINAL): 18 en eventos+entradas ─────
-- confdeltype 'r' = RESTRICT, 'a' = NO ACTION (ambos aceptables).
INSERT INTO costos_checks
SELECT 'fk_restrict_18', count(*) = 18, 'FKs dimensionales restrictivas = ' || count(*)::text
FROM pg_constraint k
JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1] AND array_length(k.conkey, 1) = 1
WHERE k.conrelid IN ('public.costos_eventos'::regclass, 'public.costos_entradas'::regclass)
  AND k.contype = 'f' AND k.confdeltype IN ('r', 'a')
  AND a.attname IN ('predio_id','lote_id','labor_id','operacion_id','maquinaria_id',
                    'inventario_id','trabajador_id','cosecha_id','venta_id');

-- ── 10.1o · adaptador maquinaria 067: funciones + 6 triggers ──────────────────
INSERT INTO costos_checks
SELECT 'adapter_fns', count(DISTINCT p.proname) = 10, 'funciones adaptador+cores = ' || count(DISTINCT p.proname)::text
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'costos_private_register_core', 'costos_private_value_core',
  'costos_private_allocate_core', 'costos_private_post_core',
  'costos_adapter_drive', 'costos_adapter_emit',
  'costos_trg_operacion_finalizada', 'costos_trg_combustible_insert',
  'costos_trg_mantenimiento_completado', 'costos_trg_fuente_guard');
INSERT INTO costos_checks
SELECT 'adapter_triggers', count(*) = 6, 'triggers adaptador (3 costo + 3 guardia, enabled) = ' || count(*)::text
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND t.tgname IN (
  'trg_costos_op_finalizada', 'trg_costos_combustible', 'trg_costos_mantenimiento',
  'trg_costos_guard_op', 'trg_costos_guard_comb', 'trg_costos_guard_mant')
  AND NOT t.tgisinternal AND t.tgenabled = 'O';

-- ── 10.1p · P0: sin EXECUTE para authenticated/anon/PUBLIC en internas ────────
INSERT INTO costos_checks
SELECT 'adapter_no_exec', count(*) = 0, 'grants EXECUTE a roles bajos en internas = ' || count(*)::text
FROM information_schema.role_routine_grants
WHERE specific_schema = 'public' AND grantee IN ('authenticated', 'anon', 'PUBLIC')
  AND routine_name IN (
  'costos_private_register_core', 'costos_private_value_core',
  'costos_private_allocate_core', 'costos_private_post_core',
  'costos_private_require_perm', 'costos_private_payload_hash',
  'costos_private_valuation_hash', 'costos_private_entry_hash',
  'costos_private_create_issue', 'costos_private_assert_period_open',
  'costos_adapter_drive', 'costos_adapter_emit',
  'costos_trg_operacion_finalizada', 'costos_trg_combustible_insert',
  'costos_trg_mantenimiento_completado', 'costos_trg_fuente_guard');

-- ── 10.1q · P0: sin backdoor GUC (ninguna función referencia costos.adapter) ──
INSERT INTO costos_checks
SELECT 'no_guc_backdoor', count(*) = 0, 'funciones con GUC costos.adapter = ' || count(*)::text
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'costos\_%' ESCAPE '\'
  AND pg_get_functiondef(p.oid) LIKE '%costos.adapter%';

-- ── 10.1r · trigger fns rechazan invocación manual (pg_trigger_depth) ────────
INSERT INTO costos_checks
SELECT 'trigger_depth_guards', count(*) = 4, 'fns trigger con depth guard = ' || count(*)::text
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'costos_trg_operacion_finalizada', 'costos_trg_combustible_insert',
  'costos_trg_mantenimiento_completado', 'costos_trg_fuente_guard')
  AND pg_get_functiondef(p.oid) LIKE '%pg_trigger_depth()%';

-- ── 10.1s · API directa sigue exigiendo permiso (4 RPCs con require_perm) ────
INSERT INTO costos_checks
SELECT 'api_still_gated', count(*) = 4, 'RPCs públicas con require_perm = ' || count(*)::text
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'costos_register_event', 'costos_value_event',
  'costos_allocate_event', 'costos_post_event')
  AND pg_get_functiondef(p.oid) LIKE '%costos_private_require_perm%';

-- ── 10.1t · issue types del adaptador aceptados ───────────────────────────────INSERT INTO costos_checks
SELECT 'issues_adapter_types', count(*) = 1, 'check con adapter_failure/source_changed/missing_fuel'
FROM pg_constraint
WHERE conrelid = 'public.costos_issues'::regclass AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%adapter_failure%'
  AND pg_get_constraintdef(oid) LIKE '%source_changed_after_post%'
  AND pg_get_constraintdef(oid) LIKE '%missing_fuel_data%';

-- ── 10.1u · guard bloquea transición terminal con costo vigente ───────────────
INSERT INTO costos_checks
SELECT 'guard_terminal_block', count(*) = 1, 'guard con bloqueo Finalizada/Completado'
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'costos_trg_fuente_guard'
  AND pg_get_functiondef(p.oid) LIKE '%Finalizada%'
  AND pg_get_functiondef(p.oid) LIKE '%Completado%'
  AND pg_get_functiondef(p.oid) LIKE '%source_locked%';

-- ── Resumen ──────────────────────────────────────────────────────────────────
SELECT check_id, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS resultado, detail
FROM costos_checks ORDER BY check_id;
SELECT count(*) FILTER (WHERE ok) || '/' || count(*) AS passed FROM costos_checks;

-- ==============================================================================
-- §10.2 MANUAL (requiere 2 JWTs de usuario de distintas companies A y B):
-- 1) Con JWT-A: SELECT * FROM costos_eventos; → solo filas company A.
-- 2) Con JWT-A: SELECT * FROM costos_eventos donde company B (service_role
--    inserta 1 fila B antes) → 0 filas.
-- 3) Con JWT-A: INSERT INTO costos_eventos (...) → ERROR (policy WITH CHECK false).
-- 4) Con JWT-A: INSERT INTO costos_entradas (...) → ERROR.
-- 5) Con JWT-A: SELECT * FROM v_costo_lote_resumen; → sin filas de B.
-- 6) Sin permiso costos/leer (rol operario): SELECT → 0 filas.
-- 7) RPC directa con JWT-A: SELECT costos_register_event('company-B', ...) →
--    ERROR ACCESO_DENEGADO (rpc_assert_tenant_access anti-IDOR).
-- ==============================================================================
