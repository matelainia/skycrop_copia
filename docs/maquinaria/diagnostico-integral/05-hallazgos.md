# F10/F12 — Hallazgos y remediación (ordenados por severidad)

**Estado remediación código (rama `diagnostico/maquinaria-integral`, build web PASS,
backend reiniciado): H-03, H-04 y H-05 remediados en código; su CIERRE requiere
re-sondeo N3/N4 + `--live`. H-01, H-02, H-06 siguen OPEN (bloque A de DB).**

## P0 (bloquean certificación y operación)

| ID | Hallazgo | Evidencia | Remediación |
| --- | --- | --- | --- |
| H-01 | Funciones 052 ausentes en vivo: las 8 RPC 404 | Sonda `probe-fns.js`: 9/9 RPC 404; `01-inventario.md` | Dashboard: re-ejecutar 052 (idempotente, guards 052-00/05/09) + `NOTIFY pgrst,'reload schema'` |
| H-02 | Funciones 022 ausentes (`registrar_costo_lote`, legacy, `process_audit_log`, `process_secure_company_id`) | `probe-fns.js` 404 ×3; 052-00/052-10 las exigen | Dashboard: aplicar sección funciones 022 (+037 hardening) ANTES de 052 |

## P1

| ID | Hallazgo | Evidencia | Remediación |
| --- | --- | --- | --- |
| H-03 | `mintSupabaseToken` roto: `.select('role')` vs columna real `role_id` → fallback anon | `legacy.js:138-144` + 42703 en vivo | **REMEDIADO**: `role_id` + resolución vía `roles` + 401 explícito sin membresía (sin fallback anon) |
| H-04 | Trigger sync escribe `Mantenimiento`/`Fuera de Servicio`; UI compara `En mantenimiento`/`Fuera de servicio` | 052:787-802 vs 6 call-sites (`useMachinery:144-145`, `MantenimientosPage:38`, …) | **REMEDIADO**: fuente única `machineryStatus.js` (canónico DB + label UI); `Machine.fromDatabase` normaliza; call-sites migrados |
| H-05 | Legacy UPDATE/INSERT maquinaria sin gate de rol (cualquier rol mismo tenant) | 021:161-174 + `machinery.repository.js:122-150` directo | **REMEDIADO (código)**: `update()`/`delete()` bloqueados fail-closed; única vía = RPC (+extras de create). Decisión fijada: **Opción A** — futura `actualizar_maestros_maquinaria()`; hueco documentado, sin improvisar |
| H-06 | Sin auditoría/guard server en vivo (triggers 404) | `probe-fns.js`; confirmar `pg_trigger` en Dashboard | Aplicar 022-triggers; query verificación en `06-certificacion.md` |

## P2

- H-07: `audit.service` solo-localStorage + `clearLogs()` — cosmético; la auditoría real es server (H-06).
- H-08: `can*` mock `return true` (gap declarado) — cubierto por RLS lecturas; exigir `mq_assert_rol` vivo (H-01).
- H-09: Sin FK/UI cosecha↔maquinaria; costo a lote existe en diseño (052:560-564).
- H-10: Fallback dev `jwt.decode` sin verificar (`legacy.js:216-218`) — solo dev; blindar `NODE_ENV`.
- H-11: Gaps declarados UI (combustible cierre null — RPC acepta null por diseño 052:529; mto. sin tipo/costo — RPC exige ambos 052:625-626, el form debe capturarlos).

## P3

- H-12: Restos cosméticos (títulos con encoding en `App.jsx`, placeholders "—").

## Orden Dashboard (idempotente)

```text
022-funciones → 037 → 048 → 049 → 050 → 051 → 052 → 053 → 054
→ NOTIFY pgrst, 'reload schema' → re-sondeo → --live --env=test
```
