# Remediación — Bloque A (DB) con checkpoints

Regla: **cada migración se verifica individualmente antes de continuar**.
Pegar en Dashboard SQL Editor en orden; tras cada bloque, correr su checkpoint
(queries de solo-lectura incluidas) y continuar solo en verde.

## A0 — Precondición 022-funciones (+037)

Aplicar sección de funciones de `022_functions.sql` (mínimo):
`registrar_costo_lote`, `process_audit_log`, `process_secure_company_id`,
`iniciar/finalizar_labor_maquinaria`, `registrar_mantenimiento_maquinaria`;
luego `037_security_hardening.sql` completo.

```sql
-- Checkpoint A1: existen y con SECURITY/OWNER sanos
select proname from pg_proc where pronamespace='public'::regnamespace
 and proname in ('registrar_costo_lote','process_audit_log',
 'process_secure_company_id','iniciar_labor_maquinaria',
 'finalizar_labor_maquinaria','registrar_mantenimiento_maquinaria');
-- esperado: 6 filas. Si falta alguna: NO continuar (052-00 abortaría).
select tgname, tgenabled from pg_trigger where tgname like '%secure_company_id%';
-- esperado: ≥1 fila por tabla tenant (maquinaria, lotes, ...).
```

**No probar escrituras funcionales todavía** (solo existencia).

## A2 — 037 contexto de seguridad

```sql
select public.current_company(), public.current_role_id(), public.current_user_id();
-- con JWT de app: company UUID válida, rol nombre, sub. Sin JWT: todo NULL
-- (fail-closed 043+). Si vuelve semilla 00000000: sigue 021 viva → avisar.
```

Detectar: NULL inesperados, fallbacks, assumptions de service_role
(`iona` — ninguna función 022/037 debe asumir service_role salvo triggers DEFINER).

## A3 — 048 → 049 → 050 → 051

Aplicar en orden, verificando tras cada una:

```sql
-- 048: funciones + vistas + bucket (bucket se verifica en Storage UI)
select proname from pg_proc where pronamespace='public'::regnamespace
 and proname in ('registrar_evento_trazabilidad','verificar_cadena_lote',
 'verificar_integridad_evento');
-- 049:
select proname from pg_proc where pronamespace='public'::regnamespace
 and proname in ('e2e_verify_evidence_chain','e2e_cleanup_test_run');
-- 050:
select proname from pg_proc where pronamespace='public'::regnamespace
 and proname='tiene_acceso_predio';
select count(*) from pg_policies where policyname like '%predio%';
-- 051:
select proname from pg_proc where pronamespace='public'::regnamespace
 and proname='alcance_operativo';
```

**Existencia real en vivo**, no solo archivos en repo.

## A4 — Hito 052 (+053, +054)

Re-ejecutar `052_maquinaria_contrato.sql` completo (idempotente: guards
052-00/05/09 + `OR REPLACE`), luego 053 y 054. Postflight 052-10 debe terminar
sin EXCEPTION (los NOTICE de cuarentena Q3 se registran, no se ignoran).

```sql
-- 8 RPC + grants mínimos + search_path
select p.proname, pg_get_function_identity_arguments(p.oid),
       (p.proconfig::text like '%search_path%') as has_path,
       p.prosecdef as is_definer
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('registrar_maquinaria',
 'iniciar_jornada_maquinaria','finalizar_jornada_maquinaria',
 'registrar_combustible_maquinaria','programar_mantenimiento_maquinaria',
 'registrar_mantenimiento_maquinaria_v2','actualizar_horometro_maquinaria',
 'registrar_incidencia_maquinaria');
-- esperado: 8 filas (054 redefine iniciar_* con 7 args: verificar firma),
-- has_path=true todas; is_definer=true SOLO v2 y horómetro.
-- triggers: 053 SUSTITUYE mq_estado_trg + mq_sync_status_trg por el unificado
-- mq_sync_legacy_trg (mismas transiciones + alias legacy). NO pedir los parciales.
select tgname from pg_trigger where tgname in ('mq_sync_legacy_trg',
 'mq_immutable_op_trg','mq_immutable_mto_trg','mq_immutable_fuel_trg','mq_immutable_ev_trg');
-- esperado: 5 filas.
-- auditoría 052-09d: nombres audit_maquinaria_<tabla>_trigger (NO audit_mq*).
select tgname, tgrelid::regclass as tabla from pg_trigger
 where tgname like 'audit_maquinaria\_%' escape '\';
-- esperado: 4 filas (operaciones, mantenimientos, combustible, eventos).
NOTIFY pgrst, 'reload schema';
-- registrar: timestamp, proyecto, entorno, resultado. Re-consultar RPC tras ~30s.
```

## Cierre de H-01 (4 niveles, §10 del plan)

- N1 existencia: checkpoint A4 en verde + PostgREST descubre (200/400, no 404).
- N2 ejecución: `remediacion/resondeo.mjs --nivel=2` (errores controlados).
- N3 seguridad: `--nivel=3` (solo tenant/rol correcto ejecuta).
- N4 integridad: `--nivel=4` (estado + evento + auditoría + costo coherentes).
- H-02 se cierra probando triggers directa (UPDATE histórico → error) e
  indirectamente (cada RPC 052 deja evento+auditoría).
