-- ==============================================================================
-- SKYCROP DATABASE V2: 059_inventario_delta_v2.sql
-- Fase 2 Inventario v2 — delta sobre esquema real (contrato-v2.md §4).
-- Rama: feat/inventario-ux-v2. Requiere 058 mergeada/aplicada.
-- D4: sku nullable + backfill + UNIQUE parcial. D2/D5 no tocan esquema aquí.
-- D3 (catálogo) pendiente: NO se alteran los CHECKs de categoría en esta migración.
--
-- PREFLIGHT: D1 cerró en 0/0/0 → índices simples suficientes, sin pg_trgm.
-- ==============================================================================

-- ── Artículo: SKU + stock máximo ─────────────────────────────────────────────
ALTER TABLE public.inventario ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE public.inventario ADD COLUMN IF NOT EXISTS stock_maximo DOUBLE PRECISION CHECK (stock_maximo >= 0);

ALTER TABLE public.inventario DROP CONSTRAINT IF EXISTS chk_max_ge_min;
ALTER TABLE public.inventario ADD CONSTRAINT chk_max_ge_min
  CHECK (stock_maximo IS NULL OR stock_maximo >= min_quantity);

-- Backfill SKU idempotente (solo NULLs). Formato: CAT-<4hex company>-<seq 4>.
-- Las filas futuras lo traen del modal (obligatorio solo en nuevos, contrato §D4).
WITH ranked AS (
  SELECT id, company_id,
         ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY created_at, id) AS rn
  FROM public.inventario WHERE sku IS NULL
)
UPDATE public.inventario i
SET sku = 'CAT-' || upper(substr(ranked.company_id::text, 1, 4)) || '-' || lpad(ranked.rn::text, 4, '0')
FROM ranked WHERE i.id = ranked.id;

-- SKU único por empresa (parcial: permite múltiples NULL).
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventario_company_sku
  ON public.inventario (company_id, sku) WHERE sku IS NOT NULL;

-- Búsqueda nombre por empresa (filtros server-side del contrato §5).
CREATE INDEX IF NOT EXISTS ix_inventario_company_name
  ON public.inventario (company_id, name);

-- ── Bodega: capacidad para eliminar el /500 hardcodeado del UI ───────────────
ALTER TABLE public.bodegas ADD COLUMN IF NOT EXISTS capacidad_posiciones INT CHECK (capacidad_posiciones > 0);
ALTER TABLE public.bodegas ADD COLUMN IF NOT EXISTS ocupacion_usada INT NOT NULL DEFAULT 0 CHECK (ocupacion_usada >= 0);
-- ocupacion_usada la mantendrá un trigger en Fase 4 (con los movimientos);
-- hasta entonces el KPI la calcula en cliente desde capacidad_posiciones.

-- ==============================================================================
-- ROLLBACK DOCUMENTADO (no ejecutar salvo reversión controlada en staging).
-- ------------------------------------------------------------------------------
-- DROP INDEX IF EXISTS public.ix_inventario_company_name;
-- DROP INDEX IF EXISTS public.uq_inventario_company_sku;
-- ALTER TABLE public.inventario DROP CONSTRAINT IF EXISTS chk_max_ge_min;
-- ALTER TABLE public.inventario DROP COLUMN IF EXISTS stock_maximo;
-- -- sku: solo dropear si ningún flujo lo exige ya (revisar frontend primero):
-- -- ALTER TABLE public.inventario DROP COLUMN IF EXISTS sku;
-- ALTER TABLE public.bodegas DROP COLUMN IF EXISTS ocupacion_usada;
-- ALTER TABLE public.bodegas DROP COLUMN IF EXISTS capacidad_posiciones;
-- ==============================================================================
