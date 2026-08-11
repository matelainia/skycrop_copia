# Análisis de errores potenciales — SkyCrop

**Fecha:** 2026-08-09
**Alcance:** `backend/` (Express, arquitectura hexagonal), `apps/web` (React + Vite), `apps/auth` (Next.js + Clerk), `packages/*` (compartidos del monorepo).
**Método:** revisión estática manual de código (routers, casos de uso, repositorios Supabase, contextos/hooks de React, middleware de Next.js), sin ejecutar la aplicación ni tests dinámicos.

> Este documento es un informe de solo lectura. No se modificó ningún archivo de código como parte de este análisis.

---

## Resumen ejecutivo

El proyecto tiene una arquitectura backend moderna (hexagonal/DDD) bien encaminada, pero conviven **tres familias de problemas graves y transversales**:

1. **Autenticación/autorización insuficiente o evitable.** Existe un patrón repetido de "si la verificación de firma del token falla, decodifica igual el token sin validarlo" (`jwt.decode`) tanto en el backend legacy como en el módulo de auth moderno. Además, la mayoría de routers de negocio (`agronomy`, `evaluation`, `fertilization`, `gee`, `inventory`, `weather`) no tienen middleware de autenticación real: usan `company_id`/`user_id` de desarrollo (`'company_dev'`, `'user_dev'`) como *fallback* cuando no hay sesión, y las consultas usan el cliente `service_role` de Supabase (que **bypassa RLS**), por lo que la única barrera de seguridad multi-tenant es la lógica de aplicación, que en varios puntos falta.
2. **Aislamiento multi-tenant (multi-empresa) roto en varios puntos**, tanto en backend (consultas de `lotes` sin filtrar por `company_id`, creación de evaluaciones que confían en el `company_id` enviado por el cliente) como en frontend (`localStorage` sin scope de empresa, tablas sin incluir en el proxy de tenant de Supabase).
3. **Funcionalidad que aparenta funcionar pero no persiste ni refleja datos reales**: botones "Eliminar" que solo tocan el estado de React, errores de Supabase que se tragan y se reportan como éxito, filtros de tablas que nunca llegan a aplicarse, métricas/gráficos con valores fijos hardcodeados, y registros de auditoría (incluida auditoría legal de manejo de agroquímicos) atribuidos a usuarios ficticios.

Se identificaron además bugs puntuales de lógica (un `await` faltante que hace que un endpoint siempre devuelva `{}`, una fecha "Hoy" hardcodeada como "Vie", condiciones `||` que descartan `0` legítimo, etc.) y riesgos de XSS por interpolar datos de usuario en HTML sin escapar (exportación de PDF, tanto en frontend como backend).

---

## Índice de hallazgos por severidad

- 🔴 [Crítico](#crítico) — 10 hallazgos
- 🟠 [Alto](#alto) — 21 hallazgos
- 🟡 [Medio](#medio) — 20 hallazgos
- 🟢 [Bajo](#bajo) — 15 hallazgos

---

## Crítico

### C1. Bypass de autenticación: `jwt.decode()` sin verificar firma como fallback
**Archivos:**
- `backend/api/legacy.js` (líneas ~108-116)
- `backend/src/modules/auth/infrastructure/adapters/outbound/ClerkAuthService.js` → `verifySessionToken` (líneas ~10-24)

Cuando `verifyToken()` de Clerk lanza una excepción (firma inválida, token expirado, error de red), el `catch` ejecuta `jwt.decode(token)`, que **no valida la firma**, y usa el `sub`/`org_id` de ese payload no verificado para resolver la empresa/rol del usuario y generar un JWT de Supabase con RLS. En `ClerkAuthService.js` el comentario dice "fallback para desarrollo", pero no hay ningún guard de entorno (`NODE_ENV`/`import.meta.env.DEV`): se ejecuta igual en producción.

**Impacto:** cualquier atacante puede fabricar un JWT arbitrario (payload en base64 sin firma válida) con un `sub` de un usuario conocido y obtener un token de Supabase válido actuando como esa identidad/empresa. Es un bypass de autenticación completo.

**Recomendación:** eliminar el fallback a `jwt.decode`. Si `verifyToken` falla, la petición debe rechazarse (401), sin excepción para ningún entorno servido públicamente.

### C2. Secreto de firma JWT hardcodeado como valor por defecto
**Archivo:** `backend/api/legacy.js`, línea 21

```js
const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET || 'super-secret-supabase-jwt-key-change-me-in-prod';
```

Si `SUPABASE_JWT_SECRET` no está definida en el entorno de ejecución de `legacy.js`, se firman JWTs de Supabase con un secreto público (visible en el repositorio). Cualquiera que lea el código puede forjar tokens válidos con cualquier rol/empresa, bypasseando RLS por completo. (El nuevo `shared/config/env.js` sí exige esta variable vía Zod y aborta el arranque si falta — el problema queda acotado a este archivo legacy, que igual se monta y ejecuta en el mismo proceso).

**Recomendación:** quitar el default inseguro; si falta la env var, lanzar un error de arranque explícito.

### C3. Endpoints de auditoría de toxicidad sin autenticación
**Archivos:** `backend/src/modules/application/infrastructure/adapters/inbound/ExpressApplicationAuditController.js` (líneas 12-40, 45-74), `ExpressApplicationAuditRouter.js` (líneas 20-25), y exclusión explícita en `backend/api/legacy.js` línea 100

`POST /api/auditoria/alta-toxicidad` y `POST /api/auditoria/estado-aplicacion` no verifican ningún token de sesión, no validan que `aplicacion_id` pertenezca a la empresa del solicitante, y el repositorio usa el cliente `service_role` (bypassa RLS). `legacy.js` excluye explícitamente `/auditoria/estado-aplicacion` de la traducción de token.

**Impacto:** cualquiera, sin autenticarse, puede falsificar el registro legal de "confirmación profesional" de manejo de agroquímicos de alta toxicidad para cualquier empresa, o alterar el estado de auditoría de aplicaciones ajenas. Compromete la integridad de registros con implicancia regulatoria.

### C4. No hay middleware de autenticación en los routers de negocio
**Archivo:** `backend/src/app.js` (líneas 158-177) + todos los repositorios de `agronomy`, `evaluation`, `fertilization`, `gee`, `inventory`, `weather` (usan `supabaseAdmin`, cliente `service_role`)

Ninguno de estos routers tiene middleware que valide el JWT y pueble `req.user`/`req.auth`. Al usar el cliente `service_role` (que bypassa RLS) en los repositorios, la única barrera de seguridad multi-tenant recae en la lógica de aplicación, que en la práctica no está aplicada de forma consistente en estas rutas.

### C5. `company_id`/`userId` de desarrollo hardcodeados como fallback en Fertilización
**Archivo:** `backend/src/modules/fertilization/infrastructure/adapters/inbound/ExpressFertilizationController.js`, método `_getAuth` (líneas ~50-59)

```js
const companyId = req.user?.company_id || req.user?.empresa_id || req.auth?.orgId || 'company_dev';
const userId = req.user?.id || req.auth?.userId || req.auth?.sub || (authHeader ? 'user_dev' : null);
```

Como `req.user`/`req.auth` nunca se pueblan (ver C4), **todas** las peticiones a este controlador (detalle de plan, PATCH, observaciones, comentarios, completar aplicación, exportar PDF, adjuntos) usan literalmente `company_id = 'company_dev'`. La única ruta con `requireToken=true` (`sugerirPlan`) solo exige que el header empiece con `"Bearer "`, sin verificar el token, por lo que cualquier valor arbitrario lo satisface.

**Impacto:** rompe completamente el aislamiento multiempresa; en la práctica todas las empresas comparten el mismo tenant ficticio en este módulo.

### C6. IDOR cross-tenant: consultas de `lotes` sin filtrar por `company_id`
**Archivos:**
- `backend/src/modules/agronomy/infrastructure/adapters/outbound/SupabaseAgronomyRepository.js` → `getLoteConCultivo` (líneas 265-282)
- `backend/src/modules/agronomy/infrastructure/adapters/outbound/SupabaseObjectRepository.js` → `getLoteConCultivo` (líneas 220-237)
- `backend/src/modules/evaluation/infrastructure/adapters/outbound/SupabaseEvaluationRepository.js` → `getLoteGeom` (líneas 275-288)

Las tres consultan `lotes` filtrando solo por `.eq('id', loteId)`, sin `company_id` (columna que sí existe en la tabla). Combinado con C4 (sin auth) y el uso de `service_role`, cualquiera que conozca o enumere un UUID de lote puede obtener el formulario de monitoreo completo o la geolocalización de un lote de otra empresa.

### C7. `CreateEvaluationUseCase` confía en el `company_id` enviado por el cliente
**Archivo:** `backend/src/modules/evaluation/application/usecases/CreateEvaluationUseCase.js` (líneas 9-22)

A diferencia de `DraftEvaluationUseCase.js` (que sí exige `company_id`), este caso de uso no lo valida: viaja directo desde el body JSON hasta la RPC `guardar_evaluacion_v2`. Un cliente puede registrar evaluaciones asociándolas a cualquier `company_id` arbitrario.

### C8. Fail-open de permisos: fallo de red otorga rol Administrador con acceso total
**Archivo:** `apps/web/src/context/AuthContext.jsx` (líneas ~59-70, 118, 127)

Si `AuthService.fetchUserProfile(token)` falla (backend caído, timeout, error 500), el `catch` asigna `role: 'Administrador'` y `permissions: [{ recurso: '*', accion: '*' }]`. Lo mismo ocurre si `profile.permissions` llega vacío o `profile.role` es `null`. El comentario dice "fallback para desarrollo", pero no hay ningún guard de entorno: se ejecuta igual en producción.

**Impacto:** cualquier usuario autenticado en Clerk cuyo perfil no cargue por un fallo transitorio obtiene acceso total en la UI a todos los módulos. Debería ser *fail-closed* (denegar por defecto), no *fail-open*. El impacto final depende de si el backend re-valida permisos en cada endpoint (ver C4/C5: en varios módulos no lo hace).

### C9. Auditoría con identidad de usuario/empresa hardcodeada (frontend)
**Archivos:**
- `apps/web/src/modules/maquinaria/audit/audit.service.js` (líneas 21-28), invocado desde `machinery.service.js`, `maintenance.service.js`, `operation.service.js` sin pasar nunca `user`/`empresaId` reales.
- `apps/web/src/components/manejo-sanitario/context/LotsContext.jsx` (`logAudit`, líneas 28-37, usuario fijo `"Andrés Castro"`).
- `apps/web/src/components/manejo-sanitario/components/PlanificadorAplicaciones.jsx` (línea 617, `logToxicityAudit({ user: 'anonimo', ... })`).

**Impacto:** el 100% de los registros de auditoría de maquinaria y de manejo sanitario (incluida la auditoría legal de manejo de agroquímicos de alta toxicidad) queda atribuido a usuarios/empresas ficticios, sin importar quién ejecutó la acción realmente. Invalida el propósito del audit trail para trazabilidad regulatoria y rendición de cuentas.

### C10. Botones "Eliminar" que no eliminan nada en el backend
**Archivos:** `apps/web/src/components/manejo-sanitario/components/LedgerPanel.jsx` (líneas 197-199, 235, 271, 305, 339) y `.../components/views/MonitoringView.jsx` (`handleDelete`, líneas 214-218)

Estos botones solo ejecutan `setState(prev => prev.filter(...))` sobre el estado de React; ninguno llama a un repositorio/Supabase (para "Aplicaciones" sí existe el flujo correcto en `useApplications.js`, pero este componente no lo usa). El registro persiste en la base de datos y **reaparece al recargar la página**.

### (Adicional crítico) C11. Tablas de tenant faltantes en el proxy de Supabase → posible IDOR
**Archivo raíz:** `apps/web/src/lib/supabaseClient.js` (`TENANT_TABLES`, líneas 19-24) — no incluye `costos` ni `planificacion_cosechas`, consultadas por `costRepository.js` y `harvestRepository.js`.

A diferencia de `lotes`, `maquinaria`, `aplicaciones`, etc., estas dos tablas no reciben el filtro automático `.eq('company_id', activeOrgId)` que el proxy central inyecta. Si no existe una política RLS de respaldo equivalente en el backend, cualquier usuario autenticado podría leer/insertar registros de costos y planificación de cosechas de otra empresa.

---

## Alto

| # | Archivo(s) | Problema | Impacto |
|---|---|---|---|
| A1 | `backend/api/legacy.js` (líneas 60-64) | `console.log('Headers recibidos:', req.headers)` en un middleware global que corre en toda petición, incluyendo el header `Authorization` en texto plano | Fuga de tokens de sesión reales en logs de producción (Vercel) |
| A2 | `backend/src/modules/auth/application/usecases/ProcessClerkWebhookUseCase.js` (líneas ~54-79) | En eventos `organizationMembership.*` se usa el Clerk Org ID (`org_xxx`) directamente como `company_id`, en vez de resolver el UUID interno como se hace en el resto del código | Rompe la sincronización automática de altas/bajas/roles desde el panel de Clerk; un usuario removido de una organización no se elimina de `company_users` |
| A3 | `backend/api/legacy.js` (líneas 25, 121-157) | `getCachedSupabaseToken` indexa solo por `clerkUserId`, ignorando el `orgId` actual | Un usuario con varias organizaciones que cambia de organización activa sigue operando hasta 10 min con el JWT/rol de la organización anterior |
| A4 | `backend/api/legacy.js` (`jwtCache`), `backend/src/shared/cache/cache.service.js` | Cachés en memoria (`Map`) usadas en un despliegue serverless (Vercel, confirmado en `vercel.json`/`package.json`) | La invalidación explícita al revocar acceso solo afecta a la instancia que la procesó; otras instancias siguen sirviendo permisos ya revocados hasta expirar el TTL |
| A5 | `backend/src/modules/agronomy/infrastructure/adapters/inbound/ExpressAgronomyController.js` (líneas 53-63) | Falta un `await` en `getEstadosFenologicos(cultivoId)`; el `await this.objectRepo` de al lado no hace lo que el autor creía (no es una promesa) | El endpoint `GET /agronomia/cultivos/:cultivoId/estados-fenologicos` serializa una `Promise` pendiente como `{}` y **nunca devuelve datos reales** |
| A6 | `backend/src/modules/evaluation/domain/services/EvaluationEngine.js` (líneas 233-256) | La jerarquía de niveles de riesgo (`Crítico`/`Alto`/`Medio`/`Bajo`) es un lookup exacto sensible a mayúsculas/tildes/espacios sobre un campo de texto libre definido por el usuario | Un valor como `"crítico"` o `"Alto "` cae a severidad 0 silenciosamente, pudiendo ocultar el nivel de riesgo real de una evaluación agronómica |
| A7 | `backend/src/modules/evaluation/domain/services/EvaluationEngine.js` → `_clasificarEnEscala` (líneas 133-145) | Un valor fuera de cualquier rango definido siempre cae en la última escala (la más severa), sin distinguir "por encima del máximo" de "por debajo del mínimo" | Datos anómalos o mal capturados pueden generar falsas alertas de máximo riesgo agronómico |
| A8 | `backend/src/modules/evaluation/application/usecases/GeocodeLoteUseCase.js` (línea 1) | `import fetch from 'node-fetch'` sin que el paquete esté declarado en `backend/package.json` (solo existe como dependencia transitoria); además es código muerto (el resto del archivo usa `global.fetch || (await import('node-fetch'))`) | Riesgo de romper el arranque completo de la app si la cadena transitiva cambia |
| A9 | `GoogleWeatherAdapter.js`, `OpenMeteoWeatherAdapter.js`, `EarthEngineServiceAdapter.js`, `GeocodeLoteUseCase.js` (Nominatim) | Llamadas a APIs externas sin `AbortController`/timeout | Si el proveedor externo se cuelga, la petición del usuario puede quedar bloqueada indefinidamente |
| A10 | `backend/src/modules/fertilization/infrastructure/adapters/outbound/FertilizationPdfAdapter.js` (`_buildHtml`, líneas 76-304) | HTML generado interpolando campos de usuario sin escapar, servido como `text/html` | XSS almacenado si un usuario incluye HTML/`<script>` en observaciones/títulos que luego se exportan a PDF |
| A11 | `backend/src/modules/gee/infrastructure/adapters/inbound/ExpressGeeRouter.js` (línea 18) | `POST /gee/index` sin sesión ni rate-limit | Cualquiera puede consumir la cuota/costo de la cuenta de servicio de Earth Engine enviando polígonos repetidamente |
| A12 | `SupabaseProductRepository.js`, `SupabaseAgronomyRepository.js`, `SupabaseObjectRepository.js`, `SupabaseProtocolRepository.js` | Términos de búsqueda libres del usuario concatenados directamente en filtros `.or()/.ilike()` de PostgREST sin escapar comas/paréntesis | Un input como `x,columna.is.null` puede alterar la lógica booleana del filtro (no permite SQL arbitrario, pero sí bypass/alteración del filtrado) |
| A13 | `apps/web/src/utils/pdfExporter.js` (líneas 16-29, 54-93, 102) | `exportFertilizationPlanPDF` interpola campos de formulario en HTML sin escapar y usa `printWindow.document.write(htmlContent)` | Equivalente a un `dangerouslySetInnerHTML` sin sanitizar; XSS si un campo contiene marcado malicioso |
| A14 | `apps/web/src/modules/fertilization/hooks/usePlans.js` (líneas 69-125) | Existen dos rutas de carga de datos (`fetchPlans` vs. el `useEffect`); el `useEffect` real anida `filters` en vez de expandirlo, y el repositorio espera las propiedades en el nivel superior | **Los filtros de búsqueda/estado/vigencia de la tabla de Planes de Fertilización nunca tienen efecto**, sin ningún error visible |
| A15 | `apps/web/src/modules/Climate/components/ClimateIndicators.jsx` (líneas 58-100), `ClimateRecommendationCard.jsx` (líneas 177, 189); sin Error Boundary en toda la app | Acceso a `current.windSpeed.toFixed(0)`, `current.uvIndex`, etc. sin verificar `null`/`undefined`, sin ningún Error Boundary en `main.jsx`/`App.jsx` | Un campo climático faltante lanza un `TypeError` que tumba el árbol de React completo (pantalla en blanco) |
| A16 | `apps/web/src/modules/Climate/components/ClimateForecast.jsx` (línea 13) | `getDayLabel` retorna `{ day: 'Vie', desc: 'Hoy' }` fijo para el índice 0, sin usar `new Date()` | El pronóstico muestra "Vie" como el día actual sin importar qué día sea realmente |
| A17 | `apps/web/src/lib/supabaseClient.js` (líneas 9-10, 36-77) | Fallback silencioso a URL/proyecto Supabase real si faltan las env vars; el filtrado de `company_id` se implementa enteramente en un `Proxy` de cliente | El aislamiento multi-tenant depende de JS ejecutado en el navegador, manipulable vía DevTools/proxy HTTP si el backend no revalida |
| A18 | `apps/web/src/modules/fertilization/api/plan-detail.api.js` (líneas 18-24) | Lectura de token de sesión (`sb_access_token`) desde `localStorage`/`sessionStorage` | Patrón vulnerable a robo de tokens vía XSS (vs. cookies `HttpOnly`); hoy es código muerto porque nada escribe ese valor, pero el diseño ya lo contempla |
| A19 | `apps/web/src/modules/maquinaria/permissions/canCreateMachine.js`, `canDeleteMachine.js`, `canRegisterMaintenance.js`, `canStartOperation.js` | Todas las funciones de permisos retornan `true` siempre (`"Enterprise permission mock"`) | Cualquier usuario autenticado puede crear/eliminar maquinaria o registrar mantenimientos/operaciones falsas, sin importar su rol |
| A20 | `apps/web/src/components/manejo-sanitario/repositories/{agronomyRepository,geeRepository,productRepository}.js` | `fetch()` nativo sin header `Authorization` ni `credentials: 'include'` | Si el backend exige sesión, estas llamadas fallan silenciosamente; si no la exige, cualquier visitante no autenticado puede consultarlas sin restricción de tenant |
| A21 | `manejo-sanitario/validators/application.validator.js` (líneas 1-10), `ApplicationForm.jsx` (líneas 18-29) | Solo se exige `producto_comercial`; el `<select>` de "Lote" no es `required` | Es posible registrar una aplicación fitosanitaria sin lote, dosis ni período de carencia válido — crítico para seguridad alimentaria |

*(Hallazgos adicionales de severidad Alta detectados: datos de negocio en `localStorage` sin scope de tenant/usuario en varios hooks de `manejo-sanitario` y `maquinaria`; adjuntos de lotes que nunca se suben realmente; importador de geometría que genera coordenadas aleatorias para `.shp`/formatos no soportados; errores de Supabase silenciados como éxito en `TalentoHumano` (`useFormacion.js`, `useNominas.js`); inconsistencia `empresa_id` vs `company_id` en el dominio de maquinaria; `AdjustStockModal` que permite stock negativo; `inventory.schema.js` sin validar que `quantity`/`minQuantity` sean numéricos; campo `volumen_agua` que nunca se completa desde el formulario y por eso `volumen_aplicado` siempre vale 200; gráficos y métricas de maquinaria (combustible, costos, reportes) completamente hardcodeados y desconectados de `costCalculator`; `hoursToday || 6` que trata `0` legítimo como "sin datos" e infla el combustible calculado. Ver detalle completo en los hallazgos originales si se requiere.)*

### A22. Redirect abierto potencial en `apps/auth`
**Archivo:** `apps/auth/middleware.ts` (líneas 22-24)

El middleware toma `redirect_url` de los query params entrantes y lo reinyecta tal cual en la URL de `/sign-in`, que Clerk usa para decidir a dónde enviar al usuario tras autenticarse. Si la única barrera es la allowlist configurada en el dashboard de Clerk, un enlace `?redirect_url=https://sitio-malicioso.com` podría desviar al usuario tras el login.

### A23. Esquema de validación de planes duplicado y ya divergente
**Archivos:** `packages/types/index.js` vs `index.ts`; `packages/types/src/plan-schema.js` vs `plan-schema.ts`; consumido con una ruta relativa de 5 niveles desde `backend/src/modules/fertilization/application/sugerir-plan.usecase.js` (línea 4), sin pasar por el paquete `@skycrop/types`.

La versión `.ts` ya agrega campos (`PlanRequest`, `PlanResponse`, `AiUsageMetadata`) ausentes en la `.js`. Si se ajustan reglas de validación en un archivo y no en el otro, backend y frontend validarán de forma distinta los mismos datos.

---

## Medio

| # | Archivo(s) | Problema |
|---|---|---|
| M1 | `backend/src/shared/audit/auditMiddleware.js` (líneas 26-28) | `req.user`/`req.auth` nunca se pueblan en las rutas modulares ⇒ toda mutación auditada queda con `userId: null`, `companyId: null` |
| M2 | `backend/api/legacy.js` (líneas 93-96) | `getSupabaseAdmin()` degrada silenciosamente a la anon key si falta `SUPABASE_SERVICE_ROLE_KEY`, en vez de fallar explícitamente |
| M3 | `backend/src/app.js` (línea 155) | `path.resolve('./src/shared/docs/swagger.json')` depende de `process.cwd()`; falla si el proceso arranca desde otro directorio |
| M4 | `backend/src/shared/audit/auditMiddleware.js` (línea 35) | `path.split('/')[2]` etiqueta todas las auditorías de `/api/v1/*` con el módulo `"v1"` en vez del nombre real del módulo |
| M5 | `ProcessClerkWebhookUseCase.js` vs `SupabaseAuthRepository.js` | Dos mapas de roles distintos (mayúsculas/minúsculas) para el mismo propósito; un rol nuevo agregado en uno y no en el otro cae silenciosamente al rol por defecto |
| M6 | `backend/src/modules/fertilization/application/sugerir-plan.usecase.js` (línea 13, 148-174) | Rate limiting en memoria (`Map`) no confiable en serverless; se agrava porque todos los usuarios sin token válido comparten `userId = 'user_dev'` (ver C5), mezclando cuotas |
| M7 | `backend/src/modules/agronomy/infrastructure/adapters/outbound/SupabaseProtocolRepository.js` (líneas 81-94) | El fallback a 4 queries se dispara ante *cualquier* error de la RPC, no solo "función no existe", enmascarando errores reales |
| M8 | `backend/src/modules/agronomy/application/usecases/ProtocolService.js` (líneas 300-308) | `_incrementarVersion` puede generar `"NaN.NaN"` si `version` no tiene el formato `"N.N"` |
| M9 | `backend/src/modules/gee/application/usecases/ProcessGeeIndexUseCase.js` (líneas 116-126, 283-292) | El ajuste de redondeo de distribución puede dejar el bucket "medio" en negativo |
| M10 | `backend/src/modules/inventory/application/usecases/GetProductDetailsUseCase.js` (líneas 8-9) | `parseInt(productId, 10)` sin verificar `isNaN` antes de consultar |
| M11 | `SupabaseAgronomyRepository.js` vs `SupabaseObjectRepository.js` | Lógica casi idéntica duplicada en dos repositorios; un fix aplicado en uno puede olvidarse en el otro (ya ocurrió con C6) |
| M12 | `apps/web/src/modules/fertilization/repository/fertilization.repository.js` (líneas 171-197) | `updatePlan`/`archivePlan`/`deletePlan` no verifican el `error` de Supabase; el estado mock local se actualiza como si hubiera éxito aunque la operación real haya fallado |
| M13 | `ClimateContext.jsx`, `AuthContext.jsx`, `RecommendationsDashboard.jsx` | `fetch`/carga de datos en efectos sin `AbortController`/bandera de cancelación; respuestas obsoletas pueden pisar el estado más reciente (en `RecommendationsDashboard` no hay debounce en el buscador) |
| M14 | `apps/web/src/modules/fertilization/pages/PlanDetailPage.jsx` (línea 67) | Desestructura `detail` sin comprobar `!detail` tras `loading=false` |
| M15 | `App.jsx`, `AuthContext.jsx` | `console.log`/`console.error` con resultados de evaluación de permisos, tokens y perfil completo, sin gate de entorno |
| M16 | `apps/web/src/modules/fertilization/api/fertilization-plans.api.js` (líneas 55-76, 98-115) | Si falla la inserción de ítems tras crear la cabecera del plan, solo se hace `console.error` (plan huérfano); la consulta de respaldo de `getPlanDetail` tampoco captura su propio error |
| M17 | `apps/web/src/modules/fertilization/components/wizard/Step3ApplicationsPlan.jsx` (línea 174) | `key={idx}` en una lista de aplicaciones que se agregan/quitan dinámicamente |
| M18 | `usePlans.js`, `usePlanDetail.js` | Lógica de fetch duplicada entre una función memoizada y un `useEffect` independiente (causa raíz de A14) |
| M19 | `manejo-sanitario/domain/services/ProtocolCalculationEngine.js` (líneas 218-291) | `calculateIncidence` puede no tener `return` final ⇒ `undefined` propagado y mostrado como "undefined%" en la UI |
| M20 | Varios (`useGoogleEarthEngine.js`, `usePagination.js`, `PlanificadorAplicaciones.jsx`, `operation.validator.js`, `DashboardDrawer.jsx`, `CosechaPostcosecha.jsx`) | Advertencia de datos GEE simulados que no se muestra en fallos de red; `useEffect` con array de dependencias no literal; timers de debounce sin limpieza al desmontar; falta validar `endFuel <= startFuel`; calendario con mes fijo "Mayo 2026"; fetch inicial sin cancelación |

---

## Bajo

- **`backend/test_router.js`, `backend/test_seed_lotes.js`**: credenciales de Supabase (clave *anon*/publicable, no `service_role`) hardcodeadas en scripts sueltos — riesgo bajo pero mal hábito a evitar replicar con claves más sensibles.
- **`backend/src/shared/audit/auditMiddleware.js`**: persiste `before`/`after` completos sin redactar campos potencialmente sensibles.
- **`backend/src/app.js` (líneas 169-170)**: montaje redundante de `authRouter` bajo `/api` expone `GET /api/me` de forma no documentada.
- **`backend/inspect_schema.js`**: script de diagnóstico cuyo resultado nunca se usa ni se loguea (no hace nada útil tal cual está).
- **`GeocodeLoteUseCase.js`**: datos "simulados" de fallback indistinguibles de datos reales para el frontend (falta un flag explícito `simulated: true`).
- **`sugerir-plan.usecase.js` (líneas 123-133)**: log de auditoría de IA como "fire-and-forget" sin `.catch()` real.
- **`ProcessGeeIndexUseCase.js`**: hash de caché de polígono sensible al orden/formato de coordenadas, provocando cache-misses innecesarios.
- **`App.jsx` (líneas 41-45)**: `useEffect` con dependencias incompletas (`exhaustive-deps`).
- **`ClimateContext.jsx`**: `parseFloat(...) || 3.518` descartaría una latitud real de `0`; `MOCK_LOTES_CLIMA` declarado pero nunca usado.
- **`usePlans.js`**: `abortRef.current` nunca se asigna a `true` — la "protección" contra respuestas obsoletas es inerte.
- **Timers de toast** (`usePlanDetail.js`, `Step3ApplicationsPlan.jsx`) no cancelados al desmontar.
- **`Step3ApplicationsPlan.jsx`**: el badge nutricional usa un catálogo estático que no incluye productos propios de la empresa.
- **`main.jsx` (líneas 19-23)**: ausencia de `VITE_CLERK_PUBLISHABLE_KEY` solo emite un `console.warn`; `ClerkProvider` se monta igual con `publishableKey={undefined}`.
- **`useLots.js`**: `weatherStation` puede volverse `NaN` si `codigo_interno` está vacío.
- **`machineryInsights.js`, `telemetry.service.js`**: código completo pero no integrado (incluye un `setInterval` en `connectDevices()` que, si se conecta sin limpieza, quedaría corriendo indefinidamente).
- **`nominas.service.js`**: no impide que `retenciones` genere un `total_neto` negativo.
- **`apps/auth`**: rutas públicas `/forgot-password` y `/verify-email` en el `matcher` sin página implementada (404); `redirect('/sign-in')` en `app/page.tsx` es inalcanzable porque el middleware ya intercepta antes; patrones `isPublicRoute` sin límite de segmento (`'/sign-in(.*)'` en vez de `'/sign-in(/.*)?'`); `await auth()` sin try/catch en el middleware.
- **`packages/*`**: `@skycrop/config` sin consumidores (placeholder); `parseJwt` en `packages/utils` tipado como `any` y sin consumidores; `packages/ui/package.json` declara `react` en `dependencies` en vez de `peerDependencies`; los 6 paquetes exponen `.ts` crudo sin build/`exports`/`types`, lo cual solo funciona porque Vite lo transpila — fallaría en cualquier otro consumidor (Node plano, Jest, Next sin `transpilePackages`); `@skycrop/types`, `@skycrop/ui`, `@skycrop/hooks` declarados en `apps/web/package.json` sin uso directo detectado.

---

## Recomendaciones priorizadas

1. **Eliminar el fallback `jwt.decode()` sin verificación de firma** (C1) en `backend/api/legacy.js` y `ClerkAuthService.js`. Es la corrección de mayor impacto por esfuerzo del informe.
2. **Quitar todos los secretos/valores por defecto inseguros** (`SUPABASE_JWT_SECRET`, `CLERK_SECRET_KEY` de prueba) y hacer que la app falle explícitamente si faltan en producción (C2).
3. **Añadir un middleware de autenticación real a todos los routers de negocio** y quitar los fallbacks `'company_dev'`/`'user_dev'` (C4, C5), reforzando además el filtrado por `company_id` en las consultas de `lotes` (C6) y en la creación de evaluaciones (C7).
4. **Proteger los endpoints de auditoría de toxicidad** (C3) con autenticación y verificación de pertenencia a la empresa.
5. **Corregir el fail-open de permisos** en `AuthContext.jsx` (C8) para que un error de red deniegue por defecto, no otorgue rol de administrador.
6. **Conectar los botones "Eliminar" y los registros de auditoría del frontend** a las llamadas reales de backend con el usuario/empresa autenticados (C9, C10), y agregar `costos`/`planificacion_cosechas` a `TENANT_TABLES` en `supabaseClient.js` (C11).
7. Como red de seguridad barata: **agregar un Error Boundary de nivel superior** en `apps/web` (mitiga varios hallazgos de "campo indefinido rompe el render").
8. Revisar y desduplicar la lógica de fetch en los hooks de `fertilization` (A14/M18) para restablecer el filtrado de la tabla de planes.

---

*Generado a partir de un análisis asistido por IA (agentes en paralelo por área del monorepo). Se recomienda validar cada hallazgo crítico con pruebas dirigidas antes de desplegar cambios en producción.*
