-- 1. Crear empresa por defecto para datos existentes
INSERT INTO empresas (id, nombre) 
VALUES ('00000000-0000-0000-0000-000000000000', 'Empresa Semilla / Demo')
ON CONFLICT (id) DO NOTHING;

-- Listado de tablas operativas existentes a modificar
-- lotes, maquinaria, inventario, trabajadores, cosechas, costos, monitoreos, aplicaciones, bodegas, labores, jornadas_maquinaria, nominas, cursos_formacion, registros_formacion, cuadrillas

-- 2. Alterar tablas para agregar empresa_id con valor por defecto
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE maquinaria ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE cosechas ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES empresas(id) ON DELETE SET NULL;
-- ALTER TABLE costos ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE monitoreos ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE bodegas ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE labores ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE jornadas_maquinaria ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE nominas ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE cursos_formacion ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE registros_formacion ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE cuadrillas ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES empresas(id) ON DELETE SET NULL;

-- 3. Habilitar Row Level Security (RLS) en todas las tablas operativas
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE maquinaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE trabajadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE cosechas ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE costos ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoreos ENABLE ROW LEVEL SECURITY;
ALTER TABLE aplicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE bodegas ENABLE ROW LEVEL SECURITY;
ALTER TABLE labores ENABLE ROW LEVEL SECURITY;
ALTER TABLE jornadas_maquinaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE nominas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos_formacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_formacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuadrillas ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas RLS basadas en empresa_id del JWT de Supabase (firmado por nuestro backend)
CREATE POLICY lotes_isolation_policy ON lotes FOR ALL TO authenticated
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY maquinaria_isolation_policy ON maquinaria FOR ALL TO authenticated
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY inventario_isolation_policy ON inventario FOR ALL TO authenticated
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY trabajadores_isolation_policy ON trabajadores FOR ALL TO authenticated
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY cosechas_isolation_policy ON cosechas FOR ALL TO authenticated
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- CREATE POLICY costos_isolation_policy ON costos FOR ALL TO authenticated
--   USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
--   WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY monitoreos_isolation_policy ON monitoreos FOR ALL TO authenticated
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY aplicaciones_isolation_policy ON aplicaciones FOR ALL TO authenticated
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY bodegas_isolation_policy ON bodegas FOR ALL TO authenticated
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY labores_isolation_policy ON labores FOR ALL TO authenticated
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY jornadas_maquinaria_isolation_policy ON jornadas_maquinaria FOR ALL TO authenticated
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY nominas_isolation_policy ON nominas FOR ALL TO authenticated
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY cursos_formacion_isolation_policy ON cursos_formacion FOR ALL TO authenticated
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY registros_formacion_isolation_policy ON registros_formacion FOR ALL TO authenticated
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY cuadrillas_isolation_policy ON cuadrillas FOR ALL TO authenticated
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);
