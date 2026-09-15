# F05/F06 — RLS, autorización y aislamiento (evidencia conductual)

## Diseño (archivo)

- Legacy (`021:128-183`): SELECT/INSERT/UPDATE por `company_id=current_company()`
  para `maquinaria`/`jornadas_maquinaria`; DELETE solo admin. **Sin gate de rol en
  UPDATE/INSERT** (H-05).
- Nuevas (`052:358-412`): SELECT/INSERT tenant; UPDATE solo estados abiertos
  (`En Progreso`; `Programado/En ejecucion`); DELETE solo operación En Progreso +
  admin; **combustible/eventos append-only** (sin UPDATE/DELETE para nadie).
  Grants: anon/PUBLIC revocados; authenticated mínimo; service_role total.
- Inmutabilidad (`052:804-832`): trigger bloquea UPDATE/DELETE de eventos,
  combustible, operaciones Finalizada/Cancelada y mantenimientos
  Completado/Vencido/Cancelado. Auditoría server (`052:834-840`, 022).

## Conducta viva (sondas SELECT, JWT HS256 estilo backend)

| Sonda | Resultado |
| --- | --- |
| anon → maquinaria/jornadas/audit/trace/profiles/company_users | 200 + `[]` (niega filas, no error) |
| anon → maquinaria_operaciones/_eventos | 401/42501 (sin GRANT a anon — explícito) |
| JWT org=skycrop → maquinaria | 3 filas, 100% `company_id` propio, sin leak |
| JWT org=prueba → maquinaria | 3 filas, 100% propio, sin leak |
| JWT org=laureles (sin datos) | `[]` (fail-closed, no mezcla) |
| JWT sin org_id / org basura | `[]` (fail-closed; 021 fail-open a semilla NO viva) |
| JWT firma inválida | 401 PGRST301 |

## Integración con módulos (F08)

- Manejo sanitario / cosecha / postcosecha: **sin referencia a maquinaria**
  (grep vacío en `CosechaPostcosecha/`; 042 sin `maquinaria_id`). Integración solo
  lógica vía `lote_id` + snapshot + `registrar_costo_lote` (022, ausente en vivo).
  P2: documentar como integración por lote, no presentar como FK.
- Trazabilidad (F09): diseño append-only + cadena por lote; en vivo RPC 048
  ausentes → alimentación de trazabilidad desde maquinaria **no operativa**
  (eventos propios 052 tampoco, H-01). P1 heredado del Paso 10.
