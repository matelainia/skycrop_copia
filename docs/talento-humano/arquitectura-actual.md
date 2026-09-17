# A2 — Arquitectura actual — Talento Humano (solo lectura)

> Rama: `diagnostico/talento-humano-integral` | Commit A0/A1: `cad8662` | Fecha: 2026-09-15.
> Pregunta A2: ¿cómo funciona realmente TH hoy, del navegador a Supabase? (A1 = qué existe; A2 = cómo está construido.)

## 1. Resumen arquitectónico

```text
Arquitectura actual: MONOLÍTICA / COMPONENT-BOUND (observación, no propuesta)
Frontend:  apps/web/src/components/TalentoHumano/ (59 archivos, shell por tabs con estado local)
Backend:   sin módulo dedicado (10 módulos, ninguno TH)
Data access: REST PostgREST vía proxy genérico (cero RPC TH)
Business logic: frontend/services (+ hooks como estado local por coordinador)
Authorization: RLS genérica 021 + gate frontend a nivel módulo (recurso 'laboral'/leer)
Tenant enforcement: parcial (proxy cubre 6/8 tablas; RLS cubre 8/8 pero sin validación cruzada)
Audit: inexistente (sin created_by/updated_by, sin triggers TH, sin audit.service)
```

## 2. Componentes

- Shell: `TalentoHumano.jsx` (5 tabs por estado, `Suspense/lazy`) + `index.jsx`. Sin router (no hay deep-links).
- Coordinadores (1 por tab, estado local `useState`, sin store global): `gestion/GestionPersonal.jsx`, `cuadrillas/Cuadrillas.jsx`, `labores/Labores.jsx`, `formacion/Formacion.jsx`, `nominas/Nominas.jsx`.
- Estado/datos: 5 hooks (`useTrabajadores|useCuadrillas|useLabores|useFormacion|useNominas.js`) — cada uno `refresh` al montar (GET completo, sin paginación), mutaciones optimistas por reemplazo de arreglo.
- DAL real: 5 services (`trabajadores|cuadrillas|labores|formacion|nominas.service.js`) — único punto con `supabase.from(...)`. Sin repository/service split (a diferencia de Maquinaria).
- Entrada: 7 modals + `gestion/forms/WorkerForm.jsx`; catálogos: `constants/{contratos,roles,labores,eps,arl,rh,ui}.js`; contratos: `types/talento.types.js` (JSDoc, no validado en runtime); cómputo: `utils/{workerHelpers (edad/iniciales/badge), laborHelpers (jornal→horas), nominaHelpers (formatCOP)}`.
- Comunes: `components/common/{Avatar,EmptyState,FilterBar,SearchBar,SectionHeader,StatusBadge}.jsx` + 6 CSS.

## 3. Dependencias

Internas (todas lectura estática confirmada):
`react/lucide-react` → `context/AuthContext.jsx` (gate) → `lib/supabaseClient.js` (proxy) → `@skycrop/services {AuthService,PermissionService}` → `@skycrop/types` (recurso `'laboral'`) → `backend/api/legacy.js` → Supabase.
Externas (acoplamientos §11).

## 4. Flujo frontend → backend (por tipo de operación)

| Tipo | Ejemplo | Request real | Headers/auth | Payload | Response/transform |
| --- | --- | --- | --- | --- | --- |
| SELECT lista | `getTrabajadores` | `GET /api/rest/v1/trabajadores?select=*&order=created_at.desc` (proxy añade `company_id=eq.activeOrgId`) | `Authorization: Bearer <supabaseToken 15min>` + `apikey: anon` (reinyectada en `legacy.js:282-289`) | — | snake→camel en service (`trabajadores.service.js:11-29`); hook setea arreglo |
| SELECT con join | `getNominas` / `getLabores` / `getCuadrillas` | `.../nominas?select=*,trabajadores(*)` (igual para `labores?select=*,labor_trabajadores(trabajador_id)`, `cuadrillas?select=*,cuadrilla_miembros(trabajador_id)`) | idem | — | join desnormalizado en cliente (`nominas.service.js:10-31`, `labores.service.js:11-23`) |
| INSERT tenant-OK | `createTrabajador/Cuadrilla/Labor/Curso/Registro/Nomina` | `POST /api/rest/v1/<tabla>` | idem | service NO envía `company_id`; **el proxy lo inyecta** (`supabaseClient.js:111-117`) | `.select()` devuelve fila; mapeo camel |
| INSERT puente SIN tenant | `createLabor §2` + `addMemberToCuadrilla` | `POST /api/rest/v1/labor_trabajadores`, `/cuadrilla_miembros` | idem pero **sin inyección** (tablas fuera de `TENANT_TABLES`) | `{labor_id,trabajador_id}` / `{cuadrilla_id,trabajador_id}` sin `company_id` | DB exige `company_id NOT NULL` + RLS `WITH CHECK (company_id=current_company())` → fallo funcional (OBS-A2-01) |
| UPDATE | `updateEstadoTrabajador/Labor`, `updateNomina`, `archive/unarchive` | `PATCH /api/rest/v1/<tabla>?id=eq.<id>` | idem; proxy inyecta `company_id` en values + `eq company_id` (`supabaseClient.js:100-104`) | `{estado}` o fila nómina recalculada en cliente | sin relectura (estado local) |
| DELETE físico | `deleteTrabajador/Labor/Nomina/Cuadrilla/Registro` | `DELETE /api/rest/v1/<tabla>?id=eq.<id>` (+`eq company_id` del proxy) | idem | — | RLS exige `administrador`; UI solo `window.confirm`, sin gate rol (OBS-A2-02) |
| Cálculo negocio en cliente | nómina | — (puro JS antes del POST) | — | `total_neto = salario + horas*valorHoraExtra − retenciones` (`nominas.service.js:40,77`); tasa efímera no persistida | DB no recomputa (sin trigger/RPC) → valor cliente es autoridad (OBS-A2-03) |

Grep confirma: **cero `.rpc(` y cero `storage.` en TH** (25 `from(` REST). Documentos: foto/cert como base64 en columnas TEXT; contrato solo filename; bucket `trabajadores` (`018:14`) sin `upload` desde frontend.

## 5. Flujo backend → Supabase

```text
Clerk sign-in + org activa → AuthContext.loadProfile (AuthContext.jsx:29-119)
 → AuthService.fetchUserProfile(token) [GET <backend>/api/auth/me]
 → GetUserProfileUseCase: verify Clerk → org_id+org_role → CLERK_ROLE_MAP → bootstrap_user_org RPC (supabaseAdmin, transacción: profiles+companies+company_users)
 → getRoleWithPermissions(role_id) → generateSupabaseJwt(sub, email, companyUuid, role) [jwt.js:13-30, 15min]
 → setSupabaseToken(supabaseToken, companyUuid) [supabaseClient.js:146] → activeClient + activeOrgId
 → cada from(TENANT_TABLES): select.eq / insert+company_id / update+company_id+eq / delete+eq
 → legacy.js: JWT propio → reenvío (RLS aplica, :212-216); Clerk → mint+401 explícito sin membresía (:242-250, H-03 remediado); sin Bearer en prod → 401 (:191-193); dev sin Bearer → anon (:194-195)
 → PostgREST → RLS 021: current_company() = claim org_id (fallback semilla), current_role_id() = company_users
```

`service_role`/`supabaseAdmin` solo en backend auth (`SupabaseAuthRepository.js`, `legacy.js:getSupabaseAdmin` para mint/bootstrap). **Nunca en el path TH.**

## 6. Gestión de identidad (A2.3-respuesta)

```text
Clerk sub (user) + Clerk org_id ──verify──▶ GetUserProfileUseCase ──bootstrap_user_org──▶ companies.id (UUID tenant) + company_users.role_id
  ──▶ JWT { sub, org_id: companyUuid, role_name } (15min, refresh 9min AuthContext.jsx:96-114)
  ──▶ RLS: current_company()=org_id, current_user_id()=sub, current_role_id()=lookup company_users
  ──▶ frontend: user/empresa/role/permissions + hasPermission('laboral','leer') solo para mostrar el módulo
  ──▶ trabajador: DESCONECTADO (sin FK usuario↔trabajador, declarado en 052/054) → RBAC por trabajador imposible
```

¿`company_id` confiable o del cliente? **Origen servidor-confiable** (`bootstrap → company.id → activeOrgId` desde perfil, no input de form), pero **aplicado por código cliente** (proxy en browser). Manipularlo no escala privilegios: RLS `WITH CHECK (company_id=current_company())` lo rechaza (fail-closed); en tablas puente la ausencia rompe la operación en vez de fugar (a verificar en vivo).

¿Rol frontend = rol que valida Supabase? **No para TH.** Frontend solo gatea visibilidad del módulo; las policies TH genéricas no chequean rol en SELECT/INSERT/UPDATE (solo DELETE admin). Cualquier rol del tenant puede escribir trabajadores/labores/nóminas si alcanza el endpoint con JWT válido (OBS-A2-04, a probar en A6/A8).

## 7. Gestión de tenant

Doble capa: filtro cliente (proxy, UX) + enforcement servidor (RLS). Cobertura proxy: `trabajadores, cuadrillas, labores, nominas, cursos_formacion, registros_formacion` + resto `TENANT_TABLES`; **hueco: `cuadrilla_miembros`, `labor_trabajadores`** (OBS-A2-01). RLS: 8/8 tablas con `company_id=current_company()`; sin validación cruzada lote (la que sí tienen `aplicaciones/monitoreos`), coherente con que TH no tiene `lote_id` formal (`labores.lote TEXT` + `lote_id` nullable que el frontend nunca setea).

## 8. Autorización

Módulo: `App.jsx:17,24-28` (`laboral/leer`, fail-closed fuera de dev per `AuthContext.jsx:140-144`). Sub-tabs: sin gates. Acciones: sin `can*` (Maquinaria tiene 4 mock; TH ni eso). Backend TH: sin controller, sin asserts rol/estado, sin RPC `INVOKER+asserts` (contraste con 052). DEV degrada a `admin */*` (`AuthContext.jsx:12-24,74-85,136-149`) + `legacy.js:228-231` `jwt.decode` sin verificar — **solo dev, blindar NODE_ENV** (mismo H-10 maquinaria).

## 9. Persistencia

REST directo por tabla; transforms snake↔camel en cada service (p. ej. `fecha_nacimiento↔fechaNacimiento`); sin validación esquema (forms solo `required`/trim); sin paginación (carga total + filtro cliente: `GestionPersonal.jsx:23-31`, `HistorialTable.jsx:25-103` que además expande labor→filas por trabajador en memoria); tipos JSDoc (`talento.types.js`) divergentes de DB (estados/tipos, ver A1).

## 10. Manejo de errores

Dos patrones: (a) `trabajadores/cuadrillas/labores`: `throw` → hook `setError` + `alert(...)` (p. ej. `GestionPersonal.jsx:38,44,56`); (b) `nominas/formacion`: `return {success:false}` + `alert('Persistencia no disponible')`, y `generateNominasPeriodo` usa `alert/confirm` para control de flujo (`useNominas.js:82-122`). Sin retry/offline/conflictos; token expirado → 401 hasta refresh 9min; JWT expirado rechazado explícito (`legacy.js:205-209`).

## 11. Integraciones externas y acoplamientos (A2.5)

| Consumidor | Qué usa | Acoplamiento |
| --- | --- | --- |
| `harvestService.js:236-238` | `trabajadores(id,nombres,apellidos)` filtrado `estado==='Activo'` | lectura por estado masculino; se rompe con `Activa` (A1) |
| `maquinaria/operation.repository.js:64-72` | match nombre→`trabajadores.id` para operador | best-effort por texto, sin FK; colisión/renombre lo rompe |
| `inventorySeed.js:26-33` | lee `trabajadores` para responsables | seed depende de datos TH |
| `011_bodegas.sql:15` | `bodegas.responsable_id → trabajadores(id) SET NULL` | FK real, la única dura hacia TH |
| `042:23` | `cosechas.responsable_id TEXT` (clerk o trabajador) | sin FK, ambigua |
| `048:50` | `traceability_events.executor_id TEXT` | sin FK, texto libre |
| `052/054` | operador snapshot + nota sin vínculo usuario↔trabajador | decisión explícita, limita trazabilidad ejecutor |

Dirección: TH no importa de otros módulos (autocontenido salvo `workers/cuadrillas` cruzados entre sus propios tabs); otros módulos leen TH de forma frágil (nombre/estado/texto).

## 12. Riesgos arquitectónicos (provisionales, sin severidad definitiva)

- RA-01 Lógica de negocio en cliente (salario/total/archivo-estado) sin contraparte servidor.
- RA-02 Tenant parcial en puentes (diseño del proxy, no dato).
- RA-03 Autorización solo-presentacional bajo datos PII/salarios.
- RA-04 Identidad trabajador fuera del grafo de acceso (auditoría ejecutor imposible).
- RA-05 Carga total + joins cliente (escala y PII en memoria).
- RA-06 Documentos sensibles en columnas TEXT base64 sin lifecycle storage.

## 13. Diagrama actual (verificado)

```text
UI (TalentoHumano shell+5 coordinadores+modals/forms, estado local, sin router)
 ↓ hooks (5, fetch-all + mutación optimista local, 2 patrones de error)
 ↓ services (5, snake↔camel + cómputo nómina + inserts sin company_id, 0 rpc / 0 storage)
 ↓ supabaseClient proxy (TENANT_TABLES 6/8 TH; inyecta company_id; JWT 15min + activeOrgId del perfil)
 ↓ POST /api/rest/v1/* (+apikey reinyectada)
 ↓ legacy.js (verifica JWT / mintea desde Clerk / 401 explícito / H-03 remediado)
 ↓ PostgREST → PostgreSQL + RLS 021 genérica (company=current_company; DELETE admin; sin asserts rol/estado/negocio)
 ↓ 8 tablas (010/014/016/017) + bucket sin usar; sin RPC/trigger TH
Sub-grafo identidad (server): Clerk → bootstrap_user_org → companies.id → JWT org_id → RLS (sólido)
Sub-grafo trabajador (roto): trabajadores ∌ auth (sin FK) → sin RBAC/auditoría por ejecutor
Lectores externos: harvest (estado), maquinaria (nombre), inventario (seed), bodegas (FK), cosecha/trazabilidad (TEXT)
```

## 14. Tabla TH-F → cadena (resumen; detalle en A1)

```text
TH-F01/F02/F03/F04/F05 → GestionPersonal/WorkerTable|Card|Form|Modal → useTrabajadores → trabajadores.service → REST trabajadores → RLS genérica
TH-F06/F07 → Cuadrillas/CuadrillaCard → useCuadrillas(+useTrabajadores) → cuadrillas.service → REST cuadrillas (tenant OK) / cuadrilla_miembros (SIN tenant)
TH-F08/F09/F10 → Labores/Kanban/Historial/LaborModal → useLabores(+Trabajadores+Cuadrillas) → labores.service → REST labores (OK) / labor_trabajadores (SIN tenant); jornal→horas en cliente
TH-F11/F12 → Formacion/CursosTable/RegistroTable/CursoModal/RegistroModal/DashboardDrawer → useFormacion(+Trabajadores+Cuadrillas) → formacion.service → REST cursos/registros (tenant OK); cert base64 en columna
TH-F13…F17 → Nominas/NominasTable/NominaModal → useNominas(+Trabajadores) → nominas.service (total_neto cliente) → REST nominas+join trabajadores
TH-F18 → harvest/maquinaria/inventario/bodegas/cosecha/trazabilidad (lecturas frágiles, §11)
TH-F19 → columnas TEXT base64 + filename (sin storage)
```

## 15. Hallazgos A2 (observación → evidencia → impacto → severidad provisional)

- OBS-A2-01 Tablas puente fuera del tenant proxy → `supabaseClient.js:46-69` vs `labores.service.js:55`, `cuadrillas.service.js:46` + `010:44,014:27` NOT NULL → inserción funcionalmente rota / RLS fail-closed → P0 potencial (estructural).
- OBS-A2-02 Deletes físicos sin gate UI → `GestionPersonal.jsx:51`, `Labores.jsx:73`, `Nominas.jsx:114`, `Cuadrillas.jsx:38` vs RLS DELETE admin → UX confusa + cascadas (`010/014/017` CASCADE) → P1 potencial.
- OBS-A2-03 Nómina calculada en cliente sin recomputo servidor → `nominas.service.js:40,77`, `NominaModal.jsx:53-56`, `Nominas.jsx:40` → manipulación de salario/total → P0/P1 potencial (seguridad).
- OBS-A2-04 Sin autorización por acción → `App.jsx:17` único gate vs `021:128-183` sin rol en SELECT/INSERT/UPDATE TH → cualquier rol tenant escribe PII/salarios → P0/P1 potencial.
- OBS-A2-05 Identidad trabajador desconectada → `052/054` notas + `GetUserProfileUseCase`/`jwt.js` sin trabajador → sin trazabilidad ejecutor → P1 potencial.
- OBS-A2-06 Fetch-all + expansión cliente → hooks `refresh` + `HistorialTable.jsx:25-103` → escala/PII en memoria → P2.
- OBS-A2-07 Storage declarado sin usar + PII base64 en columnas → `018:14` vs grep `storage.` vacío en TH → lifecycle/retención sin control → P1/P2 (A7 lo detalla).

`--live` sigue BLOQUEADO; veredicto: NO CERTIFICADO. Siguiente: A3 modelo de datos (DDL real vs uso).
