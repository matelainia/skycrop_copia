-- Borrar tablas existentes si es necesario para evitar conflictos
DROP TABLE IF EXISTS jornadas_maquinaria CASCADE;
DROP TABLE IF EXISTS maquinaria CASCADE;

-- Crear tabla maquinaria con columnas avanzadas
CREATE TABLE maquinaria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_id VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('Operando', 'Disponible', 'En mantenimiento', 'Fuera de servicio')),
    operator_name VARCHAR(255),
    current_task VARCHAR(255),
    current_lot VARCHAR(100),
    last_maintenance DATE NOT NULL,
    next_maintenance DATE NOT NULL,
    next_maintenance_hours INTEGER NOT NULL DEFAULT 250,
    hours_of_operation NUMERIC(10, 2) NOT NULL DEFAULT 0,
    hours_today NUMERIC(10, 2) NOT NULL DEFAULT 0,
    fuel_consumption VARCHAR(100) NOT NULL DEFAULT '1.5 Gal/H',
    cost_operator NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
    cost_fuel NUMERIC(10, 2) NOT NULL DEFAULT 12.00,
    cost_maintenance NUMERIC(10, 2) NOT NULL DEFAULT 8.00,
    cost_depreciation NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
    photo_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Crear tabla jornadas_maquinaria para el registro histórico de labores
CREATE TABLE jornadas_maquinaria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maquinaria_id UUID REFERENCES maquinaria(id) ON DELETE CASCADE,
    operator VARCHAR(255) NOT NULL,
    lot VARCHAR(100) NOT NULL,
    activity VARCHAR(255) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    start_horometro NUMERIC(10, 2) NOT NULL,
    end_horometro NUMERIC(10, 2),
    start_fuel NUMERIC(10, 2) NOT NULL,
    end_fuel NUMERIC(10, 2),
    calculated_hours NUMERIC(10, 2),
    calculated_fuel_consumption NUMERIC(10, 2),
    calculated_cost NUMERIC(10, 2),
    notes TEXT,
    status VARCHAR(50) NOT NULL CHECK (status IN ('En Progreso', 'Finalizada')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE maquinaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE jornadas_maquinaria ENABLE ROW LEVEL SECURITY;

-- Crear políticas de acceso libre para desarrollo
CREATE POLICY "Permitir todo a usuarios anonimos en maquinaria" ON maquinaria FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a usuarios anonimos en jornadas" ON jornadas_maquinaria FOR ALL USING (true) WITH CHECK (true);

-- Poblar la tabla de maquinaria con 24 equipos para el SaaS
INSERT INTO maquinaria (codigo_id, name, type, status, operator_name, current_task, current_lot, last_maintenance, next_maintenance, next_maintenance_hours, hours_of_operation, hours_today, fuel_consumption, cost_operator, cost_fuel, cost_maintenance, cost_depreciation, photo_url) VALUES
('TR-001', 'Tractor John Deere 6195R', 'Tractor', 'Operando', 'Juan Pérez', 'Preparación de suelo', 'Lote B-12', '2026-05-20', '2026-07-20', 250, 1248.0, 6.4, '15.5 L/h', 18.50, 15.00, 10.00, 7.50, 'https://images.unsplash.com/photo-1595273670150-bd0c3c392e46?auto=format&fit=crop&q=80&w=400'),
('CO-002', 'Cosechadora New Holland CR7.90', 'Cosechadora', 'Operando', 'Carlos Ruiz', 'Cosecha de maíz', 'Lote M-05', '2026-04-15', '2026-07-15', 144, 2356.0, 7.8, '28.0 L/h', 25.00, 27.00, 20.00, 15.00, 'https://images.unsplash.com/photo-1592982537447-6f2a6a0c7c18?auto=format&fit=crop&q=80&w=400'),
('PU-003', 'Pulverizadora Jacto Uniport 3030', 'Pulverizadora', 'Operando', 'Pedro Gómez', 'Aplicación fungicida', 'Lote C-08', '2026-05-10', '2026-07-10', 194, 856.0, 4.2, '18.0 L/h', 20.00, 17.50, 12.00, 9.00, 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&q=80&w=400'),
('CA-004', 'Camión Chevrolet FTR 2021', 'Transporte', 'Disponible', NULL, NULL, NULL, '2026-05-01', '2026-08-01', 398, 1102.0, 0.0, '12.0 L/h', 14.00, 11.50, 8.00, 5.00, 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&q=80&w=400'),
('TR-005', 'Tractor Massey Ferguson 5711', 'Tractor', 'En mantenimiento', NULL, NULL, NULL, '2026-05-25', '2026-07-25', 20, 1980.0, 0.0, '14.0 L/h', 16.00, 13.50, 9.00, 6.00, 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=400'),
('RE-006', 'Retroexcavadora Caterpillar 416F2', 'Retroexcavadora', 'Fuera de servicio', NULL, NULL, NULL, '2026-03-12', '2026-06-12', 0, 3451.0, 0.0, '22.0 L/h', 22.00, 21.00, 15.00, 12.00, 'https://images.unsplash.com/photo-1579412690850-bd41cd0af397?auto=format&fit=crop&q=80&w=400'),
('TR-007', 'Tractor John Deere 5090E', 'Tractor', 'Disponible', NULL, NULL, NULL, '2026-05-05', '2026-08-05', 180, 750.0, 0.0, '11.2 L/h', 15.00, 11.00, 7.50, 4.50, 'https://images.unsplash.com/photo-1595273670150-bd0c3c392e46?auto=format&fit=crop&q=80&w=400'),
('TR-008', 'Tractor Case IH Farmall 90A', 'Tractor', 'Operando', 'Mateo Ortiz', 'Siembra de soya', 'Lote S-02', '2026-05-18', '2026-08-18', 210, 520.0, 5.0, '12.0 L/h', 16.00, 12.00, 8.00, 5.50, 'https://images.unsplash.com/photo-1592982537447-6f2a6a0c7c18?auto=format&fit=crop&q=80&w=400'),
('SE-009', 'Sembradora John Deere 1770NT', 'Sembradora', 'Operando', 'Mateo Ortiz', 'Siembra de soya', 'Lote S-02', '2026-05-12', '2026-08-12', 245, 340.0, 5.0, 'Eléctrico', 0.00, 0.00, 10.00, 8.00, 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&q=80&w=400'),
('DR-010', 'Dron DJI Agras T40', 'Dron', 'Operando', 'Sofia Diaz', 'Monitoreo e Imagenes', 'Lote L-04', '2026-05-24', '2026-06-24', 92, 112.0, 3.5, 'Batería', 25.00, 2.00, 15.00, 20.00, 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&q=80&w=400'),
('DR-011', 'Dron DJI Agras T30', 'Dron', 'Disponible', NULL, NULL, NULL, '2026-05-15', '2026-06-15', 78, 185.0, 0.0, 'Batería', 25.00, 2.00, 15.00, 15.00, 'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?auto=format&fit=crop&q=80&w=400'),
('RI-012', 'Pivot Riego Valley 8000', 'Riego', 'Operando', 'Luis Méndez', 'Riego automatizado', 'Lote R-01', '2026-04-01', '2026-10-01', 350, 4850.0, 12.0, 'Electricidad', 5.00, 22.00, 15.00, 10.00, 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&q=80&w=400'),
('BO-013', 'Bomba de Agua Hidráulica 75HP', 'Riego', 'Operando', 'Luis Méndez', 'Riego automatizado', 'Lote R-01', '2026-04-20', '2026-10-20', 215, 6200.0, 12.0, '4.5 L/h', 5.00, 4.50, 3.00, 2.00, 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=400'),
('TR-014', 'Tractor John Deere 6150M', 'Tractor', 'Disponible', NULL, NULL, NULL, '2026-05-10', '2026-08-10', 120, 1560.0, 0.0, '13.8 L/h', 17.00, 13.00, 9.00, 6.00, 'https://images.unsplash.com/photo-1595273670150-bd0c3c392e46?auto=format&fit=crop&q=80&w=400'),
('SE-015', 'Sembradora Amazone Condor', 'Sembradora', 'Disponible', NULL, NULL, NULL, '2026-05-01', '2026-08-01', 190, 480.0, 0.0, 'Eléctrico', 0.00, 0.00, 8.50, 7.00, 'https://images.unsplash.com/photo-1592982537447-6f2a6a0c7c18?auto=format&fit=crop&q=80&w=400'),
('AT-016', 'Atomizador Fede Qi 90', 'Atomizador', 'Disponible', NULL, NULL, NULL, '2026-05-22', '2026-07-22', 150, 320.0, 0.0, '6.0 L/h', 0.00, 6.00, 5.00, 4.00, 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&q=80&w=400'),
('TR-017', 'Tractor New Holland T6.180', 'Tractor', 'Disponible', NULL, NULL, NULL, '2026-05-14', '2026-08-14', 240, 920.0, 0.0, '14.2 L/h', 17.50, 14.00, 9.50, 6.50, 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=400'),
('CO-018', 'Cosechadora Claas Lexion 8700', 'Cosechadora', 'En mantenimiento', NULL, NULL, NULL, '2026-04-20', '2026-07-20', 10, 1450.0, 0.0, '31.0 L/h', 26.00, 30.00, 22.00, 18.00, 'https://images.unsplash.com/photo-1592982537447-6f2a6a0c7c18?auto=format&fit=crop&q=80&w=400'),
('CA-019', 'Camión Scania R450 XT 6x4', 'Transporte', 'Disponible', NULL, NULL, NULL, '2026-04-28', '2026-07-28', 198, 4850.0, 0.0, '25.0 L/h', 18.00, 24.00, 15.00, 10.00, 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&q=80&w=400'),
('TR-020', 'Tractor Massey Ferguson 8737S', 'Tractor', 'Disponible', NULL, NULL, NULL, '2026-05-11', '2026-08-11', 225, 1120.0, 0.0, '19.0 L/h', 20.00, 18.00, 12.00, 9.00, 'https://images.unsplash.com/photo-1595273670150-bd0c3c392e46?auto=format&fit=crop&q=80&w=400'),
('PU-021', 'Pulverizadora John Deere M4040', 'Pulverizadora', 'Disponible', NULL, NULL, NULL, '2026-05-02', '2026-08-02', 170, 1240.0, 0.0, '17.5 L/h', 19.00, 17.00, 12.00, 9.50, 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&q=80&w=400'),
('DR-022', 'Dron DJI Mavic 3 Multispectral', 'Dron', 'Disponible', NULL, NULL, NULL, '2026-05-20', '2026-06-20', 85, 96.0, 0.0, 'Batería', 22.00, 1.00, 8.00, 10.00, 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&q=80&w=400'),
('TR-023', 'Tractor John Deere 6115D', 'Tractor', 'En mantenimiento', NULL, NULL, NULL, '2026-05-25', '2026-07-25', 5, 2950.0, 0.0, '10.5 L/h', 14.50, 10.00, 8.00, 5.00, 'https://images.unsplash.com/photo-1595273670150-bd0c3c392e46?auto=format&fit=crop&q=80&w=400'),
('RE-024', 'Minicargador Caterpillar 262D3', 'Retroexcavadora', 'Disponible', NULL, NULL, NULL, '2026-05-14', '2026-08-14', 160, 1150.0, 0.0, '10.0 L/h', 15.00, 10.00, 7.50, 6.00, 'https://images.unsplash.com/photo-1579412690850-bd41cd0af397?auto=format&fit=crop&q=80&w=400');


-- Insertar registros históricos y en progreso en jornadas_maquinaria
-- Para que el panel de "Operación Actual" detecte labores activas
INSERT INTO jornadas_maquinaria (maquinaria_id, operator, lot, activity, start_time, start_horometro, start_fuel, status)
SELECT id, 'Juan Pérez', 'Lote B-12', 'Preparación de suelo', timezone('utc'::text, now()) - interval '6 hours 24 minutes', 1241.6, 150.0, 'En Progreso'
FROM maquinaria WHERE codigo_id = 'TR-001';

INSERT INTO jornadas_maquinaria (maquinaria_id, operator, lot, activity, start_time, start_horometro, start_fuel, status)
SELECT id, 'Carlos Ruiz', 'Lote M-05', 'Cosecha de maíz', timezone('utc'::text, now()) - interval '7 hours 48 minutes', 2348.2, 320.0, 'En Progreso'
FROM maquinaria WHERE codigo_id = 'CO-002';

INSERT INTO jornadas_maquinaria (maquinaria_id, operator, lot, activity, start_time, start_horometro, start_fuel, status)
SELECT id, 'Pedro Gómez', 'Lote C-08', 'Aplicación fungicida', timezone('utc'::text, now()) - interval '4 hours 12 minutes', 851.8, 120.0, 'En Progreso'
FROM maquinaria WHERE codigo_id = 'PU-003';

INSERT INTO jornadas_maquinaria (maquinaria_id, operator, lot, activity, start_time, start_horometro, start_fuel, status)
SELECT id, 'Mateo Ortiz', 'Lote S-02', 'Siembra de soya', timezone('utc'::text, now()) - interval '5 hours', 515.0, 95.0, 'En Progreso'
FROM maquinaria WHERE codigo_id = 'TR-008';

INSERT INTO jornadas_maquinaria (maquinaria_id, operator, lot, activity, start_time, start_horometro, start_fuel, status)
SELECT id, 'Mateo Ortiz', 'Lote S-02', 'Siembra de soya', timezone('utc'::text, now()) - interval '5 hours', 335.0, 100.0, 'En Progreso'
FROM maquinaria WHERE codigo_id = 'SE-009';

INSERT INTO jornadas_maquinaria (maquinaria_id, operator, lot, activity, start_time, start_horometro, start_fuel, status)
SELECT id, 'Sofia Diaz', 'Lote L-04', 'Monitoreo e Imagenes', timezone('utc'::text, now()) - interval '3 hours 30 minutes', 108.5, 100.0, 'En Progreso'
FROM maquinaria WHERE codigo_id = 'DR-010';

INSERT INTO jornadas_maquinaria (maquinaria_id, operator, lot, activity, start_time, start_horometro, start_fuel, status)
SELECT id, 'Luis Méndez', 'Lote R-01', 'Riego automatizado', timezone('utc'::text, now()) - interval '12 hours', 4838.0, 100.0, 'En Progreso'
FROM maquinaria WHERE codigo_id = 'RI-012';

INSERT INTO jornadas_maquinaria (maquinaria_id, operator, lot, activity, start_time, start_horometro, start_fuel, status)
SELECT id, 'Luis Méndez', 'Lote R-01', 'Riego automatizado', timezone('utc'::text, now()) - interval '12 hours', 6188.0, 100.0, 'En Progreso'
FROM maquinaria WHERE codigo_id = 'BO-013';

-- Insertar algunas jornadas finalizadas como historial reciente
INSERT INTO jornadas_maquinaria (maquinaria_id, operator, lot, activity, start_time, end_time, start_horometro, end_horometro, start_fuel, end_fuel, calculated_hours, calculated_fuel_consumption, calculated_cost, status, notes)
SELECT id, 'Pedro Gómez', 'Lote C-08', 'Aplicación fungicida', timezone('utc'::text, now()) - interval '1 day 12 hours', timezone('utc'::text, now()) - interval '1 day 4 hours', 843.8, 851.8, 120.0, 40.0, 8.0, 10.0, 320.00, 'Finalizada', 'Aplicación completada en Lote C-08.'
FROM maquinaria WHERE codigo_id = 'PU-003';

INSERT INTO jornadas_maquinaria (maquinaria_id, operator, lot, activity, start_time, end_time, start_horometro, end_horometro, start_fuel, end_fuel, calculated_hours, calculated_fuel_consumption, calculated_cost, status, notes)
SELECT id, 'Juan Pérez', 'Lote B-12', 'Preparación de suelo', timezone('utc'::text, now()) - interval '2 days', timezone('utc'::text, now()) - interval '2 days - 8 hours', 1233.0, 1241.0, 150.0, 60.0, 8.0, 11.25, 410.00, 'Finalizada', 'Preparación de suelo finalizada para siembra.'
FROM maquinaria WHERE codigo_id = 'TR-001';

INSERT INTO jornadas_maquinaria (maquinaria_id, operator, lot, activity, start_time, end_time, start_horometro, end_horometro, start_fuel, end_fuel, calculated_hours, calculated_fuel_consumption, calculated_cost, status, notes)
SELECT id, 'Carlos Ruiz', 'Lote M-04', 'Cosecha de maíz', timezone('utc'::text, now()) - interval '3 days', timezone('utc'::text, now()) - interval '3 days - 9 hours', 2339.2, 2348.2, 320.0, 70.0, 9.0, 27.7, 720.00, 'Finalizada', 'Cosecha de maíz en lote M-04.'
FROM maquinaria WHERE codigo_id = 'CO-002';
