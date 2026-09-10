-- ==============================================================================
-- SKYCROP DATABASE V2: 006_permissions.sql
-- Descripción: Tabla de Permisos y Matriz de Roles
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.permisos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rol_id TEXT REFERENCES public.roles(id) ON DELETE CASCADE,
    recurso TEXT NOT NULL, -- e.g. 'lotes', 'maquinaria', 'inventario', '*'
    accion TEXT NOT NULL,  -- e.g. 'leer', 'crear', 'editar', 'eliminar', 'todo'
    UNIQUE (rol_id, recurso, accion)
);

-- Seed de Permisos Iniciales
INSERT INTO public.permisos (rol_id, recurso, accion) VALUES
-- Super Administrador
('super_admin', '*', 'todo'),

-- Gerente
('gerente', '*', 'todo'),

-- Administrador
('administrador', '*', 'todo'),

-- Ingeniero Agrónomo
('ingeniero', 'lotes', 'todo'),
('ingeniero', 'cultivos', 'todo'),
('ingeniero', 'aplicaciones', 'todo'),
('ingeniero', 'monitoreos', 'todo'),
('ingeniero', 'maquinaria', 'leer'),
('ingeniero', 'inventario', 'leer'),

-- Supervisor de Campo
('supervisor', 'maquinaria', 'todo'),
('supervisor', 'laboral', 'todo'),
('supervisor', 'inventario', 'leer'),
('supervisor', 'lotes', 'leer'),

-- Operario
('operario', 'laboral', 'leer'),
('operario', 'laboral', 'crear'),
('operario', 'maquinaria', 'leer'),

-- Auditor Externo
('auditor', '*', 'leer'),

-- Invitado
('invitado', 'lotes', 'leer'),
('invitado', 'cultivos', 'leer'),

-- Consulta
('consulta', '*', 'leer')
ON CONFLICT (rol_id, recurso, accion) DO NOTHING;
