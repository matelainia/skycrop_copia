# Release a producción — 040/042 + 043–047 + código del sprint

> Precondición inviolable: **Auditoría 2 APROBADA en staging.** Sin eso, este
> documento no se ejecuta. Sin estados intermedios ni atajos desde consola.

## 0. Congelar el release (tras Auditoría 2 aprobada)

1. Tag en git del conjunto exacto aprobado, ej. `release-2026-09-DB01`:
   - Migraciones: `040, 042, 043, 044, 045, 046, 047` (tal cual en el tag).
   - Código: backend (audit middleware/service, harvest `_empresa`, inventario
     tenant) + frontend (actor real, clima NULL, tasas/jornal explícitos,
     maquinaria esquema 015).
2. A partir del tag: **freeze**. Cualquier cambio nuevo = nuevo ciclo, no entra.
3. Ensayo en `staging-2` desde un backup FRESCO de producción, aplicando este
   mismo documento de principio a fin. Si el ensayo falla, se corrige el plan
   (no producción) y se re-ensaya. Medir duración → define la ventana.

## 1. Ventana y rollback (antes de tocar producción)

1. Ventana de bajo tráfico. DDL toma bloqueos `ACCESS EXCLUSIVE` breves; si es
   posible, app en mantenimiento (solo lectura) durante la ventana.
2. Backup completo fresco de producción. Registrar: ID, hora UTC, SHA256 si
   aplica, y confirmación de finalización correcta del backup.
3. Rollback = **restaurar backup + redesplegar código anterior**. No hay
   downgrade DDL (policies eliminadas, constraints, trigger inmutable):
   documentarlo y aceptarlo antes de empezar.
4. Criterios de aborto (cualquiera dispara rollback): un check en FAIL, error
   SQL no previsto, pico de 5xx, síntoma de cruce de tenant, `precondicion`
   distinta de la esperada al inicio.

## 2. Ejecución en producción (orden estricto, un archivo por vez, completos)

Re-ejecutar migraciones es seguro: todos los archivos son re-ejecutables
(`IF NOT EXISTS` / `OR REPLACE` / `DROP IF EXISTS` / `ON CONFLICT DO NOTHING`).
Si un archivo falla a mitad: leer el error, corregir causa, **re-ejecutar el
archivo completo** (nunca parches parciales fuera del tag).

```
P0. precondicion_base.sql → esperar EXACTAMENTE los 11 FAIL conocidos
    (040+042). Si difiere (más, menos u otros) → ABORTAR: la producción
    cambió desde el backup; investigar deriva antes de continuar.
P1. 040_analisis_suelos.sql → verificar: 4 tablas, parametros_suelo = 26,
    3 laboratorios globales.
P2. 042_cosecha_postcosecha_trazabilidad.sql → verificar: 9 tablas nuevas,
    columnas nuevas en cosechas/inventario/movimientos_inventario,
    funciones generar_* / registrar_* / trazabilidad_* existen.
P3. precondicion_base.sql → todo PASS.
P4. 043 → bloque checks 043 todo PASS.
P5. 044 → bloque checks 044 todo PASS.
P6. 045 → reporte: cobertura COMPLETA.
P7. 046 → bloque checks 046 todo PASS.
P8. 047 → bloque checks 047 todo PASS.
P9. Desplegar backend del tag → desplegar frontend del tag.
    (Orden DB-antes-que-código: el auditService nuevo exige las columnas 044.)
```

## 3. Verificación post-release (producción, sin ensuciar datos)

Prohibido G2 en producción (siembra datos de prueba y `audit_logs` no se puede
limpiar). En su lugar:

1. `schema_snapshot.sql` en producción → diff contra staging post-Auditoría-2:
   **vacío** (salvo datos, nunca esquema).
2. Smoke con 2 usuarios reales de empresas distintas (A y B):
   - Login OK, listar lotes: A no ve datos de B y viceversa (solo lectura).
   - Dashboards cargan; crear NADA de prueba (cero registros ficticios).
   - `SELECT COUNT(*) FROM audit_logs WHERE company_id IS NULL` → 0.
   - Logs backend/Supabase sin errores nuevos durante 30–60 min.
3. C6 en producción: `reporte_integridad_lotes()` + clasificación. Las
   correcciones de datos (solo valores legítimos documentados, nunca
   inventados) se preparan como UPDATEs revisados, se prueban en staging y se
   aplican en ventana aparte — fuera de este release.

## 4. Cierre

- Registrar: hora inicio/fin, checks con PASS, diff vacío, smoke OK.
- Si todo OK: release cerrado. La compuerta de trazabilidad sigue su propio
  ciclo (diseño solo tras Auditoría 2 aprobada; este release no la incluye).
- Si algo falló: rollback (backup + código anterior) y el incidente genera
  nuevos hallazgos → nuevo ciclo, nunca "arreglos en caliente" en producción.
