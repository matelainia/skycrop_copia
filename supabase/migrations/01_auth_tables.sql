-- 1. Empresas
CREATE TABLE IF NOT EXISTS empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Roles
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY, -- 'gerente', 'administrador', 'ingeniero', 'supervisor', 'operario', 'auditor', 'invitado'
  nombre TEXT NOT NULL,
  descripcion TEXT
);

-- Seed de roles
INSERT INTO roles (id, nombre, descripcion) VALUES
('gerente', 'Gerente', 'Acceso total y reportes corporativos'),
('administrador', 'Administrador', 'Control administrativo del sistema'),
('ingeniero', 'Ingeniero Agrónomo', 'Gestión de lotes, cultivos y aplicaciones'),
('supervisor', 'Supervisor de Campo', 'Supervisión de labores y maquinaria'),
('operario', 'Operario', 'Registro básico de labores asignadas'),
('auditor', 'Auditor Externo', 'Acceso de solo lectura para auditorías'),
('invitado', 'Invitado', 'Lectura limitada')
ON CONFLICT (id) DO UPDATE SET 
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion;

-- 3. Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY, -- Clerk User ID (e.g. 'user_...')
  email TEXT UNIQUE NOT NULL,
  nombre TEXT,
  apellido TEXT,
  empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  rol_id TEXT REFERENCES roles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Permisos
CREATE TABLE IF NOT EXISTS permisos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rol_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
  recurso TEXT NOT NULL, -- 'lotes', 'maquinaria', 'inventario', 'cosechas', 'laboral'
  accion TEXT NOT NULL,  -- 'leer', 'crear', 'editar', 'eliminar', 'todo'
  UNIQUE (rol_id, recurso, accion)
);

-- Seed de permisos para los roles
INSERT INTO permisos (rol_id, recurso, accion) VALUES
-- Gerente tiene acceso a todo
('gerente', '*', 'todo'),
-- Administrador tiene acceso a todo menos reportes corporativos (supuesto)
('administrador', '*', 'todo'),
-- Ingeniero Agrónomo gestiona cultivos, lotes y aplicaciones
('ingeniero', 'lotes', 'todo'),
('ingeniero', 'cultivos', 'todo'),
('ingeniero', 'aplicaciones', 'todo'),
('ingeniero', 'monitoreos', 'todo'),
('ingeniero', 'maquinaria', 'leer'),
('ingeniero', 'inventario', 'leer'),
-- Supervisor controla labores y maquinaria
('supervisor', 'maquinaria', 'todo'),
('supervisor', 'laboral', 'todo'),
('supervisor', 'inventario', 'leer'),
('supervisor', 'lotes', 'leer'),
-- Operario lee labores y registra avances
('operario', 'laboral', 'leer'),
('operario', 'laboral', 'crear'), -- Registrar labores
('operario', 'maquinaria', 'leer'),
-- Auditor lee todo
('auditor', '*', 'leer'),
-- Invitado lee limitado
('invitado', 'lotes', 'leer'),
('invitado', 'cultivos', 'leer')
ON CONFLICT (rol_id, recurso, accion) DO NOTHING;

-- 5. Tabla de Auditoría (Audit Logs)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id TEXT NOT NULL, -- ID del usuario que realiza la acción (Clerk ID)
  usuario_email TEXT NOT NULL,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  fecha TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  accion TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'LOGIN', etc.
  modulo TEXT NOT NULL, -- 'maquinaria', 'lotes', 'inventario', etc.
  ip TEXT,
  antes JSONB, -- Registro antes de la modificación
  despues JSONB -- Registro después de la modificación
);
