-- 1. ELIMINAR DE ANTEMANO TODAS LAS POLÍTICAS Y CONSTRAINTS DE LAS TABLAS OPERATIVAS
-- Esto evita errores de dependencias al alterar los tipos de columnas más adelante.
DO $$
DECLARE
  t_name TEXT;
  tables TEXT[] := ARRAY[
    'lotes', 'maquinaria', 'inventario', 'trabajadores', 'cosechas', 
    'monitoreos', 'aplicaciones', 'bodegas', 'labores', 
    'jornadas_maquinaria', 'nominas', 'cursos_formacion', 
    'registros_formacion', 'cuadrillas', 'almacenamientos'
  ];
BEGIN
  FOREACH t_name IN ARRAY tables LOOP
    -- Drop old policies
    EXECUTE format('DROP POLICY IF EXISTS %I_isolation_policy ON %I', t_name, t_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_policy ON %I', t_name, t_name);
    
    -- Drop constraints de llaves foráneas antiguas
    EXECUTE format('ALTER TABLE IF EXISTS %I DROP CONSTRAINT IF EXISTS %I_empresa_id_fkey', t_name, t_name);
    EXECUTE format('ALTER TABLE IF EXISTS %I DROP CONSTRAINT IF EXISTS %I_company_id_fkey', t_name, t_name);
  END LOOP;
END $$;

-- 2. ENUM DE ROLES DE EMPRESA
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_role') THEN
    CREATE TYPE company_role AS ENUM ('Owner', 'Administrator', 'Supervisor', 'Operario');
  END IF;
END $$;

-- 3. CREAR NUEVAS TABLAS DE TENANTS (Usando Clerk Org ID como PK)
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY, -- Clerk Organization ID (e.g. 'org_3GSw...') o ID semilla de desarrollo
  nombre TEXT NOT NULL,
  slug TEXT,
  nit TEXT,
  telefono TEXT,
  correo TEXT,
  direccion TEXT,
  logo TEXT,
  estado TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migrar las empresas existentes desde la tabla 'empresas' a la tabla 'companies'
-- convirtiendo su UUID a TEXT
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'empresas') THEN
    INSERT INTO companies (id, nombre, created_at, updated_at, estado)
    SELECT id::text, nombre, created_at, created_at, 'active'
    FROM empresas
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Insertar la empresa semilla por si acaso no estuviera registrada
INSERT INTO companies (id, nombre, slug, estado)
VALUES ('00000000-0000-0000-0000-000000000000', 'Empresa Semilla / Demo', 'demo', 'active')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  role company_role NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (company_id, clerk_user_id)
);

-- Migrar los usuarios y roles existentes de 'usuarios' a la nueva tabla 'company_users'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usuarios') AND 
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_users') THEN
    INSERT INTO company_users (company_id, clerk_user_id, role, status, created_at)
    SELECT 
      empresa_id::text, 
      id, 
      CASE 
        WHEN rol_id = 'gerente' THEN 'Owner'::company_role
        WHEN rol_id = 'administrador' THEN 'Administrator'::company_role
        WHEN rol_id = 'supervisor' THEN 'Supervisor'::company_role
        ELSE 'Operario'::company_role
      END,
      'active',
      created_at
    FROM usuarios
    WHERE empresa_id IS NOT NULL
    ON CONFLICT (company_id, clerk_user_id) DO NOTHING;
  END IF;
END $$;

-- 4. RENOMBRAR COLUMNAS empresa_id A company_id Y ALTERAR SU TIPO A TEXT
DO $$
DECLARE
  t_name TEXT;
  tables TEXT[] := ARRAY[
    'lotes', 'maquinaria', 'inventario', 'trabajadores', 'cosechas', 
    'monitoreos', 'aplicaciones', 'bodegas', 'labores', 
    'jornadas_maquinaria', 'nominas', 'cursos_formacion', 
    'registros_formacion', 'cuadrillas', 'almacenamientos'
  ];
BEGIN
  FOREACH t_name IN ARRAY tables LOOP
    -- Manejar renombrado y conversión de tipo de la columna
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = t_name AND column_name = 'empresa_id'
    ) THEN
      -- Renombrar columna
      EXECUTE format('ALTER TABLE %I RENAME COLUMN empresa_id TO company_id', t_name);
      -- Cambiar tipo a TEXT (Clerk org_id)
      EXECUTE format('ALTER TABLE %I ALTER COLUMN company_id TYPE TEXT', t_name);
    ELSE
      -- Crear la columna si no existe
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS company_id TEXT', t_name);
      EXECUTE format('ALTER TABLE %I ALTER COLUMN company_id TYPE TEXT', t_name);
    END IF;

    -- Agregar foreign key apuntando a la tabla de companies
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE', t_name, t_name);
  END LOOP;
END $$;

-- 5. AGREGAR ÍNDICES DE RENDIMIENTO (Simples y Compuestos)
DO $$
DECLARE
  t_name TEXT;
  tables TEXT[] := ARRAY[
    'lotes', 'maquinaria', 'inventario', 'trabajadores', 'cosechas', 
    'monitoreos', 'aplicaciones', 'bodegas', 'labores', 
    'jornadas_maquinaria', 'nominas', 'cursos_formacion', 
    'registros_formacion', 'cuadrillas', 'almacenamientos'
  ];
BEGIN
  FOREACH t_name IN ARRAY tables LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_company_id ON %I (company_id)', t_name, t_name);
  END LOOP;
END $$;

-- Índices compuestos para consultas optimizadas frecuentes
CREATE INDEX IF NOT EXISTS idx_trabajadores_compuesto ON trabajadores (company_id, estado);
CREATE INDEX IF NOT EXISTS idx_labores_compuesto_fecha ON labores (company_id, fecha);
CREATE INDEX IF NOT EXISTS idx_labores_compuesto_estado ON labores (company_id, estado);
CREATE INDEX IF NOT EXISTS idx_nominas_compuesto ON nominas (company_id, trabajador_id);
CREATE INDEX IF NOT EXISTS idx_cosechas_compuesto ON cosechas (company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_jornadas_compuesto ON jornadas_maquinaria (company_id, start_time);
CREATE INDEX IF NOT EXISTS idx_registros_formacion_compuesto ON registros_formacion (company_id, trabajador_id);

-- 6. VOLVER A ACTIVAR Y CREAR RLS POLICIES BASADAS EN EL JWT org_id DE CLERK
DO $$
DECLARE
  t_name TEXT;
  tables TEXT[] := ARRAY[
    'lotes', 'maquinaria', 'inventario', 'trabajadores', 'cosechas', 
    'monitoreos', 'aplicaciones', 'bodegas', 'labores', 
    'jornadas_maquinaria', 'nominas', 'cursos_formacion', 
    'registros_formacion', 'cuadrillas', 'almacenamientos'
  ];
BEGIN
  FOREACH t_name IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t_name);
    
    -- La política valida la claim 'org_id' inyectada en el JWT por el backend proxy
    EXECUTE format(
      'CREATE POLICY %I_tenant_policy ON %I FOR ALL TO authenticated ' ||
      'USING (company_id = auth.jwt() ->> ''org_id'') ' ||
      'WITH CHECK (company_id = auth.jwt() ->> ''org_id'')',
      t_name, t_name
    );
  END LOOP;
END $$;

-- 7. ACTUALIZAR TABLA DE AUDITORÍA Y TRIGGER
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_empresa_id_fkey;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_company_id_fkey;

-- Cambiar tipo de empresa_id a TEXT en audit_logs si existe, o renombrar
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'empresa_id'
  ) THEN
    ALTER TABLE audit_logs RENAME COLUMN empresa_id TO company_id;
    ALTER TABLE audit_logs ALTER COLUMN company_id TYPE TEXT;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN company_id TEXT;
  END IF;
END $$;

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs (company_id, fecha);

CREATE OR REPLACE FUNCTION process_audit_log() RETURNS TRIGGER AS $$
DECLARE
  v_user_id TEXT;
  v_user_email TEXT;
  v_company_id TEXT;
  v_antes JSONB := NULL;
  v_despues JSONB := NULL;
BEGIN
  BEGIN
    v_user_id := COALESCE(auth.jwt() ->> 'sub', 'sistema_api');
    v_user_email := COALESCE(auth.jwt() ->> 'email', 'sistema_api');
    v_company_id := auth.jwt() ->> 'org_id';
  EXCEPTION WHEN OTHERS THEN
    v_user_id := 'sistema_api';
    v_user_email := 'sistema_api';
    v_company_id := NULL;
  END;

  IF (TG_OP = 'DELETE') THEN
    v_antes := to_jsonb(OLD);
    IF v_company_id IS NULL AND (OLD.company_id IS NOT NULL) THEN
      v_company_id := OLD.company_id;
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_antes := to_jsonb(OLD);
    v_despues := to_jsonb(NEW);
    IF v_company_id IS NULL AND (NEW.company_id IS NOT NULL) THEN
      v_company_id := NEW.company_id;
    END IF;
  ELSIF (TG_OP = 'INSERT') THEN
    v_despues := to_jsonb(NEW);
    IF v_company_id IS NULL AND (NEW.company_id IS NOT NULL) THEN
      v_company_id := NEW.company_id;
    END IF;
  END IF;

  INSERT INTO audit_logs (
    usuario_id, 
    usuario_email, 
    company_id, 
    accion, 
    modulo, 
    antes, 
    despues
  ) VALUES (
    v_user_id, 
    v_user_email, 
    v_company_id, 
    TG_OP, 
    TG_TABLE_NAME, 
    v_antes, 
    v_despues
  );

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
