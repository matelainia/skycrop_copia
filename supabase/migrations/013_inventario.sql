-- ==============================================================================
-- SKYCROP DATABASE V2: 013_inventario.sql
-- Descripción: Módulo Inventario (Productos en Stock, Kardex/Movimientos)
-- ==============================================================================

-- 1. Tabla de Inventario de Agroinsumos y Equipos en Bodega
CREATE TABLE IF NOT EXISTS public.inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Fungicida', 'Insecticida', 'Herbicida', 'Fertilizante', 'Semilla', 'Herramienta', 'EPP')),
    quantity DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (quantity >= 0),
    unit TEXT NOT NULL,
    min_quantity DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (min_quantity >= 0),
    warehouse_id UUID REFERENCES public.bodegas(id) ON DELETE SET NULL,
    lote CHARACTER VARYING, -- Lote de fabricación del producto
    registro_ica CHARACTER VARYING,
    comentarios TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    deleted_by TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Movimientos de Inventario (Kardex de Auditoría)
CREATE TABLE IF NOT EXISTS public.movimientos_inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.inventario(id) ON DELETE CASCADE,
    cantidad NUMERIC NOT NULL CHECK (cantidad > 0),
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
    antes NUMERIC NOT NULL CHECK (antes >= 0),
    despues NUMERIC NOT NULL CHECK (despues >= 0),
    motivo TEXT,
    usuario_id TEXT, -- ID del usuario que ejecuta la acción (Clerk User ID)
    warehouse_id UUID REFERENCES public.bodegas(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
