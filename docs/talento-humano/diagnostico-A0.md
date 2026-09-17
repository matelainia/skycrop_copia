# A0 — Preflight y congelamiento — Talento Humano

> Rama: `diagnostico/talento-humano-integral`
> Regla: **DIAGNÓSTICO ≠ CORRECCIÓN. Cero `fix`/`refactor`/`feature`/`migration` hasta cerrar diagnóstico.**
> Estado: `EN DIAGNÓSTICO` → veredicto provisional: **NO CERTIFICADO = NO PRODUCCIÓN** (escrituras de negocio bloqueadas hasta certificar).
> Fecha: 2026-09-15 | Commit base: `e83d8d96f5c821859b79c06a541d5ea04a2f4258` (`feat(maquinaria): shell por pestanas...`)
> Upstream previo: `origin/diagnostico/maquinaria-integral` (working tree limpio salvo `?? apps/landing/`).

Metodología (réplica Maquinaria `docs/maquinaria/diagnostico-integral/00-plan.md`):
inventario estático (archivos) + sondas **solo-lectura**. **Cero escrituras**.
`--live` bloqueado si el preflight falla.

## 1. Freeze Git (evidencia)

```text
branch:  diagnostico/talento-humano-integral (nueva, creada desde e83d8d9)
commit:  e83d8d96f5c821859b79c06a541d5ea04a2f4258
working tree al corte: limpio salvo untracked apps/landing/ (heredado de maquinaria-integral)
comando: git status --porcelain → "?? apps/landing/"
```

## 2. Localización del módulo (A0-2.2)

**No existe** `apps/web/src/modules/talento-humano|talento|rrhh|empleados|personal|workers/`.
Ubicación real: `apps/web/src/components/TalentoHumano/` — **59 archivos** (divergencia arquitectónica vs Maquinaria que vive en `modules/maquinaria/`).

```text
TalentoHumano.jsx (shell 5 tabs) + index.jsx
gestion/GestionPersonal.jsx + components/WorkerCard|WorkerTable.jsx + forms/WorkerForm.jsx
cuadrillas/Cuadrillas.jsx + components/CuadrillaCard|MemberList.jsx
labores/Labores.jsx + components/HistorialTable|KanbanBoard|LaborCard|LaborColumn.jsx
formacion/Formacion.jsx + components/CursosTable|RegistroTable.jsx
nominas/Nominas.jsx + components/NominasTable.jsx
hooks/useTrabajadores|useCuadrillas|useLabores|useFormacion|useNominas.js (5)
services/trabajadores|cuadrillas|labores|formacion|nominas.service.js (5)
modals/AddMemberModal|CursoModal|DashboardDrawer|LaborModal|NominaModal|RegistroModal|WorkerModal.jsx (7)
components/common/Avatar|EmptyState|FilterBar|SearchBar|SectionHeader|StatusBadge.jsx (6)
constants/arl|contratos|eps|labores|rh|roles|ui.js (7)
types/talento.types.js + utils/laborHelpers|nominaHelpers|workerHelpers.js (3)
styles/common|cuadrillas|formacion|gestion|labores|nominas.css (6)
```

Referencias cruzadas fuera del módulo (alcance real mayor que la carpeta):

- `apps/web/src/modules/harvest/services/harvestService.js:236-238` → `from('trabajadores').select('id,nombres,apellidos').eq('estado','Activo')`
- `apps/web/src/modules/maquinaria/repository/operation.repository.js:64-72` → best-effort `trabajadores.id` por nombre (sin FK usuario↔trabajador)
- `apps/web/src/modules/traceability/types/traceability.types.js:14,31` → `worker_activity` / `personal`
- `supabase/migrations/011_bodegas.sql:15` → `responsable_id → trabajadores(id)`
- `supabase/migrations/042_cosecha_postcosecha_trazabilidad.sql:23` → `cosechas.responsable_id TEXT` (clerk_user_id o trabajador_id, sin FK)
- `supabase/migrations/048_traceability_events.sql:50` → `executor_id TEXT` (trabajador/operario, sin FK)
- `supabase/migrations/052/054_maquinaria_*.sql` → declaran explícito: **"no existe vínculo usuario↔trabajador en el esquema"**
- `scripts/seed/inventorySeed.js:26-33` → lee `trabajadores` para responsables

Backend: **sin módulo TH**. `backend/src/modules/`: agronomy, application, auth, evaluation, fertilization, gee, harvest, inventory, traceability, weather (10, ninguno TH). Cadena real: UI → `supabase` proxy (`lib/supabaseClient.js`) → `POST /api/rest/v1/...` → `api/legacy.js` → Supabase. Sin RPC TH, sin controller TH.

## 3. Mapa Supabase estático (archivos, no vivo)

| Tabla | Origen | `company_id` | RLS (021) | Notas |
| --- | --- | --- | --- | --- |
| `trabajadores` | `010` | NOT NULL FK companies CASCADE, UNIQUE(company_id,identificacion) | ENABLE + genérica tenant (SELECT/INSERT/UPDATE por company, DELETE solo admin) | CHECK estado/tipo_contrato parcheados en `026` (ver §5) |
| `cuadrillas` | `010` | NOT NULL | idem | sin `deleted_at` |
| `cuadrilla_miembros` | `010` | NOT NULL, PK(labor compuesta) | idem | **no está en TENANT_TABLES del proxy** (§4) |
| `labores` | `014` | NOT NULL | idem | `lote TEXT` legacy + `lote_id` nullable SET NULL; CHECK estado 4 valores (§5) |
| `labor_trabajadores` | `014` | NOT NULL, PK(labor,trabajador) | idem | **no está en TENANT_TABLES** (§4) |
| `nominas` | `017` | NOT NULL, `trabajador_id` SET? CASCADE | idem | cálculo `total_neto` en cliente (§6) |
| `cursos_formacion` | `016` | NOT NULL | idem | CHECK tipo 5 valores |
| `registros_formacion` | `016` | NOT NULL, FKs CASCADE | idem | CHECK estado 4 valores (§5) |
| Storage | `018:14` | bucket `trabajadores` | — | verificar policies storage en fase RLS |

Sin funciones/RPC/trigger específicos TH en `022_functions.sql`, `021_rls.sql`, ni `052/054`. RLS TH = política genérica multi-tenant por `company_id = current_company()` (claim `org_id`, fallback semilla `00000000-...`). Sin validación cruzada de lote (la que sí tienen `aplicaciones/monitoreos`), sin gate de rol en SELECT/INSERT/UPDATE (cualquier `authenticated` del tenant escribe; solo DELETE exige `administrador`).

## 4. Cadena frontend→backend (lectura estática)

Todo TH usa `import { supabase } from '../../../lib/supabaseClient'` (proxy, nunca directo). El proxy (`supabaseClient.js:46-135`):

- `TENANT_TABLES` incluye `trabajadores, labores, nominas, cursos_formacion, registros_formacion, cuadrillas` → `select` añade `.eq('company_id',activeOrgId)`; `insert`/`update` inyectan `company_id`.
- **NO incluye** `labor_trabajadores`, `cuadrilla_miembros` → `createLabor` (`labores.service.js:55`) y `addMemberToCuadrilla` (`cuadrillas.service.js:46`) insertan **sin `company_id`** → violan `NOT NULL` + `WITH CHECK (company_id=current_company())` → fallo funcional o fila huérfana según RLS viva. **Pre-hallazgo P0/P1 a confirmar en vivo (solo-lectura: inspección de esquema + policies, sin inserts).**
- Ningún service TH envía `company_id` explícito; dependencia total de `activeOrgId` (UUID Clerk→`setSupabaseToken`). Sin token/UUID → insert sin tenant → RLS fail-closed (bueno) pero UX sin mensaje (malo). A verificar en fase RBAC.
- Sin `service_role`/`supabaseAdmin` en frontend TH (grep: solo inyecciones `company_id` del proxy). Confirmar en backend `legacy.js` que no hay bypass para tablas TH.

Operaciones cableadas (REST directo, cero RPC):

- Trabajadores: `select *`, `insert`, `update {estado}`, `delete` (`trabajadores.service.js`)
- Cuadrillas: `select *,miembros`, `insert {nombre}`, `delete`, `insert/delete cuadrilla_miembros` (sin company_id)
- Labores: `select *,labor_trabajadores`, `insert labor + insert relaciones`, `update {estado}`, `delete`, `archive (update estado='Archivada')`
- Nóminas: `select *,trabajadores(*)`, `insert/update/delete` con cálculo cliente
- Formación: `select cursos/registros`, `insert curso/registro`, `delete registro`

## 5. Divergencias de taxonomía (pre-hallazgos P1, solo estático)

1. **Estado trabajador roto:** `010` = `Activo|Inactivo|Vacaciones|Licencia`; `026` amplía a `Activo|Activa|Inactivo|Vacaciones|Licencia|On Leave` + `tipo_contrato` 9 valores (`Permanente|Temporal|Contrato|Cosecha|...`). Frontend: `createTrabajador` default `'Activa'` (`trabajadores.service.js:49`); `useTrabajadores.js:52` toggle `['Activa','On Leave','Inactivo']` (mezcla género/idioma); `GestionPersonal.jsx:132,170` cuenta activos con `==='Activa'`; `harvestService.js:236` filtra `==='Activo'`. → conteos y filtros inconsistentes entre módulos.
2. **Estado labor inválido:** `014` CHECK `Pendiente|En Progreso|Completada|Cancelada`; frontend `archiveActiveLabores` escribe `'Archivada'` (`labores.service.js:97`) → viola CHECK.
3. **Estado formación inválido:** `016` CHECK `Aprobado|Reprobado|Asistió|Pendiente`; frontend `createRegistro` usa `estado==='Completada'` para certificado (`formacion.service.js:47`) → viola CHECK. Verificar catálogo real de estados usados en `Formacion.jsx/RegistroModal.jsx` en fase inventario.
4. **Identidad sin definir:** `auth.users ≠ profiles/company_users ≠ trabajadores`. Trabajador puede existir sin acceso; usuario admin sin ser trabajador. Sin FK usuario↔trabajador (052/054 lo declaran). RBAC por trabajador imposible hoy.

## 6. Seguridad datos personales (pre-clasificación, a confirmar)

Campos P0 (salario `nominas.salario_neto|total_neto`, identificación, cuentas —si existen—, salud `rh_sanguineo|eps|arl`): lectura `select *` sin proyección mínima (`getTrabajadores`, `getNominas` con `trabajadores(*)`); UPDATE permitido a cualquier rol del tenant (RLS 021 sin gate); cálculo salarial en cliente manipulable; DELETE físico desde UI con solo `window.confirm` (`GestionPersonal.jsx:51`). **Pre-hallazgo P0: sin RBAC backend para PII/salarios; UI como único gate (antipatrón).** Exportación: verificar si `Nominas.jsx/DashboardDrawer.jsx` exportan CSV/PDF sin control.

## 7. Criterios `--live` (bloqueo)

`--live` (y cualquier escritura productiva) queda **BLOQUEADO** hasta:

1. Completar inventario A1→A20 + sondas solo-lectura (esquema vivo, RLS, RPC, storage).
2. Clasificar P0/P1/P2/P3 y firmar `hallazgos.md` + `contrato-tecnico.md` + `plan-correccion.md`.
3. Re-sondeo en verde + `TH-001…TH-016` E2E (incl. cross-company, cross-predio cuando aplique, RBAC, RLS, auditoría).
4. Veredicto explícito `CERTIFICADO`; mientras tanto: **NO CERTIFICADO**.

## 8. Siguiente paso (orden estricto, sin saltos)

```text
01. A0 Freeze (este doc + manifest) → 02. Inventario A1 → 03. Mapa frontend →
04. Mapa backend → 05. Mapa Supabase vivo (solo-lectura) → 06. Modelo datos →
07. RLS → 08. RPC/DEFINER → 09. RBAC → 10. Empresa/Predio isolation →
11. Datos personales → 12. Integridad → 13. Trazabilidad → 14. Integraciones →
15. UI/UX → 16. Negativas → 17. E2E → 18. Preflight --live → 19. Hallazgos →
20. Contrato técnico → 21. Plan corrección → CERTIFICACIÓN
```

## 9. Archivos inspeccionados en A0 (resumen; detalle en `manifest-A0.txt`)

Frontend TH (59) + `lib/supabaseClient.js` + `harvestService.js` + `operation.repository.js` + `traceability.types.js`; backend `src/modules/` (ausencia TH) + `api/legacy.js` (pendiente lectura profunda fase backend); supabase `010,014,016,017,018,020,021,022,026` + `052/054` (nota sin vínculo usuario↔trabajador); docs maquinaria `00-plan,01-inventario,05-hallazgos,06-certificacion` (plantilla); `tests/e2e/{helpers/db,schema-contract}` (mencionan TH).
