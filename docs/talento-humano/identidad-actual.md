# A4 — Identidad actual: usuario ↔ trabajador (solo lectura)

> Rama: `diagnostico/talento-humano-integral` | A0/A1: `cad8662` | A2/A3: `eb7daf4` | Fecha: 2026-09-15.

## 1. Arquitectura de identidad (verificada)

```text
CLERK (IdP externo: user id `user_*`, org `org_*`, org_role)
  │ verifySessionToken / verifyToken
  ▼
backend GetUserProfileUseCase (CLERK_ROLE_MAP → VALID_ROLES 005)
  │ bootstrap_user_org RPC (025, supabaseAdmin, atómico)
  ▼
profiles.id (= clerk sub, PK TEXT) + companies.id (UUID, clerk_org_id UNIQUE) + company_users(company_id, clerk_user_id, role_id)
  │ generateSupabaseJwt (jwt.js:13-30, 15 min)
  ▼
JWT { sub, org_id: companyUuid, role_name, role:'authenticated' }
  │ setSupabaseToken → legacy.js verifica/remintea → PostgREST
  ▼
RLS: current_company()=org_id, current_user_id()=sub, current_role_id()=lookup
  │
  ├────▶ EMPRESA + ROL + PERMISOS (permisos seed 006) ──▶ frontend hasPermission('laboral','leer')
  │
  ╳────▶ TRABAJADOR (sin arista: no existe FK, columna, ni RPC que los una)
```

## 2. Clerk

IdP y única fuente de autenticación. `AuthContext.jsx:9-119`: `useAuth{isLoaded,isSignedIn,orgId,getToken}`, sin org → pantalla `OrganizationList` (no hay modo sin empresa). DEV bypass (`bypassAuth` + fallback admin `*/*`, `AuthContext.jsx:12-24,74-85`) — fuera de prod.

## 3. JWT

`backend/src/shared/utils/jwt.js:13-30` = `legacy.js:57-74` (duplicado): `{aud:authenticated, exp:+15min, sub, email, role:authenticated, app_metadata.clerk, org_id: companyUuid, role_name}`. Refresh 9 min (`AuthContext.jsx:96-114`). Expirado → rechazo explícito (`legacy.js:205-209`). Sin `trabajador_id`, sin `predio`, sin permisos embebidos (rol por nombre, permisos por tabla `permisos`).

## 4. Empresa

`companies` (`003`): `id UUID PK`, `clerk_org_id UNIQUE NOT NULL`, `estado active/inactive/suspended`. Bootstrap (`025`) upsert por `clerk_org_id` + lote semilla `Las Margaritas` + membresía (preserva rol manual). Tenant efectivo = `companies.id` (UUID), nunca el `org_*` crudo (el proxy recibe `companyUuid`, `AuthContext.jsx:65-66`).

## 5. Roles

Seed `005`: 9 roles (`super_admin,gerente,administrador,ingeniero,supervisor,operario,auditor,invitado,consulta`). Matriz `006`: `laboral` → `supervisor:todo`, `operario:leer+crear`, `administrador/gerente:*/todo`, `auditor:*/leer`, `ingeniero:sin laboral`. `company_users.role_id TEXT FK roles RESTRICT` + `UNIQUE(company_id,clerk_user_id)` (`007`): un usuario = un rol por empresa; multi-empresa = N membresías. Homonimia peligrosa: rol operativo TH `Supervisor de Campo` (ROLES) ≠ rol acceso `supervisor` — cadenas distintas sin vínculo.

## 6. Persona

No existe entidad `persona`. Sus atributos están incrustados en `trabajadores` (nombres, documento, fechas, RH/EPS/ARL, teléfonos, foto) y en `profiles` (nombre, apellido, email). Documento: `UNIQUE(company_id,identificacion)` — identidad laboral por empresa. Email: `UNIQUE` global en `profiles` — identidad acceso global. **Sin puente entre ambas.**

## 7. Trabajador

`trabajadores` = registro operativo con PII, sin credenciales, sin email, sin `user_id` (grep `email|clerk|user_id|created_by` en TH: vacío). Creación: cualquier actor con JWT del tenant (RLS sin rol). Lifecycle: `estado` texto + `deleted_at` muerto (delete físico).

## 8. Usuario ↔ trabajador (A4.1-respuesta + casos)

| Identidad | Fuente | Persistencia | Uso |
| --- | --- | --- | --- |
| Usuario autenticado | Clerk `sub` | `profiles.id` (cache) | auth/auditoría JWT |
| Empresa | bootstrap/JWT | `companies.id` | tenant |
| Rol acceso | Clerk org_role→map→`company_users.role_id` | `company_users` + JWT `role_name` | autorización (módulo) |
| Trabajador | PostgreSQL (alta manual) | `trabajadores.id` | operaciones TH |
| Documento | TH digitado | `trabajadores.identificacion` UNIQUE empresa | identidad laboral |
| Email | Clerk | `profiles.email` UNIQUE global | identidad acceso |

- Caso 1 (usuario+trabajador): **sin asociación modelada** (B). Coexistencia nominal sin vínculo.
- Caso 2 (usuario sin trabajador): **flujo normal** (admin/ingeniero operan TH sin ser trabajadores).
- Caso 3 (trabajador sin usuario): **flujo normal y mayoritario** (campo sin Clerk).
- Caso 4 (asociación incorrecta A↔B): **nada lo impide** — no hay constraint; el único "vínculo" es texto (D, §9).
- Caso 5 (trabajador eliminado, usuario activo): independientes — borrar trabajador no toca `profiles/company_users` (CASCADE solo hacia abajo TH + `bodegas SET NULL`); desactivar usuario no afecta trabajador.

## 9. Resolución actual por nombre (A4.2-respuesta: componente, algoritmo, homónimos)

Único resolvedor usuario→trabajador en el sistema, fuera de TH:

- `maquinaria/repository/operation.repository.js:67-84` `resolveOperadorId(nombre)`: trim → primer token (`split(/\s+/)[0]`) → `ilike nombres %token% limit 10` (tenant vía RLS) → match exacto `nombres+apellidos == nombre` (case-insensitive) → `id`, si no `null` (RPC 054 conserva texto snapshot).
- `harvestService.js:236-238`: `eq estado 'Activo' limit 50` (sin matching, selector).
- `HistorialTable`/`getLaborAssigneeName`: resolución por `id` en memoria (sana, no es identidad).

Homónimos: `exact` falla → `null` → operación queda con texto sin FK (trazabilidad degradada a string). Cambio de nombre: FK ya guardada sobrevive, pero futuras resoluciones del mismo texto fallan o apuntan a otro (sin historia de nombres). Dos trabajadores iguales: indistinguibles para el resolvedor. `nombre ≠ identidad, nombre ≠ autorización` — confirmado con evidencia.

## 10. Empresa (A4.4-respuesta)

Vínculo real: `usuario → empresa (company_users)` y `trabajador → empresa (trabajadores.company_id)`. Entre sí: **estrella por empresa sin arista directa** (`usuario → empresa ← trabajador`). La arquitectura objetivo necesita la arista (`usuario ↔ trabajador` scoping empresa) con cardinalidad decidida en diseño, no aquí.

## 11. Cardinalidad (A4.5 — opciones sin asumir)

Hoy: `N:M` implícita por texto (cualquiera). Opciones de diseño: (a) `usuario 1:0..1 trabajador` + `trabajador 0..1:0..1 usuario` (recomendable estudiar; un operario con login ve solo lo suyo); (b) `usuario 1:N` (multi-rol campo, complejo); (c) mantener desacoplado + actor explícito por operación (mínimo auditoría). Decisión post-diagnóstico.

## 12. Auditoría (A4.6-respuesta)

Actor en 0/8 tablas TH; server solo `audit_trabajadores_trigger` (si vive). `audit_logs` guarda `usuario_id/email` del JWT (actor administrativo), nunca `trabajador afectado` como entidad. Distinción requerida: `performed_by` (clerk sub, quién ejecuta) vs `affected_worker` (trabajador.id, sobre quién) vs `on_behalf` (autoservicio futuro). Ejemplo: `Administrador Juan (sub) modifica Trabajador Pedro (id)` — hoy solo persistiría el cambio, sin quién.

## 13. Casos ambiguos

- Operario con login (`operario: crear laboral`) registra su propia labor: indistinguible de un admin que la registra por él.
- `Supervisor de Campo` (cargo) vs `supervisor` (rol): un cargo puede no tener el rol y viceversa; UI no distingue.
- `NominaModal` muestra `rol + CC` del trabajador seleccionado — PII expuesta a quien liquida, sin registro de quién liquidó.
- Bootstrap crea `profiles` sin trabajador espejo: todo usuario nace "sin cuerpo operativo".

## 14. Requisitos derivados (para contrato técnico, no diseño)

R-A4-01 Decidir cardinalidad usuario↔trabajador scoping empresa. R-A4-02 Actor obligatorio (`performed_by`) en escrituras TH + `affected_worker` donde aplique. R-A4-03 Eliminar resolución por nombre como mecanismo (mantenerla como ayuda UI con confirmación explícita + FK). R-A4-04 Separar namespace cargo vs rol acceso. R-A4-05 Definir lifecycle trabajador↔usuario (alta/baja/desvinculación independientes pero trazadas).

## 15. Hallazgos A4

- OBS-A4-01 Sin vínculo usuario↔trabajador (B+D) → `profiles/company_users` vs `trabajadores` sin arista; bootstrap no crea trabajador; grep vacío → P0 estructural (identidad).
- OBS-A4-02 Resolución por primer-token (`operation.repository.js:67-84`) → colisiones/nulos silenciosos, snapshot texto como fallback permanente → P1 (integridad/trazabilidad).
- OBS-A4-03 Actor ausente 8/8 + auditoría 1/8 → operaciones anónimas a nivel dominio → P1 (auditoría).
- OBS-A4-04 Homonimia cargo/rol (`Supervisor`) + matriz `laboral` sin enforcement backend → autorización ambigua → P1 (RBAC, se detalla en A6).
- OBS-A4-05 Email global vs documento por-empresa sin puente → mismo humano irreconciliable entre dominios → P2 (diseño).

`--live` BLOQUEADO; NO CERTIFICADO. Siguiente: A5 empresa/predio (profundizar tenant + triangularidad + alcance predial).
