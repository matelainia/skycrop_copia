import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gynttnymneanbziywqqr.supabase.co';
const supabaseKey = 'sb_publishable_YQgpOzCvrEjkfjZbR5tv7Q_-KMPafye';
const supabase = createClient(supabaseUrl, supabaseKey);

const LOTES_PARA_BD = [
  {
    id: 'd9b7f5d0-9d3b-4889-b88d-e4fb38f6d601',
    codigo_interno: 'A1',
    nombre: 'Lote A1 - Maíz Híbrido',
    cultivo: 'Maíz',
    variedad: 'DK-7088',
    fecha_siembra: '2026-02-15',
    estado_fenologico: 'Vegetativo',
    sistema_productivo: 'Convencional',
    responsable_tecnico: 'Sebastian Diaz',
    observaciones: 'Vigor óptimo, aplicación de fungicida en curso para prevención de roya.',
    area_ha: 12.45,
    perimetro_m: 1842.6,
    centroide_lat: 3.5182,
    centroide_lng: -76.3054,
    estado_sanitario: 'excelente',
    ndvi_actual: 0.78
  },
  {
    id: 'd9b7f5d0-9d3b-4889-b88d-e4fb38f6d602',
    codigo_interno: 'A2',
    nombre: 'Lote A2 - Maíz Híbrido',
    cultivo: 'Maíz',
    variedad: 'DK-7088',
    fecha_siembra: '2026-02-18',
    estado_fenologico: 'Floración',
    sistema_productivo: 'Convencional',
    responsable_tecnico: 'Sebastian Diaz',
    observaciones: 'Gusano cogollero detectado en nivel umbral bajo.',
    area_ha: 8.32,
    perimetro_m: 1120.4,
    centroide_lat: 3.5225,
    centroide_lng: -76.3012,
    estado_sanitario: 'bueno',
    ndvi_actual: 0.69
  },
  {
    id: 'd9b7f5d0-9d3b-4889-b88d-e4fb38f6d603',
    codigo_interno: 'B1',
    nombre: 'Lote B1 - Soya Orgánica',
    cultivo: 'Soya',
    variedad: 'Soya-Org-1',
    fecha_siembra: '2026-03-10',
    estado_fenologico: 'Vaina Llena',
    sistema_productivo: 'Orgánico Certificado',
    responsable_tecnico: 'Sebastian Diaz',
    observaciones: 'Monitoreo de trips indica incremento leve de poblaciones.',
    area_ha: 15.60,
    perimetro_m: 1720.5,
    centroide_lat: 3.5135,
    centroide_lng: -76.3085,
    estado_sanitario: 'regular',
    ndvi_actual: 0.56
  },
  {
    id: 'd9b7f5d0-9d3b-4889-b88d-e4fb38f6d604',
    codigo_interno: 'C1',
    nombre: 'Lote C1 - Girasol',
    cultivo: 'Girasol',
    variedad: 'Helios-22',
    fecha_siembra: '2026-04-05',
    estado_fenologico: 'Desarrollo Vegetativo',
    sistema_productivo: 'Convencional',
    responsable_tecnico: 'Sebastian Diaz',
    observaciones: 'Mildiu foliar detectado en sector norte con estrés hídrico activo.',
    area_ha: 9.75,
    perimetro_m: 980.1,
    centroide_lat: 3.5115,
    centroide_lng: -76.3155,
    estado_sanitario: 'bajo',
    ndvi_actual: 0.41
  },
  {
    id: 'd9b7f5d0-9d3b-4889-b88d-e4fb38f6d605',
    codigo_interno: 'D1',
    nombre: 'Lote D1 - Cacao CCN51',
    cultivo: 'Cacao',
    variedad: 'CCN51',
    fecha_siembra: '2024-05-12',
    estado_fenologico: 'Fructificación',
    sistema_productivo: 'Agroforestal',
    responsable_tecnico: 'Sebastian Diaz',
    observaciones: 'Alta tasa de fotosíntesis. Sin plagas.',
    area_ha: 6.25,
    perimetro_m: 790.3,
    centroide_lat: 3.5165,
    centroide_lng: -76.3125,
    estado_sanitario: 'excelente',
    ndvi_actual: 0.82
  }
];

async function seed() {
  console.log('Seeding lotes...');
  const { data, error } = await supabase.from('lotes').upsert(LOTES_PARA_BD).select();
  console.log('Result:', { data, error });
}

seed();
