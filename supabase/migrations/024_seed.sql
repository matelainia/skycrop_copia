-- ==============================================================================
-- SKYCROP DATABASE V2: 024_seed.sql
-- Descripción: Script de Semilla (Seed) para Entorno de Desarrollo
-- ==============================================================================

-- 1. Insertar Empresa Semilla / Demo
INSERT INTO public.companies (id, clerk_org_id, nombre, slug, estado)
VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'Empresa Semilla / Demo', 'demo', 'active')
ON CONFLICT (id) DO NOTHING;

-- 2. Insertar Perfiles Semilla
INSERT INTO public.profiles (id, email, nombre, apellido) VALUES
('user_clerk_test_a', 'user_a@test.com', 'Operario', 'Semilla'),
('admin_test_a', 'admin_a@test.com', 'Admin', 'Semilla'),
('user_clerk_test_b', 'user_b@test.com', 'Administrador B', 'Semilla')
ON CONFLICT (id) DO NOTHING;

-- 3. Asociar Miembros a la Empresa Semilla
INSERT INTO public.company_users (company_id, clerk_user_id, role_id, activo, status) VALUES
('00000000-0000-0000-0000-000000000000', 'user_clerk_test_a', 'operario', true, 'active'),
('00000000-0000-0000-0000-000000000000', 'admin_test_a', 'administrador', true, 'active')
ON CONFLICT (company_id, clerk_user_id) DO NOTHING;

-- 4. Crear Predio de Prueba
INSERT INTO public.predios (id, company_id, nombre, ubicacion, area_total_ha)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'Las Margaritas', 'Sector Central Coffee', 25.5)
ON CONFLICT (id) DO NOTHING;

-- 5. Crear Lote de Prueba (Las Margaritas)
INSERT INTO public.lotes (id, company_id, predio_id, codigo_interno, nombre, cultivo, area_ha, ndvi_actual, estado_sanitario)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'LM',
  'Lote Las Margaritas',
  'Café',
  15.5,
  0.81,
  'excelente'
)
ON CONFLICT (company_id, codigo_interno) DO NOTHING;
