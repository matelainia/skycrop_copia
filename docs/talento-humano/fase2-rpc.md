# Fase 2 — Capa RPC + arquitectura modular (rama `remediacion/talento-humano-fase1`)

> Base: `94bcf81` (Fase 1 verificada E2E). Fecha: 2026-09-15.
> Patrón: Maquinaria 052 (INVOKER + search_path + asserts). Estado: **NO CERTIFICADO**
> (056 pendiente de aplicar; regresión E2E pendiente).

## Migración `056_th_fase2_rpc.sql` (Dashboard + `NOTIFY pgrst,'reload schema'`)

- Helpers `th_company()` / `th_assert_rol()` (admin/gerente bypass).
- RPCs: `th_crear_trabajador` (duplicado → 23505 amistoso), `th_retirar/reactivar_trabajador`
  (rol supervisor+), `th_crear_cuadrilla`, `th_agregar_miembro` (idempotente, exige
  trabajador activo mismo tenant), `th_registrar_labor` (**atómica** cabecera+miembros),
  `th_cambiar_estado_labor`, `th_registrar/actualizar_nomina` (rol supervisor+, total server),
  `th_crear_curso`, `th_registrar_capacitacion` (co-tenant validado).
- `trabajadores.user_id → profiles` + UNIQUE parcial `(company,user)` (diseño A4:
  1 usuario → 0..1 trabajador/empresa; **sin cableado UI**, Fase 3).
- Storage privado: buckets `trabajadores`/`certificados` a `public=false` + policies
  por carpeta `{company_id}/` (SELECT/INSERT/UPDATE tenant, DELETE admin).

## Frontend

- Services → RPC (crear/retirar/reactivar, cuadrilla+miembro, labor atómica,
  nómina create/update, curso/registro). Deletes físicos y toggle quedan en REST+RLS.
- Traslado `components/TalentoHumano/` → `modules/talento-humano/` (61 archivos,
  `git`-detectado como rename; `App.jsx` actualizado; cero refs viejas).
  (`git mv` bloqueado por watcher dev en Windows; copia+build+remove verificados.)
- `services/thStorage.js`: foto/certificado a bucket tenant (`getActiveOrgId()`);
  fallback a columna si 056 sin aplicar (transición, con warn).
- Listados con `.limit(500)` (+orders); pager UI completo → Fase 3.

## Decisiones diferidas (documentadas, no olvidadas)

- Maquinaria sigue con operador texto + best-effort (su modal es dueño del cambio).
- Salarios presuntos bulk, reactivación UI admin, pager UI, autoservicio `user_id`,
  alcance predial TH → Fase 3. Resolución por nombre: ayuda UI con FK explícita (Fase 3).

## Verificación pendiente

1. Aplicar 056 → 2. re-sondeo lectura → 3. `runner-th.js --seq=N` regresión →
4. smoke UI (crear trabajador/labor/nómina) → 5. veredicto.
