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
| Concurrencia paralela real | ⏳ pendiente (requiere 2 sesiones simultáneas; ejecutar antes del merge a main) |
| Concurrencia paralela real | ⏳ pendiente (requiere 2 sesiones simultáneas; ejecutar antes del merge a main) |
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

## 6. Limpieza de datos de prueba (tras el merge)

```sql
DELETE FROM public.companies WHERE slug IN ('test-org-a','test-org-b');
-- cascada: bodegas, inventario y movimientos de TEST-ORG-A/B.
```
