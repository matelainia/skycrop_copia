-- ====================================================================
-- SKYCROP: MIGRATION & SEED SQL - MODULE INVENTARIO Y BODEGAS
-- Executing this script sets up the inventory movements logging table,
-- creates the database-side RPC transaction block for atomic stock
-- changes, and seeds the tables with default initial data.
-- Run this inside Supabase SQL Editor.
-- ====================================================================

-- 1. Create movimientos_inventario table if not exists
CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    item_id UUID REFERENCES inventario(id) ON DELETE CASCADE,
    cantidad NUMERIC NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- 'entrada', 'salida'
    antes NUMERIC NOT NULL,
    despues NUMERIC NOT NULL,
    motivo TEXT,
    usuario_id UUID, -- For future authentication mapping
    warehouse_id UUID REFERENCES bodegas(id) ON DELETE SET NULL
);

-- 2. Create the registrar_movimiento_inventario stored procedure for transactional stock edits
CREATE OR REPLACE FUNCTION registrar_movimiento_inventario(
  p_item_id UUID,
  p_cantidad NUMERIC,
  p_tipo VARCHAR,
  p_motivo TEXT,
  p_warehouse_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_antes NUMERIC;
  v_despues NUMERIC;
  v_result JSONB;
BEGIN
  -- Retrieve current stock quantity
  SELECT quantity INTO v_antes FROM inventario WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Artículo con ID % no encontrado en el inventario.', p_item_id;
  END IF;

  -- Calculate target stock level
  IF p_tipo = 'entrada' THEN
    v_despues := v_antes + p_cantidad;
  ELSIF p_tipo = 'salida' THEN
    v_despues := GREATEST(0, v_antes - p_cantidad);
  ELSE
    RAISE EXCEPTION 'Tipo de movimiento % no es válido. Debe ser "entrada" o "salida".', p_tipo;
  END IF;

  -- Update inventario table atomically
  UPDATE inventario 
  SET quantity = v_despues 
  WHERE id = p_item_id;

  -- Log auditing movement
  INSERT INTO movimientos_inventario (
    item_id, 
    cantidad, 
    tipo, 
    antes, 
    despues, 
    motivo, 
    warehouse_id
  ) VALUES (
    p_item_id, 
    p_cantidad, 
    p_tipo, 
    v_antes, 
    v_despues, 
    p_motivo, 
    p_warehouse_id
  );

  v_result := jsonb_build_object(
    'success', true,
    'antes', v_antes,
    'despues', v_despues,
    'cantidad', p_cantidad,
    'tipo', p_tipo
  );
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 3. Default Seed Data (Warehouses and Items)
-- Insert default warehouses if they do not exist
INSERT INTO bodegas (nombre, sector, coordenada_x, coordenada_y, categoria)
SELECT 'Bodega Central', 'Sector A (Semillas y Abonos)', 3.4516, -76.5320, 'Fertilizantes'
WHERE NOT EXISTS (SELECT 1 FROM bodegas WHERE nombre = 'Bodega Central');

INSERT INTO bodegas (nombre, sector, coordenada_x, coordenada_y, categoria)
SELECT 'Bodega Norte', 'Sector B (Herramientas)', 3.4600, -76.5400, 'Herramientas'
WHERE NOT EXISTS (SELECT 1 FROM bodegas WHERE nombre = 'Bodega Norte');

INSERT INTO bodegas (nombre, sector, coordenada_x, coordenada_y, categoria)
SELECT 'Bodega Sur', 'Sector C (Químicos y Plaguicidas)', 3.4400, -76.5200, 'Agroquímicos'
WHERE NOT EXISTS (SELECT 1 FROM bodegas WHERE nombre = 'Bodega Sur');

-- Seed items using a DO block to fetch actual dynamic warehouse IDs
DO $$
DECLARE
  v_central_id UUID;
  v_norte_id UUID;
  v_sur_id UUID;
BEGIN
  -- Retrieve active warehouse IDs
  SELECT id INTO v_central_id FROM bodegas WHERE nombre = 'Bodega Central' LIMIT 1;
  SELECT id INTO v_norte_id FROM bodegas WHERE nombre = 'Bodega Norte' LIMIT 1;
  SELECT id INTO v_sur_id FROM bodegas WHERE nombre = 'Bodega Sur' LIMIT 1;

  -- Seed default items if inventario is empty
  IF NOT EXISTS (SELECT 1 FROM inventario LIMIT 1) THEN
    INSERT INTO inventario (name, category, quantity, unit, min_quantity, warehouse_id, lote, registro_ica, comentarios) VALUES
    ('Urea Fertilizing Granules', 'Fertilizantes', 150, 'Sacos', 100, v_central_id, 'L-774', 'ICA-0012', 'Fertilizante de alta calidad.'),
    ('Glyphosate Herbicide', 'Herbicidas', 15, 'Latas', 25, v_norte_id, 'L-893', 'ICA-3921', 'Control de maleza.'),
    ('Maize P1 Seed', 'Semillas', 30, 'Sacos', 20, v_central_id, 'L-211', 'ICA-1945', 'Semilla híbrida certificada.'),
    ('Tractor Oil 10W40', 'Mantenimiento', 5, 'Gals', 10, v_norte_id, 'L-104', 'ICA-9941', 'Lubricante para motores diesel.'),
    ('Pesticide Delta', 'Pesticidas', 10, 'Latas', 15, v_sur_id, 'L-673', 'ICA-4819', 'Insecticida potente.'),
    ('Safety Gloves', 'Seguridad', 50, 'Pairs', 30, v_sur_id, 'L-029', 'ICA-N/A', 'Protección para fumigadores.'),
    ('Spade and Fork Set', 'Herramientas', 8, 'Units', 5, v_norte_id, 'L-001', 'ICA-N/A', 'Herramientas de mano de acero.'),
    ('Tomato Seeds F1', 'Semillas', 45, 'unidades', 15, v_central_id, 'L-412', 'ICA-9391', 'Semilla certificada'),
    ('Pruning Shears', 'Herramientas', 12, 'unidades', 5, v_norte_id, 'L-121', 'ICA-N/A', 'Tijeras de podar de acero'),
    ('Nylon Rope Roll', 'Herramientas', 15, 'unidades', 10, v_norte_id, 'L-089', 'ICA-N/A', 'Cuerda de alta resistencia'),
    ('Sprayer Nozzles', 'Herramientas', 25, 'unidades', 20, v_norte_id, 'L-002', 'ICA-N/A', 'Boquillas de repuesto para fumigadora'),
    ('Irrigation Drip Tape', 'Herramientas', 30, 'unidades', 15, v_norte_id, 'L-193', 'ICA-N/A', 'Cinta de riego por goteo'),
    ('Work Boots Leather', 'Seguridad', 15, 'unidades', 10, v_sur_id, 'L-102', 'ICA-N/A', 'Botas de seguridad con puntera de acero'),
    ('Safety Helmet Yellow', 'Seguridad', 20, 'unidades', 15, v_sur_id, 'L-104', 'ICA-N/A', 'Casco de protección para operarios'),
    ('PH Meter Digital', 'Herramientas', 5, 'unidades', 3, v_norte_id, 'L-301', 'ICA-0023', 'Medidor de pH digital para suelo'),
    ('Grass Killer Concentrated', 'Herbicidas', 12, 'L', 10, v_sur_id, 'L-390', 'ICA-4091', 'Herbicida concentrado maleza difícil');
  END IF;
END $$;
