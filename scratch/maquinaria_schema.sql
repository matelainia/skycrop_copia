-- Borrar tabla existente si es necesario para recrear con la nueva estructura
DROP TABLE IF EXISTS maquinaria;

-- Crear tabla maquinaria
CREATE TABLE maquinaria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_id VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('Operando Normal', 'En Taller', 'Crítico')),
    last_maintenance DATE NOT NULL,
    next_maintenance DATE NOT NULL,
    hours_of_operation INTEGER NOT NULL DEFAULT 0,
    fuel_consumption VARCHAR(100) NOT NULL DEFAULT '1.5 Gal/H',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE maquinaria ENABLE ROW LEVEL SECURITY;

-- Crear políticas para permitir acceso libre a todos (según la configuración actual)
CREATE POLICY "Permitir todo a usuarios anonimos" ON maquinaria FOR ALL USING (true) WITH CHECK (true);

-- Poblar la tabla con datos iniciales (12 equipos en total para coincidir con la métrica del diseño)
INSERT INTO maquinaria (codigo_id, name, type, status, last_maintenance, next_maintenance, hours_of_operation, fuel_consumption) VALUES
('T-01', 'Tractor John Deere 8R', 'Tractor', 'Operando Normal', '2026-05-20', '2026-07-20', 250, '1.5 Gal/H'),
('C-01', 'Cosechadora Case IH Axial-Flow', 'Cosechadora', 'En Taller', '2026-04-15', '2026-07-15', 450, '1.5 Gal/H'),
('T-02', 'Tractor New Holland T7', 'Tractor', 'En Taller', '2026-05-10', '2026-07-10', 200, '1.5 Gal/H'),
('S-01', 'Sembradora Amazone Condor', 'Sembradora', 'Crítico', '2026-05-01', '2026-08-01', 150, '1.5 Gal/H'),
('A-01', 'Atomizador Fede', 'Atomizador', 'Crítico', '2026-05-25', '2026-07-25', 180, '1.5 Gal/H'),
('T-03', 'Tractor John Deere 6J', 'Tractor', 'Operando Normal', '2026-05-18', '2026-08-18', 300, '1.2 Gal/H'),
('C-02', 'Cosechadora John Deere S700', 'Cosechadora', 'Operando Normal', '2026-04-12', '2026-08-12', 550, '2.0 Gal/H'),
('S-02', 'Sembradora John Deere 1770', 'Sembradora', 'Operando Normal', '2026-05-05', '2026-09-05', 120, '0.8 Gal/H'),
('D-01', 'Dron DJI Agras T40', 'Dron', 'Operando Normal', '2026-05-22', '2026-06-22', 85, 'Eléctrico'),
('D-02', 'Dron DJI Agras T30', 'Dron', 'Operando Normal', '2026-05-14', '2026-06-14', 110, 'Eléctrico'),
('R-01', 'Sistema Pivot Central Riego', 'Riego', 'Operando Normal', '2026-04-01', '2026-10-01', 950, 'Eléctrico'),
('R-02', 'Bomba de Riego Principal', 'Riego', 'En Taller', '2026-04-20', '2026-10-20', 1200, '0.5 Gal/H');
