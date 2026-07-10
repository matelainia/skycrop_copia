-- Habilitar extensión PostGIS si aún no está activa
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Tabla de Lotes/Sectores Georreferenciados
CREATE TABLE IF NOT EXISTS lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_interno VARCHAR(50) UNIQUE NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  cultivo VARCHAR(100) NOT NULL,
  variedad VARCHAR(100),
  fecha_siembra DATE,
  estado_fenologico VARCHAR(100),
  sistema_productivo VARCHAR(100),
  responsable_tecnico VARCHAR(150),
  observaciones TEXT,
  geom GEOMETRY(Geometry, 4326), -- Campo PostGIS para la geometría (soporta Polígonos)
  area_ha DOUBLE PRECISION,
  perimetro_m DOUBLE PRECISION,
  centroide_lat DOUBLE PRECISION,
  centroide_lng DOUBLE PRECISION,
  estado_sanitario VARCHAR(50) DEFAULT 'excelente', -- excelente, bueno, regular, bajo, sin_datos
  ndvi_actual DOUBLE PRECISION DEFAULT 0.75,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Crear un índice espacial para acelerar las consultas GIS en el futuro
CREATE INDEX IF NOT EXISTS lotes_geom_idx ON lotes USING GIST (geom);

-- 2. Tabla de Aplicaciones Agrícolas (Fitosanitarias y Nutricionales)
CREATE TABLE IF NOT EXISTS aplicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID REFERENCES lotes(id) ON DELETE CASCADE,
  tipo_aplicacion VARCHAR(50) NOT NULL, -- Fitosanitaria, Nutricional
  tipo_producto VARCHAR(50) NOT NULL, -- Fungicida, Insecticida, Herbicida, Fertilizante, Biológico
  producto_comercial VARCHAR(150) NOT NULL,
  ingrediente_activo VARCHAR(150),
  dosis VARCHAR(50),
  unidad_medida VARCHAR(20),
  volumen_aplicado DOUBLE PRECISION,
  metodo_aplicacion VARCHAR(100),
  operario_responsable VARCHAR(150),
  maquinaria_utilizada VARCHAR(150),
  condiciones_climaticas VARCHAR(150),
  fecha_aplicacion TIMESTAMP WITH TIME ZONE NOT NULL,
  costo_aplicacion DOUBLE PRECISION DEFAULT 0.0,
  receta_agronomica_url TEXT,
  registro_ica VARCHAR(100),
  periodo_carencia_dias INTEGER DEFAULT 0, -- PC (días para cosecha)
  periodo_reingreso_horas INTEGER DEFAULT 0, -- REI (horas para reingreso)
  clasificacion_toxicologica VARCHAR(50),
  residualidad_nivel VARCHAR(50), -- Alto, Medio, Bajo
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabla de Monitoreos y Evaluaciones Sanitarias
CREATE TABLE IF NOT EXISTS monitoreos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID REFERENCES lotes(id) ON DELETE CASCADE,
  tipo_monitoreo VARCHAR(50) NOT NULL, -- Sanitario, Agronómico, Post-Aplicación
  fecha_monitoreo TIMESTAMP WITH TIME ZONE NOT NULL,
  responsable VARCHAR(150) NOT NULL,
  incidencia_pct DOUBLE PRECISION DEFAULT 0.0,
  severidad_pct DOUBLE PRECISION DEFAULT 0.0,
  humedad_pct DOUBLE PRECISION,
  temperatura_c DOUBLE PRECISION,
  plagas_detectadas TEXT,
  enfermedades_detectadas TEXT,
  deficiencias_nutricionales TEXT,
  observaciones TEXT,
  evidencia_foto_url TEXT,
  documento_adjunto_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabla de Planificación de Cosechas
CREATE TABLE IF NOT EXISTS planificacion_cosechas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID REFERENCES lotes(id) ON DELETE CASCADE,
  fecha_programada DATE NOT NULL,
  produccion_estimada_kg DOUBLE PRECISION,
  area_programada_ha DOUBLE PRECISION,
  estado_carencia VARCHAR(50) DEFAULT 'Sin restricciones', -- Sin restricciones, Faltan X días, Carencia activa
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabla de Historial Cronológico de Actividades (Timeline)
CREATE TABLE IF NOT EXISTS historial_actividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID REFERENCES lotes(id) ON DELETE CASCADE,
  tipo_actividad VARCHAR(100) NOT NULL, -- Aplicación, Fertilización, Monitoreo, Evaluación, Cosecha, Poda, Labor, Siembra, Carga Documental
  fecha_actividad TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  responsable VARCHAR(150),
  observaciones TEXT,
  resultados TEXT,
  documentos_urls TEXT[], -- Array de URLs de soporte
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Tabla de Auditoría
CREATE TABLE IF NOT EXISTS auditoria_sanitaria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla_afectada VARCHAR(100) NOT NULL,
  registro_id UUID NOT NULL,
  campo_modificado VARCHAR(100),
  valor_anterior TEXT,
  valor_nuevo TEXT,
  usuario_modificador VARCHAR(150) NOT NULL,
  fecha_modificacion TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Tabla de Caché para Consultas de Google Earth Engine (GEE)
CREATE TABLE IF NOT EXISTS gee_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID REFERENCES lotes(id) ON DELETE CASCADE,
  polygon_hash VARCHAR(64) NOT NULL,
  index_type VARCHAR(20) NOT NULL,
  tile_url TEXT NOT NULL,
  avg_value DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índice para búsquedas rápidas de caché por hash de polígono e índice
CREATE INDEX IF NOT EXISTS gee_cache_hash_idx ON gee_cache (polygon_hash, index_type);

