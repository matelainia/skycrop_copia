-- ==============================================================================
-- SKYCROP DATABASE V2: 005_roles.sql
-- Descripción: Tabla de Roles y Definición Inicial
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY, -- Identificador único en minúsculas (e.g. 'administrador')
    nombre TEXT NOT NULL,
    descripcion TEXT
);

-- Seed de Roles Estructurales
INSERT INTO public.roles (id, nombre, descripcion) VALUES
('super_admin', 'Super Administrador', 'Acceso global para mantenimiento del sistema'),
('gerente', 'Gerente', 'Acceso total y reportes corporativos a nivel de empresa'),
('administrador', 'Administrador', 'Control administrativo completo del inquilino'),
('ingeniero', 'Ingeniero Agrónomo', 'Gestión de lotes, cultivos, aplicaciones y monitoreos'),
('supervisor', 'Supervisor de Campo', 'Supervisión de labores de campo y maquinaria'),
('operario', 'Operario', 'Registro básico de labores asignadas y horómetros'),
('auditor', 'Auditor Externo', 'Acceso de solo lectura para auditorías y certificaciones'),
('invitado', 'Invitado', 'Lectura limitada para terceros'),
('consulta', 'Consulta', 'Acceso de solo lectura general')
ON CONFLICT (id) DO UPDATE SET 
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion;
