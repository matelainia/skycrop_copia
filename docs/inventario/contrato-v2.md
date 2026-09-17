# Contrato técnico — Inventario y Bodegas v2 (Fase 1)

**Estado:** Aprobado parcial (D2, D4, D5, hotfix S1–S3). Pendiente: D1 (counts staging), D3 (catálogo negocio).
**Base:** esquema real (`bodegas`, `inventario`, `movimientos_inventario`), helpers `current_company()/current_user_id()/current_role_id()`. Las tablas `inventory_*` del plan original están descartadas.
**Prerrequisito:** hotfix `058` mergeado con matriz `hotfix-p0.md` 100% verde. Sin él, nada de lo aquí descrito es seguro.

## 1. Entidades y regla derivada

- **Bodega** = `bodegas` (+ `capacidad_posiciones`, `ocupacion_usada`, ver §4). **Artículo** = `inventario` (+ `sku`, `stock_maximo`, ver §4). **Movimiento** = `movimientos_inventario` (log inmutable; tras S1 solo escriben las RPC).
- **Estado de stock (derivado, no almacenado):** `quantity = 0` → Agotado · `quantity < min_quantity*0.5` → Crítico · `quantity < min_quantity` → Bajo · `stock_maximo IS NOT NULL AND quantity > stock_maximo` → Sobrestock · otro → Óptimo. Implementación única: `utils/inventoryStatus.js` + espejo SQL solo donde filtre server-side.
- Fuera de alcance v2: QR/barras, lotes-vencimiento por artículo, costeo ponderado, multi-ubicación, offline.

## 2. Operaciones (contrato negocio)

| Operación | Frontend | Backend (tras hotfix) |
|---|---|---|
| Crear/editar artículo | `ItemModal` (nombre*, categoría, SKU sugerido, unidad, bodega, stock*, mín*, máx, ubicación interna→`comentarios` o columna nueva si D3 lo pide) | `INSERT/UPDATE inventario` vía RLS (permiso `crear/editar`); `UPDATE` de stock **prohibido directo**: solo RPC |
| Crear/editar bodega | `WarehouseModal` (nombre*, tipo, capacidad*, ubicación→`sector`, responsable→`responsable_id`) | RLS + `warehouses.manage`; capacidad ≥ ocupación al editar |
| Entrada / Salida / Ajuste | `MovementModal` segmento 3 opciones + preview (solo UX) | `registrar_movimiento_inventario` (atómica; salida → `[CONFLICT]`; ajuste = conteo absoluto) |
| Transferencia parcial (D5 aprobada) | `MovementModal` 4.ª opción con cantidad + destino ≠ origen | **Fase 4:** `inventory_transfer` — lock origen+destino en orden por id, decrementa origen, upsert destino (misma `name+unit`, crea fila si no existe), 2 movimientos (salida origen / entrada destino) + motivo común |
| Eliminar artículo | `ConfirmDialog` reutilizable | borrado suave (`deleted_at`, ya soportado por RLS); físico solo admin |
| Listar/filtrar/ordenar/paginar | server-side (§5), URL-persistido | `SELECT` RLS + índices §4; si D1 supera umbrales → `inventory_list()` + `pg_trgm` (Etapa 4) |
| Exportar CSV | respeta filtros, requiere permiso, auditado | endpoint que registra en `audit_logs` |

## 3. Decisiones aplicadas

- **D2 (aprobada):** DB `timestamptz` UTC (ya es así, no se toca); presentación con `America/Guayaquil` en un único módulo `utils/formatDate.js`; prohibido `now()` de cliente para lógica.
- **D4 (aprobada):** `sku text NULL` + backfill `CAT-<company4>-<seq>` + `UNIQUE (company_id, sku) WHERE sku IS NOT NULL`; obligatorio solo en artículos nuevos; búsqueda incluye SKU.
- **D5 (aprobada):** transferencia parcial por cantidad (total = cantidad igual al stock). El demo se ajusta: el modal de transferencia muestra cantidad.
- **D6 (resuelta la fuente, pendiente la función):** mapear claves v2 → `permisos`: `inventory.view→(inventario,leer)`, `inventory.create→(inventario,crear)`, `inventory.update→(inventario,editar)`, `inventory.delete→(inventario,eliminar)`, `inventory.movements→(inventario,crear)` (registrar movimiento), `inventory.export→(inventario,leer)` + marca de auditoría, `warehouses.view→(bodegas,leer)`, `warehouses.manage→(bodegas,todo)`. Seeds: otorgar `crear/editar` a `ingeniero`, `todo` bodegas a `administrador/gerente`; `supervisor` conserva `leer` (+movimientos si el negocio lo pide). Fase 3 crea `has_permission(recurso,acción)` (respeta `*`/`todo`) y refina políticas; UI usa `hasPermission` existente con estado *denied* diferenciado.
- **D1 (pendiente staging):** umbral < 5.000 artículos y < 50.000 movimientos → server-side simple; si no, RPC + `pg_trgm`. SQL en `058` cabecera.
- **D3 (pendiente negocio):** base = catálogos DB actuales; añadir solo categorías demo validadas; UI elimina `CATEGORIES` locales y consume origen único.

## 4. Delta Fase 2 (migración `059`, tras `058`)

```sql
ALTER TABLE public.inventario ADD COLUMN sku text;
ALTER TABLE public.inventario ADD COLUMN stock_maximo DOUBLE PRECISION CHECK (stock_maximo >= 0);
-- CHECK max>=min no es expresable entre columnas anulables sin trigger:
-- ALTER ... ADD CONSTRAINT chk_max_ge_min CHECK (stock_maximo IS NULL OR stock_maximo >= min_quantity);
CREATE UNIQUE INDEX uq_inventario_company_sku ON public.inventario (company_id, sku) WHERE sku IS NOT NULL;
CREATE INDEX ix_inventario_company_name ON public.inventario (company_id, name);
-- backfill SKU por compañía (función de una sola ejecución, idempotente por WHERE sku IS NULL)
ALTER TABLE public.bodegas ADD COLUMN capacidad_posiciones INT CHECK (capacidad_posiciones > 0);
ALTER TABLE public.bodegas ADD COLUMN ocupacion_usada INT NOT NULL DEFAULT 0 CHECK (ocupacion_usada >= 0);
-- ocupación: calculada por trigger en movimientos (Fase 4) o vista; KPI deja de usar /500.
```

## 5. Filtros/búsqueda/orden (comportamiento exigible)

Búsqueda nombre/SKU (debounce 300 ms, `ilike` server); filtros combinables categoría+bodega+estado (+ pseudo-estado "Con alerta"); Limpiar visible solo con filtros; clic en strip/KPI/campana sincroniza filtros (`?q=&cat=&wh=&st=&sort=&page=`); orden server por nombre/categoría/stock; page size 8.

## 6. Contrato de errores (estable, sin filtrar Postgres)

Prefijos de RPC `[VALIDATION] [PERMISSION] [NOT_FOUND] [CONFLICT]` → el adapter los mapea a `{code, message}` + toast/estado correspondiente (`CONFLICT` = estado de conflicto, no error genérico). RLS denegado → `PERMISSION`. `prefers-reduced-motion`, foco/Esc/`/` y responsive del demo (§6 plan original) sin cambios.

## 7. Gates

Fase 2: `059` aplica y revierte en local. Fase 3: matriz §1 `hotfix-p0.md` + permisos nuevos 100% verde. Fase 4: concurrencia (salidas + transferencias paralelas, sin negativo ni deadlock) + Kardex reconcilia (`quantity` = Σ movimientos). Sin atajos.
