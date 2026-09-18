-- ==============================================================================
-- SKYCROP DATABASE V2: 065_costos_produccion.sql
-- Módulo Costos de Producción — MODELO (base de 066 RPCs).
-- Rama: draft/costos-produccion. NO aplicar en producción.
-- NOTA DRAFT: este archivo cambió tras aplicarse en dev (ajustes §2.1–§2.6:
-- columnas de valorización, entry_hash, security_invoker, grants granulares).
-- En dev con 065 ya aplicada: hacer reset de la base draft o aplicar los
-- ALTER equivalentes antes de 066 (066 los incluye como §0 idempotente).
--
-- Alcance de este archivo (PR2):
--   1) Compat no destructiva de public.costos (solo ADD COLUMN IF NOT EXISTS).
--   2) Nuevas tablas public.costos_* en schema public, tenant company_id.
--   3) RLS + bloqueo de escritura directa (solo backend/RPC futuro escribe).
--   4) Seeds: categorías por empresa, catálogo global de indicadores, permisos.
--   5) Vistas básicas de agregación (solo posted).
--
-- Fuera de alcance (irá en 066 + backend):
--   RPCs costos_register/value/allocate/post/reverse/recalculate,
--   adaptadores de módulos origen, backfill histórico, UI.
--
-- Convenciones respetadas:
--   - company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE.
--   - Nada de organization_id. Nada de CREATE SCHEMA costs.
--   - Lectura: company_id = current_company() AND has_permission('costos','leer').
--   - Ledger inmutable: sin UPDATE/DELETE directo para authenticated.
--   - Sin precio no hay costo cero: status pending_price + costos_issues.
--   - Moneda base COP, fx_rate DEFAULT 1; FX distinta sin tasa -> issue fx_missing.
--   - Periodo cerrado bloquea posted (lógica en 066; aquí solo estructura).
--
-- Preflight staging (solo lectura, antes de aplicar en dev):
--   SELECT count(*) FROM public.costos;
--   SELECT concepto, count(*) FROM public.costos GROUP BY concepto ORDER BY 2 DESC;
--   SELECT count(*) FROM public.companies;
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0 · Compat no destructiva de public.costos (tabla legacy, sigue viva)
-- No DROP, no RENAME, no cambio de tipos. registrar_costo_lote() intacto.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.costos
  ADD COLUMN IF NOT EXISTS predio_id UUID REFERENCES public.predios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS labor_id UUID REFERENCES public.labores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cantidad NUMERIC,
  ADD COLUMN IF NOT EXISTS unidad TEXT,
  ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC,
  ADD COLUMN IF NOT EXISTS moneda CHAR(3) NOT NULL DEFAULT 'COP',
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'posted';

-- Índices compat (no rompen nada, aceleran el espejo futuro referencia_tipo/id).
CREATE INDEX IF NOT EXISTS costos_company_fecha_idx
  ON public.costos (company_id, fecha DESC);
CREATE INDEX IF NOT EXISTS costos_referencia_idx
  ON public.costos (company_id, referencia_tipo, referencia_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · costos_categorias — normaliza costos.concepto (TEXT libre actual)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.costos_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  nombre TEXT NOT NULL,
  cost_class TEXT NOT NULL CHECK (cost_class IN (
    'labor','input','fuel','maintenance','machinery_usage','depreciation',
    'service','overhead','financial','tax','harvest','commercial','revenue','other')),
  cost_behavior TEXT NOT NULL DEFAULT 'variable' CHECK (cost_behavior IN ('fixed','variable')),
  directness TEXT NOT NULL DEFAULT 'direct' CHECK (directness IN ('direct','indirect')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
CREATE INDEX IF NOT EXISTS idx_costos_categorias_company
  ON public.costos_categorias (company_id, is_active);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · costos_items — items específicos (no se siembran desde inventario aún)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.costos_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.costos_categorias(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  nombre TEXT NOT NULL,
  default_unit TEXT,
  account_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
CREATE INDEX IF NOT EXISTS idx_costos_items_company_cat
  ON public.costos_items (company_id, categoria_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · costos_tarifas — tarifas vigentes para valorizar (estructura; sin migrar
-- maquinaria.costo_*_hora ni labores.jornal todavía — fase controlada aparte)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.costos_tarifas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rate_type TEXT NOT NULL CHECK (rate_type IN (
    'labor','machine','input','fuel','market_price','overhead')),
  resource_type TEXT,
  resource_id UUID,
  effective_from DATE NOT NULL,
  effective_to DATE,
  unit TEXT,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'COP',
  includes_burden BOOLEAN NOT NULL DEFAULT false,
  includes_fuel BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX IF NOT EXISTS idx_costos_tarifas_company_rate
  ON public.costos_tarifas (company_id, rate_type, resource_type, resource_id, effective_from DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · costos_eventos — hecho bruto idempotente desde módulos origen
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.costos_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_module TEXT NOT NULL CHECK (source_module IN (
    'labores','maquinaria','combustible','mantenimiento','inventario',
    'aplicaciones','fertilization','nominas','cosecha','ventas','finanzas','manual')),
  source_entity TEXT NOT NULL,
  source_id UUID NOT NULL,
  source_version INT NOT NULL DEFAULT 1 CHECK (source_version >= 1),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'input_consumption','labor_usage','machine_usage','fuel_consumption',
    'maintenance_cost','external_service','depreciation','overhead_expense',
    'harvest_output','sale_revenue','estimated_revenue',
    'other_income','other_expense','correction')),
  occurred_at TIMESTAMPTZ NOT NULL,
  business_date DATE NOT NULL,
  -- §1-FINAL (decisión integridad): dimensionales RESTRICT. El ledger nunca
  -- pierde contexto; retirar una entidad = soft delete/archivo, no DELETE físico.
  predio_id UUID REFERENCES public.predios(id) ON DELETE RESTRICT,
  lote_id UUID REFERENCES public.lotes(id) ON DELETE RESTRICT,
  labor_id UUID REFERENCES public.labores(id) ON DELETE RESTRICT,
  operacion_id UUID REFERENCES public.maquinaria_operaciones(id) ON DELETE RESTRICT,
  maquinaria_id UUID REFERENCES public.maquinaria(id) ON DELETE RESTRICT,
  inventario_id UUID REFERENCES public.inventario(id) ON DELETE RESTRICT,
  trabajador_id UUID REFERENCES public.trabajadores(id) ON DELETE RESTRICT,
  cosecha_id UUID REFERENCES public.cosechas(id) ON DELETE RESTRICT,
  venta_id UUID REFERENCES public.ventas(id) ON DELETE RESTRICT,
  quantity NUMERIC,
  source_unit TEXT,
  provided_unit_price NUMERIC,
  provided_amount NUMERIC,
  currency CHAR(3) NOT NULL DEFAULT 'COP',
  fx_rate NUMERIC NOT NULL DEFAULT 1 CHECK (fx_rate > 0),
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN (
    'received','validated','invalid','pending_price','pending_allocation',
    'priced','allocated','posted','reversed','ignored')),
  idempotency_key TEXT,
  valuation_hash TEXT,
  -- §2.1 Valor final del motor (provided_* = declarado por el origen;
  -- valued_*/amount_base = determinado por costos_value_event en 066).
  valued_unit_price NUMERIC,
  valued_amount NUMERIC CHECK (valued_amount IS NULL OR valued_amount >= 0),
  valued_currency CHAR(3) NOT NULL DEFAULT 'COP',
  valued_fx_rate NUMERIC NOT NULL DEFAULT 1 CHECK (valued_fx_rate > 0),
  amount_base NUMERIC CHECK (amount_base IS NULL OR amount_base >= 0),
  valued_at TIMESTAMPTZ,
  allocated_at TIMESTAMPTZ,
  payload_hash TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_at TIMESTAMPTZ,
  UNIQUE (company_id, source_module, source_entity, source_id, source_version, event_type)
);
-- Unicidad de idempotency_key solo cuando viene informada (varios NULL permitidos).
CREATE UNIQUE INDEX IF NOT EXISTS uq_costos_eventos_idemkey
  ON public.costos_eventos (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_costos_eventos_company_status
  ON public.costos_eventos (company_id, status);
CREATE INDEX IF NOT EXISTS idx_costos_eventos_source
  ON public.costos_eventos (company_id, source_module, source_entity, source_id);
CREATE INDEX IF NOT EXISTS idx_costos_eventos_lote_fecha
  ON public.costos_eventos (company_id, lote_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_costos_eventos_labor_fecha
  ON public.costos_eventos (company_id, labor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_costos_eventos_maquina_fecha
  ON public.costos_eventos (company_id, maquinaria_id, occurred_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5 · costos_entradas — LEDGER inmutable valorizado y asignado
-- Correcciones solo vía reversal/adjustment (066). Nunca DELETE directo.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.costos_entradas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_event_id UUID NOT NULL REFERENCES public.costos_eventos(id) ON DELETE RESTRICT,
  entry_kind TEXT NOT NULL CHECK (entry_kind IN (
    'cost','expense','revenue','adjustment','reversal')),
  cost_class TEXT NOT NULL CHECK (cost_class IN (
    'labor','input','fuel','maintenance','machinery_usage','depreciation',
    'service','overhead','financial','tax','harvest','commercial','revenue','other')),
  cost_behavior TEXT NOT NULL DEFAULT 'variable' CHECK (cost_behavior IN ('fixed','variable')),
  directness TEXT NOT NULL DEFAULT 'direct' CHECK (directness IN ('direct','indirect')),
  cost_item_id UUID REFERENCES public.costos_items(id) ON DELETE SET NULL,
  -- §1-FINAL (decisión integridad): igual que en costos_eventos, RESTRICT.
  predio_id UUID REFERENCES public.predios(id) ON DELETE RESTRICT,
  lote_id UUID REFERENCES public.lotes(id) ON DELETE RESTRICT,
  labor_id UUID REFERENCES public.labores(id) ON DELETE RESTRICT,
  operacion_id UUID REFERENCES public.maquinaria_operaciones(id) ON DELETE RESTRICT,
  maquinaria_id UUID REFERENCES public.maquinaria(id) ON DELETE RESTRICT,
  inventario_id UUID REFERENCES public.inventario(id) ON DELETE RESTRICT,
  trabajador_id UUID REFERENCES public.trabajadores(id) ON DELETE RESTRICT,
  cosecha_id UUID REFERENCES public.cosechas(id) ON DELETE RESTRICT,
  venta_id UUID REFERENCES public.ventas(id) ON DELETE RESTRICT,
  occurred_at TIMESTAMPTZ NOT NULL,
  business_date DATE NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  unit_price NUMERIC,
  amount_original NUMERIC NOT NULL CHECK (amount_original >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'COP',
  fx_rate NUMERIC NOT NULL DEFAULT 1 CHECK (fx_rate > 0),
  amount_base NUMERIC NOT NULL CHECK (amount_base >= 0),
  sign SMALLINT NOT NULL DEFAULT 1 CHECK (sign IN (-1, 1)),
  allocation_method TEXT CHECK (allocation_method IN (
    'direct','area','machine_hours','labor_hours',
    'operation_hours','yield','direct_cost','manual')),
  allocation_quality TEXT CHECK (allocation_quality IN (
    'direct','inferred','estimated','manual')),
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','reversed')),
  calculation_run_id UUID,
  valuation_hash TEXT,
  -- §2.2 Anti-duplicado de publicación (un evento puede generar N entradas
  -- por asignación parcial futura, pero nunca dos idénticas).
  entry_hash TEXT,
  reason TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_costos_entradas_entry_hash
  ON public.costos_entradas (company_id, source_event_id, entry_hash)
  WHERE entry_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_costos_entradas_company_status
  ON public.costos_entradas (company_id, status);
CREATE INDEX IF NOT EXISTS idx_costos_entradas_labor
  ON public.costos_entradas (company_id, labor_id, status);
CREATE INDEX IF NOT EXISTS idx_costos_entradas_lote
  ON public.costos_entradas (company_id, lote_id, status);
CREATE INDEX IF NOT EXISTS idx_costos_entradas_maquina
  ON public.costos_entradas (company_id, maquinaria_id, status);
CREATE INDEX IF NOT EXISTS idx_costos_entradas_clase
  ON public.costos_entradas (company_id, cost_class, status);
CREATE INDEX IF NOT EXISTS idx_costos_entradas_evento
  ON public.costos_entradas (source_event_id);
CREATE INDEX IF NOT EXISTS idx_costos_entradas_business_date
  ON public.costos_entradas (company_id, business_date DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6 · costos_reglas_asignacion — prorrateo de indirectos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.costos_reglas_asignacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  applies_to_event_type TEXT,
  applies_to_cost_class TEXT,
  target_level TEXT NOT NULL CHECK (target_level IN (
    'labor','lote','predio','maquina','operacion')),
  method TEXT NOT NULL CHECK (method IN (
    'direct','area','machine_hours','labor_hours',
    'operation_hours','yield','direct_cost','manual')),
  priority INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_costos_reglas_company
  ON public.costos_reglas_asignacion (company_id, is_active, priority);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7 · costos_presupuestos — budget/standard por objeto y periodo
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.costos_presupuestos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  predio_id UUID REFERENCES public.predios(id) ON DELETE SET NULL,
  lote_id UUID REFERENCES public.lotes(id) ON DELETE SET NULL,
  labor_id UUID REFERENCES public.labores(id) ON DELETE SET NULL,
  categoria_id UUID REFERENCES public.costos_categorias(id) ON DELETE SET NULL,
  cost_item_id UUID REFERENCES public.costos_items(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL CHECK (period_end >= period_start),
  quantity NUMERIC,
  unit TEXT,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'COP',
  scenario TEXT NOT NULL DEFAULT 'budget' CHECK (scenario IN ('budget','standard')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_costos_presupuestos_company_periodo
  ON public.costos_presupuestos (company_id, period_start, period_end);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8 · costos_issues — calidad de datos visible (nunca costo cero silencioso)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.costos_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_event_id UUID REFERENCES public.costos_eventos(id) ON DELETE SET NULL,
  issue_type TEXT NOT NULL CHECK (issue_type IN (
    'missing_price','missing_dimension','invalid_unit','fx_missing',
    'unallocatable','duplicate_event','closed_period','invalid_source',
    'missing_period','other')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open','investigating','resolved','ignored')),
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_costos_issues_company_status
  ON public.costos_issues (company_id, status);
CREATE INDEX IF NOT EXISTS idx_costos_issues_evento
  ON public.costos_issues (source_event_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9 · costos_periodos — periodos cerrables (sin periodos = modo abierto)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.costos_periodos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL CHECK (period_end >= period_start),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_by TEXT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, period_start, period_end)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10 · Catálogo global de indicadores + snapshots por empresa
-- costos_indicadores_def es GLOBAL (sin company_id, como productos globales).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.costos_indicadores_def (
  code TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'cost','revenue','margin','efficiency','budget','risk')),
  unit TEXT NOT NULL,
  formula TEXT NOT NULL,
  direction TEXT CHECK (direction IN (
    'higher_is_better','lower_is_better','neutral')),
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.costos_indicadores_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  indicator_code TEXT NOT NULL REFERENCES public.costos_indicadores_def(code) ON DELETE RESTRICT,
  period_start DATE,
  period_end DATE,
  predio_id UUID REFERENCES public.predios(id) ON DELETE SET NULL,
  lote_id UUID REFERENCES public.lotes(id) ON DELETE SET NULL,
  labor_id UUID REFERENCES public.labores(id) ON DELETE SET NULL,
  maquinaria_id UUID REFERENCES public.maquinaria(id) ON DELETE SET NULL,
  value NUMERIC,
  unit TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_costos_snapshots_company
  ON public.costos_indicadores_snapshots (company_id, indicator_code);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10b · DECISIÓN FINAL §1 — FKs dimensionales RESTRICT (documentado,
-- no cambiar sin RFC explícita).
-- costos_eventos y costos_entradas → predios/lotes/labores/operaciones/
-- maquinaria/inventario/trabajadores/cosechas/ventas: ON DELETE RESTRICT.
-- Motivo: SET NULL protege el borrado pero degrada trazabilidad; un ledger
-- vivo sin contexto se vuelve administrativamente inutilizable. Las entidades
-- productivas con historia no se borran físicamente: soft delete / archive /
-- estado inactivo. Si dev revela DELETEs físicos que chocan con costos, es
-- hallazgo de integridad P1/P2 (implementar borrado lógico), NUNCA revertir
-- a SET NULL automáticamente.
-- Excepciones con SET NULL (no comprometen el ledger):
--   costos_items.categoria_id, costos_entradas.cost_item_id (configuración),
--   costos_presupuestos.* (planeación), costos_indicadores_snapshots.* (analítica),
--   compat public.costos.predio_id/labor_id (tabla legacy).
-- ─────────────────────────────────────────────────────────────────────────────
-- §2.6 costos_indicadores_def: catálogo GLOBAL (sin company_id, como
-- productos globales). RLS activo + SELECT USING (is_active=true) + sin
-- escritura para authenticated (ver §11.2 y REVOKEs). Solo migraciones y
-- service_role-lectura. Confirmado.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 11 · RLS + bloqueo de escritura directa (patrón 058/060)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.costos_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costos_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costos_tarifas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costos_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costos_entradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costos_reglas_asignacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costos_presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costos_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costos_periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costos_indicadores_def ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costos_indicadores_snapshots ENABLE ROW LEVEL SECURITY;

-- Grants: lectura para authenticated (filtrada por RLS).
GRANT SELECT ON public.costos_categorias, public.costos_items, public.costos_tarifas,
  public.costos_eventos, public.costos_entradas, public.costos_reglas_asignacion,
  public.costos_presupuestos, public.costos_issues, public.costos_periodos,
  public.costos_indicadores_def, public.costos_indicadores_snapshots TO authenticated;
-- §2.4 Grants mínimos por tabla para service_role (el backend escribe vía
-- supabaseAdmin y las RPCs 066 son DEFINER del owner: no necesitan ALL).
-- TODO: tighten grants before production; no DELETE on ledger.
-- Ledger: solo SELECT+INSERT (reversos = filas nuevas, nunca UPDATE/DELETE).
GRANT SELECT, INSERT ON public.costos_entradas TO service_role;
REVOKE UPDATE, DELETE ON public.costos_entradas FROM service_role;
-- Eventos/issues/periodos: SELECT+INSERT+UPDATE (transiciones de estado).
GRANT SELECT, INSERT, UPDATE ON public.costos_eventos TO service_role;
REVOKE DELETE ON public.costos_eventos FROM service_role;
GRANT SELECT, INSERT, UPDATE ON public.costos_issues TO service_role;
REVOKE DELETE ON public.costos_issues FROM service_role;
GRANT SELECT, INSERT, UPDATE ON public.costos_periodos TO service_role;
REVOKE DELETE ON public.costos_periodos FROM service_role;
-- Configuración: SELECT+INSERT+UPDATE (baja lógica con is_active=false).
GRANT SELECT, INSERT, UPDATE ON public.costos_categorias TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.costos_items TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.costos_tarifas TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.costos_reglas_asignacion TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.costos_presupuestos TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.costos_indicadores_snapshots TO service_role;
REVOKE DELETE ON public.costos_categorias, public.costos_items, public.costos_tarifas,
  public.costos_reglas_asignacion, public.costos_presupuestos,
  public.costos_indicadores_snapshots FROM service_role;
-- Catálogo global de indicadores: solo lectura (lo gestionan migraciones).
GRANT SELECT ON public.costos_indicadores_def TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.costos_indicadores_def FROM service_role;

-- Revokes defensa en profundidad (estilo 058): ni authenticated ni anon escriben.
REVOKE INSERT, UPDATE, DELETE ON public.costos_categorias FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.costos_items FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.costos_tarifas FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.costos_eventos FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.costos_entradas FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.costos_reglas_asignacion FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.costos_presupuestos FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.costos_issues FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.costos_periodos FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.costos_indicadores_def FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.costos_indicadores_snapshots FROM authenticated, anon, PUBLIC;

-- 11.1 SELECT por tenant + permiso (tablas con company_id).
DROP POLICY IF EXISTS costos_categorias_select_policy ON public.costos_categorias;
CREATE POLICY costos_categorias_select_policy ON public.costos_categorias FOR SELECT TO authenticated
  USING (company_id = public.current_company() AND public.has_permission('costos', 'leer'));
DROP POLICY IF EXISTS costos_items_select_policy ON public.costos_items;
CREATE POLICY costos_items_select_policy ON public.costos_items FOR SELECT TO authenticated
  USING (company_id = public.current_company() AND public.has_permission('costos', 'leer'));
DROP POLICY IF EXISTS costos_tarifas_select_policy ON public.costos_tarifas;
CREATE POLICY costos_tarifas_select_policy ON public.costos_tarifas FOR SELECT TO authenticated
  USING (company_id = public.current_company() AND public.has_permission('costos', 'leer'));
DROP POLICY IF EXISTS costos_eventos_select_policy ON public.costos_eventos;
CREATE POLICY costos_eventos_select_policy ON public.costos_eventos FOR SELECT TO authenticated
  USING (company_id = public.current_company() AND public.has_permission('costos', 'leer'));
DROP POLICY IF EXISTS costos_entradas_select_policy ON public.costos_entradas;
CREATE POLICY costos_entradas_select_policy ON public.costos_entradas FOR SELECT TO authenticated
  USING (company_id = public.current_company() AND public.has_permission('costos', 'leer'));
DROP POLICY IF EXISTS costos_reglas_select_policy ON public.costos_reglas_asignacion;
CREATE POLICY costos_reglas_select_policy ON public.costos_reglas_asignacion FOR SELECT TO authenticated
  USING (company_id = public.current_company() AND public.has_permission('costos', 'leer'));
DROP POLICY IF EXISTS costos_presupuestos_select_policy ON public.costos_presupuestos;
CREATE POLICY costos_presupuestos_select_policy ON public.costos_presupuestos FOR SELECT TO authenticated
  USING (company_id = public.current_company() AND public.has_permission('costos', 'leer'));
DROP POLICY IF EXISTS costos_issues_select_policy ON public.costos_issues;
CREATE POLICY costos_issues_select_policy ON public.costos_issues FOR SELECT TO authenticated
  USING (company_id = public.current_company() AND public.has_permission('costos', 'leer'));
DROP POLICY IF EXISTS costos_periodos_select_policy ON public.costos_periodos;
CREATE POLICY costos_periodos_select_policy ON public.costos_periodos FOR SELECT TO authenticated
  USING (company_id = public.current_company() AND public.has_permission('costos', 'leer'));
DROP POLICY IF EXISTS costos_snapshots_select_policy ON public.costos_indicadores_snapshots;
CREATE POLICY costos_snapshots_select_policy ON public.costos_indicadores_snapshots FOR SELECT TO authenticated
  USING (company_id = public.current_company() AND public.has_permission('costos', 'leer'));

-- 11.2 Catálogo global de indicadores: lectura para cualquier autenticado activo.
DROP POLICY IF EXISTS costos_indicadores_def_select_policy ON public.costos_indicadores_def;
CREATE POLICY costos_indicadores_def_select_policy ON public.costos_indicadores_def FOR SELECT TO authenticated
  USING (is_active = true);

-- 11.3 Bloqueo explícito de escritura directa (defensa en profundidad;
-- el REVOKE ya bloquea, estas policies documentan la intención y cubren
-- un eventual re-grant futuro). Solo service_role / RPC DEFINER escriben.
DROP POLICY IF EXISTS costos_eventos_no_direct_insert ON public.costos_eventos;
CREATE POLICY costos_eventos_no_direct_insert ON public.costos_eventos FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS costos_eventos_no_direct_update ON public.costos_eventos;
CREATE POLICY costos_eventos_no_direct_update ON public.costos_eventos FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS costos_eventos_no_direct_delete ON public.costos_eventos;
CREATE POLICY costos_eventos_no_direct_delete ON public.costos_eventos FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS costos_entradas_no_direct_insert ON public.costos_entradas;
CREATE POLICY costos_entradas_no_direct_insert ON public.costos_entradas FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS costos_entradas_no_direct_update ON public.costos_entradas;
CREATE POLICY costos_entradas_no_direct_update ON public.costos_entradas FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS costos_entradas_no_direct_delete ON public.costos_entradas;
CREATE POLICY costos_entradas_no_direct_delete ON public.costos_entradas FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS costos_issues_no_direct_insert ON public.costos_issues;
CREATE POLICY costos_issues_no_direct_insert ON public.costos_issues FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS costos_issues_no_direct_update ON public.costos_issues;
CREATE POLICY costos_issues_no_direct_update ON public.costos_issues FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS costos_issues_no_direct_delete ON public.costos_issues;
CREATE POLICY costos_issues_no_direct_delete ON public.costos_issues FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS costos_periodos_no_direct_insert ON public.costos_periodos;
CREATE POLICY costos_periodos_no_direct_insert ON public.costos_periodos FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS costos_periodos_no_direct_update ON public.costos_periodos;
CREATE POLICY costos_periodos_no_direct_update ON public.costos_periodos FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS costos_periodos_no_direct_delete ON public.costos_periodos;
CREATE POLICY costos_periodos_no_direct_delete ON public.costos_periodos FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS costos_categorias_no_direct_insert ON public.costos_categorias;
CREATE POLICY costos_categorias_no_direct_insert ON public.costos_categorias FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS costos_categorias_no_direct_update ON public.costos_categorias;
CREATE POLICY costos_categorias_no_direct_update ON public.costos_categorias FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS costos_categorias_no_direct_delete ON public.costos_categorias;
CREATE POLICY costos_categorias_no_direct_delete ON public.costos_categorias FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS costos_items_no_direct_insert ON public.costos_items;
CREATE POLICY costos_items_no_direct_insert ON public.costos_items FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS costos_items_no_direct_update ON public.costos_items;
CREATE POLICY costos_items_no_direct_update ON public.costos_items FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS costos_items_no_direct_delete ON public.costos_items;
CREATE POLICY costos_items_no_direct_delete ON public.costos_items FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS costos_tarifas_no_direct_insert ON public.costos_tarifas;
CREATE POLICY costos_tarifas_no_direct_insert ON public.costos_tarifas FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS costos_tarifas_no_direct_update ON public.costos_tarifas;
CREATE POLICY costos_tarifas_no_direct_update ON public.costos_tarifas FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS costos_tarifas_no_direct_delete ON public.costos_tarifas;
CREATE POLICY costos_tarifas_no_direct_delete ON public.costos_tarifas FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS costos_reglas_no_direct_insert ON public.costos_reglas_asignacion;
CREATE POLICY costos_reglas_no_direct_insert ON public.costos_reglas_asignacion FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS costos_reglas_no_direct_update ON public.costos_reglas_asignacion;
CREATE POLICY costos_reglas_no_direct_update ON public.costos_reglas_asignacion FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS costos_reglas_no_direct_delete ON public.costos_reglas_asignacion;
CREATE POLICY costos_reglas_no_direct_delete ON public.costos_reglas_asignacion FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS costos_presupuestos_no_direct_insert ON public.costos_presupuestos;
CREATE POLICY costos_presupuestos_no_direct_insert ON public.costos_presupuestos FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS costos_presupuestos_no_direct_update ON public.costos_presupuestos;
CREATE POLICY costos_presupuestos_no_direct_update ON public.costos_presupuestos FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS costos_presupuestos_no_direct_delete ON public.costos_presupuestos;
CREATE POLICY costos_presupuestos_no_direct_delete ON public.costos_presupuestos FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS costos_snapshots_no_direct_insert ON public.costos_indicadores_snapshots;
CREATE POLICY costos_snapshots_no_direct_insert ON public.costos_indicadores_snapshots FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS costos_snapshots_no_direct_update ON public.costos_indicadores_snapshots;
CREATE POLICY costos_snapshots_no_direct_update ON public.costos_indicadores_snapshots FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS costos_snapshots_no_direct_delete ON public.costos_indicadores_snapshots;
CREATE POLICY costos_snapshots_no_direct_delete ON public.costos_indicadores_snapshots FOR DELETE TO authenticated USING (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 12 · Seeds idempotentes
-- ─────────────────────────────────────────────────────────────────────────────
-- 12.1 Permisos del recurso costos (vocabulario 006/060: recurso + accion ES).
INSERT INTO public.permisos (rol_id, recurso, accion) VALUES
  ('administrador', 'costos', 'todo'),
  ('gerente',       'costos', 'todo'),
  ('ingeniero',     'costos', 'leer'),
  ('supervisor',    'costos', 'leer'),
  ('auditor',       'costos', 'leer'),
  ('consulta',      'costos', 'leer')
ON CONFLICT (rol_id, recurso, accion) DO NOTHING;

-- 12.2 Categorías base por empresa existente (mapea costos.concepto libre).
INSERT INTO public.costos_categorias (company_id, code, nombre, cost_class, cost_behavior, directness)
SELECT c.id, seed.code, seed.nombre, seed.cost_class, seed.cost_behavior, seed.directness
FROM public.companies c
CROSS JOIN (VALUES
  ('MANO_OBRA',    'Mano de obra directa',      'labor',          'variable', 'direct'),
  ('INSUMO',       'Insumos agrícolas',         'input',          'variable', 'direct'),
  ('COMBUSTIBLE',  'Combustibles y lubricantes','fuel',           'variable', 'direct'),
  ('MANTENIMIENTO','Mantenimiento',             'maintenance',    'variable', 'indirect'),
  ('MAQUINARIA',   'Uso de maquinaria',         'machinery_usage','variable', 'direct'),
  ('DEPRECIACION', 'Depreciación',              'depreciation',   'fixed',    'indirect'),
  ('SERVICIO_EXT', 'Servicios externos',        'service',        'variable', 'direct'),
  ('OVERHEAD',     'Gastos generales predio',   'overhead',       'fixed',    'indirect'),
  ('COSECHA',      'Cosecha y poscosecha',      'harvest',        'variable', 'direct'),
  ('COMERCIAL',    'Comercialización',          'commercial',     'variable', 'direct'),
  ('INGRESO',      'Ingresos por venta',        'revenue',        'variable', 'direct'),
  ('OTRO',         'Otros',                     'other',          'variable', 'direct')
) AS seed(code, nombre, cost_class, cost_behavior, directness)
ON CONFLICT (company_id, code) DO NOTHING;

-- 12.3 Catálogo global de indicadores PKI/KPI (sin snapshots todavía).
INSERT INTO public.costos_indicadores_def (code, nombre, category, unit, formula, direction) VALUES
  ('COSTO_TOTAL',        'Costo total',                 'cost',      'COP',  'sum(sign*amount_base) cost+expense posted', 'lower_is_better'),
  ('COSTO_DIRECTO',      'Costo directo',               'cost',      'COP',  'sum direct posted',                         'lower_is_better'),
  ('COSTO_INDIRECTO',    'Costo indirecto asignado',    'cost',      'COP',  'sum indirect posted',                       'lower_is_better'),
  ('COSTO_HA',           'Costo por hectárea',          'cost',      'COP/ha','costo_total / area_ha',                    'lower_is_better'),
  ('COSTO_KG',           'Costo por kilogramo',         'cost',      'COP/kg','costo_total / produccion_kg',              'lower_is_better'),
  ('INGRESO_TOTAL',      'Ingreso total',               'revenue',   'COP',  'sum revenue posted (real+estimado sep.)',  'higher_is_better'),
  ('MARGEN_BRUTO',       'Margen bruto',                'margin',    'COP',  'ingreso - costo_directo',                  'higher_is_better'),
  ('MARGEN_NETO',        'Margen neto',                 'margin',    'COP',  'ingreso - costo_total',                    'higher_is_better'),
  ('MARGEN_PCT',         'Margen porcentual',           'margin',    '%',    'margen_neto / ingreso * 100',              'higher_is_better'),
  ('PUNTO_EQ_KG',        'Punto equilibrio (kg)',       'risk',      'kg',   'costo_total / precio_kg',                  'lower_is_better'),
  ('PUNTO_EQ_PRECIO',    'Precio mínimo (punto eq.)',   'risk',      'COP/kg','costo_total / produccion_kg',             'lower_is_better'),
  ('DESVIACION_PTO',     'Desviación vs presupuesto',   'budget',    'COP',  'real - presupuesto',                       'lower_is_better'),
  ('L_HA',               'Combustible por hectárea',    'efficiency','L/ha', 'litros / area_ha',                         'lower_is_better'),
  ('L_HORA',             'Combustible por hora máquina','efficiency','L/h',  'litros / horas_maquina',                   'lower_is_better'),
  ('COSTO_HORA_MAQ',     'Costo horario maquinaria',   'efficiency','COP/h','(depr+mant+comb+operador)/horas',          'lower_is_better'),
  ('PCT_INDIRECTO',      '% costo indirecto',           'cost',      '%',    'indirecto / total * 100',                  'neutral')
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13 · Vistas básicas (solo posted).
-- §2.3 security_invoker=true (patrón 052): la vista corre con los
-- privilegios/RLS del invocante, nunca del owner. Sin esto, un SELECT
-- autenticado podría ver costos de otra empresa. Verificado en dev con los
-- tests §10.2 (fuga entre companies A/B).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_costo_labor_resumen
WITH (security_invoker = true) AS
SELECT ce.company_id, ce.labor_id,
  sum(CASE WHEN ce.entry_kind IN ('cost','expense') THEN ce.sign * ce.amount_base ELSE 0 END) AS total,
  sum(CASE WHEN ce.entry_kind IN ('cost','expense') AND ce.directness = 'direct' THEN ce.sign * ce.amount_base ELSE 0 END) AS directo,
  sum(CASE WHEN ce.entry_kind IN ('cost','expense') AND ce.directness = 'indirect' THEN ce.sign * ce.amount_base ELSE 0 END) AS indirecto,
  sum(CASE WHEN ce.entry_kind = 'revenue' THEN ce.sign * ce.amount_base ELSE 0 END) AS ingreso
FROM public.costos_entradas ce
WHERE ce.status = 'posted'
GROUP BY ce.company_id, ce.labor_id;

CREATE OR REPLACE VIEW public.v_costo_lote_resumen
WITH (security_invoker = true) AS
SELECT ce.company_id, ce.lote_id,
  sum(CASE WHEN ce.entry_kind IN ('cost','expense') THEN ce.sign * ce.amount_base ELSE 0 END) AS total,
  sum(CASE WHEN ce.entry_kind IN ('cost','expense') AND ce.directness = 'direct' THEN ce.sign * ce.amount_base ELSE 0 END) AS directo,
  sum(CASE WHEN ce.entry_kind IN ('cost','expense') AND ce.directness = 'indirect' THEN ce.sign * ce.amount_base ELSE 0 END) AS indirecto,
  sum(CASE WHEN ce.entry_kind = 'revenue' THEN ce.sign * ce.amount_base ELSE 0 END) AS ingreso
FROM public.costos_entradas ce
WHERE ce.status = 'posted'
GROUP BY ce.company_id, ce.lote_id;

CREATE OR REPLACE VIEW public.v_costo_clase_resumen
WITH (security_invoker = true) AS
SELECT ce.company_id, ce.lote_id, ce.labor_id, ce.maquinaria_id, ce.cost_class,
  sum(ce.sign * ce.amount_base) AS total
FROM public.costos_entradas ce
WHERE ce.status = 'posted'
GROUP BY ce.company_id, ce.lote_id, ce.labor_id, ce.maquinaria_id, ce.cost_class;

REVOKE ALL ON TABLE public.v_costo_labor_resumen FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.v_costo_labor_resumen TO authenticated, service_role;
REVOKE ALL ON TABLE public.v_costo_lote_resumen FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.v_costo_lote_resumen TO authenticated, service_role;
REVOKE ALL ON TABLE public.v_costo_clase_resumen FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.v_costo_clase_resumen TO authenticated, service_role;

-- ==============================================================================
-- ROLLBACK DOCUMENTADO (reversión controlada en dev/staging; NUNCA en prod
-- sin backup + aprobación):
--   DROP VIEW IF EXISTS public.v_costo_clase_resumen;
--   DROP VIEW IF EXISTS public.v_costo_lote_resumen;
--   DROP VIEW IF EXISTS public.v_costo_labor_resumen;
--   DELETE FROM public.permisos WHERE recurso = 'costos';
--   DELETE FROM public.costos_indicadores_def WHERE code IN ('COSTO_TOTAL',...);
--   DROP TABLE IF EXISTS public.costos_indicadores_snapshots;
--   DROP TABLE IF EXISTS public.costos_indicadores_def;
--   DROP TABLE IF EXISTS public.costos_periodos;
--   DROP TABLE IF EXISTS public.costos_issues;
--   DROP TABLE IF EXISTS public.costos_presupuestos;
--   DROP TABLE IF EXISTS public.costos_reglas_asignacion;
--   DROP TABLE IF EXISTS public.costos_entradas;
--   DROP TABLE IF EXISTS public.costos_eventos;
--   DROP TABLE IF EXISTS public.costos_tarifas;
--   DROP TABLE IF EXISTS public.costos_items;
--   DROP TABLE IF EXISTS public.costos_categorias;
--   ALTER TABLE public.costos
--     DROP COLUMN IF EXISTS predio_id, DROP COLUMN IF EXISTS labor_id,
--     DROP COLUMN IF EXISTS cantidad, DROP COLUMN IF EXISTS unidad,
--     DROP COLUMN IF EXISTS precio_unitario, DROP COLUMN IF EXISTS moneda,
--     DROP COLUMN IF EXISTS estado;
-- ==============================================================================
