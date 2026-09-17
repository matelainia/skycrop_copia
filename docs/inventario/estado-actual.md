# Inventario y Bodegas — Estado actual vs demo v2 (Fase 0, solo lectura)

**Fecha:** 2026-09-16 · **Rama observada:** `remediacion/talento-humano-fase1` (sucia, ~50 modificados + `apps/landing/`, `LeafLoader.jsx` sin seguimiento).
**Regla de fase:** cero escrituras de código. Este documento es el único entregable nuevo (`docs/inventario/estado-actual.md`).
**Advertencia de proceso (actualizado 2026-09-17):** freeze parcial ejecutado con aprobación explícita (decisión: commit en rama propia).
Qué era: `InventoryMovementsHistory.jsx` (1 línea: texto "Cargando historial..." → `<LeafLoader>`) + `LeafLoader.jsx` nuevo — parte de una estandarización transversal de loadings (57 archivos).
Qué se hizo: commit `06f7066 refactor(ui): standardize inventory history loading with LeafLoader` en rama nueva `refactor/ui-loading-leafloader` (solo esos 2 archivos). Verificado: en `remediacion/talento-humano-fase1` ya no queda ningún archivo de inventario modificado ni `LeafLoader.jsx` sin seguimiento.
Por qué: aislar el diff del hotfix P0 y de la feature sin perder el trabajo transversal.
Pendiente del dueño de talento-humano: los ~55 archivos restantes siguen sucios en su rama + `apps/landing/` sin seguimiento; el "árbol limpio" total del gate queda en sus manos. El trabajo de inventario continúa en `fix/inventario-seguridad-p0` (limpia respecto a inventario).

**Clasificación:**
- **Confirmado:** verificado por lectura directa de archivos citados (`ruta:línea`).
- **Inferido:** deducción razonable marcada como tal.
- **Pendiente:** requiere DB viva o decisión (lista al final).

---

## 1. Repo y stack (confirmado)

- Monorepo npm workspaces (`package.json:4-7`): `apps/*` (`web`, `landing`, `auth`), `packages/*` (`ui`, `services`, `types`), `backend/` (Express 4.19.2 ESM, hexagonal por módulo), `supabase/migrations/` (57 vigentes `001–057`), `tests/e2e/`.
- Frontend inventario en `apps/web/src/components/InventarioBodegas/` — **35 archivos**, montado desde `apps/web/src/app/App.jsx` por estado `activeTab` (no hay `react-router`; persiste en `localStorage skycrop_active_tab`). No existe `src/pages`.
- Sin Tailwind (sin `tailwind.config`, sin dependencia en `apps/web/package.json`). Estilos 100% variables CSS + clases custom en `apps/web/src/app/index.css` (~1515 líneas, importa `Inter+Outfit`). Tokens light "Emerald & Ivory" (`--primary:hsl(142,72%,40%)`, `--bg-app:hsl(44,45%,95%)`, etc.); dark vía `body.dark-theme` + `localStorage skycrop_theme`, toggle en sidebar-footer de `App.jsx`. El módulo hereda el tema, sin lógica propia.
- Iconos `lucide-react`; iconos de ítem con emojis vía heurística (`utils/inventoryHelpers.js`). `packages/ui` existe pero el módulo **no lo usa**. `QueryClientProvider` montado en `main.jsx` pero el módulo usa `useState/useEffect`, no react-query.
- Acceso a datos: **100% Supabase vía proxy backend**, cero mocks. `apps/web/src/lib/supabaseClient.js` crea cliente contra `localhost:3000/api` (dev) / `https://backend.skycrop.app/api` (prod) e inyecta `company_id=activeOrgId` en `select/insert/update/delete` para tablas en `TENANT_TABLES` (incluye `inventario`, `bodegas`, `trabajadores`). `setSupabaseToken(token, orgId)` se alimenta de `AuthContext` tras `GET /api/auth/me`.

## 2. Módulo actual (confirmado)

**Orquestador:** `components/InventarioBodegas/InventarioBodegas.jsx` (194 líneas): header + `Agregar Insumo` / `Gestionar Bodegas`, `<InventoryMetrics/>`, `<WarehouseCards/>` (strip), tarjeta `Toolbar + Table + Pagination`, 4 drawers/modales. Sin tabs.

**Estructura real:**
```
context/InventoryModuleContext.jsx   (loading + toast global, withFeedback)
hooks/useInventory.js, useWarehouses.js, useInventoryMovements.js,
      useInventoryMutations.js, useWarehouseMutations.js,
      useInventoryFilters.js, usePagination.js
services/inventoryService.js, warehouseService.js, inventoryMovementService.js
adapters/inventory.adapter.js, warehouse.adapter.js, movement.adapter.js
schemas/inventory.schema.js, warehouse.schema.js, movement.schema.js
utils/inventoryCalculations.js, inventoryConstants.js, inventoryHelpers.js
components/Inventory/AddItemDrawer.jsx, AdjustStockModal.jsx, InventoryMetrics.jsx,
  InventoryPagination.jsx, InventoryRow.jsx, InventoryTable.jsx,
  InventoryToolbar.jsx, ViewItemModal.jsx
components/Warehouse/WarehouseCards.jsx, ManageWarehousesDrawer.jsx
components/Movements/InventoryMovementsHistory.jsx
components/Shared/WarehouseSelector.jsx, ToastNotification.jsx, ItemStatusBadge.jsx, ItemIcon.jsx
```

**Datos que consume:** `inventario` (`services/inventoryService.js:4-12` select `*` order `created_at` desc), `bodegas` + `trabajadores(id,nombres,apellidos)` en paralelo, `movimientos_inventario` (order `created_at` desc, fallback silencioso a `[]` si la relación no existe), RPC `registrar_movimiento_inventario(p_item_id,p_cantidad,p_tipo,p_motivo,p_warehouse_id)` solo `entrada|salida`.

**Filtros/paginación/orden:** todo **cliente** (`useInventoryFilters.js`, `usePagination.js`): strip por `warehouseId`, búsqueda case-insensitive **solo `name`+`category`** (sin SKU/lote/bodega), filtro categoría (`CATEGORIES` locales), sin filtro de estado, sin orden UI (solo SQL `created_at`), paginación `slice` con `ITEMS_PER_PAGE=7` fijo, sin page-size, sin server-side, sin persistencia en URL.

**Estados:** `loading` global compartido (sobreescritura mutua entre hooks); único visual de carga `LeafLoader` en historial; tabla sin skeleton/spinner; empty sí (tabla/drawers/historial); error solo toast + `console.error`, sin error boundary ni errores inline de campo. Deletes con `window.confirm` nativo (no `ConfirmDialog` reutilizable).

**KPIs** (`utils/inventoryCalculations.js:1-17`): Total = `items.length`; Bajo stock = `quantity < minQuantity` (binario, no los 5 estados del demo); Bodegas = `warehouses.length`; Ocupación = `sum(qty bodega cuyo nombre incluye 'central')/500` — capacidad **hardcodeada 500**, acoplada al nombre, `0%` si no hay "central".

## 3. Supabase (confirmado por migraciones)

**Las tablas `inventory_warehouses/items/movements` del plan NO existen** (0 hits en el repo). Nombres reales:

| Plan v2 | Real | Definición |
|---|---|---|
| Bodega | `public.bodegas` (+ `public.almacenamientos`) | `supabase/migrations/011_bodegas.sql:7-31` |
| Artículo | `public.inventario` (+ catálogo `public.productos`) | `013_inventario.sql:7-22`, `012_productos.sql` |
| Movimiento | `public.movimientos_inventario` (extendida en `042:409-416`) | `013:25-37` |

**Columnas reales vs contrato v2 — faltan:** `sku`, `max_stock`, `internal_location`, `status/used/capacity/manager/location` en bodega (bodega tiene `sector, coordenada_x/y, categoria, responsable_id`; capacidad solo existe en `almacenamientos`), `updated_at/updated_by/created_by`, `stock_before/after` se llaman `antes/despues`, `from/to_warehouse`, `performed_by` se llama `usuario_id TEXT`. Tipos: `quantity/min_quantity DOUBLE`, `cantidad/antes/despues NUMERIC`.

**Catálogos divergentes (bloqueante Fase 1):** bodega DB `Herramientas|Insumos Fitosanitarios|Fertilizantes|Semillas|EPP|Cosecha` vs demo `General|Insumos|Agroquímicos|Semillas|Combustible`; artículo DB `Fungicida|Insecticida|Herbicida|Fertilizante|Semilla|Herramienta|EPP` vs demo 9 categorías. UI local usa un tercer catálogo (`inventoryConstants.js`: `Semillas|Fertilizantes|Herbicidas|Pesticidas|Mantenimiento|Seguridad|Herramientas`).

**Constraints/índices:** sin `UNIQUE` en `bodegas/inventario/movimientos_inventario` (solo PK/FK/CHECK); sin `ENUM` (solo `CHECK ... IN`); sin `pg_trgm`; índices solo `(company_id)` (`020:13-16`) + `(company_id,item_id)` (`020:45`) + 2 parciales de `042:415-416`. Sin índice de búsqueda por nombre/SKU.

**RLS (vigente):** habilitado en `021:39-43`; todo `TO authenticated`, `anon` revocado en `043:26-37`. Patrón `company_id = current_company()` (JWT `org_id`, `021:7-28`, endurecido a `NULL` fail-closed en `038`); `inventario` con soft-delete visible a admin/autor; `DELETE` exige `current_role_id()='administrador'`; `productos` permite `company_id IS NULL` (global ICA). Trigger `secure_company_id_trg` (`022:50-67`) autocompleta `company_id` y bloquea `FORGERY_ATTEMPT`; auditoría `audit_inventario_trigger → audit_logs`.

**RPCs:** `registrar_movimiento_inventario` (`022:501-548`, `SECURITY INVOKER`) solo `entrada|salida`, sin `FOR UPDATE` visible → riesgo de carrera; `consumir_inventario_por_aplicacion` (`022:152-215`, `DEFINER` + `rpc_assert_tenant_access`) descuenta y alerta `STOCK_MINIMO`; `registrar_movimiento_bodega` (`042:528-554`) opera sobre `lotes_producto` y usa `SELECT id FROM inventario LIMIT 1` como `item_id` placeholder (huele a inconsistencia referencial). **No hay prohibición de INSERT directo a `movimientos_inventario`** (RLS lo permite con `company_id` propio) — contradice el requisito v2 "solo RPC escribe".

**Helpers `current_org_id()/has_permission()`:** no existen con esos nombres. Equivalentes: `current_company()`, `current_user_id()`, `current_role_id()`, `rpc_assert_tenant_access()`.

## 4. Identidad y permisos (confirmado)

Clerk → `AuthContext.jsx` → `GET /api/auth/me` (`GetUserProfileUseCase`: exige `orgId`, mapea `org:admin→administrador` etc., `bootstrap_user_org`, junta `roles+permisos`, firma JWT Supabase 15 min con `org_id = companies.id UUID`) → `setSupabaseToken` (refresh 9 min) → proxy inyecta `company_id` + RLS manda en servidor. Backend `authenticate.js`: traduce `org_xxx → companies.id` vía `companies.clerk_org_id` (caché 10 min); `resolveTenant` falla cerrado en prod, abierto con fallbacks en dev.

**Brecha:** entrada al módulo exige `inventario:leer` (`App.jsx`), pero **dentro del módulo no hay ningún `hasPermission('inventario','crear|actualizar|eliminar')`** — cualquiera que ve el módulo puede intentar crear/eliminar/ajustar; solo RLS frena (DELETE solo admin; INSERT/UPDATE cualquier miembro de la company). Seed `006_permissions.sql`: `ingeniero/supervisor → inventario:leer`, `administrador → *`.
**Inferido:** captura `localhost:5173` con contadores `0/0/0` = DB vacía o RLS filtrando otra org; sin conexión viva no se distingue.

## 5. Entorno (confirmado nombres, sin secretos)

`.env.example` + `backend/.env`: `PORT,NODE_ENV,LLM,GEMINI_API_KEY,DEEPSEEK_API_KEY,SUPABASE_URL,SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,SUPABASE_JWT_SECRET,CLERK_SECRET_KEY,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,UPSTASH_*,GOOGLE_WEATHER_API_KEY,GEE_SERVICE_ACCOUNT_KEY` (+`FRONTEND_URL` en backend). Web `apps/web/.env.local`: `VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY,VITE_CLERK_PUBLISHABLE_KEY,VITE_AUTH_URL,VITE_BACKEND_URL,VITE_API_URL`. Único proyecto hardcodeado `https://gynttnymneanbziywqqr.supabase.co` (prod); sin `supabase/config.toml`; staging por vars `STAGING_*` + `docs/STAGING_RUNBOOK_043_047.md` + `tests/e2e/config/env-guard.js` (bloquea prod). Gap: `CLERK_WEBHOOK_SECRET` se usa en `ClerkAuthService` pero no está en el schema de `env.js` ni en `.env.example`.

## 6. Gaps vs demo v2

| Demo v2 | Estado actual |
|---|---|
| Strip bodegas clicable con ocupación/alertas | ✅ parcial (filtra; sin % ocupación ni conteo alertas; card "Todas" con `id:'all'` inconsistente con filtro `'all'`) |
| Tabs Insumos/Bodegas/Movimientos con contadores | ❌ no hay tabs; bodegas y movimientos son secciones/drawers separados |
| Toolbar: búsqueda + 3 selects + Limpiar + Export CSV | ⚠️ búsqueda sin SKU, solo filtro categoría, sin filtro bodega/estado, sin Limpiar, sin CSV (CSV solo existe en manejo-sanitario/trazabilidad) |
| Tabla con orden, 5 estados derivados, paginación server 8 | ❌ sin orden UI; estado binario (Bajo/Óptimo); paginación cliente 7; sin `max/stock bar real` |
| Modales Agregar/Editar, Bodega, Movimiento 4 tipos, Confirm | ⚠️ Add (sin edit), Manage (crear/eliminar, sin editar), Adjust (solo entrada/salida, sin transferencia/ajuste-a-conteo, sin preview), confirm = `window.confirm` |
| Campana + popover alertas → filtrar | ❌ solo toast fijo superior; sin campana ni popover |
| KPIs 4 con sparklines/deltas | ⚠️ 4 KPIs sin sparklines/deltas, ocupación hardcodeada |
| Motion catalog + `prefers-reduced-motion` + responsive matrix + a11y (foco, Esc, `/`) | ❌ no hay catálogo; `Esc//` inexistentes; responsive solo genérico (`1024/768`) |
| Filtros URL-persistidos, server-side, `pg_trgm` | ❌ todo cliente, sin URL, sin índices de búsqueda |

## 7. Hallazgos priorizados

- **P0 — Escritura directa a `movimientos_inventario` permitida por RLS** (021). v2 exige solo-RPC. Decidir en Fase 1 y migrar en Fase 3.
- **P0 — Sin integridad cross-tenant `warehouse_id → otra org`.** FK sin compañía + trigger solo autocompleta `company_id` propio. Requiere FK compuesta/trigger + prueba de aislamiento.
- **P0 — Árbol sucio + rama diag no creada; freeze inexistente.** Resolver antes de Fase 1 (stash/commit + `diag/inventario-ux-v2`).
- **P1 — RPC `registrar_movimiento_inventario` solo entrada/salida, sin lock de fila** → salidas concurrentes pueden dar stock negativo (CHECK `>=0` lo convierte en error 500, no en `CONFLICT` contractual). Requiere RPC transaccional v2.
- **P1 — Esquema incompatible con contrato v2** (sin SKU/UNIQUE, sin max, sin used/capacity en bodega, catálogos divergentes, placeholder `LIMIT 1` en `042`). Fase 1 debe decidir reutilizar+expandir vs tablas nuevas + migración de datos.
- **P1 — Sin granularidad UI de permisos** (crear/eliminar/ajustar visibles a todo lector). Añadir `usePermissions` + denied diferenciado (backend manda igual).
- **P2 — Filtros/paginación/orden cliente** (`ITEMS_PER_PAGE=7`, búsqueda sin SKU). Escalará mal; server-side + índices desde Fase 2.
- **P2 — Ocupación hardcodeada `/500` por nombre 'central'.** Redefinir (capacidad por bodega o quitar KPI hasta Fase 2).
- **P2 — `updateStock/updateItem` en servicio sin uso; ajuste va por RPC; edición de artículo/bodega inexistente en UI.** Contrato CRUD incompleto.
- **P3 — Sin export CSV auditado, sin tabs/popover/motion/a11y del demo; `CLERK_WEBHOOK_SECRET` fuera del schema env; `docs/data_dictionary.md:121-149` desactualizado (no incluye columnas `042`).**

## 8. Pendientes (bloquean Fase 1/2, ninguno requiere escritura)

1. Volúmenes reales (`count` inventario/movimientos por org) → decide server-side vs cliente y `pg_trgm`.
2. Timezone operativo (migraciones usan `timezone('utc')`; demo muestra fechas `es-EC`).
3. Catálogo oficial categorías/unidades (3 fuentes divergentes: DB, UI, demo).
4. Decisión SKU: ¿obligatorio + `UNIQUE(company_id,sku)` con backfill?
5. Semántica transferencia/ajuste (¿mueve `warehouse_id`? ¿ajuste = conteo absoluto?) y si movimientos de `lotes_producto` comparten kardex.
6. Confirmar proyecto Supabase dev/staging y credenciales con marcadores anti-prod; `backend/.env` contiene secretos reales — no commitear.
7. Aprobación del plan + creación de `diag/inventario-ux-v2` + freeze antes de cualquier migración.

*Fin Fase 0 — sin cambios de código; solo este documento.*

---

## Adenda 2026-09-17 — revisión de gate (solo lectura adicional)

- **Corrección al P1 de concurrencia:** `registrar_movimiento_inventario` (`022_functions.sql:521-527`) no solo carece de lock: usa `GREATEST(0, v_antes - p_cantidad)`. Dos salidas concurrentes tienen **éxito silencioso** y el stock queda en 0 (sobrevendido, auditoría falsa). Sube a P0 y motiva S3 del hotfix.
- **D6 resuelto:** existe tabla `permisos(rol_id, recurso, accion)` con `UNIQUE` (`006_permissions.sql:6-12`), vocabulario `leer/crear/editar/eliminar/todo` + `*`; `inventario:leer` otorgado a `ingeniero/supervisor`. `current_role_id()` (`021_rls.sql:64-78`) hace lookup en `company_users` (solo `activo=true`, default `operario`). Falta función SQL `has_permission()` → Fase 3.
- **Impacto S1 verificado:** ningún insert directo a `movimientos_inventario` en app/backend (solo SELECT + RPC); backend lee vía `service_role` (no afectado por el REVOKE).
- **Decisiones aprobadas:** D2 `America/Guayaquil` presentación / UTC en DB; D4 SKU nullable + backfill + UNIQUE parcial; D5 transferencia parcial (Fase 4). D1 pendiente (counts en staging, sin tocar prod). D3 pendiente de negocio.
- Hotfix: `supabase/migrations/058_inventario_seguridad_p0.sql` + gate en `docs/inventario/hotfix-p0.md`. Contrato: `docs/inventario/contrato-v2.md`.
