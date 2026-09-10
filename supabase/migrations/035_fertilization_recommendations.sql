-- ==============================================================================
-- SKYCROP DATABASE MIGRATION: 035_fertilization_recommendations.sql
-- Descripción: Módulo de Recomendaciones de Fertilización (Estructura Limpia en Blanco)
-- Producción: Sin datos de prueba o demostración.
-- Fixes: 
--   - responsible_id corregido a TEXT para coincidir con public.profiles(id)
--   - producto_id corregido a BIGINT para coincidir con public.productos(id)
-- ==============================================================================

-- 1. TIPOS ENUM DE WORKFLOW Y ORIGEN
DO $$ BEGIN
  CREATE TYPE public.fert_rec_status AS ENUM (
    'borrador', 'pendiente', 'revision', 'aprobada', 'programada', 
    'aplicada', 'finalizada', 'archivada', 'rechazada', 'cancelada', 'vencida'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fert_rec_origin AS ENUM (
    'manual', 'plan', 'ia', 'analisis_suelo', 'analisis_foliar', 'monitoreo', 'importacion', 'api'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fert_type AS ENUM (
    'edafica', 'foliar', 'fertirriego', 'organica', 'quimica', 'biologica'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fert_priority AS ENUM (
    'baja', 'media', 'alta', 'urgente'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. TABLA PRINCIPAL: fertilizacion_recomendaciones
CREATE TABLE IF NOT EXISTS public.fertilizacion_recomendaciones (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    predio_id               UUID REFERENCES public.predios(id) ON DELETE SET NULL,
    lote_id                 UUID REFERENCES public.lotes(id) ON DELETE SET NULL,
    
    code                    VARCHAR(50) NOT NULL UNIQUE,
    farm_name               VARCHAR(200),
    lot_name                VARCHAR(200),
    sector_name             VARCHAR(200),
    crop_name               VARCHAR(200) NOT NULL,
    variety                 VARCHAR(200),
    phenological_stage      VARCHAR(100),
    
    origin                  public.fert_rec_origin NOT NULL DEFAULT 'manual',
    fertilization_type      public.fert_type NOT NULL DEFAULT 'edafica',
    status                  public.fert_rec_status NOT NULL DEFAULT 'borrador',
    priority                public.fert_priority NOT NULL DEFAULT 'media',
    
    version                 VARCHAR(20) NOT NULL DEFAULT 'v1',
    is_latest               BOOLEAN NOT NULL DEFAULT true,
    parent_id               UUID REFERENCES public.fertilizacion_recomendaciones(id) ON DELETE SET NULL,
    
    recommended_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    deadline_date           DATE,
    
    responsible_id          TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
    responsible_name        VARCHAR(200),
    
    ai_confidence_score     NUMERIC(5,2) DEFAULT 0.00,
    ai_proposal_json        JSONB,
    
    estimated_cost          NUMERIC(14,2) DEFAULT 0.00,
    executed_cost           NUMERIC(14,2) DEFAULT 0.00,
    kg_programmed           NUMERIC(10,2) DEFAULT 0.00,
    kg_applied              NUMERIC(10,2) DEFAULT 0.00,
    
    has_conflicts           BOOLEAN DEFAULT false,
    low_inventory_alert     BOOLEAN DEFAULT false,
    nutritional_status      VARCHAR(100) DEFAULT 'optimo',
    
    technical_justification TEXT,
    observations            TEXT,
    
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLA DETALLE DE PRODUCTOS
CREATE TABLE IF NOT EXISTS public.fertilizacion_recomendacion_detalle (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recomendacion_id        UUID NOT NULL REFERENCES public.fertilizacion_recomendaciones(id) ON DELETE CASCADE,
    producto_id             BIGINT REFERENCES public.productos(id) ON DELETE SET NULL,
    product_name            VARCHAR(250) NOT NULL,
    active_ingredient       VARCHAR(250),
    concentration           VARCHAR(100),
    dose                    NUMERIC(10,2) NOT NULL,
    unit                    VARCHAR(50) NOT NULL DEFAULT 'kg/ha',
    application_method      VARCHAR(100),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. INDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_fert_rec_company ON public.fertilizacion_recomendaciones(company_id);
CREATE INDEX IF NOT EXISTS idx_fert_rec_status ON public.fertilizacion_recomendaciones(status);
CREATE INDEX IF NOT EXISTS idx_fert_rec_code ON public.fertilizacion_recomendaciones(code);

-- 5. VISTA DE KPIS AGREGADOS DE RECOMENDACIONES
CREATE OR REPLACE VIEW public.vw_fertilizacion_recomendaciones_kpis AS
SELECT
    company_id,
    COUNT(*) AS total_recomendaciones,
    COUNT(*) FILTER (WHERE status = 'pendiente') AS pendientes_aprobacion,
    COUNT(*) FILTER (WHERE status = 'aprobada') AS aprobadas,
    COUNT(*) FILTER (WHERE status = 'aplicada') AS aplicadas
FROM public.fertilizacion_recomendaciones
GROUP BY company_id;
