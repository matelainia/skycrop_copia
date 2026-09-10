-- ==============================================================================
-- SKYCROP DATABASE V2: 019_auditoria.sql
-- Descripción: Módulo Auditoría, Trazabilidad e Historial de Seguridad
-- ==============================================================================

-- 1. Registro General de Auditoría de Base de Datos (Audit Logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    usuario_id TEXT NOT NULL,
    usuario_email TEXT NOT NULL,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    accion TEXT NOT NULL CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT')),
    modulo TEXT NOT NULL, -- Nombre de la tabla modificada
    ip TEXT,
    antes JSONB, -- Estado previo de la fila
    despues JSONB -- Estado posterior de la fila
);

-- 2. Historial de Cambios de Estados en Aplicaciones Sanitarias
CREATE TABLE IF NOT EXISTS public.auditoria_aplicaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    aplicacion_id UUID NOT NULL, -- Se vincula formalmente en ejecuciones.sql
    codigo_apl TEXT,
    lote_id UUID REFERENCES public.lotes(id) ON DELETE SET NULL,
    producto_comercial TEXT,
    estado_anterior TEXT NOT NULL,
    estado_nuevo TEXT NOT NULL,
    usuario TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    notas TEXT,
    origen TEXT
);

-- 3. Bitácora de Cambios de Diagnósticos y Monitoreos de Campo
CREATE TABLE IF NOT EXISTS public.auditoria_sanitaria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    tabla_afectada VARCHAR(100) NOT NULL,
    registro_id UUID NOT NULL,
    campo_modificado VARCHAR(100),
    valor_anterior TEXT,
    valor_nuevo TEXT,
    usuario_modificador VARCHAR(150) NOT NULL,
    fecha_modificacion TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Registro de Confirmaciones Especiales para Productos Altamente Tóxicos (Clase IA/IB)
CREATE TABLE IF NOT EXISTS public.auditoria_prescripcion_alta_toxicidad (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    usuario_id TEXT NOT NULL, -- Clerk User ID
    aplicacion_id TEXT NOT NULL,
    ingredientes_detectados JSONB NOT NULL,
    categorias_toxicologicas TEXT[] NOT NULL,
    advertencia_confirmada BOOLEAN NOT NULL CHECK (advertencia_confirmada = true),
    declaracion_profesional BOOLEAN NOT NULL CHECK (declaracion_profesional = true),
    ip_cliente TEXT,
    geolocalizacion JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabla de Registro de Eventos e Intentos de Violaciones de RLS (Acceso Indebido)
CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id TEXT NOT NULL DEFAULT 'anonimo',
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    ip TEXT,
    accion TEXT NOT NULL CHECK (accion IN ('FORGERY_ATTEMPT', 'UNAUTHORIZED_ACCESS')),
    tabla TEXT NOT NULL,
    registro_id UUID,
    resultado TEXT NOT NULL CHECK (resultado IN ('BLOCKED', 'FLAGGED')),
    fecha TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
