import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables from .env.local in the root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY deben estar definidos en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSeed() {
  console.log('🌱 Iniciando siembra de base de datos para Inventario y Bodegas...');

  // 1. Obtener trabajadores para asignar responsables si existen
  const { data: workers, error: workersErr } = await supabase
    .from('trabajadores')
    .select('id, nombres, apellidos')
    .limit(3);

  if (workersErr) {
    console.error('⚠️ Advertencia: Error al leer trabajadores:', workersErr.message);
  }

  // 2. Sembrar bodegas si no existen
  const { data: existingWarehouses, error: whReadErr } = await supabase
    .from('bodegas')
    .select('*');

  if (whReadErr) {
    console.error('❌ Error al verificar bodegas:', whReadErr.message);
    process.exit(1);
  }

  let currentWarehouses = existingWarehouses || [];

  if (currentWarehouses.length === 0) {
    console.log('📦 Sembrando bodegas por defecto...');
    const defaultBodegas = [
      {
        nombre: 'Bodega Central',
        sector: 'Sector A (Semillas y Abonos)',
        coordenada_x: 3.4516,
        coordenada_y: -76.5320,
        categoria: 'Fertilizantes',
        responsable_id: workers?.[0]?.id || null
      },
      {
        nombre: 'Bodega Norte',
        sector: 'Sector B (Herramientas)',
        coordenada_x: 3.4600,
        coordenada_y: -76.5400,
        categoria: 'Herramientas',
        responsable_id: workers?.[1]?.id || null
      },
      {
        nombre: 'Bodega Sur',
        sector: 'Sector C (Químicos y Plaguicidas)',
        coordenada_x: 3.4400,
        coordenada_y: -76.5200,
        categoria: 'Agroquímicos',
        responsable_id: workers?.[2]?.id || null
      }
    ];

    const { data: insertedWh, error: insertWhErr } = await supabase
      .from('bodegas')
      .insert(defaultBodegas)
      .select();

    if (insertWhErr) {
      console.error('❌ Error al sembrar bodegas:', insertWhErr.message);
      process.exit(1);
    }
    console.log(`✅ ${insertedWh.length} bodegas sembradas con éxito.`);
    currentWarehouses = insertedWh;
  } else {
    console.log('ℹ️ Bodegas ya registradas en la base de datos.');
  }

  // 3. Sembrar artículos de inventario si no existen
  const { data: existingItems, error: itemsReadErr } = await supabase
    .from('inventario')
    .select('id')
    .limit(1);

  if (itemsReadErr) {
    console.error('❌ Error al verificar inventario:', itemsReadErr.message);
    process.exit(1);
  }

  if (!existingItems || existingItems.length === 0) {
    console.log('📦 Sembrando catálogo de insumos inicial...');
    const centralWh = currentWarehouses.find(w => w.nombre.includes('Central'))?.id || null;
    const norteWh = currentWarehouses.find(w => w.nombre.includes('Norte'))?.id || null;
    const surWh = currentWarehouses.find(w => w.nombre.includes('Sur'))?.id || null;

    const seedItems = [
      { name: 'Urea Fertilizing Granules', category: 'Fertilizantes', quantity: 150, unit: 'Sacos', min_quantity: 100, warehouse_id: centralWh, lote: 'L-774', registro_ica: 'ICA-0012', comentarios: 'Fertilizante de alta calidad.' },
      { name: 'Glyphosate Herbicide', category: 'Herbicidas', quantity: 15, unit: 'Latas', min_quantity: 25, warehouse_id: norteWh, lote: 'L-893', registro_ica: 'ICA-3921', comentarios: 'Control de maleza.' },
      { name: 'Maize P1 Seed', category: 'Semillas', quantity: 30, unit: 'Sacos', min_quantity: 20, warehouse_id: centralWh, lote: 'L-211', registro_ica: 'ICA-1945', comentarios: 'Semilla híbrida certificada.' },
      { name: 'Tractor Oil 10W40', category: 'Mantenimiento', quantity: 5, unit: 'Gals', min_quantity: 10, warehouse_id: norteWh, lote: 'L-104', registro_ica: 'ICA-9941', comentarios: 'Lubricante para motores diesel.' },
      { name: 'Pesticide Delta', category: 'Pesticidas', quantity: 10, unit: 'Latas', min_quantity: 15, warehouse_id: surWh, lote: 'L-673', registro_ica: 'ICA-4819', comentarios: 'Insecticida potente.' },
      { name: 'Safety Gloves', category: 'Seguridad', quantity: 50, unit: 'Pairs', min_quantity: 30, warehouse_id: surWh, lote: 'L-029', registro_ica: 'ICA-N/A', comentarios: 'Protección para fumigadores.' },
      { name: 'Spade and Fork Set', category: 'Herramientas', quantity: 8, unit: 'Units', min_quantity: 5, warehouse_id: norteWh, lote: 'L-001', registro_ica: 'ICA-N/A', comentarios: 'Herramientas de mano de acero.' }
    ];

    const categories = ['Semillas', 'Fertilizantes', 'Herbicidas', 'Pesticidas', 'Mantenimiento', 'Seguridad', 'Herramientas'];
    const units = ['Sacos', 'Latas', 'Gals', 'Pairs', 'Units', 'kg', 'L'];
    const names = [
      'Urea Fertilizing Granules', 'Glyphosate Herbicide', 'Maize P1 Seed', 'Tractor Oil 10W40',
      'Pesticide Delta', 'Safety Gloves', 'Spade and Fork Set', 'Potassium Fertilizer',
      'Tomato Seeds F1', 'Nylon Rope Roll', 'Sprayer Nozzles', 'Irrigation Drip Tape',
      'Pruning Shears', 'Diesel Fuel Additive', 'Protective Goggles', 'Organic Compost Bag',
      'Soybean Seeds', 'Herbicida Rápido', 'Fungicida Premium', 'Shovel Wood Handle',
      'Wheelbarrow Metal', 'Gardening Rake', 'PVC pipe 2 inch', 'Work Boots Leather',
      'Reflective Vest', 'Tractor Air Filter', 'Grease Tube', 'Water Pump Belt',
      'Insecticide Spray', 'Copper Fungicide', 'Wheat Seeds winter', 'Calcium Nitrate Bag',
      'PH Meter Digital', 'Soil Soil Probe', 'Nitrogen Fertilizer Extra', 'Grass Killer Concentrated',
      'Safety Helmet Yellow', 'Ear Plugs Foam', 'Toolbox Metal Case', 'Chain Saw Oil',
      'Hydraulic Oil Fluid', 'Corn Seeds Yellow'
    ];

    // Generar más artículos de ejemplo
    for (let i = 7; i < 42; i++) {
      const name = names[i] || `Insumo Genérico ${i}`;
      const category = categories[i % categories.length];
      const unit = units[i % units.length];
      const quantity = Math.floor(Math.random() * 80) + 10;
      const min_quantity = Math.floor(Math.random() * 30) + 12;
      const whId = i % 3 === 0 ? centralWh : (i % 3 === 1 ? norteWh : surWh);
      seedItems.push({
        name,
        category,
        quantity,
        unit,
        min_quantity,
        warehouse_id: whId,
        lote: `L-${Math.floor(Math.random() * 900) + 100}`,
        registro_ica: `ICA-${Math.floor(Math.random() * 8000) + 1000}`,
        comentarios: 'Registrado en el sembrado inicial.'
      });
    }

    const { error: insertItemsErr } = await supabase
      .from('inventario')
      .insert(seedItems);

    if (insertItemsErr) {
      console.error('❌ Error al sembrar catálogo:', insertItemsErr.message);
      process.exit(1);
    }
    console.log(`✅ ${seedItems.length} artículos del inventario sembrados con éxito.`);
  } else {
    console.log('ℹ️ Artículos de inventario ya existentes.');
  }

  console.log('🎉 Siembra completada con éxito.');
}

runSeed().catch(err => {
  console.error('❌ Falló la ejecución del script:', err);
  process.exit(1);
});
