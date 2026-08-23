# Política de Datos SkyCrop

> Regla fundamental: **si un dato no existe en Supabase y no pertenece a un catálogo
> maestro legítimo, SkyCrop no debe mostrarlo como si existiera.**

## Reglas

1. **Los datos del cliente viven en Supabase.** El backend y el frontend son vistas/
   transformaciones de esa fuente de verdad, nunca almacenes alternativos.
2. **El frontend nunca inventa datos persistentes.** Prohibido `const defaultLots = [...]`,
   KPIs con defaults distintos de 0, nombres/valores agronómicos ficticios.
3. **Un estado vacío se muestra como estado vacío** (`No hay registros todavía.`),
   jamás sustituido por datos de ejemplo.
4. **Los datos maestros son independientes del cliente**: cultivos, estados fenológicos,
   productos ICA, roles, catálogos fert_calc_* (`company_id NULL`) pueden existir globalmente.
5. **Datos demo solo en desarrollo/testing**, nunca en el flujo de producción.
6. **RLS controla el aislamiento entre empresas.** Toda tabla transaccional filtra por
   `company_id = current_company()`; sin `org_id` válido ⇒ 0 filas (ver migración 038).
7. **Todo cambio de esquema se realiza mediante migraciones versionadas** en
   `supabase/migrations/` (aplicadas manualmente al proyecto vía SQL Editor).
8. **Toda información mostrada debe tener fuente identificable:**
   `KPI → consulta → tabla → filtros → cálculo → resultado`.

## Estados obligatorios por módulo

| Estado | UI |
|---|---|
| Loading | spinner/skeleton |
| Error | mensaje visible + retry (nunca datos) |
| Empty | mensaje vacío honesto |
| Data | solo lo devuelto por Supabase |

## Excepciones permitidas (no son mock)

- Catálogos maestros estáticos de UI (tipos de labor, tipos de maquinaria,
  `DEFAULT_FERTILIZERS` con composiciones N-P-K reales).
- Claves de infraestructura (`dummy-key` del canal proxy, claves publishable de fallback).
- Plantillas de ceros (`mockDashboard.js` = estructura con 0s) mientras se migra su RPC —
  **pendiente**: reemplazar `getDashboard()` por consulta real.

## Auditoría continua

```powershell
powershell -ExecutionPolicy Bypass -File scripts\audit-mock-data.ps1
```

Revisar manualmente cada coincidencia. Objetivo permanente:
`Mocks usados como datos productivos: 0 · Fallbacks ficticios: 0`.

## Migraciones asociadas a esta política

- `037_security_hardening.sql` — guards anti-IDOR en RPCs SECURITY DEFINER.
- `038_remove_mock_data.sql` — bootstrap sin lote demo, RLS sin empresa semilla,
  borrado controlado de filas seed (empresa UUID-cero), verificaciones post-limpieza.

## Pendientes conocidos (follow-ups)

1. Aplicar 037 + 038 al proyecto Supabase (requiere backup previo; ver cabecera de 038).
2. Rotar `SUPABASE_JWT_SECRET` y configurar la service_role real (bloquea RLS fino).
3. Con `getDashboard()` real vía `supabase.rpc(...)` y eliminar plantilla de ceros.
4. Permisos de maquinaria (`canCreateMachine` etc.) hoy conceden todo — cablear a roles reales.
5. Trigger `process_auto_predio`: exige selector de predio en la UI antes de endurecerlo
   (bloque comentado listo en 038).
6. `FuelTable.jsx`: default `hoursToday || 6` cosmético por revisar.
