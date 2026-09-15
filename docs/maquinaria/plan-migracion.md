# Plan de migración — Maquinaria (congelado)

> Secuencia obligatoria: staging → pruebas → aprobación → producción.
> Nunca SQL manual en producción. Todo en migraciones versionadas con rollback.

## 1. Estado actual (verificado)

- Tablas: `maquinaria`, `jornadas_maquinaria` (`015_ejecuciones.sql:7-32,84-103`).
- RPC: `iniciar/finalizar_labor_maquinaria`, `registrar_mantenimiento_maquinaria`
  (`022_functions.sql:323-497`, INVOKER sin hardening).
- RLS: generado `021_rls.sql:128-183`. Índices: `020:20,22,40`.
- Deudas: `status 'En mantenimiento'` (frontend) vs `'Mantenimiento'` (DB);
  lote/operador como texto libre; combustible dentro de jornada; sin eventos;
  permisos frontend mock; `select('*')`; backend sin módulo (proxy directo).
- Release prod vigente excluye 048–051 (`RELEASE_PRODUCCION.md:8-9`); 049 es solo
  aislamiento E2E; 051 excluye maquinaria de scope predio (`051:15-17`).

## 2. Migración propuesta (nueva, ej. `052_maquinaria_contrato.sql`)

1. Crear `maquinaria_operaciones`, `maquinaria_mantenimientos`,
   `maquinaria_combustible`, `maquinaria_eventos` (§2 contrato).
2. Evolucionar `maquinaria`: añadir columnas canónicas (`codigo`, `estado`, …),
   migrar datos (`codigo_id→codigo`, `status→estado` con mapeo
   `'En mantenimiento'→'Mantenimiento'`), backfill `horometro_actual`,
   `UNIQUE(company_id,codigo)`, CHECKs, `updated_at` + trigger.
3. Migrar `jornadas_maquinaria → maquinaria_operaciones`:
   `lot + company → lote_id` (LEFT JOIN `lotes(nombre,company)`; no-match a
   cuarentena `lote_id NULL + lote_nombre` + reporte, nunca inventar FK),
   `operator → operador_id` best-effort contra `trabajadores` + snapshot,
   `start/end_horometro`, estados `En Progreso/Finalizada`.
4. Crear índices §2.6, triggers (`secure_company_id`, inmutabilidad, estados),
   vistas analytics §12, RPC §8 con `SET search_path = public, pg_temp` +
   `REVOKE FROM PUBLIC` + `GRANT TO authenticated`.
5. RLS §9 por tabla/operación + `secure_company_id_trg` extendido.
6. Wrappers legacy DEPRECATED (`iniciar/finalizar_labor_maquinaria`,
   `registrar_mantenimiento_maquinaria`) delegando a las nuevas RPC.
7. Rollback: migración `DOWN` documentada (eliminar wrappers → policies nuevas →
   triggers nuevos → vistas → tablas nuevas; `maquinaria` se revierte por columnas,
   no DROP). Backup pre-migración obligatorio.

## 3. Orden de ejecución

```text
052 SQL (staging) → RLS+grants → RPC → probes tenant → repository/services →
hooks (useFleet/useMachine/...) → components (KPI/table/panel/analytics) →
pages → E2E mock → --live → aprobación → producción
```

Frontend conserva `index.jsx`, `MachineryProvider`, `Machine.js` como shell;
se reescriben repositorios (`select` explícito + paginación server),
permisos (reemplazar mocks), charts (suspender hasta vista analytics).

## 4. Puerta de producción (todos obligatorios)

```text
0 P0 / 0 P1 · RLS PASS · isolation PASS · audit PASS · E2E PASS
```

Incluye: static/preflight, RLS cross-company (A/B/anon/sin permiso),
matriz por rol, sabotaje hostil (forjar company/maquinaria/horómetro/costo,
doble jornada, máquina en mantenimiento, borrar evento), concurrencia,
append-only, paginación, `--live` con regla **PRE-FLIGHT falla → cero escrituras**,
y cleanup (`metadata.test_run_id` patrón 049).
