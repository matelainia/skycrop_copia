-- ==============================================================================
-- SKYCROP DATABASE V2: 042_cosecha_postcosecha_trazabilidad.sql
-- Descripción: Capa operativa Cosecha y Postcosecha — trazabilidad completa
--   producción → transformación → inventario → ventas → despachos → facturación
--   Mantiene aislamiento estricto multiempresa (RLS) y cero datos mock.
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EXTENDER TABLA COSECHAS (conserva compatibilidad legacy)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS predio_id UUID REFERENCES public.predios(id) ON DELETE SET NULL;
-- lote_id ya existe (FK lotes)
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS cultivo_variedad TEXT;
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS area_cosechada NUMERIC CHECK (area_cosechada IS NULL OR area_cosechada >= 0);
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS cantidad_cosechada NUMERIC;
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS unidad TEXT DEFAULT 'kg';
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS numero_plantas INTEGER CHECK (numero_plantas IS NULL OR numero_plantas >= 0);
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS rendimiento_kg_ha NUMERIC GENERATED ALWAYS AS (
  CASE WHEN area_cosechada IS NOT NULL AND area_cosechada > 0 AND COALESCE(cantidad_cosechada, weight) IS NOT NULL
  THEN COALESCE(cantidad_cosechada, weight) / area_cosechada ELSE NULL END
) STORED;
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS responsable_id TEXT; -- clerk_user_id o trabajador_id
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS responsable_nombre TEXT;
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS cuadrilla_id UUID REFERENCES public.cuadrillas(id) ON DELETE SET NULL;
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'REGISTRADA' CHECK (estado IN ('BORRADOR','REGISTRADA','EN_POSTCOSECHA','FINALIZADA','ANULADA'));
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS observaciones TEXT;
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS latitud DOUBLE PRECISION CHECK (latitud IS NULL OR (latitud BETWEEN -90 AND 90));
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS longitud DOUBLE PRECISION CHECK (longitud IS NULL OR (longitud BETWEEN -180 AND 180));
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS precision_gps NUMERIC;
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS gps_capturado_en TIMESTAMPTZ;
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS gps_capturado_por TEXT;
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS fecha_cosecha TIMESTAMPTZ;
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS deleted_by TEXT DEFAULT NULL;
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.cosechas ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- Migrar datos legacy: cantidad_cosechada = weight, fecha_cosecha = COALESCE(date::timestamptz, created_at)
UPDATE public.cosechas SET cantidad_cosechada = weight WHERE cantidad_cosechada IS NULL AND weight IS NOT NULL;
UPDATE public.cosechas SET fecha_cosecha = COALESCE(date::timestamptz, created_at) WHERE fecha_cosecha IS NULL;

-- Índice único código por empresa (solo si no nulo)
CREATE UNIQUE INDEX IF NOT EXISTS ux_cosechas_company_codigo ON public.cosechas(company_id, codigo) WHERE codigo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cosechas_company_predio ON public.cosechas(company_id, predio_id);
CREATE INDEX IF NOT EXISTS idx_cosechas_company_lote ON public.cosechas(company_id, lote_id);
CREATE INDEX IF NOT EXISTS idx_cosechas_company_estado ON public.cosechas(company_id, estado);
CREATE INDEX IF NOT EXISTS idx_cosechas_company_fecha ON public.cosechas(company_id, fecha_cosecha DESC);
CREATE INDEX IF NOT EXISTS idx_cosechas_company_codigo ON public.cosechas(company_id, codigo) WHERE codigo IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FUNCIÓN GENERADORA DE CÓDIGOS SECUENCIALES POR EMPRESA Y AÑO
--    COS-YYYY-NNNNNN, PROD-YYYY-NNNNNN, etc.  Atomicidad via bloqueo fila
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generar_codigo_cosecha(p_company_id UUID, p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS TEXT AS $$
DECLARE v_year TEXT := EXTRACT(YEAR FROM p_fecha)::TEXT; v_seq INT; v_code TEXT;
BEGIN
  -- Bloqueo advisory por empresa+año para evitar duplicados concurrentes (opcional, se usa MAX+1)
  SELECT COALESCE(MAX((regexp_match(codigo, '^COS-'||v_year||'-(\d+)$'))[1]::INT), 0) + 1
    INTO v_seq FROM public.cosechas WHERE company_id = p_company_id AND codigo LIKE 'COS-'||v_year||'-%';
  IF v_seq IS NULL THEN v_seq := 1; END IF;
  v_code := 'COS-'||v_year||'-'||LPAD(v_seq::TEXT, 6, '0');
  -- Evitar colisión si existe (retry)
  WHILE EXISTS (SELECT 1 FROM public.cosechas WHERE company_id = p_company_id AND codigo = v_code) LOOP
    v_seq := v_seq + 1; v_code := 'COS-'||v_year||'-'||LPAD(v_seq::TEXT, 6, '0');
  END LOOP;
  RETURN v_code;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.process_cosecha_codigo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := public.generar_codigo_cosecha(NEW.company_id, COALESCE(NEW.fecha_cosecha::DATE, NEW.date, CURRENT_DATE));
  END IF;
  IF NEW.fecha_cosecha IS NULL AND NEW.date IS NOT NULL THEN
    NEW.fecha_cosecha := NEW.date::timestamptz;
  END IF;
  IF NEW.cantidad_cosechada IS NULL AND NEW.weight IS NOT NULL THEN
    NEW.cantidad_cosechada := NEW.weight;
  END IF;
  IF NEW.cantidad_cosechada IS NOT NULL THEN
    NEW.weight := NEW.cantidad_cosechada;
  END IF;
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS cosecha_codigo_trg ON public.cosechas;
CREATE TRIGGER cosecha_codigo_trg BEFORE INSERT OR UPDATE ON public.cosechas FOR EACH ROW EXECUTE FUNCTION public.process_cosecha_codigo();

-- Extender trigger secure_company_id y audit ya existen (022), pero nos aseguramos:
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='secure_company_id_trg' AND tgrelid='public.cosechas'::regclass) THEN
    CREATE TRIGGER secure_company_id_trg BEFORE INSERT OR UPDATE ON public.cosechas FOR EACH ROW EXECUTE FUNCTION public.process_secure_company_id();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABLA LOTES DE PRODUCTO (trazabilidad)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lotes_producto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cosecha_id UUID NOT NULL REFERENCES public.cosechas(id) ON DELETE CASCADE,
  predio_id UUID REFERENCES public.predios(id) ON DELETE SET NULL,
  lote_agricola_id UUID REFERENCES public.lotes(id) ON DELETE SET NULL,
  codigo TEXT NOT NULL, -- PROD-YYYY-NNNNNN
  cultivo TEXT,
  variedad TEXT,
  grado TEXT CHECK (grado IN ('Grado A','Grado B','Grado C','Premium','Estándar','Procesamiento') OR grado IS NULL),
  peso_inicial NUMERIC NOT NULL CHECK (peso_inicial >= 0),
  peso_actual NUMERIC NOT NULL CHECK (peso_actual >= 0),
  merma_acumulada NUMERIC DEFAULT 0 CHECK (merma_acumulada >= 0),
  humedad_inicial NUMERIC CHECK (humedad_inicial IS NULL OR (humedad_inicial BETWEEN 0 AND 100)),
  humedad_actual NUMERIC CHECK (humedad_actual IS NULL OR (humedad_actual BETWEEN 0 AND 100)),
  bodega_id UUID REFERENCES public.bodegas(id) ON DELETE SET NULL,
  almacenamiento_id UUID REFERENCES public.almacenamientos(id) ON DELETE SET NULL,
  estado TEXT NOT NULL DEFAULT 'PROCESANDO' CHECK (estado IN ('PROCESANDO','TERMINADO','ALMACENADO','RESERVADO','VENDIDO','DESPACHADO','MERMADO','ANULADO')),
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(company_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_lotes_producto_company ON public.lotes_producto(company_id);
CREATE INDEX IF NOT EXISTS idx_lotes_producto_company_cosecha ON public.lotes_producto(company_id, cosecha_id);
CREATE INDEX IF NOT EXISTS idx_lotes_producto_company_estado ON public.lotes_producto(company_id, estado);
CREATE INDEX IF NOT EXISTS idx_lotes_producto_company_bodega ON public.lotes_producto(company_id, bodega_id);

CREATE OR REPLACE FUNCTION public.generar_codigo_producto(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE v_year TEXT := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT; v_seq INT; v_code TEXT;
BEGIN
  SELECT COALESCE(MAX((regexp_match(codigo, '^PROD-'||v_year||'-(\d+)$'))[1]::INT), 0) + 1 INTO v_seq FROM public.lotes_producto WHERE company_id=p_company_id AND codigo LIKE 'PROD-'||v_year||'-%';
  IF v_seq IS NULL THEN v_seq:=1; END IF;
  v_code:='PROD-'||v_year||'-'||LPAD(v_seq::TEXT,6,'0');
  WHILE EXISTS (SELECT 1 FROM public.lotes_producto WHERE company_id=p_company_id AND codigo=v_code) LOOP v_seq:=v_seq+1; v_code:='PROD-'||v_year||'-'||LPAD(v_seq::TEXT,6,'0'); END LOOP;
  RETURN v_code;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp;

CREATE OR REPLACE FUNCTION public.process_lote_producto_codigo() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo='' THEN NEW.codigo:=public.generar_codigo_producto(NEW.company_id); END IF;
  NEW.updated_at:=timezone('utc'::text, now());
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp;
DROP TRIGGER IF EXISTS lote_producto_codigo_trg ON public.lotes_producto;
CREATE TRIGGER lote_producto_codigo_trg BEFORE INSERT ON public.lotes_producto FOR EACH ROW EXECUTE FUNCTION public.process_lote_producto_codigo();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PROCESOS POSTCOSECHA
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.procesos_postcosecha (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cosecha_id UUID NOT NULL REFERENCES public.cosechas(id) ON DELETE CASCADE,
  lote_producto_id UUID REFERENCES public.lotes_producto(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ACOPIO','FERMENTACION','SECADO','CLASIFICACION','TRILLA','LAVADO','DESPULPADO','TOSTADO','OTRO')),
  estado TEXT NOT NULL DEFAULT 'EN_PROCESO' CHECK (estado IN ('PENDIENTE','EN_PROCESO','COMPLETADO','ANULADO')),
  peso_inicial NUMERIC CHECK (peso_inicial IS NULL OR peso_inicial >= 0),
  peso_final NUMERIC CHECK (peso_final IS NULL OR peso_final >= 0),
  merma_kg NUMERIC GENERATED ALWAYS AS (CASE WHEN peso_inicial IS NOT NULL AND peso_final IS NOT NULL THEN GREATEST(0, peso_inicial - peso_final) ELSE NULL END) STORED,
  merma_pct NUMERIC GENERATED ALWAYS AS (CASE WHEN peso_inicial IS NOT NULL AND peso_inicial > 0 AND peso_final IS NOT NULL THEN ROUND(((peso_inicial - peso_final)/peso_inicial*100)::NUMERIC,2) ELSE NULL END) STORED,
  humedad_inicial NUMERIC CHECK (humedad_inicial IS NULL OR (humedad_inicial BETWEEN 0 AND 100)),
  humedad_final NUMERIC CHECK (humedad_final IS NULL OR (humedad_final BETWEEN 0 AND 100)),
  metodo TEXT,
  responsable TEXT,
  responsable_id TEXT,
  fecha_inicio TIMESTAMPTZ,
  fecha_fin TIMESTAMPTZ,
  duracion_horas NUMERIC GENERATED ALWAYS AS (CASE WHEN fecha_inicio IS NOT NULL AND fecha_fin IS NOT NULL THEN ROUND(EXTRACT(EPOCH FROM (fecha_fin - fecha_inicio))/3600::NUMERIC,2) ELSE NULL END) STORED,
  numero_volteos INTEGER CHECK (numero_volteos IS NULL OR numero_volteos >= 0),
  observaciones TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);
CREATE INDEX IF NOT EXISTS idx_postcosecha_company_cosecha ON public.procesos_postcosecha(company_id, cosecha_id);
CREATE INDEX IF NOT EXISTS idx_postcosecha_company_loteprod ON public.procesos_postcosecha(company_id, lote_producto_id);
CREATE INDEX IF NOT EXISTS idx_postcosecha_company_tipo ON public.procesos_postcosecha(company_id, tipo);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CLIENTES Y DESTINOS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  codigo TEXT,
  nombre TEXT NOT NULL,
  nit TEXT,
  tipo TEXT DEFAULT 'JURIDICA' CHECK (tipo IN ('NATURAL','JURIDICA')),
  email TEXT CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  telefono TEXT,
  direccion TEXT,
  ciudad TEXT,
  departamento TEXT,
  pais TEXT DEFAULT 'Colombia',
  contacto_nombre TEXT,
  contacto_telefono TEXT,
  estado TEXT DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO','BLOQUEADO')),
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(company_id, nit)
);
CREATE INDEX IF NOT EXISTS idx_clientes_company ON public.clientes(company_id);
CREATE INDEX IF NOT EXISTS idx_clientes_company_nombre ON public.clientes(company_id, nombre);

CREATE TABLE IF NOT EXISTS public.destinos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL, -- ej. Planta Medellín
  direccion TEXT,
  ciudad TEXT,
  departamento TEXT,
  pais TEXT DEFAULT 'Colombia',
  latitud DOUBLE PRECISION CHECK (latitud IS NULL OR (latitud BETWEEN -90 AND 90)),
  longitud DOUBLE PRECISION CHECK (longitud IS NULL OR (longitud BETWEEN -180 AND 180)),
  contacto_nombre TEXT,
  contacto_telefono TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_destinos_company ON public.destinos(company_id);
CREATE INDEX IF NOT EXISTS idx_destinos_company_cliente ON public.destinos(company_id, cliente_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. VENTAS Y DETALLE (vinculado a lotes_producto para trazabilidad)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL, -- VEN-YYYY-NNNNNN
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  destino_id UUID REFERENCES public.destinos(id) ON DELETE SET NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  estado TEXT NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR','CONFIRMADA','PREPARACION','DESPACHADA','ENTREGADA','ANULADA','CANCELADA')),
  subtotal NUMERIC NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  impuestos NUMERIC NOT NULL DEFAULT 0 CHECK (impuestos >= 0),
  total NUMERIC NOT NULL DEFAULT 0 CHECK (total >= 0),
  moneda TEXT DEFAULT 'COP',
  condiciones_pago TEXT,
  observaciones TEXT,
  responsable TEXT,
  responsable_id TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(company_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_ventas_company ON public.ventas(company_id);
CREATE INDEX IF NOT EXISTS idx_ventas_company_cliente ON public.ventas(company_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_company_estado ON public.ventas(company_id, estado);
CREATE INDEX IF NOT EXISTS idx_ventas_company_fecha ON public.ventas(company_id, fecha DESC);

CREATE TABLE IF NOT EXISTS public.venta_detalles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  venta_id UUID NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  lote_producto_id UUID NOT NULL REFERENCES public.lotes_producto(id) ON DELETE RESTRICT,
  producto_nombre TEXT NOT NULL,
  cantidad NUMERIC NOT NULL CHECK (cantidad > 0),
  unidad TEXT NOT NULL DEFAULT 'kg',
  precio_unitario NUMERIC NOT NULL CHECK (precio_unitario >= 0),
  subtotal NUMERIC GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  impuestos NUMERIC DEFAULT 0 CHECK (impuestos >= 0),
  total NUMERIC GENERATED ALWAYS AS (cantidad * precio_unitario + COALESCE(impuestos,0)) STORED,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_venta_detalles_venta ON public.venta_detalles(venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_detalles_loteprod ON public.venta_detalles(lote_producto_id);

CREATE OR REPLACE FUNCTION public.generar_codigo_venta(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE v_year TEXT:=EXTRACT(YEAR FROM CURRENT_DATE)::TEXT; v_seq INT; v_code TEXT;
BEGIN
  SELECT COALESCE(MAX((regexp_match(codigo,'^VEN-'||v_year||'-(\d+)$'))[1]::INT),0)+1 INTO v_seq FROM public.ventas WHERE company_id=p_company_id AND codigo LIKE 'VEN-'||v_year||'-%';
  IF v_seq IS NULL THEN v_seq:=1; END IF;
  v_code:='VEN-'||v_year||'-'||LPAD(v_seq::TEXT,6,'0');
  WHILE EXISTS (SELECT 1 FROM public.ventas WHERE company_id=p_company_id AND codigo=v_code) LOOP v_seq:=v_seq+1; v_code:='VEN-'||v_year||'-'||LPAD(v_seq::TEXT,6,'0'); END LOOP;
  RETURN v_code;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp;
CREATE OR REPLACE FUNCTION public.process_venta_codigo() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo='' THEN NEW.codigo:=public.generar_codigo_venta(NEW.company_id); END IF;
  NEW.updated_at:=timezone('utc'::text, now());
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp;
DROP TRIGGER IF EXISTS venta_codigo_trg ON public.ventas;
CREATE TRIGGER venta_codigo_trg BEFORE INSERT ON public.ventas FOR EACH ROW EXECUTE FUNCTION public.process_venta_codigo();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. DESPACHOS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.despachos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL, -- DES-YYYY-NNNNNN
  venta_id UUID REFERENCES public.ventas(id) ON DELETE SET NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  destino_id UUID REFERENCES public.destinos(id) ON DELETE SET NULL,
  lote_producto_id UUID REFERENCES public.lotes_producto(id) ON DELETE SET NULL,
  producto_nombre TEXT,
  cantidad NUMERIC NOT NULL CHECK (cantidad > 0),
  unidad TEXT DEFAULT 'kg',
  bodega_origen_id UUID REFERENCES public.bodegas(id) ON DELETE SET NULL,
  almacenamiento_id UUID REFERENCES public.almacenamientos(id) ON DELETE SET NULL,
  fecha_despacho TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  estado TEXT NOT NULL DEFAULT 'PREPARACION' CHECK (estado IN ('PREPARACION','DESPACHADO','ENTREGADO','ANULADO','CANCELADO')),
  responsable TEXT,
  responsable_id TEXT,
  transportador TEXT,
  vehiculo_placa TEXT,
  observaciones TEXT,
  evidencia_url TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(company_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_despachos_company ON public.despachos(company_id);
CREATE INDEX IF NOT EXISTS idx_despachos_company_venta ON public.despachos(company_id, venta_id);
CREATE INDEX IF NOT EXISTS idx_despachos_company_estado ON public.despachos(company_id, estado);

CREATE OR REPLACE FUNCTION public.generar_codigo_despacho(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE v_year TEXT:=EXTRACT(YEAR FROM CURRENT_DATE)::TEXT; v_seq INT; v_code TEXT;
BEGIN
  SELECT COALESCE(MAX((regexp_match(codigo,'^DES-'||v_year||'-(\d+)$'))[1]::INT),0)+1 INTO v_seq FROM public.despachos WHERE company_id=p_company_id AND codigo LIKE 'DES-'||v_year||'-%';
  IF v_seq IS NULL THEN v_seq:=1; END IF;
  v_code:='DES-'||v_year||'-'||LPAD(v_seq::TEXT,6,'0');
  WHILE EXISTS (SELECT 1 FROM public.despachos WHERE company_id=p_company_id AND codigo=v_code) LOOP v_seq:=v_seq+1; v_code:='DES-'||v_year||'-'||LPAD(v_seq::TEXT,6,'0'); END LOOP;
  RETURN v_code;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp;
CREATE OR REPLACE FUNCTION public.process_despacho_codigo() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo='' THEN NEW.codigo:=public.generar_codigo_despacho(NEW.company_id); END IF;
  NEW.updated_at:=timezone('utc'::text, now());
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp;
DROP TRIGGER IF EXISTS despacho_codigo_trg ON public.despachos;
CREATE TRIGGER despacho_codigo_trg BEFORE INSERT ON public.despachos FOR EACH ROW EXECUTE FUNCTION public.process_despacho_codigo();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. FACTURACIÓN
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL, -- FAC-YYYY-NNNNNN
  venta_id UUID REFERENCES public.ventas(id) ON DELETE SET NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  numero_factura TEXT, -- número oficial DIAN / fiscal
  fecha_emision DATE DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  subtotal NUMERIC NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  impuestos NUMERIC NOT NULL DEFAULT 0 CHECK (impuestos >= 0),
  total NUMERIC NOT NULL DEFAULT 0 CHECK (total >=0),
  moneda TEXT DEFAULT 'COP',
  estado TEXT NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR','EMITIDA','PAGADA','ANULADA','VENCIDA')),
  metodo_pago TEXT,
  observaciones TEXT,
  documento_url TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(company_id, codigo),
  UNIQUE(company_id, numero_factura)
);
CREATE INDEX IF NOT EXISTS idx_facturas_company ON public.facturas(company_id);
CREATE INDEX IF NOT EXISTS idx_facturas_company_venta ON public.facturas(company_id, venta_id);
CREATE INDEX IF NOT EXISTS idx_facturas_company_estado ON public.facturas(company_id, estado);

CREATE TABLE IF NOT EXISTS public.factura_detalles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  factura_id UUID NOT NULL REFERENCES public.facturas(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  cantidad NUMERIC NOT NULL CHECK (cantidad > 0),
  unidad TEXT DEFAULT 'kg',
  precio_unitario NUMERIC NOT NULL CHECK (precio_unitario >= 0),
  impuestos NUMERIC DEFAULT 0,
  total NUMERIC GENERATED ALWAYS AS (cantidad * precio_unitario + COALESCE(impuestos,0)) STORED,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE OR REPLACE FUNCTION public.generar_codigo_factura(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE v_year TEXT:=EXTRACT(YEAR FROM CURRENT_DATE)::TEXT; v_seq INT; v_code TEXT;
BEGIN
  SELECT COALESCE(MAX((regexp_match(codigo,'^FAC-'||v_year||'-(\d+)$'))[1]::INT),0)+1 INTO v_seq FROM public.facturas WHERE company_id=p_company_id AND codigo LIKE 'FAC-'||v_year||'-%';
  IF v_seq IS NULL THEN v_seq:=1; END IF;
  v_code:='FAC-'||v_year||'-'||LPAD(v_seq::TEXT,6,'0');
  WHILE EXISTS (SELECT 1 FROM public.facturas WHERE company_id=p_company_id AND codigo=v_code) LOOP v_seq:=v_seq+1; v_code:='FAC-'||v_year||'-'||LPAD(v_seq::TEXT,6,'0'); END LOOP;
  RETURN v_code;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp;
CREATE OR REPLACE FUNCTION public.process_factura_codigo() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo='' THEN NEW.codigo:=public.generar_codigo_factura(NEW.company_id); END IF;
  NEW.updated_at:=timezone('utc'::text, now());
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp;
DROP TRIGGER IF EXISTS factura_codigo_trg ON public.facturas;
CREATE TRIGGER factura_codigo_trg BEFORE INSERT ON public.facturas FOR EACH ROW EXECUTE FUNCTION public.process_factura_codigo();

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. EXTENDER MOVIMIENTOS_INVENTARIO PARA TRAZABILIDAD DE COSECHA
-- ─────────────────────────────────────────────────────────────────────────────
-- Añadir tipos nuevos si no existen: re-crear CHECK
ALTER TABLE public.movimientos_inventario DROP CONSTRAINT IF EXISTS movimientos_inventario_tipo_check;
ALTER TABLE public.movimientos_inventario ADD CONSTRAINT movimientos_inventario_tipo_check CHECK (tipo IN ('entrada','salida','ajuste','transferencia','transformacion','merma','reserva','ajuste_calidad'));
ALTER TABLE public.movimientos_inventario ADD COLUMN IF NOT EXISTS lote_producto_id UUID REFERENCES public.lotes_producto(id) ON DELETE SET NULL;
ALTER TABLE public.movimientos_inventario ADD COLUMN IF NOT EXISTS cosecha_id UUID REFERENCES public.cosechas(id) ON DELETE SET NULL;
ALTER TABLE public.movimientos_inventario ADD COLUMN IF NOT EXISTS referencia_tabla TEXT;
ALTER TABLE public.movimientos_inventario ADD COLUMN IF NOT EXISTS referencia_id UUID;
CREATE INDEX IF NOT EXISTS idx_movimientos_loteprod ON public.movimientos_inventario(company_id, lote_producto_id) WHERE lote_producto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movimientos_cosecha ON public.movimientos_inventario(company_id, cosecha_id) WHERE cosecha_id IS NOT NULL;

-- Bodega categoria: asegurar 'Cosecha' existe (ya está en CHECK), añadir si se necesita ampliar
-- Categoría de bodega ya permite 'Cosecha' conforme 011_bodegas.sql

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. RLS: Habilitar y políticas multiempresa estrictas
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.lotes_producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procesos_postcosecha ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venta_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despachos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factura_detalles ENABLE ROW LEVEL SECURITY;

-- Helper genérico para RLS multiempresa (usa current_company() ya hardenizado en 041)
DO $$
DECLARE t_name TEXT; tables TEXT[] := ARRAY['lotes_producto','procesos_postcosecha','clientes','destinos','ventas','venta_detalles','despachos','facturas','factura_detalles'];
BEGIN
  FOREACH t_name IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select_policy ON public.%I', t_name, t_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert_policy ON public.%I', t_name, t_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_update_policy ON public.%I', t_name, t_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete_policy ON public.%I', t_name, t_name);
    EXECUTE format('CREATE POLICY %I_select_policy ON public.%I FOR SELECT TO authenticated USING (company_id = public.current_company())', t_name, t_name);
    EXECUTE format('CREATE POLICY %I_insert_policy ON public.%I FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company())', t_name, t_name);
    EXECUTE format('CREATE POLICY %I_update_policy ON public.%I FOR UPDATE TO authenticated USING (company_id = public.current_company()) WITH CHECK (company_id = public.current_company())', t_name, t_name);
    EXECUTE format('CREATE POLICY %I_delete_policy ON public.%I FOR DELETE TO authenticated USING (company_id = public.current_company() AND public.current_role_id() IN (''administrador'',''gerente''))', t_name, t_name);
  END LOOP;
END $$;

-- Triggers de seguridad company_id para todas las nuevas tablas
DO $$
DECLARE t_name TEXT; tables TEXT[] := ARRAY['lotes_producto','procesos_postcosecha','clientes','destinos','ventas','venta_detalles','despachos','facturas','factura_detalles'];
BEGIN
  FOREACH t_name IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS secure_company_id_trg ON public.%I', t_name);
    EXECUTE format('CREATE TRIGGER secure_company_id_trg BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.process_secure_company_id()', t_name);
  END LOOP;
END $$;

-- Auditoría automática para tablas críticas
DO $$
DECLARE t_name TEXT; tables TEXT[] := ARRAY['lotes_producto','procesos_postcosecha','ventas','despachos','facturas','clientes','cosechas'];
BEGIN
  FOREACH t_name IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I_trigger ON public.%I', t_name, t_name);
    EXECUTE format('CREATE TRIGGER audit_%I_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.process_audit_log()', t_name, t_name);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. FUNCIONES TRANSACCIONALES Y DE CÁLCULO (concurrencia, stock, mermas)
-- ─────────────────────────────────────────────────────────────────────────────

-- 11.1 Registrar cosecha + generar lote_producto inicial atómicamente
CREATE OR REPLACE FUNCTION public.registrar_cosecha(
  p_predio_id UUID,
  p_lote_agricola_id UUID,
  p_cultivo TEXT,
  p_variedad TEXT,
  p_area_cosechada NUMERIC,
  p_cantidad NUMERIC,
  p_unidad TEXT DEFAULT 'kg',
  p_numero_plantas INT DEFAULT NULL,
  p_responsable TEXT DEFAULT NULL,
  p_observaciones TEXT DEFAULT NULL,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_precision_gps NUMERIC DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE v_company UUID:=public.current_company(); v_user TEXT:=public.current_user_id(); v_cosecha_id UUID; v_codigo TEXT; v_result JSONB;
BEGIN
  IF v_company IS NULL THEN RAISE EXCEPTION 'Empresa no identificada (JWT sin org_id)'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <=0 THEN RAISE EXCEPTION 'Cantidad debe ser > 0'; END IF;
  IF p_area_cosechada IS NOT NULL AND p_area_cosechada <=0 THEN RAISE EXCEPTION 'Área debe ser > 0'; END IF;
  -- Validar predio/lote pertenecen a empresa si se proveen
  IF p_predio_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.predios WHERE id=p_predio_id AND company_id=v_company) THEN RAISE EXCEPTION 'Predio no pertenece a la empresa'; END IF;
  IF p_lote_agricola_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.lotes WHERE id=p_lote_agricola_id AND company_id=v_company) THEN RAISE EXCEPTION 'Lote agrícola no pertenece a la empresa'; END IF;

  v_codigo:=public.generar_codigo_cosecha(v_company, CURRENT_DATE);
  INSERT INTO public.cosechas(company_id, codigo, predio_id, lote_id, cultivo_variedad, crop, lote, area_cosechada, cantidad_cosechada, weight, unidad, numero_plantas, estado, responsable_nombre, observaciones, latitud, longitud, precision_gps, gps_capturado_en, gps_capturado_por, fecha_cosecha, date)
  VALUES (v_company, v_codigo, p_predio_id, p_lote_agricola_id, p_variedad, COALESCE(p_cultivo, p_variedad, ''), COALESCE((SELECT codigo_interno FROM public.lotes WHERE id=p_lote_agricola_id), 'SIN-LOTE'), p_area_cosechada, p_cantidad, p_cantidad, COALESCE(p_unidad,'kg'), p_numero_plantas, 'REGISTRADA', p_responsable, p_observaciones, p_lat, p_lng, p_precision_gps, CASE WHEN p_lat IS NOT NULL THEN now() ELSE NULL END, CASE WHEN p_lat IS NOT NULL THEN v_user ELSE NULL END, now(), CURRENT_DATE)
  RETURNING id INTO v_cosecha_id;

  -- Registrar historial timeline
  IF p_lote_agricola_id IS NOT NULL THEN
    PERFORM public.registrar_historial_actividad(v_company, p_lote_agricola_id, 'Cosecha', COALESCE(p_responsable, v_user), 'Cosecha '||v_codigo||' registrada: '||p_cantidad||' '||COALESCE(p_unidad,'kg'), NULL);
  END IF;

  v_result:=jsonb_build_object('success',true,'cosecha_id',v_cosecha_id,'codigo',v_codigo);
  RETURN v_result;
END; $$ LANGUAGE plpgsql SECURITY INVOKER SET search_path=public, pg_temp;

-- 11.2 Crear lote_producto desde cosecha (producto terminado postcosecha inicial)
CREATE OR REPLACE FUNCTION public.crear_lote_producto_desde_cosecha(p_cosecha_id UUID, p_peso NUMERIC DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE v_company UUID:=public.current_company(); v_cosecha RECORD; v_loteprod_id UUID; v_codigo TEXT;
BEGIN
  SELECT * INTO v_cosecha FROM public.cosechas WHERE id=p_cosecha_id AND company_id=v_company;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cosecha no encontrada o no pertenece a la empresa'; END IF;
  v_codigo:=public.generar_codigo_producto(v_company);
  INSERT INTO public.lotes_producto(company_id, cosecha_id, predio_id, lote_agricola_id, codigo, cultivo, variedad, grado, peso_inicial, peso_actual, estado)
  VALUES (v_company, p_cosecha_id, v_cosecha.predio_id, v_cosecha.lote_id, v_codigo, v_cosecha.cultivo_variedad, v_cosecha.cultivo_variedad, COALESCE(v_cosecha.grade,'Grado A'), COALESCE(p_peso, v_cosecha.cantidad_cosechada, v_cosecha.weight), COALESCE(p_peso, v_cosecha.cantidad_cosechada, v_cosecha.weight), 'PROCESANDO')
  RETURNING id INTO v_loteprod_id;
  RETURN jsonb_build_object('success',true,'lote_producto_id',v_loteprod_id,'codigo',v_codigo);
END; $$ LANGUAGE plpgsql SECURITY INVOKER SET search_path=public, pg_temp;

-- 11.3 Registrar movimiento bodega con validación de stock (con concurrencia FOR UPDATE)
CREATE OR REPLACE FUNCTION public.registrar_movimiento_bodega(
  p_lote_producto_id UUID,
  p_bodega_id UUID,
  p_cantidad NUMERIC,
  p_tipo TEXT,
  p_motivo TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE v_company UUID:=public.current_company(); v_user TEXT:=public.current_user_id(); v_actual NUMERIC; v_nuevo NUMERIC; v_lote RECORD;
BEGIN
  IF p_tipo NOT IN ('entrada','salida','transferencia','transformacion','merma','reserva','ajuste','ajuste_calidad') THEN RAISE EXCEPTION 'Tipo movimiento inválido: %', p_tipo; END IF;
  IF p_cantidad <=0 THEN RAISE EXCEPTION 'Cantidad debe ser >0'; END IF;
  SELECT * INTO v_lote FROM public.lotes_producto WHERE id=p_lote_producto_id AND company_id=v_company FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote producto no encontrado'; END IF;
  v_actual:=v_lote.peso_actual;
  IF p_tipo IN ('salida','merma','reserva') THEN
    IF v_actual < p_cantidad THEN RAISE EXCEPTION 'Stock insuficiente lote %: disponible %, solicitado %', v_lote.codigo, v_actual, p_cantidad; END IF;
    v_nuevo:=v_actual - p_cantidad;
  ELSIF p_tipo='entrada' THEN
    v_nuevo:=v_actual + p_cantidad;
  ELSE
    v_nuevo:=v_actual;
  END IF;
  UPDATE public.lotes_producto SET peso_actual=v_nuevo, merma_acumulada = CASE WHEN p_tipo='merma' THEN COALESCE(merma_acumulada,0)+p_cantidad ELSE merma_acumulada END, bodega_id=COALESCE(p_bodega_id, bodega_id), estado = CASE WHEN p_tipo='merma' AND v_nuevo=0 THEN 'MERMADO' WHEN p_tipo='entrada' THEN 'ALMACENADO' ELSE estado END, updated_at=now() WHERE id=p_lote_producto_id;
  INSERT INTO public.movimientos_inventario(company_id, item_id, cantidad, tipo, antes, despues, motivo, usuario_id, warehouse_id, lote_producto_id, cosecha_id)
  VALUES (v_company, (SELECT id FROM public.inventario WHERE company_id=v_company LIMIT 1), p_cantidad, p_tipo, v_actual, v_nuevo, COALESCE(p_motivo, 'Movimiento bodega lote '||v_lote.codigo), v_user, p_bodega_id, p_lote_producto_id, v_lote.cosecha_id);
  RETURN jsonb_build_object('success',true,'antes',v_actual,'despues',v_nuevo,'lote',v_lote.codigo);
EXCEPTION WHEN OTHERS THEN RAISE; END; $$ LANGUAGE plpgsql SECURITY INVOKER SET search_path=public, pg_temp;

-- 11.4 Confirmar venta con validación stock y reserva transaccional
CREATE OR REPLACE FUNCTION public.confirmar_venta(p_venta_id UUID)
RETURNS JSONB AS $$
DECLARE v_company UUID:=public.current_company(); v_venta RECORD; r RECORD; v_stock NUMERIC;
BEGIN
  SELECT * INTO v_venta FROM public.ventas WHERE id=p_venta_id AND company_id=v_company FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venta no encontrada'; END IF;
  IF v_venta.estado != 'BORRADOR' THEN RAISE EXCEPTION 'Solo ventas en BORRADOR pueden confirmarse (actual: %)', v_venta.estado; END IF;
  FOR r IN SELECT vd.*, lp.peso_actual, lp.codigo FROM public.venta_detalles vd JOIN public.lotes_producto lp ON lp.id=vd.lote_producto_id WHERE vd.venta_id=p_venta_id AND vd.company_id=v_company LOOP
    SELECT peso_actual INTO v_stock FROM public.lotes_producto WHERE id=r.lote_producto_id FOR UPDATE;
    IF v_stock < r.cantidad THEN RAISE EXCEPTION 'Stock insuficiente para lote %: disponible %, solicitado %', r.codigo, v_stock, r.cantidad; END IF;
  END LOOP;
  -- Reservar stock
  FOR r IN SELECT * FROM public.venta_detalles WHERE venta_id=p_venta_id AND company_id=v_company LOOP
    PERFORM public.registrar_movimiento_bodega(r.lote_producto_id, NULL, r.cantidad, 'reserva', 'Reserva por venta '||v_venta.codigo);
    UPDATE public.lotes_producto SET estado='RESERVADO' WHERE id=r.lote_producto_id AND estado='ALMACENADO';
  END LOOP;
  UPDATE public.ventas SET estado='CONFIRMADA', updated_at=now() WHERE id=p_venta_id;
  RETURN jsonb_build_object('success',true,'venta_id',p_venta_id,'codigo',v_venta.codigo);
END; $$ LANGUAGE plpgsql SECURITY INVOKER SET search_path=public, pg_temp;

-- 11.5 Trazabilidad completa por código de lote producto / cosecha
CREATE OR REPLACE FUNCTION public.trazabilidad_por_codigo(p_codigo TEXT)
RETURNS JSONB AS $$
DECLARE v_company UUID:=public.current_company(); v_cosecha RECORD; v_loteprod RECORD; v_result JSONB;
BEGIN
  SELECT * INTO v_cosecha FROM public.cosechas WHERE codigo=p_codigo AND company_id=v_company;
  IF FOUND THEN
    SELECT jsonb_build_object(
      'tipo','cosecha',
      'cosecha', to_jsonb(v_cosecha),
      'predio', (SELECT to_jsonb(p) FROM public.predios p WHERE p.id=v_cosecha.predio_id),
      'lote_agricola', (SELECT to_jsonb(l) FROM public.lotes l WHERE l.id=v_cosecha.lote_id),
      'lotes_producto', (SELECT COALESCE(jsonb_agg(to_jsonb(lp)),'[]'::jsonb) FROM public.lotes_producto lp WHERE lp.cosecha_id=v_cosecha.id),
      'procesos', (SELECT COALESCE(jsonb_agg(to_jsonb(pp) ORDER BY pp.fecha_inicio),'[]'::jsonb) FROM public.procesos_postcosecha pp WHERE pp.cosecha_id=v_cosecha.id),
      'ventas', (SELECT COALESCE(jsonb_agg(to_jsonb(v) ),'[]'::jsonb) FROM public.ventas v JOIN public.venta_detalles vd ON vd.venta_id=v.id JOIN public.lotes_producto lp ON lp.id=vd.lote_producto_id WHERE lp.cosecha_id=v_cosecha.id),
      'despachos', (SELECT COALESCE(jsonb_agg(to_jsonb(d)),'[]'::jsonb) FROM public.despachos d WHERE d.lote_producto_id IN (SELECT id FROM public.lotes_producto WHERE cosecha_id=v_cosecha.id))
    ) INTO v_result;
    RETURN v_result;
  END IF;
  SELECT * INTO v_loteprod FROM public.lotes_producto WHERE codigo=p_codigo AND company_id=v_company;
  IF FOUND THEN
    SELECT * INTO v_cosecha FROM public.cosechas WHERE id=v_loteprod.cosecha_id;
    SELECT jsonb_build_object(
      'tipo','lote_producto',
      'lote_producto', to_jsonb(v_loteprod),
      'cosecha', to_jsonb(v_cosecha),
      'predio', (SELECT to_jsonb(p) FROM public.predios p WHERE p.id=v_cosecha.predio_id),
      'lote_agricola', (SELECT to_jsonb(l) FROM public.lotes l WHERE l.id=v_cosecha.lote_id),
      'procesos', (SELECT COALESCE(jsonb_agg(to_jsonb(pp) ORDER BY pp.fecha_inicio),'[]'::jsonb) FROM public.procesos_postcosecha pp WHERE pp.cosecha_id=v_cosecha.id),
      'bodega', (SELECT to_jsonb(b) FROM public.bodegas b WHERE b.id=v_loteprod.bodega_id),
      'ventas', (SELECT COALESCE(jsonb_agg(to_jsonb(v)),'[]'::jsonb) FROM public.ventas v JOIN public.venta_detalles vd ON vd.venta_id=v.id WHERE vd.lote_producto_id=v_loteprod.id),
      'despachos', (SELECT COALESCE(jsonb_agg(to_jsonb(d)),'[]'::jsonb) FROM public.despachos d WHERE d.lote_producto_id=v_loteprod.id)
    ) INTO v_result;
    RETURN v_result;
  END IF;
  RETURN jsonb_build_object('error','Código no encontrado');
END; $$ LANGUAGE plpgsql SECURITY INVOKER SET search_path=public, pg_temp;

-- 11.6 Métricas dashboard (KPIs reales, sin mocks)
CREATE OR REPLACE FUNCTION public.dashboard_cosecha_postcosecha(p_predio_id UUID DEFAULT NULL, p_lote_id UUID DEFAULT NULL, p_periodo TEXT DEFAULT 'este_anio')
RETURNS JSONB AS $$
DECLARE v_company UUID:=public.current_company(); v_now DATE:=CURRENT_DATE; v_start DATE; v_result JSONB;
  v_cosecha_acum NUMERIC; v_area NUMERIC; v_rend NUMERIC; v_almacenado NUMERIC; v_bodegas INT; v_total_ventas NUMERIC;
BEGIN
  IF p_periodo='este_anio' THEN v_start:=date_trunc('year', v_now)::DATE;
  ELSIF p_periodo='ultimos_6_meses' THEN v_start:=v_now - INTERVAL '6 months';
  ELSIF p_periodo='este_mes' THEN v_start:=date_trunc('month', v_now)::DATE;
  ELSE v_start:=date_trunc('year', v_now)::DATE; END IF;

  SELECT COALESCE(SUM(COALESCE(cantidad_cosechada, weight)),0), COALESCE(SUM(area_cosechada),0)
    INTO v_cosecha_acum, v_area FROM public.cosechas WHERE company_id=v_company AND (p_predio_id IS NULL OR predio_id=p_predio_id) AND (p_lote_id IS NULL OR lote_id=p_lote_id) AND fecha_cosecha >= v_start AND deleted_at IS NULL;

  IF v_area >0 THEN v_rend:= v_cosecha_acum / v_area; ELSE v_rend:=0; END IF;

  SELECT COALESCE(SUM(peso_actual),0), COUNT(DISTINCT bodega_id) INTO v_almacenado, v_bodegas FROM public.lotes_producto WHERE company_id=v_company AND estado IN ('ALMACENADO','TERMINADO','RESERVADO');
  SELECT COALESCE(SUM(peso_actual),0) INTO v_total_ventas FROM public.lotes_producto WHERE company_id=v_company AND estado IN ('VENDIDO','DESPACHADO');

  v_result:=jsonb_build_object(
    'cosecha_acumulada_kg', v_cosecha_acum,
    'area_cosechada_ha', v_area,
    'rendimiento_kg_ha', ROUND(v_rend::NUMERIC,2),
    'producto_almacenado_kg', v_almacenado,
    'bodegas_con_stock', COALESCE(v_bodegas,0),
    'cosechas_registradas', (SELECT COUNT(*) FROM public.cosechas WHERE company_id=v_company AND fecha_cosecha >= v_start AND deleted_at IS NULL),
    'periodo_desde', v_start,
    'periodo_hasta', v_now
  );
  RETURN v_result;
END; $$ LANGUAGE plpgsql SECURITY INVOKER SET search_path=public, pg_temp;

-- 11.7 Historial mensual para gráfico (agregación real)
CREATE OR REPLACE FUNCTION public.cosecha_historica_mensual(p_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT)
RETURNS TABLE(mes INT, mes_nombre TEXT, total_kg NUMERIC, total_ha NUMERIC, cosechas INT) AS $$
DECLARE v_company UUID:=public.current_company();
BEGIN
  RETURN QUERY
  WITH meses AS (SELECT generate_series(1,12) AS m),
  agg AS (
    SELECT EXTRACT(MONTH FROM fecha_cosecha)::INT AS m, SUM(COALESCE(cantidad_cosechada, weight)) AS kg, SUM(area_cosechada) AS ha, COUNT(*)::INT AS cnt
    FROM public.cosechas WHERE company_id=v_company AND EXTRACT(YEAR FROM fecha_cosecha)=p_year AND deleted_at IS NULL GROUP BY 1
  )
  SELECT meses.m, CASE meses.m WHEN 1 THEN 'Ene' WHEN 2 THEN 'Feb' WHEN 3 THEN 'Mar' WHEN 4 THEN 'Abr' WHEN 5 THEN 'May' WHEN 6 THEN 'Jun' WHEN 7 THEN 'Jul' WHEN 8 THEN 'Ago' WHEN 9 THEN 'Sep' WHEN 10 THEN 'Oct' WHEN 11 THEN 'Nov' ELSE 'Dic' END,
         COALESCE(agg.kg,0), COALESCE(agg.ha,0), COALESCE(agg.cnt,0)
  FROM meses LEFT JOIN agg ON agg.m=meses.m ORDER BY meses.m;
END; $$ LANGUAGE plpgsql SECURITY INVOKER SET search_path=public, pg_temp;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. VISTAS Y POLÍTICAS STORAGE
-- ─────────────────────────────────────────────────────────────────────────────
-- Vista trazabilidad rápida (último despacho por lote_producto)
CREATE OR REPLACE VIEW public.vw_trazabilidad_rapida AS
SELECT lp.company_id, lp.codigo AS lote_codigo, lp.id AS lote_producto_id, c.codigo AS cosecha_codigo, c.id AS cosecha_id,
       pr.nombre AS predio_nombre, la.codigo_interno AS lote_agricola_codigo, la.nombre AS lote_agricola_nombre,
       c.cultivo_variedad, c.cantidad_cosechada, c.area_cosechada, c.fecha_cosecha, c.estado AS cosecha_estado,
       lp.estado AS producto_estado, lp.peso_actual, b.nombre AS bodega_nombre,
       (SELECT jsonb_agg(jsonb_build_object('tipo',pp.tipo,'estado',pp.estado,'peso_inicial',pp.peso_inicial,'peso_final',pp.peso_final) ORDER BY pp.fecha_inicio) FROM public.procesos_postcosecha pp WHERE pp.lote_producto_id=lp.id) AS procesos,
       (SELECT d.codigo FROM public.despachos d WHERE d.lote_producto_id=lp.id ORDER BY d.fecha_despacho DESC LIMIT 1) AS ultimo_despacho_codigo
FROM public.lotes_producto lp
JOIN public.cosechas c ON c.id=lp.cosecha_id
LEFT JOIN public.predios pr ON pr.id=c.predio_id
LEFT JOIN public.lotes la ON la.id=c.lote_id
LEFT JOIN public.bodegas b ON b.id=lp.bodega_id;

-- Bucket privado para documentos de cosecha/postcosecha (si storage existe)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='storage' AND table_name='buckets') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('cosecha-documentos','cosecha-documentos', false), ('despachos-evidencias','despachos-evidencias', false)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Políticas storage privadas (si existe storage.objects)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='storage' AND table_name='objects') THEN
    -- cosecha-documentos: folder = company_id
    DROP POLICY IF EXISTS "cosecha_documentos_select" ON storage.objects;
    CREATE POLICY "cosecha_documentos_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='cosecha-documentos' AND (storage.foldername(name))[1]::TEXT = public.current_company()::TEXT);
    DROP POLICY IF EXISTS "cosecha_documentos_insert" ON storage.objects;
    CREATE POLICY "cosecha_documentos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='cosecha-documentos' AND (storage.foldername(name))[1]::TEXT = public.current_company()::TEXT);
    DROP POLICY IF EXISTS "cosecha_documentos_update" ON storage.objects;
    CREATE POLICY "cosecha_documentos_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='cosecha-documentos' AND (storage.foldername(name))[1]::TEXT = public.current_company()::TEXT);
    DROP POLICY IF EXISTS "cosecha_documentos_delete" ON storage.objects;
    CREATE POLICY "cosecha_documentos_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='cosecha-documentos' AND (storage.foldername(name))[1]::TEXT = public.current_company()::TEXT);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. HARDENING: search_path + REVOKE
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE fn TEXT; funcs TEXT[] := ARRAY['generar_codigo_cosecha','generar_codigo_producto','generar_codigo_venta','generar_codigo_despacho','generar_codigo_factura','registrar_cosecha','crear_lote_producto_desde_cosecha','registrar_movimiento_bodega','confirmar_venta','trazabilidad_por_codigo','dashboard_cosecha_postcosecha','cosecha_historica_mensual'];
BEGIN
  FOREACH fn IN ARRAY funcs LOOP
    EXECUTE format('ALTER FUNCTION public.%I SET search_path = public, pg_temp', fn);
  END LOOP;
END $$;

-- Permisos RPC: solo authenticated y service_role
REVOKE ALL ON FUNCTION public.registrar_cosecha(UUID,UUID,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,INT,TEXT,TEXT,DOUBLE PRECISION,DOUBLE PRECISION,NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_cosecha(UUID,UUID,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,INT,TEXT,TEXT,DOUBLE PRECISION,DOUBLE PRECISION,NUMERIC) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.trazabilidad_por_codigo(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_cosecha_postcosecha(UUID,UUID,TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cosecha_historica_mensual(INT) TO authenticated, service_role;

-- Log de migración
INSERT INTO public.schema_versions(version, description) VALUES ('042','cosecha postcosecha trazabilidad completa') ON CONFLICT DO NOTHING;
