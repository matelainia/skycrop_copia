# F02 — Modelo de datos (archivo vs vivo)

## ERD maquinaria (contrato 052, `052:100-250`)

```text
companies ──< maquinaria ──< maquinaria_operaciones (lote_id lógico + snapshot lote_nombre)
   │              │         ──< maquinaria_mantenimientos
   │              │         ──< maquinaria_combustible (append-only)
   │              │         ──< maquinaria_eventos (append-only)
   │              │
   │              ├── estado: Disponible→Operando→Disponible;
   │              │          Disponible→Mantenimiento→Disponible|Fuera de servicio;
   │              │          Fuera de servicio→Disponible (trigger 052:767-784)
   │              └── status legacy sincronizado por trigger (052:787-802)
   ├── lotes ──(lógico, sin FK desde operaciones; RPC valida tenant 052:500)
   └── trabajadores ──(lógico + snapshot operador_nombre; 054)
```

FK reales: `maquinaria_id → maquinaria ON DELETE RESTRICT` en operaciones/
mantenimientos/combustible (052:103,128,149); eventos `CASCADE` (052:166).
Índices: `(company_id,maquinaria_id)` ×4 + **único parcial anti-doble-jornada**
`uq_mqop_activa_052 (maquinaria_id) WHERE estado='En Progreso'` (052:238-245).
Vistas `security_invoker`: `vw_maquinaria_fleet_summary`, `vw_maquinaria_analytics`
(KPIs backend reales; UI aún no las consume — los charts mock se eliminaron).

## Vivo (sondas solo-lectura)

| Objeto | Vivo | Nota |
| --- | --- | --- |
| Tablas 052 ×4 | SÍ | SELECT 200 |
| Columnas `codigo/estado/horometro_actual/snapshot/costos` | SÍ | SELECT 200 c/u |
| Funciones 052 ×8 | **NO (404)** | Tablas sin funciones = escrituras imposibles |
| Funciones 022 (`registrar_costo_lote`, legacy labor/mto) | **NO (404)** | Precondición 052-00 insatisfecha |
| `process_audit_log`, `process_secure_company_id` | **NO (404)** | Sin auditoría server ni guard server |
| Helpers 050/051 (`tiene_acceso_predio`, `alcance_operativo`) | **NO (404)** | Re-aplicar 050/051 |
| RPC 048/049 | **NO (404)** | Bloquea Paso 10 (conocido) |
| `current_company/role_id/user_id` | SÍ | Versión fail-closed (043+, verificado) |

## Taxonomía de estados (deuda conocida, H-04)

Canónico DB (052 trigger): `Disponible|Operando|Mantenimiento|Fuera de servicio`;
`status` normalizado por trigger a `Disponible|Operando|Mantenimiento|Fuera de Servicio`.
Frontend compara valores legacy `En mantenimiento` / `Fuera de servicio`
(`hooks/useMachinery.js:144-145`, `pages/MantenimientosPage.jsx:38`,
`hooks/useMaintenance.js:35`, `scheduler/maintenanceScheduler.js:17,52`,
`components/dashboard/*`). Tras cualquier cambio de estado vía 052, filtros y
alertas dejan de matchear. Constantes ya centralizadas con alias
(`constants/machineryStatus.js`: `normalizeMachineryStatus`); falta migrar los
6 call-sites y preferir `estado` sobre `status` en lecturas.
