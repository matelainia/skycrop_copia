# SkyCrop — Prueba integral E2E + integración + seguridad + trazabilidad

> Pregunta que responde: **"Si este usuario ingresa a SkyCrop, ¿puedo reconstruir de forma íntegra y verificable todo lo que hizo, y pudo falsificar o saltarse algún registro?"**

## Ambientes

```text
LOCAL → TEST / E2E → STAGING → PRODUCCIÓN
```

- El usuario sintético **solo existe en TEST/STAGING**, jamás en producción.
- Cada ejecución tiene un `TEST_RUN_ID` inequívoco (`E2E-YYYY-MM-DD-NNN`).
- Todo registro sintético lleva `metadata.test_run_id = TEST_RUN_ID`.
- `049_e2e_isolation.sql` **no inserta mocks**: solo verificación + limpieza por `test_run_id`.

## Ejecución

```bash
# Seco (sin Supabase, simulador en memoria con reglas RLS/inmutabilidad/hash):
npm run test:e2e:skycrop -- --env=test --dry-run

# Real contra TEST/STAGING (requiere .env con proyecto de pruebas):
npm run test:e2e:skycrop -- --env=test
npm run test:e2e:skycrop -- --env=staging  # + --keep-data para conservar evidencia

# Re-analizar un reporte sin re-ejecutar:
npm run test:e2e:analyze -- tests/e2e/reports/SKYCROP_E2E_REPORT_2026-09-10.json

# Análisis estadístico en R (no ejecuta pruebas, solo analiza el JSON):
Rscript tests/e2e/R/analyze_results.R tests/e2e/reports/SKYCROP_E2E_REPORT_2026-09-10.json
```

## Fase 2 — Validación real contra Supabase (`tests/e2e/real/`)

Segunda prueba sobre infraestructura real TEST/STAGING (plan §1–§13).
Sin dependencias nuevas: JWT HS256 firmados en local + `fetch` nativo a PostgREST/Storage.

```bash
# Self-check local (sin red): matriz 360 celdas + JWT firma/expiración
npm run test:e2e:real -- --env=test

# Ejecución real (requiere SUPABASE_URL/ANON/SERVICE_ROLE/JWT_SECRET del proyecto TEST/STAGING)
npm run test:e2e:real -- --env=test --live
npm run test:e2e:real -- --env=staging --live --keep-data
```

- `role-matrix.js` — matriz formal 6 roles × 12 módulos × 5 acciones (fuente de verdad; celda ausente = DENY).
- `real-env.js` — guard de producción, `mintTestJwt` (`sub` + `org_id`=UUID, lo que lee `current_company()`), REST/RPC/Storage.
- `setup.js` — contexto sintético vía service_role: companies A/B, profiles, `company_users` (rol real que lee `current_role_id()`), predios (uno no asignado), lotes, cliente. Cleanup inverso; auditoría y reporte retenidos.
- `suites-real.js` — §4 auth (sin token/expirado/firma), §5 permisos por módulo vs matriz, §6 batería RLS directa (UPDATE/DELETE trace y audit, cross-lote, cambio de empresa, CHECKs, GPS 999, filtro DevTools), §7 recorrido vía RPC + `verificar_cadena_lote`, §8 storage cross-tenant y delete por rol, §9 concurrencia (UNIQUE impone un ganador; cadena válida), §10 replay (observación de idempotencia).
- `reconcile.js` — §11: conteos, huérfanos, duplicados, timestamps, actores, cadena.
- Reporte: `tests/e2e/real/reports/SKYCROP_E2E_REAL_SUPABASE_REPORT_YYYY-MM-DD.{json,md}`.
- Criterio §12: PASS solo con 100% ALLOW autorizados + 100% DENY; P0/P1 → exit 1 (bloquea promoción §13).

Hallazgo documentado por diseño: el RLS aísla por **empresa**, no por predio (no existe asignación por predio en SQL) — `REAL-AUTH-05` lo convierte en FAIL P1 si el backend no lo compensa.

### Fix aplicado: alcance por predio (migración 050)

- `supabase/migrations/050_predio_scope.sql` — tabla `user_predios` (usuario×predio con
  guard tenant), backfill conservador (cada miembro activo hereda todos los predios de su
  empresa: nadie pierde acceso), helper `tiene_acceso_predio()` (roles de alcance empresa
  pasan siempre; el resto solo con asignación) y policies `predios`/`lotes` reescritas con
  alcance en SELECT/INSERT/UPDATE. Restringir = quitar filas, sin código.
- `tests/e2e/real/schema-contract.js` — contrato de columnas obligatorias reales
  (`cosechas.lote` TEXT, `cliente_id` en ventas/facturas, `company_users`→`profiles`,
  enums 048, rangos GPS). Corre en el self-check local, falla antes de tocar Supabase.
- `setup.js` genera los UUIDs y asigna `user_predios` (operario/limitado→A, externo→B,
  sin_predio→ninguno); si la 050 no está aplicada, avisa y `REAL-AUTH-05` falla P1 como detector.
- Aplicación: correr la 050 en el proyecto TEST/STAGING **antes** del `--live`
  (probar rollback: DROP POLICY … + restore 021, DELETE FROM user_predios).
  Tras aplicarla, `REAL-AUTH-05` debe pasar de FAIL P1 a PASS.

El guard bloquea (`ENV-GUARD`) si: `--env` no es local/test/staging, `NODE_ENV=production`,
o la URL apunta a dominio productivo conocido.

## Recorrido (Día 1 → Día 8)

| Día | Suites | Qué se prueba |
| --- | --- | --- |
| 1 | `00-auth-company-farm` | vinculación empresa/predio, roles, aislamiento base |
| 2-3 | `01-labor-machinery` | ciclo ASIGNADA→FINALIZADA, maquinaria + operario |
| 4-5 | `02-applications-fertilization` | dosis/área/GPS/evidencia, rechazo GPS 999 |
| 5-6 | `03-sanitary-soil-harvest` | sanitario, suelos, cosecha |
| 7 | `04-sales-invoicing` | venta cuadra cantidad×precio, factura, cadena de evidencia |
| — | `05-tamper` | company/created_by/created_at/farm inmutables, no DELETE físico |
| — | `06-cross-tenant` | COMPANY_A×COMPANY_B, IDOR, usuario fantasma |
| — | `07-storage-gps-resilience` | storage por folder=company, GPS, timeout/500/token/duplicadas, concurrencia |
| 8 | `08-traceability-final` | **prueba de fuego**: N generados = N trazabilidad, orden/actor/tenant, hash chain |

## Métricas por operación (spec §15)

`test_run_id, test_case_id, module, action, timestamps, duration_ms, status, http/database/authorization/audit/traceability_status, error_code/message`.

## Severidad y salida

- `P0` seguridad/aislamiento/datos · `P1` corrupción/exposición · `P2` funcional controlable · `P3` menor · `INFO` optimización.
- Exit code `1` si hay `P0/P1` (bloquea promoción a producción); `WARN` si solo `P2/P3`.
- Reportes: `tests/e2e/reports/SKYCROP_E2E_REPORT_*.{json,md,html}` (se retienen).
- Limpieza: operacionales por `test_run_id` se borran; `audit_logs` + reportes se retienen temporalmente.

## Estructura

```text
tests/e2e/
  config/env-guard.js        # TEST_RUN_ID + bloqueo de producción
  helpers/test-context.js    # métricas timedResult
  helpers/assertions.js      # expectativas §6
  helpers/mem-store.js       # simulador dry-run (RLS+hash+inmutabilidad)
  helpers/db.js              # Supabase real + cleanup controlado
  helpers/http.js            # HTTP con reintentos idempotentes
  helpers/report.js          # matriz, severidad, Priority Score, md/html/json
  fixtures/mock-context.js   # empresa/predios/lotes/usuarios + payloads Día 2-7
  suites/00-*.suite.js … 08-*.suite.js
  runner.js                  # TEST RUNNER   (npm run test:e2e:skycrop)
  analyzer.js                # TEST ANALYZER (npm run test:e2e:analyze)
  R/analyze_results.R        # ranking, latencia p95, regresiones
  reports/
supabase/migrations/049_e2e_isolation.sql  # cleanup + verify por test_run_id
```

## Regla de oro (spec §20)

> **El frontend oculta lo que el usuario no puede hacer; el backend/Supabase impide realmente hacerlo.**
