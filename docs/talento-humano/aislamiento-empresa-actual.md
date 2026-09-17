# A5 — Aislamiento empresa/predio actual (solo lectura)

> Rama: `diagnostico/talento-humano-integral` | A0/A1: `cad8662` | A2/A3: `eb7daf4` | A4 entregado | Fecha: 2026-09-15.
> Corrección vigente desde A3: los puentes **sí tienen `company_id`**; no volver a clasificarlos como "tablas sin tenant".

## 1. Modelo actual de empresa

Tenant = `companies.id` (UUID, `003`, `clerk_org_id UNIQUE`). Pertenencia usuario = `company_users(company_id, clerk_user_id, role_id)` (`007`, UNIQUE par). Las 8 tablas TH cuelgan de `companies` con `company_id NOT NULL FK CASCADE` (A3 §2-3). Eliminar empresa borra todo TH (correcto tenant-drop).

## 2. Origen de `company_id` (cadena de custodia)

```text
Clerk org_* → bootstrap_user_org (025, supabaseAdmin) → companies.id
 → JWT org_id (= companies.id) + setSupabaseToken(token, companyUuid) [AuthContext.jsx:65-66]
 → proxy inyecta company_id (6/8 TH) o service omite (puentes)
 → secure_company_id_trg autofill si NULL + anti-forgery (022:23-67, 8/8 TH)
 → RLS WITH CHECK company_id=current_company() (021)
```

Tres capas redundantes (proxy, trigger, RLS); ninguna valida coherencia entre FKs.

## 3. `org_id` ↔ `company_id`

`org_id` (JWT claim) **es** `companies.id`, no el `org_*` de Clerk (`jwt.js:25`, `GetUserProfileUseCase:123`). `current_company()` lo lee del JWT (`021:12`, endurecido a NULL sin JWT en `043:16-27`). Efectivo vivo depende de migraciones aplicadas (021 semilla vs 043 NULL) — verificar en sonda.

## 4. JWT

15 min, `role:authenticated`, `role_name` informativo (RLS no lo usa; usa `current_role_id()` por lookup). Sin trabajador, sin predio, sin permisos.

## 5. `profiles`

Cache Clerk (`004`): `id TEXT PK (=sub)`, `email UNIQUE NOT NULL`, nombre/apellido. Sin empresa (vía `company_users`), sin trabajador.

## 6. `company_users`

Un rol por empresa (`UNIQUE(company_id,clerk_user_id)`, `role_id FK roles RESTRICT`). `activo/status` existen pero RLS `current_role_id()` solo exige `activo=true` (021:68-77); `status` no se chequea en RLS (solo en backfill 050/051).

## 7. RLS por tabla TH (archivo)

- Base `021:128-183`: 4 policies genéricas × 8 tablas (`SELECT/INSERT/UPDATE` por company; `DELETE` +admin). `trabajadores/cuadrillas` (con `deleted_at` solo trabajadores) con cláusula soft-delete en SELECT.
- `labores` reescrita por `051:55-76` → `*_scoped`: `company_id=current_company() AND alcance_operativo(lote_id, NULL)`.
- Resto TH sin cambios posteriores. `044` no toca TH (solo `audit_logs`).
- Sin policies `anon`/`service_role` restrictivas en archivo para TH (policies son `TO authenticated`; anon sin JWT → `current_company()` NULL/semilla → fail-closed u oculto según versión).

## 8. Triggers de tenant

`secure_company_id_trg` (022, 8/8 TH): autofill + `FORGERY_ATTEMPT→security_events` + excepción. `validate_lote_predio_trg` (043, incluye `labores`): valida `lote_id→lotes.company` y `predio_id→predios.company`, pero no exige NOT NULL. `user_predios_tenant_trg` (050) solo para asignaciones predio.

## 9. Integridad tenant de las FK (diseño)

FKs garantizan existencia, **no co-tenant**: `cuadrilla_miembros(trabajador_id→trabajadores)` no exige `miembros.company_id = trabajadores.company_id`; igual `labor_trabajadores` (2 aristas), `nominas/registros` (FK NULLables), `labores.cuadrilla_id/lote_id` (SET NULL). Sin FKs compuestas `(id,company_id)`, sin trigger triangular, sin CHECK. **TENANT ISOLATION ≠ RELATIONAL INTEGRITY** (distinción para contrato).

## 10. Aislamiento de bridges (respuesta A5: reformulación definitiva)

Puentes con `company_id` propio + RLS propia + trigger: **aislamiento de fila correcto en diseño**. Riesgo remanente = **combinación**: puente(A) + labor(B) + trabajador(C) con A=B=C=A pasa todo, pero labor(A)+trabajador(B) con puente(A) también pasa la RLS del puente (su `company_id`=tenant del lector). La FK no cruza tenant-check. Requiere prueba negativa viva (A-negativas): insert puente cross-tenant con JWT A debe fallar solo si existe control triangular — en archivo **no existe**.

## 11. Predio y `predio_id`

- TH: 0/8 con `predio_id`; `labores.lote_id` NULLable (frontend siempre NULL, `lote` texto). `lotes.predio_id` NULLable SET NULL (`009:9`); `user_predios(company, predio, user)` + `tiene_acceso_predio()` (roles empresa bypass; resto por asignación) + backfill conservador (050).
- `051` extiende alcance a `labores` vía `lote_id` — pero `alcance_operativo(NULL,NULL)=true` (`051:42-50`) y `lotes.predio_id NULL→visible empresa` (050 §9): **como TH nunca setea `lote_id`, el alcance predial sobre labores es no-op en la práctica**. `trabajadores/cuadrillas/nominas/cursos/registros/puentes` fuera de todo alcance predial (como `maquinaria`, declarado en `051:15-17`).
- Conclusión: **aislamiento empresa SÍ modelado; aislamiento predio NO aplicable a TH hoy** (sin ancla `lote_id`/`predio_id` poblada).

## 12. Escenarios cross-company (razonamiento estático, sin ejecución)

| # | Escenario | Control archivo | Resultado esperado (a probar en vivo) |
| --- | --- | --- | --- |
| C-01 | JWT-A `SELECT trabajadores` | RLS company | solo A (PASS esperado) |
| C-02 | JWT-A `SELECT ... WHERE id=B1` | RLS company | vacío (PASS esperado) |
| C-03 | JWT-A `INSERT trabajador con company_id=B` | trigger forgery + WITH CHECK | excepción + `security_events` (PASS esperado) |
| C-04 | JWT-A `INSERT puente(A) + labor(A) + trabajador(B)` | RLS puente OK; sin triangular | **PASA en archivo (FAIL integridad)** ← prueba clave |
| C-05 | JWT-A `INSERT labor con lote_id=lote(B)` | `validate_lote_predio_trg` | excepción 42501 (PASS esperado) |
| C-06 | JWT-A `UPDATE nominas SET salario` de otro rol mismo tenant | sin gate rol | **PASA (FAIL autorización)** ← A6 |
| C-07 | anon sin JWT | NULL/semilla según versión | vacío o semilla (versión-dependiente, verificar) |
| C-08 | `DELETE` no-admin | rol admin | denegado (PASS esperado) |

## 13. Escenarios cross-predio

Sin ancla poblada, todo es visible-empresa por diseño (`051:40-50`). No hay cross-predio violable en TH porque no hay predio que cruzar: **alcance predial N/A** (no PASS/FAIL). Formalizar `labor→lote` es prerrequisito para cualquier alcance (diseño futuro).

## 14. Riesgos P0/P1/P2

- P0: integridad triangular ausente (C-04) — una fila puente válida puede coser tenants.
- P0/P1: autorización por rol ausente en escritura mismo-tenant (C-06, A6 lo cuantifica).
- P1: alcance predial no-op en `labores` por `lote_id` muerto (falsa sensación de scope 051).
- P1: `current_company()` versión-dependiente (semilla vs NULL) + `status` no chequeado en RLS.
- P2: backfill `user_predios` otorga todo (opt-out nunca ejercido presumiblemente); `lotes.predio_id NULL` visibles empresa por decisión.

## 15. Requisitos derivados

R-A5-01 Control triangular (trigger o FK compuesta o RPC) para puentes + `nominas/registros/labores.cuadrilla`. R-A5-02 Poblar o eliminar `labores.lote_id` (una columna muerta con policy scoped es peor que no tenerla). R-A5-03 Decidir alcance predial TH (si labores→lote formal, hereda 051; resto empresa). R-A5-04 Fijar versión `current_company()` viva y documentarla. R-A5-05 Incluir `status` en `current_role_id()` o eliminarlo.

## 16. Hallazgos A5

- OBS-A5-01 Sin control triangular en 2 puentes + 3 FKs (evidencia §9) → P0 integridad.
- OBS-A5-02 Scope predial `labores` no-op por `lote_id` muerto (§11, `051:42-50` + `LaborModal` sin lote_id) → P1 alcance.
- OBS-A5-03 Escritura mismo-tenant sin rol (021 + §12 C-06) → P0/P1 autorización (A6).
- OBS-A5-04 Divergencia `current_company()` 021 vs 043 → P1 (determinar viva).
- OBS-A5-05 `company_users.status` fuera de RLS → P2.

## 17. Diagrama de aislamiento actual

```text
Clerk org ──bootstrap──▶ companies.id ◀──FK── 8 tablas TH (company NOT NULL)
JWT org_id ──▶ RLS company ✓ (8/8) ──▶ SELECT/INSERT/UPDATE mismo-tenant ✓ / DELETE admin ✓
trigger autofill+forgery ✓ (8/8, si vive) ──▶ proxy inyecta (6/8) + puentes manuales
FKs ──▶ existencia ✓ / co-tenant ✗ ──▶ C-04 PASA (P0)
labores.lote_id ──▶ NULL siempre ──▶ alcance 051 no-op ──▶ predio N/A
predios/lotes ──▶ user_predios + tiene_acceso_predio (TH no participa salvo labores-teórico)
anon ──▶ NULL/semilla (versión) ──▶ fail-closed u oculto (verificar vivo)
```

`--live` BLOQUEADO; NO CERTIFICADO. Siguiente: A6 RBAC (matriz `laboral` efectiva: identidad→empresa→rol→acción→recurso).
