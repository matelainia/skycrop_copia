# Fase 1 — Saneamiento estructural TH (rama `remediacion/talento-humano-fase1`)

> Base: `7fd9abb` (diagnóstico A0–A5). Fecha: 2026-09-15. Alcance: sin features, sin `user_id`.
> Estado: **NO CERTIFICADO** (`--live` y E2E TH-001…016 pendientes; migración 055 pendiente de aplicar en Dashboard).

## Precheck vivo (solo SELECT, sonda eliminada)

- `trabajadores`: 2 filas, `estado='Activa'`, `tipo_contrato='Permanente'`, roles Operario/Tractorista → coherente con `026`; sin migración de datos necesaria.
- `labores/nominas/cursos/registros/cuadrillas/puentes`: 0 filas → CHECKs nuevos sin backfill.
- `anon SELECT trabajadores`: 0 filas → RLS fail-closed.
- `profiles`: accesible (identidad viva).

## Cambios código (frontend)

- F1.1: `constants/taxonomia.js` (fuente única) + `labores.js` re-export; `En Curso→En Progreso` (Labores ×2, LaborColumn, StatusBadge, RegistroModal placeholder); cursos a 5 tipos DB (CursoModal, Formacion filtro, DashboardDrawer); `useTrabajadores` usa constante; `harvestService.listTrabajadores` filtra `Activa`; JSDoc actualizado.
- F1.3: `labores.service.getLotes()` + `lote_id` en create/get; `useLabores.lotes`; `LaborModal` selector lote formal (NULL = alcance empresa); `Labores` cablea `lotes`.
- F1.5: `nominas.service` persiste `valor_hora_extra`; bulk aporta `0` (ya no lanza).
- F1.6: `deleteTrabajador` → retiro lógico (`Inactivo` + `deleted_at`); `reactivateTrabajador()` listo (UI admin Fase 2); confirm re-redactado.
- F1.7: `TENANT_TABLES` += `labor_trabajadores`, `cuadrilla_miembros`.

## Migración `055_th_fase1_saneamiento.sql` (idempotente, aplicar en Dashboard + `NOTIFY pgrst,'reload schema'`)

1. CHECKs: labores +`Archivada`; nominas 4-state UI; registros 3-state UI.
2. `nominas.valor_hora_extra` + `UNIQUE(company,trabajador,periodo)` + trigger `process_nomina_total()` (recompute server).
3. `process_th_actor()` (created_by/updated_by/deleted_by/updated_at server) en 8 tablas + columnas.
4. `process_audit_log` extendido a labores/nominas/cuadrillas/cursos/registros (guarded).
5. `process_validate_th_tenant()` triangular en puentes/nominas/registros/labores.
6. RBAC nominas: INSERT/UPDATE solo `administrador/gerente/supervisor`.

## Verificación

- `npm run build` (web): **PASS** (1.25s).
- eslint archivos tocados: 24 errores **preexistentes**, 0 nuevos.
- Comportamiento DB post-055: pendiente de apply + re-sondeo (C-04 debe fallar 42501; bulk nómina debe insertar; `En Progreso`/`Archivada`/`Procesando` deben pasar CHECK).

## Re-sondeo post-055 (2026-09-15, solo lectura): 12/12 PASS

Columnas nuevas visibles vía REST (schema recargado): `nominas.valor_hora_extra`,
actor en 8/8 tablas. 2 trabajadores intactos (`Activa`). `anon` ciego.
Pendiente verificación conductual (requiere escrituras controladas): CHECKs nuevos,
trigger triangular (C-04 → 42501), recompute nómina, RBAC nóminas.

## Deuda explícita → Fase 2

Salarios presuntos por rol (bulk), reactivación UI admin, paginación, storage documentos, RPC/service-layer, resolución por nombre, `user_id` (diseño), alcance predial TH, E2E + `--live` + certificación.
