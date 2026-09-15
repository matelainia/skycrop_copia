# ACTA A0 — Preflight Bloque A (2026-09-15)

## Verificado por auditoría (este ciclo)

| Ítem | Resultado |
| --- | --- |
| Rama | `diagnostico/maquinaria-integral` ✓ |
| Árbol | 49 archivos = set conocido (UI tabs, maquinaria DAL, `legacy.js` H-03, docs, migraciones 052-054 sin aplicar) ✓ |
| Proyecto objetivo | `gynttnymneanbziywqqr.supabase.co` ✓ |
| Guard anti-producción (`resondeo.mjs` + manual) | PASS, sin marcadores `skycrop.app` ✓ |
| `service_role` en frontend | Ausente (grep limpio) ✓ |
| Snapshot existencia | `resondeo-BEFORE.json` (R0) + `resondeo-N1-2026-09-15.json` (H-01/H-02 OPEN) ✓ |
| Guard `resondeo.mjs` N3/N4 | Activo (exige `E2E_LIVE=1` + sin marcadores prod) ✓ |
| Escrituras de negocio durante A0–A4 | PROHIBIDAS (solo DDL Dashboard + sondas lectura) ✓ |

## A confirmar en Dashboard (tu lado, antes de A1)

- [ ] Proyecto abierto = `gynttnymneanbziywqqr` (ver ref en URL del editor SQL)
- [ ] NO es producción (confirmación explícita)
- [ ] Backup/estado recuperable (snapshot Supabase o pausa de escrituras app)

## A1 — PASS con nota (022-funciones + 037)

- Dashboard: 39× `secure_company_id_trg`, `tgenabled=O` (todas las tablas tenant).
- PostgREST: 6 funciones 404 = esperado pre-`NOTIFY reload` (caché de esquema).
  `process_audit_log` / `process_secure_company_id` devuelven `TRIGGER` y
  PostgREST jamás las expone: su 404 es permanente y correcto; existen porque
  los 39 triggers las referencian (el `CREATE TRIGGER` habría fallado si no).
- Revisión estática `process_secure_company_id` (022:23-48): rellena NULL desde
  JWT, registra `FORGERY_ATTEMPT` + EXCEPTION ante suplantación, sin fallback
  permisivo; contexto NULL cae en RLS fail-closed. PASS.
- Sanidad post-A1: anon → `[]` (fail-closed intacto tras 037).
- **Veredicto: PASS. Continuar A2.**

## A2 — PASS (037 contexto)

- Dashboard (sin JWT): `current_company=NULL, current_role_id='operario',
  current_user_id=NULL`.
- Sin fallback a semilla 00000000 → versión fail-closed (043+) viva, no 021.
  Rol `'operario'` es default de mínimo privilegio con compañía NULL (RLS niega
  filas igual); sin assumption de service_role.
- **Veredicto: PASS. Continuar A3 (048–051).**

## A3 — STOP parcial (falta 051)

- 048: 3/3 (`registrar_evento_trazabilidad`, `verificar_cadena_lote`,
  `verificar_integridad_evento`) ✓
- 049: 2/2 (`e2e_*`) ✓
- 050: `tiene_acceso_predio` ✓ + 4 policies `%predio%` ✓
- 051: `alcance_operativo(UUID,UUID)` **ausente** → 051 no aplicada o falló.
- **Veredicto: STOP (superado abajo: causa raíz = faltan 040/042).**
  ```sql
  select proname from pg_proc where pronamespace='public'::regnamespace
   and proname in ('alcance_operativo','predio_de_lote');
  ```
  Esperado: 2 filas. Sin esto no hay A4 (las policies scoped dependen de él).

## A3 — PASS (040 → 042 → 048–051 completos)

- `analisis_suelos` existe (040 ✓); `alcance_operativo` + `predio_de_lote`
  existen (051 ✓ tras aplicar 040/042 primero).
- 048/049/050 intactos (re-ejecución idempotente).
- Pendiente confirmación explícita separada de `cosechas.predio_id` y `ventas`
  (inferido por éxito de 051; verificar en A4 junto al resto).
- **Veredicto: PASS. Continuar A4 (052 → 053 → 054).**

## A4 — PASS lado DB; N1/N2 PASS (Caso 1)

- 8 RPC en `pg_proc` ✓ + triggers (4 immutable + sync unificado + 5 audit) ✓.
- Incidente caché: 2× NOTIFY sin efecto; restart proyecto + corrección de
  sondas (firma completa) → descubrimiento OK.
- **N1 CLOSED**: 8/8 ROUTED (400/403 denegaciones controladas).
  **N2 CLOSED**: anon 401/404 en todas (sin bypass).
- H-01/H-02 → **candidatos a CLOSED** (cierre formal con N3/N4 + `--live`).
- Estado: **NO CERTIFICADO**. N3/N4 y adversarial-escritura requieren
  levantar la prohibición de escrituras en alcance TEST (decisión pendiente).

- `mq_immutable_*` ×4 ✓. Ausencia de `mq_estado_trg`/`mq_sync_status_trg` es
  POR DISEÑO: 053 los reemplaza por `mq_sync_legacy_trg` unificado (mismas
  transiciones + alias `En mantenimiento`, 053:88-97). Checkpoint corregido.
- Pendiente del operador: salida de las 8 RPC, triggers `audit_maquinaria_*`,
  confirmación `NOTIFY` + timestamp. Luego N1/N2 por auditoría.
- Auditoría ✓ (5 filas: 4 tablas 052 + `maquinaria` legacy).
- Pendiente: salida 8 RPC + confirmación NOTIFY con timestamp.
- 8 RPC ✓ en `pg_proc` (firmas, search_path ×8, DEFINER solo v2+horómetro,
  `iniciar` con 7 args de 054). Lado DB: PASS.
- N1 PostgREST: **FAIL (caché)** — funciones existen pero devuelven 404:
  `NOTIFY` pendiente de confirmación. Caso N1-FAIL → STOP, sin `--live`.
- NOTIFY ejecutado 11:50, +75s → N1 sigue OPEN.
- Descarte grants: con JWT `authenticated` + firma exacta persiste PGRST202
  ("no matches in the schema cache") → caché PostgREST no recargada, no es
  permiso. Pendiente: confirmar misma DB en Dashboard + re-NOTIFY.
- 2.º NOTIFY 11:56:22, +130s → persiste. N1 corregido (llamadas con firma
  completa; `{}` daba PGRST202 aun sano). Veredicto: funciones en `pg_proc`
  pero invisibles a PostgREST → causa plataforma (canal NOTIFY/pooler).
  Escalamiento: restart del proyecto Supabase. STOP vigente (Caso 3).
- 022 legacy confirmado en `pg_proc` (4/4: costo_lote, iniciar/finalizar_labor,
  registrar_mantenimiento). H-02(N1) Dashboard: PASS; falta descubrimiento.
- Pendiente: restart del proyecto → re-sondeo N1.

- Causa: 051 exige `cosechas.predio_id` (042) y `analisis_suelos` (040), no
  aplicadas en vivo. El script revierte entero (funciones incluidas).
- Error de orden del bloque A (corregido en ORDEN.md): insertar
  **040 → 042 antes de 048–051**, con verificación tras cada una.
- **Veredicto: STOP. Aplicar 040, verificar; aplicar 042, verificar;
  re-ejecutar 048→051.**

```text
tú: aplicar migración → correr checkpoint SQL de ORDEN.md → pegar resultado
yo: sondas PostgREST descubrimiento → veredicto STOP/PASS
```

STOP ante cualquier FAIL o NOTICE no documentado. Tras A4: `NOTIFY pgrst,
'reload schema'` + registro (timestamp, proyecto, entorno, resultado) + N1/N2.

## Interpretación N1/N2 (fijada)

- N1 estructura: ¿desplegado lo exigido? N2 exposición segura: ¿PostgREST lo
  resuelve sin bypass? N1+N2 PASS ⇒ H-01/H-02 **candidatos** (cierre formal solo
  con rutas funcionales N3/N4 + `--live`).
- Casos: N1 FAIL→STOP sin `--live` · N1 PASS+N2 FAIL→investigar schema/grants ·
  PASS con fallo seguridad→NO CERTIFICADO, no avanzar.

## H-05 — decisión fijada: Opción A (RPC explícita de dominio)

Hueco documentado, sin improvisar en este ciclo: futura
`actualizar_maestros_maquinaria()` (autorización+validación+auditoría en un
solo camino). La vía directa permanece bloqueada fail-closed.
