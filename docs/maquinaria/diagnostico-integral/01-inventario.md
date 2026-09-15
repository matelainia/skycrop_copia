# F01 — Inventario técnico

## Frontend (`apps/web/src/modules/maquinaria/`)

| Capa | Archivos |
| --- | --- |
| Shell | `MachineryModule.jsx`, `index.jsx`, `components/MachineryHeader.jsx`, `components/MachineryTabs.jsx` |
| Páginas (vistas de pestaña) | `pages/FlotaPage, OperacionesPage, MantenimientosPage, CombustiblePage, HistorialPage, CostosPage, AlertasPage, ReportesPage.jsx` |
| Estado | `context/MachineryProvider.jsx` (flota+jornadas+activeMachine, eventos), `hooks/useMachinery, useCurrentOperation, useMaintenance.js` |
| DAL | `repository/machinery|operation|maintenance|fuel.repository.js` — único punto con `supabase.from/rpc` |
| Servicios | `services/machinery|operation|maintenance|fuel.service.js` + `rpcErrors.js` (traducción de errores) |
| Reglas UI | `validators/*.validator.js`, `permissions/can*.js` (los 4 `return true`), `scheduler/maintenanceScheduler.js` (solo display) |
| Tipos | `types/Machine|Operation|Maintenance|FuelRecord.js` (mapeo dual legacy+canónico) |
| Auditoría UI | `audit/audit.service.js` — **solo localStorage** (ver H-07) |
| Costos | `costs/costCalculator.js` |

Llamadas Supabase desde frontend (todas vía proxy `lib/supabaseClient.js`, nunca directo):

- REST lecturas: `maquinaria`, `maquinaria_operaciones`, `maquinaria_combustible`, `maquinaria_mantenimientos`, `lotes`, `trabajadores`
- REST escrituras directas: `maquinaria` UPDATE/DELETE (`machinery.repository.js:98-101,122-150`)
- RPC: `registrar_maquinaria`, `iniciar/finalizar_jornada_maquinaria`, `registrar_combustible_maquinaria`, `programar_mantenimiento_maquinaria`, `registrar_mantenimiento_maquinaria_v2`

## Backend (`backend/`)

**Sin módulo de maquinaria.** `src/modules/`: agronomy, application, auth, evaluation,
fertilization, gee, harvest, inventory, traceability, weather.
Cadena real: UI → `POST /api/rest/v1/...` o `/api/rpc/...` → `api/legacy.js`
(proxy http-proxy-middleware, `^/api`→`''`) → Supabase. Auth del proxy:
JWT backend válido se reenvía (RLS aplica); token Clerk se verifica y se mintea
JWT Supabase 15 min con `org_id=company.id` + `role_name` (`legacy.js:57-74,163-247`).

## Matriz acción → cadena (F03)

| Acción | UI handler | Service | Repo | RPC/Tabla | Evento | Estado vivo |
| --- | --- | --- | --- | --- | --- | --- |
| Registrar equipo | AddMachineDrawer→useMachinery.handleAddMachine | machinery.service.registerMachine | rpc registrar_maquinaria + update maestros | RPC 052-07.1 + `maquinaria` | maquinaria_eventos REGISTRO | RPC 404 → ROTO |
| Editar maestros | EditMachineDrawer | updateMachine | UPDATE maquinaria directo | tabla (RLS 021) | audit trigger (si existe) | Funciona sin rol |
| Eliminar | handleDeleteMachine | removeMachine | DELETE directo | tabla (RLS admin) | — | Solo admin |
| Iniciar jornada | StartLaborModal | operation.service | rpc iniciar_jornada + resolve lote/operador | RPC 052-07.2/054 | JORNADA_INICIO | RPC 404 → ROTO |
| Finalizar jornada | EndLaborModal | operation.service | rpc finalizar_jornada (+costo a lote vía registrar_costo_lote) | RPC 052-07.3 | JORNADA_FIN | RPC 404 → ROTO |
| Registrar combustible | fuel.service | fuel.repository | rpc registrar_combustible | RPC 052-07.4 | COMBUSTIBLE | RPC 404 → ROTO |
| Programar mto. | MaintenanceModal | maintenance.service | rpc programar | RPC 052-07.5 | MANTENIMIENTO_PROGRAMADO | RPC 404 → ROTO |
| Ejecutar mto. | — | maintenance.service | rpc v2 (DEFINER) | RPC 052-07.6 | MANTENIMIENTO_EJECUTADO | RPC 404 → ROTO |
| Actualizar horómetro | — | — | (sin cablear a UI) | RPC 052-07.7 DEFINER | EDICION/HOROMETRO_CORRECCION | RPC 404 → ROTO |
| Incidencia | — | — | (sin cablear a UI) | RPC 052-07.8 | INCIDENCIA | RPC 404 → ROTO |
| Alertas flota | AlertasPage/scheduler | cliente | lectura maquinaria | tabla | — | OK lectura |
