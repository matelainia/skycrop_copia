# A1 — Inventario funcional — Talento Humano (solo lectura, sin commit)

> Fecha: 2026-09-15 | Rama: `diagnostico/talento-humano-integral` | Base: A0 (`diagnostico-A0.md` + `manifest-A0.txt`).
> Veredicto A1: **el freeze A0 se confirma** (ubicación, 59 archivos, sin backend TH, 8 tablas). A1 agrega precisión funcional; **no corrige nada**.

## 1. Ruta y gate de acceso (UI)

- Sidebar: `App.jsx:17` → `{ id:'talento', recurso:'laboral' }`, filtro `hasPermission(recurso,'leer')`.
- `AuthContext.jsx:16-21,138-143` → DEV: admin `*/*` (`hasPermission()=>true`); prod: `PermissionService.hasPermission` (`packages/services/index.ts:59`), recurso `'laboral'` declarado en `packages/types/index.ts:33`.
- Sub-navegación **sin router**: `TalentoHumano.jsx:19-25` state `gestion|asistencia|labores|formacion|nominas`. Sin deep-links, sin guards por sub-tab (todo el que lee `laboral` ve las 5, incl. Nóminas PII).

## 2. Matriz función → UI → hook → service → endpoint → tabla → seguridad → estado

Método HTTP/endpoint único en todo TH: `POST/GET/PATCH/DELETE /api/rest/v1/<tabla>` vía proxy `supabaseClient.js` → `backend/api/legacy.js` → Supabase. **Cero RPC TH.** `company_id`: nunca explícito en services (lo inyecta el proxy solo si tabla ∈ TENANT_TABLES y `activeOrgId` es UUID). Rol backend: ninguno (RLS genérica 021, DELETE solo admin). Auditoría: ninguna (`created_at` solo en algunas tablas; sin `created_by/updated_by`, sin triggers).

| ID | Funcionalidad | UI | Hook | Service | Tabla(s) | company_id / RLS | Estado A1 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TH-F01 | Listar/buscar/filtrar trabajadores (cuadrilla, tipo contrato, texto) | `GestionPersonal.jsx:23-31` + `SearchBar/FilterBar/WorkerTable/WorkerCard` | `useTrabajadores.refresh` | `getTrabajadores: select * order created_at desc` | `trabajadores` | proxy inyecta `eq company_id` en select (tabla ∈ TENANT) | Implementado (lectura) |
| TH-F02 | Crear trabajador (form 16 campos, foto base64, contrato solo filename) | `WorkerForm.jsx` (defaults `Permanente/O+/Nueva EPS/Positiva/Operario General/Activa`) → `GestionPersonal.handleAddWorker` | `useTrabajadores.createWorker` | `createTrabajador: insert` sin company_id | `trabajadores` | depende proxy insert; UNIQUE(company_id,identificacion) | Implementado, riesgo tenant + PII |
| TH-F03 | Toggle estado trabajador | `WorkerTable/WorkerCard onToggleStatus` | `useTrabajadores.toggleEstado: ['Activa','On Leave','Inactivo']` | `updateEstadoTrabajador: update {estado}` | `trabajadores` | proxy añade company_id + eq | Implementado pero taxonomía divergente (A0 §5; tipos dicen `Activa\|On Leave\|Inactivo` vs DB 6 valores 026) |
| TH-F04 | Eliminar trabajador (físico, `window.confirm`) | `GestionPersonal.jsx:50-57` | `useTrabajadores.deleteWorker` | `deleteTrabajador: delete eq id` | `trabajadores` (+CASCADE a cuadrilla_miembros, labor_trabajadores, nominas, registros) | RLS DELETE exige admin; UI sin gate rol | Riesgo: borrado físico en cascada, sin soft-delete aplicado |
| TH-F05 | Ficha detalle trabajador (+cuadrillas, contrato filename) | `WorkerModal.jsx` (lee PII completa: CC, RH, EPS, ARL, teléfonos) | — (props) | — | — | sin minimización | Implementado; observar en A7 |
| TH-F06 | Cuadrillas listar/crear/eliminar | `Cuadrillas.jsx` + `CuadrillaCard/EmptyState/SectionHeader` | `useCuadrillas` (create/delete) | `getCuadrillas select *,miembros / createCuadrilla insert {nombre} / deleteCuadrilla` | `cuadrillas` (+join `cuadrilla_miembros`) | proxy OK (tabla ∈ TENANT) | Implementado; **sin update nombre, sin responsable** |
| TH-F07 | Añadir/retirar miembro cuadrilla | `CuadrillaCard` vía `addingMemberTo` + `AddMemberModal` | `useCuadrillas.add/removeMember` | `addMember insert {cuadrilla_id,trabajador_id} / removeMember delete` | `cuadrilla_miembros` | **NO ∈ TENANT_TABLES → insert sin company_id → viola NOT NULL + WITH CHECK** | **P0 potencial (roto funcional)** |
| TH-F08 | Crear labor (cuadrilla o individual, jornal requerido, lote texto libre) | `LaborModal.jsx` (defaults `Cosecha/Pendiente/cuadrilla`) → `Labores.handleCreateLabor` | `useLabores.createLabor` | `createLabor: insert labor + insert relaciones` | `labores` + `labor_trabajadores` | labor OK proxy; **relaciones sin company_id (no ∈ TENANT)** | **P0 potencial**; lote = TEXT libre, `lote_id` nunca se setea |
| TH-F09 | Kanban cambio estado labor | `KanbanBoard.jsx + LaborColumn` (columnas = `LABOR_ESTADOS`) | `useLabores.changeEstadoLabor` | `updateEstadoLabor: update {estado}` | `labores` | proxy OK | Riesgo: `LABOR_ESTADOS=['Pendiente','En Curso','Completada']` vs CHECK `014:16` (`En Progreso`, no `En Curso`) → update inválido |
| TH-F10 | Finalizar día (archivar), desarchivar, eliminar, historial/filtros | `Labores.jsx:46-79` + `HistorialTable` | `useLabores.archive/unarchive/delete` | `archive update {estado:'Archivada'} / unarchive / delete` | `labores` | proxy OK | **Roto CHECK**: `'Archivada'` no existe en `014:16`; delete físico sin gate UI |
| TH-F11 | Cursos listar/crear (sin editar/eliminar curso) | `Formacion.jsx + CursosTable + CursoModal` (tipos `Seguridad y Salud/Técnica/Operación`) | `useFormacion.createCurso` | `createCurso insert {nombre,tipo,total_horas} / getCursos` | `cursos_formacion` | proxy OK | Riesgo: 2/3 tipos frontend fuera del CHECK `016:12` (`Técnica/Operación` inválidos); sin update/delete curso |
| TH-F12 | Registros formación crear/eliminar + visor/diploma | `RegistroTable + RegistroModal + DashboardDrawer` (estados `Completada/En Curso/Vencida`, cert base64 data-URL) | `useFormacion.create/deleteRegistro` | `createRegistro insert {trabajador_id,curso_id,fecha,resultado,estado,certificado_url} / delete` | `registros_formacion` | proxy OK tablas; cert guarda base64 en columna TEXT | **Roto CHECK**: UI `016:45` (`Aprobado/Reprobado/Asistió/Pendiente`) 0% coincidencia; **sin update registro** |
| TH-F13 | Nóminas listar + KPI/analítica por periodo | `Nominas.jsx + NominasTable` (periodo `Enero..Mayo`, KPIs `Completado/Procesando/Fallido/Vencida`; barras histórico **hardcodeadas** `Feb 32.4M/Mar 35.1M`, `Nominas.jsx:252-256`) | `useNominas.refresh` | `getNominas select *,trabajadores(*)` | `nominas` join `trabajadores` | lectura tenant OK; expone salarios+PII sin minimización | Implementado lectura; mocks en UI |
| TH-F14 | Registrar pago individual | `NominaModal.jsx` (salario digitado, `valorHoraExtra` requerido explícito, `NominaModal.jsx:53-56`) | `useNominas.createNomina` | `createNomina: total_neto = salario + horas*valorHoraExtra − retenciones` en cliente → `insert` | `nominas` | sin validación server | **PII/RBAC**: cálculo cliente manipulable; estados UI vs CHECK `017:16` (`Pendiente/Pagado/Procesado` vs `Procesando/Completado/Fallido/Vencida`) → insert inválido |
| TH-F15 | Editar nómina | `NominaModal isEdit` | `useNominas.updateNomina` | `updateNomina: update` mismos campos calculados cliente | `nominas` | cualquier rol tenant (RLS sin gate) | Riesgo alto |
| TH-F16 | Eliminar nómina (`confirm`) | `Nominas.jsx:113-120` | `useNominas.deleteNomina` | `deleteNomina: delete` | `nominas` | RLS DELETE admin; UI sin gate | Riesgo |
| TH-F17 | Generar nómina del periodo (masiva) | `Nominas.handleGeneratePeriod` (solo `estado==='Activa'`) | `useNominas.generateNominasPeriodo` | `createNomina` en loop con **salarios presuntos por rol** (`Tractorista 4250000/Supervisor 5500000/else 3500000`, `useNominas.js:91`) | `nominas` | idem + doble fallo | **Roto por diseño**: form sin `valorHoraExtra` → `createNomina` lanza `valor_hora_extra requerido`; + estado `Procesando` fuera de CHECK; + salarios inventados por rol |
| TH-F18 | Cross-module (solo lectura externa) | harvest selector `estado==='Activo'`; maquinaria best-effort por nombre; `inventorySeed.js:26-33` | — | `harvestService.js:236-238`, `operation.repository.js:64-72` | `trabajadores` | lectura tenant | Acoplamiento frágil (nombre, no FK); confirma A0 |
| TH-F19 | Documentos/archivos | foto base64 en `trabajadores.foto`; cert base64 en `registros_formacion.certificado_url`; contrato **solo filename** (`WorkerForm.jsx:37-41`) | — | — | columnas TEXT; bucket `trabajadores` (`018:14`) **sin uso desde frontend** (sin `storage.upload`) | PII en columnas sin policies storage ejercidas | Observar A7/A8 |

Ausencias (confirmado, no asumir roadmap): sin edit trabajador (solo toggle estado), sin update cuadrilla/labor/curso/registro, sin delete curso, sin contratos/entidad contrato, sin jornadas/asistencia/vacaciones/permisos/incapacidades/seguridad-social como entidades, sin `predio_id` en ninguna tabla TH, sin `empresa_id` (es `company_id`), sin vínculo usuario↔trabajador.

## 3. Mapas de dependencia (flujo real)

```text
GestionPersonal.jsx → useTrabajadores.js → trabajadores.service.js → supabase.from('trabajadores') [proxy inyecta company_id]
  → POST /api/rest/v1/trabajadores → legacy.js (Clerk→JWT org_id/role, H-03 remediado) → Supabase RLS 021
Labores idem con bifurcación: insert labores (tenant OK) + insert labor_trabajadores (SIN tenant → P0 potencial)
Cuadrillas.jsx → useCuadrillas.js → cuadrillas.service.js → cuadrillas (tenant OK) / cuadrilla_miembros (SIN tenant → P0 potencial)
Formacion.jsx → useFormacion.js → formacion.service.js → cursos_formacion / registros_formacion (tenant OK, CHECK roto)
Nominas.jsx → useNominas.js → nominas.service.js (cálculo total_neto cliente) → nominas (tenant OK, CHECK roto, sin RBAC)
```

## 4. Dónde se calcula cada valor de nómina (A1 §5-respuesta)

`NominaModal` captura `salarioNeto, horasExtras, valorHoraExtra (no persistido), retenciones`; `nominas.service.js:40,77` calcula `total_neto` en cliente; DB solo CHECK `>=0`, sin trigger/RPC que lo recompute. Tasa hora-extra **efímera** (no se guarda → KPI `Nominas.jsx:40` admite que no se puede recomponer). Bulk `useNominas.js:91-102` inventa salario por rol y omite tasa → siempre lanza. Periodo = nombre de mes (`Enero..Mayo`), no `YYYY-MM` (`017:11` sugiere `'2026-07'`).

## 5. Confirmación A0 + divergencias que A1 debe arrastrar a A2

A0 confirmado en: ubicación `components/`, 59 archivos, cadena proxy sin backend TH, 8 tablas, RLS genérica, sin RPC. Precisiones A1: (a) rotura CHECK no es solo trabajadores/labores — alcanza **nóminas, cursos, registros** (tres CHECK 0%-parcialmente incompatibles con UI); (b) `TH-F07/F08` tenant-roto es estructural (tablas puente fuera del proxy); (c) nómina masiva F17 triplemente rota (tasa ausente + CHECK + salarios presuntos); (d) documentos: storage sin usar, PII en columnas.

## 6. Siguiente (A2 — arquitectura actual, sin cambios)

Cruzar estos flujos con RLS viva (solo-lectura), `legacy.js` completo, `PermissionService` matriz `laboral`, y `App.jsx` gates. `--live` sigue **BLOQUEADO**; veredicto sigue **NO CERTIFICADO**.
