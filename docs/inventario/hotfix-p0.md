# Hotfix P0 Inventario — gate de validación (`058_inventario_seguridad_p0.sql`)

Rama: `fix/inventario-seguridad-p0`. Todo lo de este documento se ejecuta en **staging** (nunca prod). Requiere dos orgs de prueba (A y B) con un artículo y una bodega cada una.

## 0. Resultado de validación 2026-09-17 — GATE VERDE ✅

Proyecto staging, DB vacía (D1: `inv=0, bod=0, mov=0`). Orgs de prueba `org_test_p0_a/b` creadas y pendientes de limpieza (§6).

| Evidencia | Resultado |
|---|---|
| Funciones `prosecdef` (las 3) | `true` = DEFINER ✅ |
| Grants `movimientos_inventario` para `authenticated` | solo `SELECT` (+`REFERENCES/TRIGGER/TRUNCATE` residuales, no bloquean) ✅ S1 |
| Constraints S2 (5/5) | presentes ✅ |
| B4 insert directo | `42501 permission denied` ✅ |
| B7 bodega de otra org | `23503 fk_inventario_bodega_tenant` ✅ |
| B9 salida 999999 vs stock 10 | `[CONFLICT]`, stock intacto ✅ |
| Feliz +10 / −5 | `antes/despues` 10→20→15 encadenan ✅ |
<<<<<<< HEAD
| Concurrencia paralela real | ⏳ pendiente reintento limpio tras `063` (ver §0.2) → ✅ VERDE 2026-09-17: reset 999→10, salida 10→0 OK, 2.ª salida `[CONFLICT]`, stock intacto |
| Casos 1–3, 5, 6, 8, 10–12 | ⏳ pendientes de JWTs reales de 2 orgs (vía app); la simulación con `SET ROLE` cubrió el núcleo S1/S2/S3 |
| Regresión app (§3) | ⏳ pendiente: abrir Inventario y Bodegas contra staging y probar un ajuste |

Veredicto: hotfix funcionalmente validado; merge a main bloqueado hasta concurrencia + regresión app + limpieza §6.

## 0.1 Validación 059/060/061 (2026-09-17, staging) ✅

| Evidencia | Resultado |
|---|---|
| Backfill SKU (`059`) | origen con `CAT-974C-0001` ✅ |
| Seeds `060` | `ingeniero` con crear; `test-a` sin membresía → `[PERMISSION]` en transfer ✅ (defensa en profundidad opera) |
| Transfer cross-tenant (A→bodega B) | `[VALIDATION]` ✅ |
| Transfer parcial 10/15 A→A2 (`061`) | origen 15→5, destino nuevo 10 con `sku NULL`, 2 movimientos `[transferencia]` encadenados ✅ |
| Trigger ocupación | A=1, A2=1, B=0 ✅ |

## 0.2 Bypass UPDATE directo detectado y cerrado (2026-09-17)

`audit_logs` mostró un `UPDATE quantity 10→0` a las 02:19:34 sin fila de kardex,
proveniente de fuera de las RPC (edición/guardado con cantidad obsoleta). La RPC
posterior leyó 0 y respondió `[CONFLICT]`: la RPC operó bien, pero el bypass no
debía existir. Remedio: migración `063` (trigger `trg_inventario_guard_quantity`
+ flag `app.inventory_rpc` en las 3 RPCs) y `updateItem` ya no envía `quantity`;
servicio `updateStock` (bypass sin uso) eliminado.

## 0.3 Gate de concurrencia VERDE + guard `063` verificado (2026-09-17)

Secuencia: ajuste reset a 10 (`antes:999` confirmó que el paso 0 previo había
escrito sin `063`) → salida 10 OK (`10→0`) → 2.ª salida `[CONFLICT]`, stock
intacto en 0. Tras aplicar `063`, el UPDATE directo se rechaza con
`[PERMISSION] El stock solo cambia vía movimientos (RPC)`.

>>>>>>> origin/main
## 1. Matriz de aislamiento (100% verde para merge)

| # | Actor | Operación | Esperado |
|---|---|---|---|
| 1 | B | `SELECT` artículo de A | 0 filas (invisible) |
| 2 | B | `INSERT inventario` con `company_id` de A | rechazado (trigger `FORGERY_ATTEMPT` + RLS) |
| 3 | B | `UPDATE` / `DELETE` artículo de A | 0 filas / denegado (DELETE solo `administrador` de su propia org) |
| 4 | B | `INSERT` directo a `movimientos_inventario` | **denegado** (`permission denied`, S1) |
| 5 | B | `UPDATE` / `DELETE` en `movimientos_inventario` | **denegado** (S1) |
| 6 | B | `SELECT` movimientos de A | 0 filas |
| 7 | A | `INSERT inventario` con `warehouse_id` de B | **rechazado** (FK `fk_inventario_bodega_tenant`, S2) |
| 8 | A | `rpc(registrar_movimiento_inventario)` con `p_warehouse_id` de B | `[VALIDATION]` (chequeo explícito, previo a la FK) |
| 9 | A | `rpc` salida con `cantidad > stock` | `[CONFLICT]` (no `GREATEST`, no clamp) |
| 10 | A | `rpc` con `cantidad <= 0` o tipo inválido | `[VALIDATION]` |
| 11 | sin sesión | `rpc` sin JWT | `[PERMISSION]` |
| 12 | A | flujo feliz entrada → salida → ajuste | `antes/despues` encadenan; ajuste a igual valor retorna `sin_cambios` sin insertar |

Script base (ajustar IDs; ejecutar con el JWT de cada org, rol `authenticated`):

```sql
-- 4/5 (S1): debe fallar con permission denied
INSERT INTO public.movimientos_inventario
  (company_id, item_id, cantidad, tipo, antes, despues, motivo, usuario_id)
VALUES ('<COMPANY_A>', '<ITEM_A>', 1, 'entrada', 0, 1, 'intento directo', 'test');
UPDATE public.movimientos_inventario SET motivo='x' WHERE id='<MOV_A>';
DELETE FROM public.movimientos_inventario WHERE id='<MOV_A>';

-- 7 (S2): debe fallar con violación de fk_inventario_bodega_tenant
INSERT INTO public.inventario
  (company_id, name, category, quantity, unit, min_quantity, warehouse_id)
VALUES ('<COMPANY_A>', 'Cebo', 'Herramienta', 1, 'unidad', 0, '<BODEGA_B>');
```

## 2. Concurrencia (obligatoria, S3)

Dos sesiones simultáneas, stock = 10, salida de 10 en ambas:

```sql
SELECT public.registrar_movimiento_inventario('<ITEM_A>', 10, 'salida', 'test-1', NULL);
-- en paralelo:
SELECT public.registrar_movimiento_inventario('<ITEM_A>', 10, 'salida', 'test-2', NULL);
```

Esperado: **una OK** (`despues: 0`), **una `[CONFLICT]`**. Verificar después: `quantity = 0` (nunca negativo) y exactamente **un** movimiento `salida` de 10 para ese artículo en la ventana de prueba. Repetir con `consumir_inventario_por_aplicacion` (misma expectativa).

## 3. Regresión funcional (la app actual debe seguir operando)

- `fetchInventory` / `fetchWarehouses` / `fetchMovements` (SELECT): sin cambios.
- `adjustStock` entrada/salida vía RPC: misma firma y mismas claves de respuesta (`success, antes, despues, cantidad, tipo`).
- `confirmar_venta` → `registrar_movimiento_bodega` (ahora DEFINER): flujo postcosecha en staging.
- Trazabilidad lee `movimientos_inventario` vía `service_role`: sin cambios.

## 4. Aplicación y rollback

1. Backup staging → aplicar `058` → correr §1–§3 → registrar resultado (fecha, proyecto, commit, responsable).
2. Si S2 se bloquea por huérfanos: NO forzar; exportar el reporte del `RAISE EXCEPTION`, decidir limpieza con negocio, reintentar.
3. Rollback: bloque comentado al pie de `058` (reintroduce el bug `GREATEST`: solo como puente; preferir forward-fix).

## 5. Seguimiento fuera de scope (no bloquea el merge)

- `lotes_producto.bodega_id` y `despachos.bodega_origen_id` siguen sin FK compuesta → Fase 4.
- `transferencia` parcial real (upsert destino + doble lock) → Fase 4 (`contrato-v2.md` D5).
- Función SQL `has_permission(recurso, acción)` sobre `permisos` → Fase 3.

## 6. Limpieza de datos de prueba ✅ 2026-09-17

Empresas `test-org-a/b` + perfil `user_test_p0_a` eliminados; `inventario` de
prueba en 0; `audit_logs_immutable_trg` reactivado (`tgenabled=O`).
Hallazgo de proceso: el `DELETE CASCADE` de `companies` choca con el trigger de
auditoría (borra padre antes que hijos y el log huérfano viola la FK). La
limpieza debió hacerse hijos→padre (§6 actualizado). Lección para prod: nunca
borrar empresas en cascada; usar borrado suave.

```sql
-- orden que funciona (inmutable desactivado solo durante la ventana):
-- movimientos → inventario → bodegas → company_users → purga audit_logs →
-- companies → profiles → reactivar trigger.
```

## 7. Certificación E2E en app (staging) ✅ 2026-09-17

Flujo de 11 pasos reportado sin fallas: alta con SKU, validación máx≥mín,
entrada/salida/ajuste con Kardex encadenado, conflicto con stock intacto,
transferencia, campana + filtro de alertas, filtros/URL/orden/paginación/CSV,
tab Bodegas, supervisor con acciones deshabilitadas + `[PERMISSION]`,
limpieza `E2E-*` completa. Hallazgos del ciclo ya corregidos: `062` (= ANY),
guard `063`, modal con stock fresco (`518065a`).
Estado del módulo: **CERTIFICADO para merge** en orden
`refactor/*` → `fix/*` → `feat/*`.
