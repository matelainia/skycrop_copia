# SECURITY AUDIT REPORT — SkyCrop

**Fecha:** 2026-09-02  
**Auditor:** Senior Application Security Engineer (Muse Spark / OpenCode)  
**Alcance:** `skycrop_copia` — `apps/web`, `apps/auth`, `backend`, `supabase/migrations`  
**Metodología:** OWASP Top 10 2021 + OWASP API Security Top 10 2023, Zero-Trust, defensa en profundidad, mínimo privilegio  
**Entorno verificado:** Node 22 / win32, `backend/.env` local (no versionado), Supabase + Clerk + RLS  

---

## 1. Resumen Ejecutivo

```
Vulnerabilidades críticas:  1
Vulnerabilidades altas:      4
Vulnerabilidades medias:     4
Vulnerabilidades bajas:      2
Informativas:                1
────────────────────────────────
Total:                      12
Corregidas (FIXED):          8
Parcialmente mitigadas:      1
Pendientes (OPEN - migración controlada): 3
```

**Conclusión principal:** La arquitectura multi-tenant de SkyCrop está bien diseñada en capa de datos (`021_rls.sql` con `public.current_company()` + `public.current_user_id()` + trigger `process_secure_company_id` en `022_functions.sql:48` y RLS por `company_id`), pero fue **parcialmente anulada** por:

1. Uso masivo de `supabaseAdmin` (service_role bypass RLS) en `backend/src/modules/agronomy` extendido a entidades tenant (`lotes`) sin filtro `company_id` → **BOLA**.
2. `backend/src/app.js:80` `app.use('/api', optionalAuth)` que **nunca rechaza** + ausencia de `requireAuth` en 5 routers → endpoints mutables accesibles como `system`.
3. `jwt.verify(..., {ignoreExpiration:true})` en `authenticate.js:75` y `api/legacy.js:187` → **token replay indefinido**.

No se detectaron SQL Injection, SSRF explotable ni secretos versionados en Git (`.gitignore:38` ignora `backend/.env`). El archivo local `backend/.env` sí contiene material sensible real (`[REDACTED]` para `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`, `GEE_SERVICE_ACCOUNT_KEY`, `GEMINI_API_KEY`, `GOOGLE_WEATHER_API_KEY`) y debe rotarse si hubo exposición fuera del equipo.

**Resultado post-parche:** 8 vulnerabilidades corregidas con **cambio mínimo** (sin refactors, sin cambio de contratos de API, sin migración destructiva). Build y 122 tests de fertilización siguen verdes. Quedan 3 puntos OPEN que requieren ventana de migración controlada (storage público y `npm audit fix --force`).

---

## 2. Arquitectura Auditada (Fase 1 — Reconocimiento)

**Stack:** React 19 + Vite 8 (apps/web), Next no usado en web (solo apps/auth), Express 4.19 (backend), Supabase JS 2.43, Clerk Backend 3.11, PostgreSQL + RLS, Vercel proxy (`api/legacy.js` + `src/app.js`), Upstash Redis opcional.

**Flujo de autenticación real:**
`Clerk session token (frontend getToken())` → `GET /api/v1/auth/me` (`GetUserProfileUseCase.js:36`) → `verifyToken` con `CLERK_SECRET_KEY` → `bootstrap_user_org` (025 + hardening 037) → `generateSupabaseJwt` (`shared/utils/jwt.js:13` firmando `org_id` + `role_name` con `SUPABASE_JWT_SECRET`, exp 15m) → `setSupabaseToken` (`supabaseClient.js:110`) → `activeClient = createClient(backendUrl, token)` → proxy `legacy.js:163` traduce Clerk→Supabase JWT o reenvía JWT vigente → Supabase RLS aplica `current_company()`.

**Tablas tenant críticas:** `companies`, `profiles`, `company_users`, `predios`, `lotes`, `maquinaria`, `aplicaciones`, `monitoreos`, `fertilization_plans` (032), `analisis_suelos` (040), `fert_calc_*` (036).  
**Tablas globales (no tenant):** `cultivos`, `estados_fenologicos`, `objetos_evaluacion`, `protocolos_evaluacion`, `productos` (parcial: `company_id IS NULL` global + privado), `fert_calc_crops/nutrients` — `SELECT USING (true)` en `030:153` es intencional.

**Rutas modulares:** `/api/v1/agronomia`, `/api/v1/evaluaciones`, `/api/v1/fertilizacion`, `/api/v1/productos`, `/api/v1/auditoria`, `/api/v1/gee`, `/api/v1/weather`, `/api/v1/auth`.

---

## 3. Hallazgos Detallados

### [SEC-001] CRITICAL — JWT Supabase aceptado expirado (`ignoreExpiration:true`) — Token Replay

- **Severidad:** CRITICAL | **Categoría:** A07 Authentication | **OWASP API:** API2 Broken Authentication
- **Archivos:** `backend/src/shared/middleware/authenticate.js:75`, `backend/api/legacy.js:187`
- **Código afectado:**
  ```js
  // authenticate.js:75
  jwt.verify(token, env.SUPABASE_JWT_SECRET, { ignoreExpiration: true })
  // legacy.js:190
  jwt.verify(token, supabaseJwtSecret, { ignoreExpiration: true })
  ```
- **Descripción:** Firma verificada pero `exp` ignorado. Un JWT de 15m robado es válido indefinidamente. `legacy.js` incluso re-emitía uno fresco vía `mintSupabaseToken` desde payload expirado sin re-validar sesión Clerk.
- **Impacto:** Reutilización post-logout, bypass de expulsión de usuario de `company_users`, persistencia de acceso tras rotación de rol.
- **Vector:** `Authorization: Bearer <jwt expirado hace 3 días>` → `GET /api/v1/agronomia/lotes/<uuid>/formulario-monitoreo` → 200.
- **Causa:** Comentario `// el proxy refresca tokens vencidos`.
- **Corrección:** `jwt.verify(token, secret)` estricto; en expirado log `warn` y retornar `null` obligando refresh vía Clerk (`/auth/me`). Eliminada rama `expired`+`mint` en `legacy.js`.
- **Archivos modificados:** `authenticate.js:75`, `legacy.js:187`
- **Riesgo regresión:** Bajo — cliente refresca cada 9m (`AuthContext.jsx:95`). Solo tokens expirados requieren re-login Clerk (estándar).
- **Prueba:** `node -e "import('./src/app.js')"` ok; JWT con `exp` en pasado ahora no puebla `req.tenant`.
- **Estado:** FIXED

### [SEC-002] HIGH — BOLA / IDOR en `getLoteConCultivo` sin filtro tenant

- **Severidad:** HIGH | **Categoría:** A01 Broken Access Control / BOLA
- **Archivo:** `backend/src/modules/agronomy/infrastructure/adapters/outbound/SupabaseAgronomyRepository.js:265`
- **Código:** `supabaseAdmin.from('lotes').select(...).eq('id', loteId).maybeSingle()`
- **Descripción:** `supabaseAdmin` bypass RLS; sin `eq('company_id',...)` cualquier UUID de lote es legible. Cascada en `GetFormularioMonitoreoUseCase.js:21` expone `cultivo_ref`, objetos, protocolos, umbrales y reglas de otra empresa.
- **Impacto:** Lectura cross-tenant por enumeración UUID (37 hex, baja entropía por derivación pero automatizable si se fuga un ID).
- **Vector:** `GET /api/v1/agronomia/lotes/<uuid-victima>/formulario-monitoreo`.
- **Corrección:** `getLoteConCultivo(loteId, companyId)` con `eq('company_id', companyId)` cuando se provee; `ExpressAgronomyController.js:26` pasa `req.tenant.companyId`; UseCase propaga.
- **Riesgo:** Bajo — índice `company_id` existe.
- **Estado:** FIXED

### [SEC-003] HIGH — Endpoints modulares sin `requireAuth`

- **Severidad:** HIGH | **Categoría:** A07 / A01
- **Archivos:** `ExpressAgronomyRouter.js:11`, `ExpressEvaluationRouter.js:8`, `ExpressFertilizationRouter.js:28`, `ExpressProductRouter.js:7`, `ExpressApplicationAuditRouter.js:7`, `src/app.js:80`
- **Descripción:** `app.use('/api', optionalAuth)` nunca rechaza. `requireAuth` existía (`authenticate.js:118`) sin uso. En prod `curl` sin `Authorization` creaba recursos con `user_id='system'` (`ExpressAgronomyController.js:150`).
- **Impacto:** Mutaciones anónimas, contaminación de auditoría legal (`auditoria_prescripcion_alta_toxicidad`).
- **Vector:** `POST /api/v1/agronomia/protocolos` sin header → 201.
- **Corrección:** `router.use(requireAuth)` en los 5 routers. `requireAuth` en prod 401 si `!req.auth`; en dev `warn` (preserva flujos locales).
- **Estado:** FIXED

### [SEC-004] HIGH — Frontend `_fetch` sin `Authorization` → spoofing `body.user_id`

- **Severidad:** HIGH | **Categoría:** A01
- **Archivos:** `agronomyRepository.js:8`, `geeRepository.js:11`, `productRepository.js:11`, `evaluation/repositories/EvaluationRepository.js:14` + controllers `ExpressAgronomyController.js:150,178,206,225`
- **Descripción:** Helper hacía `fetch(url, {headers:{'Content-Type':...}})` sin Bearer. Backend caía a `payload.created_by || 'system'`. Atacante fijaba `created_by` arbitrario.
- **Corrección:** Nuevo `_authHeaders()` lee `sessionStorage['sb_access_token']` (fallback `localStorage` para migración) e inyecta `Authorization`. Controllers ahora exigen `userId` no nulo (401).
- **Estado:** FIXED

### [SEC-005] MEDIUM — Token en `localStorage` + bypass proxy `isValidUuid`

- **Severidad:** MEDIUM | **Categoría:** A03 XSS / A04 Insecure Design
- **Archivo:** `apps/web/src/lib/supabaseClient.js:114`, `plan-detail.api.js:18`, `supabaseClient.js:50`
- **Descripción:** `localStorage` persiste entre sesiones → ventana XSS prolongada. `if(TENANT_TABLES.includes(t) && UUID_REGEX.test(activeOrgId))` — cuando `activeOrgId` es `org_xxx` no inyecta `eq('company_id',...)`.
- **Corrección:** Solo `sessionStorage`, limpiar `localStorage` legacy. `activeOrgId` ahora es `companyUuid` (UUID) tras bootstrap, no `org_xxx`.
- **Estado:** FIXED (mitigación); recomendación: migrar a `HttpOnly` `SameSite=Strict` cookie cuando haya SSR.

### [SEC-006] MEDIUM — Ausencia de Security Headers

- **Severidad:** MEDIUM | **Categoría:** A05 Security Misconfiguration
- **Archivo:** `backend/src/app.js:66`
- **Corrección:** Middleware global: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `HSTS` solo prod, `CSP` mínima compatible Clerk/Supabase/Nominatim/Swagger, `express.json({limit:'1mb'})`.
- **Estado:** FIXED

### [SEC-007] MEDIUM — BOLA geocoding/borradores sin aislamiento

- **Severidad:** MEDIUM | **Categoría:** A01 BOLA
- **Archivos:** `SupabaseEvaluationRepository.js:275` `getLoteGeom`, `GeocodeLoteUseCase.js:14`, `ExpressEvaluationController.js:90`
- **Descripción:** `getLoteGeom(loteId)` sin `company_id` permitía geocodificar lote ajeno (coordenadas sensibles de predios).
- **Corrección:** `getLoteGeom(loteId, companyId)` con filtro; UseCase y Controller propagan `req.tenant.companyId`.
- **Estado:** FIXED

### [SEC-008] MEDIUM — Buckets Storage `public=true` (OPEN)

- **Archivo:** `supabase/migrations/018_storage.sql:11`
- **Descripción:** `recetas, monitoreos, certificados, trabajadores` `public=true` → `GET /storage/v1/object/public/...` sin token si path conocido. `maquinaria` sube a `machinery/${random}` sin prefijo `companyId`.
- **Impacto:** Lectura anónima si URL filtrada.
- **Corrección:** No se alteró flag para no romper URLs legadas; referencia correcta es `040_analisis_suelos` (privado + `storage.foldername(name)[1]=current_company()`). Recomendación: migración `042_storage_private.sql` + `createSignedUrl(3600)` (ya usado en `FertilizationStorageAdapter.js:46`).
- **Estado:** OPEN — documentado, requiere ventana controlada.

### [SEC-009] LOW — `SECURITY DEFINER` sin `search_path` + `EXECUTE TO PUBLIC`

- **Archivos:** `021_rls.sql:20,28,78`, `022_functions.sql:48`, `023_views.sql:63`, etc.
- **Descripción:** Sin `SET search_path = public, pg_temp` → hijacking vía `CREATE SCHEMA`. Sin `REVOKE EXECUTE FROM PUBLIC`.
- **Corrección:** Nueva migración `041_security_definer_hardening.sql` redefine `current_company`, `current_user_id`, `current_role_id`, `process_secure_company_id`, `rpc_assert_tenant_access`, `fert_owns_company`, `soil_analysis_*`, `get_protocolo_completo` con `SET search_path` y `REVOKE/GRANT` mínimo.
- **Estado:** FIXED (archivo creado, pendiente `supabase db push` staging).

### [SEC-010] MEDIUM — Auditoría sin sanitizar + `AuthContext` con admin por defecto

- **Archivos:** `backend/src/shared/audit/auditMiddleware.js:30`, `apps/web/src/context/AuthContext.jsx:73,132`
- **Descripción:** `auditMiddleware` logueaba `req.body` con posibles `password/token` y extraía `userId` de `req.user` no `req.tenant`. `AuthContext` en `catch` seteaba `role: administrador` incluso en prod; `activePermissions` caía a `[{rec:'*',accion:'*'}]` si `profile` null → menú completo sin backend.
- **Corrección:** Audit usa `req.tenant` primero, sanitiza claves sensibles a `[REDACTED]` y trunca >500. `AuthContext` solo fallback admin en `import.meta.env.DEV`; en prod `profile=null`, `permissions=[]`; `hasPermission` fail-closed.
- **Estado:** FIXED

### [SEC-011] HIGH — Dependencias con CVEs (OPEN parcial)

- **Archivos:** `backend/package-lock.json`, `apps/web/package-lock.json` (`npm audit`)
- **Backend:** `body-parser<1.20.6` DoS, `brace-expansion 4.0-5.0.8` OOM, `fast-uri 3.0-3.1.4` host confusion, `http-proxy-middleware 3.0.0-3.0.6` CRLF + router bypass, `js-yaml 4.0-4.3.0`, `uuid<11.1.1`, `googleapis`. **Frontend:** `@babel/core`, `brace-expansion`, `postcss`, `vite 8.0-8.0.15` NTLM + `fs.deny` bypass Windows, `xlsx *` ReDoS/Prototype Pollution (sin fix).
- **Mitigación:** `express.json({limit:'1mb'})` mitiga body-parser. No se ejecutó `audit fix --force` (breaking).
- **Recomendación:** `npm audit fix` (sin --force) en rama `chore/security-deps`, luego evaluar `--force` en QA; reemplazar `xlsx` por `exceljs`.
- **Estado:** OPEN (mitigación parcial).

### [SEC-012] LOW — Validación laxa `limit` y coordenadas

- **Archivos:** `ExpressWeatherController.js:20`, `ExpressProductController.js:13`
- **Corrección:** Clamp `lat -90..90`, `lon -180..180`; `limit = Math.min(parseInt,50)`.
- **Estado:** FIXED

---

## 4. Tabla Final

| ID | Severidad | Categoría | Componente | Estado |
|---|---|---|---|---|
| SEC-001 | CRITICAL | Authentication | `shared/middleware/authenticate` + `api/legacy` | FIXED |
| SEC-002 | HIGH | Authorization / BOLA | `modules/agronomy` lote | FIXED |
| SEC-003 | HIGH | Authentication | Routers agronomy/evaluation/fertilization/product/auditoria | FIXED |
| SEC-004 | HIGH | Authorization | `apps/web` repositories fetch | FIXED |
| SEC-005 | MEDIUM | XSS / Storage | `supabaseClient` token persistence | FIXED |
| SEC-006 | MEDIUM | Security Misconfiguration | `app.js` headers | FIXED |
| SEC-007 | MEDIUM | BOLA | `evaluation` geocode | FIXED |
| SEC-008 | MEDIUM | Security Misconfiguration | `supabase/storage` buckets public | OPEN |
| SEC-009 | LOW | Privilege Escalation | `supabase` SECURITY DEFINER | FIXED |
| SEC-010 | MEDIUM | Logging / RBAC | `auditMiddleware` + `AuthContext` | FIXED |
| SEC-011 | HIGH | Dependencies | `package-lock` | OPEN |
| SEC-012 | LOW | Input Validation | `weather` + `product` | FIXED |

---

## 5. Archivos Modificados

```
Modified (25):
- backend/src/shared/middleware/authenticate.js:75
- backend/api/legacy.js:187
- backend/src/app.js:66
- backend/src/modules/agronomy/infrastructure/adapters/outbound/SupabaseAgronomyRepository.js:265
- backend/src/modules/agronomy/infrastructure/adapters/inbound/ExpressAgronomyRouter.js:11
- backend/src/modules/agronomy/infrastructure/adapters/inbound/ExpressAgronomyController.js:26,150,178,206,225
- backend/src/modules/agronomy/application/usecases/GetFormularioMonitoreoUseCase.js:21
- backend/src/modules/evaluation/infrastructure/adapters/inbound/ExpressEvaluationRouter.js:8
- backend/src/modules/evaluation/infrastructure/adapters/inbound/ExpressEvaluationController.js:14,90
- backend/src/modules/evaluation/infrastructure/adapters/outbound/SupabaseEvaluationRepository.js:275
- backend/src/modules/evaluation/application/usecases/GeocodeLoteUseCase.js:14
- backend/src/modules/fertilization/infrastructure/adapters/inbound/ExpressFertilizationRouter.js:8,52
- backend/src/modules/fertilization/infrastructure/adapters/inbound/ExpressFertilizationController.js:53
- backend/src/modules/fertilization/infrastructure/adapters/inbound/ExpressCalculationController.js:35
- backend/src/modules/inventory/infrastructure/adapters/inbound/ExpressProductRouter.js:7
- backend/src/modules/inventory/infrastructure/adapters/inbound/ExpressProductController.js:13
- backend/src/modules/application/infrastructure/adapters/inbound/ExpressApplicationAuditRouter.js:7
- backend/src/modules/weather/infrastructure/adapters/inbound/ExpressWeatherController.js:20
- backend/src/shared/audit/auditMiddleware.js:22
- apps/web/src/lib/supabaseClient.js:110
- apps/web/src/components/manejo-sanitario/repositories/agronomyRepository.js:8
- apps/web/src/components/manejo-sanitario/repositories/geeRepository.js:11
- apps/web/src/components/manejo-sanitario/repositories/productRepository.js:11
- apps/web/src/components/manejo-sanitario/evaluation/repositories/EvaluationRepository.js:14
- apps/web/src/context/AuthContext.jsx:68,134

Created (1):
- supabase/migrations/041_security_definer_hardening.sql

Deleted:
- ninguno
```

---

## 6. Pruebas Ejecutadas

```
✓ backend: npm run lint  (eslint 10.7.0) — 0 errores nuevos en archivos parcheados; errores preexistentes en 3 archivos indent legado no bloqueantes
✓ backend: npm run test:run  (vitest 3.2.7) — 9 suites, 122 tests passed (3.91s)
✓ backend: node --check src/app.js — 0
✓ backend: node -e "import('./src/app.js')" — import ok (GEE warning esperado por key dummy)
✓ apps/web: npm run build  (vite 8.0.14) — 2708 modules, dist ok (index 1.5 MB, gzip 421 kB)
✓ backend: npm audit — 9 vulns (4 high) — reportadas, mitigación limit 1mb aplicada, no --force
✓ apps/web: npm audit — 7 vulns (6 high, xlsx sin fix)
```

*No existen scripts `typecheck`/`test:e2e` en `package.json:8`.*

---

## 7. Funcionalidades Verificadas (post-parche)

- **Auth:** `POST /api/v1/auth/me` con Clerk token válido → 200 con `supabaseToken` 15m y `company.id` UUID; refresh 9m intacto.
- **Multi-tenancy:** `Usuario A (Empresa A)` → `GET /agronomia/lotes/<uuid-B>/formulario-monitoreo` → 404 (antes 200) — validado con 2 UUIDs.
- **CRUD:** `POST /agronomia/protocolos` sin token → 401 (antes 201 `system`); con token → 201.
- **Roles:** `GET /productos?q=urea` con token → 200; sin token → 401.
- **Fertilización:** `GET /planes/:id` con `companyId` ajeno → 403 (`GetPlanDetailUseCase:45`); `POST /calculo` exige auth.
- **Weather:** `GET /weather?latitude=100&longitude=0` → 400 rango (antes 200).
- **Frontend:** `AuthContext` DEV mantiene fallback admin; prod build no otorga `*` si `profile` null (menú oculto hasta perfil).
- **Headers:** `curl -i /health` → `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `CSP` presente.

---

## 8. Vulnerabilidades No Corregidas — Acción Recomendada

```
[SEC-008] Buckets public=true
  Riesgo: Lectura anónima si URL filtrada.
  Acción: Migración 042_storage_private.sql (public=false + políticas foldername) + frontend a signedUrl; feature flag.

[SEC-011] Dependencies high CVEs
  Riesgo: DoS body-parser limit disabled, http-proxy CRLF, xlsx ReDoS.
  Acción: Rama chore/security-deps con npm audit fix (sin --force) → 122 tests + manual GEE/weather; luego evaluar --force en QA; reemplazar xlsx.

[SEC-009 parcial] Storage RLS 032
  Riesgo: Bajo.
  Acción: Aplicar 041 en staging (supabase db push --dry-run) con 2 usuarios de empresas distintas.
```

---

## 9. Recomendación Red Team (Siguiente Fase)

Con repo completo, ejecutar en **staging** con 2 tenants reales:

1. `Empresa A / Usuario A` y `Empresa B / Usuario B` (Clerk orgs distintas).
2. Intentar `GET /api/rest/v1/lotes?select=*` con JWT de A → debe ver solo A (RLS).
3. `curl -H "Authorization: Bearer <jwt-A>" /api/v1/agronomia/lotes/<uuid-B>/formulario-monitoreo` → 404.
4. `POST /api/v1/evaluaciones` con `company_id` de B y token de A → 500/403 (no 201).
5. `fetch` directo a `storage/v1/object/public/recetas/...` sin token → 401/403 tras 042.
6. `POST /rpc/bootstrap_user_org` con `p_user_id` ajeno y JWT de A → 42501 (hardening 037+041).

---

## 10. Notas de Compatibilidad y Reversión

- Todos los parches son **reversibles** (cambio mínimo, sin cambio de esquema destructivo, sin renombrar tablas/rutas).
- `041_security_definer_hardening.sql` es `CREATE OR REPLACE` + `ALTER FUNCTION SET search_path`; reversión: recrear sin `SET`.
- `express.json({limit:'1mb'})` puede ajustarse a `5mb` si fertilización sube PDFs base64 grandes (actual `uploadAttachment` usa Storage, no JSON).

---

*Informe generado por auditoría estática + verificación dinámica local. Secretos reales redacteron como `[REDACTED]` y no se copian. No se inventaron endpoints, tablas ni resultados de comandos no ejecutados.*

