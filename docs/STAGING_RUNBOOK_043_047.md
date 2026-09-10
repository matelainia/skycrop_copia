# Runbook staging — migraciones 043→047 + compuertas (NO producción)

> Decisión vigente: **NO implementar `traceability_events`. NO aplicar 043–047 en producción.**
> Este runbook solo opera sobre **staging**. Producción no se toca.

## 0. Punto de recuperación (obligatorio, antes de todo)

1. Backup completo de producción (Dashboard → Database → Backups, o `pg_dump`).
2. Registrar identificador del backup + hora UTC + hash SHA256 del dump si aplica.
3. Crear staging de una de estas formas:
   - **A (recomendado):** Branch de base de datos desde el backup (Dashboard → Branches).
   - **B:** Proyecto nuevo + restore del dump + configurar `backend/.env.staging` aparte
     (nunca sobrescribir `backend/.env` de producción).
4. Criterio: staging arranca con el esquema 001→042 idéntico a producción
   (verificar con `scripts/staging/schema_snapshot.sql` en ambos y `diff` vacío
   salvo objetos esperados).
5. Precondición: `scripts/staging/precondicion_base.sql` debe dar PASS en todas
   las filas (las 50 tablas base existen). Caso real 2026-09-03: producción no
   tiene 040 ni 042 (11 tablas ausentes); el staging clonado heredará el mismo
   gap — eso es fidelidad, no un error. Completar la base en staging ANTES de
   043, en este orden:
   - `040_analisis_suelos.sql` → verificar: 4 tablas + 26 parámetros
     (`SELECT COUNT(*) FROM parametros_suelo` = 26) + 3 laboratorios globales.
   - `042_cosecha_postcosecha_trazabilidad.sql` → verificar: 9 tablas nuevas +
     columnas en `cosechas`/`inventario`/`movimientos_inventario`.
   - Re-ejecutar `precondicion_base.sql` → todo PASS.
   043–045 omiten lo ausente con NOTICE, los checks lo marcan FAIL y la
   compuerta no abre con base incompleta. El reporte 045 indicará
   `cobertura: PARCIAL` mientras falten tablas.

## 1. Aplicar 043→047 en staging, en orden estricto

```
043_tenant_security_c1_c2_c3_h1.sql
→ 044_audit_c4_c5.sql
→ 045_integridad_lotes_reporte.sql
→ 046_codigos_atomicos.sql
→ 047_harvest_explicit_company.sql
```

Vía Dashboard → SQL Editor (pegar cada archivo completo, ejecutar, confirmar 0 errores)
o `supabase db push` si el proyecto está linkeado. **Una migración por vez.**

Después de CADA migración, ejecutar su bloque en
`scripts/staging/staging_checks.sql` (bloques `-- 043 --`, `-- 044 --`, …).
Regla: cada bloque debe devolver `status = 'PASS'` en todas sus filas.
Si una fila es `FAIL`: detenerse, no continuar, registrar evidencia y corregir
el archivo de migración en el repo (nunca parchear staging a mano sin reflejarlo).

Qué comprueba cada bloque: fin correcto, policies esperadas, firmas de funciones
(`pg_proc` + `pg_get_function_arguments`), índices/constraints, grants
(anon revocado donde aplica), triggers por tabla, y que no aparezcan objetos
fuera del alcance declarado en el pre-vuelo.

## 2. Reporte de integridad C6 (el punto más importante)

1. `SELECT * FROM public.reporte_integridad_lotes();` y
   `SELECT chequeo, COUNT(*) FROM public.vw_inconsistencias_cadena GROUP BY 1;`
2. Clasificar con `scripts/staging/clasificar_inconsistencias.sql`:

| Severidad | Chequeos |
|---|---|
| CRÍTICA | `*.lote_otra_empresa`, `lotes.predio_otra_empresa` (dato de A atado a B) |
| ALTA | actividad sin lote (`aplicaciones/cosechas/monitoreos/planes/suelos sin_lote`), `cosechas.sin_lote` |
| MEDIA | `lotes.sin_predio`, `labores/costos sin_lote`, `analisis_suelos.sin_predio_lote` |
| BAJA | `cultivo FK vs texto` (divergencia `cultivo_id`/`cultivo`), cadenas `SET NULL` históricas documentadas |

3. Reglas de reparación: **no inventar** lote/empresa/predio. Si no puede
   determinarse legítimamente (responsable + evidencia), el registro queda
   documentado como `inconsistencia histórica` en el informe, no se "arregla".
4. Solo cuando CRÍTICA + ALTA = 0 se puede planificar el endurecimiento
   (`NOT NULL` / `RESTRICT` prospectivos). Ese endurecimiento es otra migración
   (048+), fuera de este runbook.

## 3. Compuerta de seguridad G2 (0 escapes)

```bash
cd backend
STAGING_SUPABASE_URL=... STAGING_ANON_KEY=... \
STAGING_SERVICE_ROLE_KEY=... STAGING_JWT_SECRET=... \
node verify_tenant_isolation_g2.js
```

- Cubre A→B y B→A: SELECT / INSERT / UPDATE / DELETE / RPC, directo PostgREST.
- Manipula `company_id`, `predio_id`, `lote_id` y `org_id` ausente (C3).
- Cubre C1 (recomendaciones), C2 (snapshots/events), C4 (UPDATE/DELETE
  `audit_logs` → debe fallar), C5 (RPC con lote ajeno), 047 (RPC con empresa
  ajena), productos por empresa.
- Limpia su siembra salvo filas etiquetadas `g2_gate` en `audit_logs`
  (inmutables por diseño: son evidencia, no basura).
- Resultado esperado: `ESCAPES = 0` y exit code 0. Cualquier otro resultado =
  compuerta cerrada.
- Rutas backend (requieren sesión Clerk real de staging): probes manuales en
  `scripts/staging/backend_tenant_probes.md`. El backend deriva el tenant del
  token: enviar `company_id` de B debe ser ignorado o 403, nunca obedecido.

## 4. Diff de esquema producción vs staging

1. Ejecutar `scripts/staging/schema_snapshot.sql` en producción (**solo SELECT**)
   y en staging; guardar ambos CSV.
2. `diff prod_schema.csv staging_schema.csv`: el diff debe contener
   **exactamente** los objetos de 043–047 (ver inventario en el informe del
   sprint) y nada más. Cualquier línea extra = migración con efectos laterales:
   detener y revisar.

## 5. Auditoría 2 (mismo inventario que Auditoría 1)

Re-auditar C1–C6 + H1–H2 contra staging + código actual, y además buscar
regresiones introducidas por las correcciones (funcionalidad rota, nuevos
`USING(true)`, nuevos `supabaseAdmin` sin tenant, nuevos defaults falsos).
Checklist y criterios binarios en `docs/AUDITORIA2_CHECKLIST.md`.

## 6. Decisión (binaria, sin estados intermedios)

- **APROBADA → compuerta abierta → diseñar trazabilidad.** Solo entonces.
- **RECHAZADA → compuerta cerrada → corregir nuevos hallazgos**, nuevo ciclo.
- Empezar "parcialmente" la trazabilidad está prohibido.
