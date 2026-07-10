import express from 'express';
import cors from 'cors';
import { legacyCreateProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import ee from '@google/earthengine';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Cargar variables de entorno localmente si están disponibles
dotenv.config();

const app = express();

// Middleware global de logging para depurar peticiones
app.use((req, res, next) => {
  console.log(`[REQUEST LOG] ${req.method} ${req.url}`);
  console.log('Headers recibidos:', req.headers);
  next();
});

// Configurar CORS
const allowedOrigins = [
  'http://localhost:5173',
  'https://skycrop.app',
  'https://www.skycrop.app',
  'https://backend.skycrop.app'
];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin origen (como apps móviles, curl o llamadas del mismo servidor)
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'apikey',
    'X-Client-Info',
    'x-client-info',
    'Prefer',
    'Range',
    'Accept-Encoding',
    'accept-profile',
    'content-profile',
    'x-retry-count'
  ]
}));

// Obtener variables de entorno (configuradas en Vercel)
const supabaseUrl = process.env.SUPABASE_URL || 'https://fxcasqkwkiytbckvtgag.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Inicializar cliente Supabase localmente para gestionar la caché
let supabaseDb = null;
if (supabaseUrl && supabaseAnonKey) {
  supabaseDb = createClient(supabaseUrl, supabaseAnonKey);
}

// --- CONEXIÓN E INICIALIZACIÓN DE GOOGLE EARTH ENGINE ---
let geeInitialized = false;
let geeInitializationError = null;

async function initGEE() {
  const serviceAccountKey = process.env.GEE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    console.warn("⚠️ GEE: GEE_SERVICE_ACCOUNT_KEY no está configurada en .env. El backend correrá en Modo Simulado (Mock).");
    geeInitializationError = "GEE_SERVICE_ACCOUNT_KEY is missing";
    return;
  }

  try {
    let privateKey;
    try {
      privateKey = JSON.parse(serviceAccountKey);
    } catch (parseErr) {
      console.warn("⚠️ GEE: La clave de la cuenta de servicio no es un JSON válido directamente. Intentando parsear limpiando retornos...");
      privateKey = JSON.parse(serviceAccountKey.replace(/\\n/g, '\n'));
    }

    console.log("🔄 GEE: Autenticando con Google Earth Engine...");

    await new Promise((resolve, reject) => {
      ee.data.authenticateViaPrivateKey(
        privateKey,
        () => {
          ee.initialize(
            null,
            null,
            () => {
              geeInitialized = true;
              console.log("✅ GEE: Google Earth Engine inicializado correctamente!");
              resolve();
            },
            (err) => {
              console.error("❌ GEE: Error al inicializar:", err);
              reject(err);
            }
          );
        },
        (err) => {
          console.error("❌ GEE: Error al autenticar:", err);
          reject(err);
        }
      );
    });
  } catch (err) {
    geeInitializationError = err.message;
    console.error("⚠️ GEE: Error en la inicialización de Earth Engine. Ejecutando en Modo Simulado (Mock). Detalle:", err.message);
  }
}

// Ejecutar inicialización al arrancar
initGEE();

// --- GESTIÓN DE CACHÉ DE TILES ---
const memoryCache = new Map();

function getPolygonHash(coordinates, indexType) {
  const coordString = JSON.stringify(coordinates);
  return crypto.createHash('sha256').update(`${coordString}_${indexType}`).digest('hex');
}

async function getCachedTile(hash) {
  const now = new Date();

  // 1. Caché en memoria
  if (memoryCache.has(hash)) {
    const cached = memoryCache.get(hash);
    if (now - cached.createdAt < 259200000) { // 3 días de expiración
      console.log(`[CACHE HIT] Memoria para hash: ${hash}`);
      return cached;
    } else {
      memoryCache.delete(hash);
    }
  }

  // 2. Caché en PostgreSQL (Supabase)
  if (supabaseDb) {
    try {
      const { data, error } = await supabaseDb
        .from('gee_cache')
        .select('*')
        .eq('polygon_hash', hash)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const cached = data[0];
        const createdAt = new Date(cached.created_at);
        if (now - createdAt < 259200000) {
          console.log(`[CACHE HIT] PostgreSQL para hash: ${hash}`);
          const cacheObj = {
            tileUrl: cached.tile_url,
            avgValue: cached.avg_value,
            stats: cached.histogram_data?.stats || null,
            distribution: cached.histogram_data?.distribution || null,
            histogram: cached.histogram_data?.histogram || null,
            createdAt: createdAt
          };
          memoryCache.set(hash, cacheObj);
          return cacheObj;
        } else {
          await supabaseDb.from('gee_cache').delete().eq('id', cached.id);
        }
      }
    } catch (dbErr) {
      console.warn("⚠️ CACHE: Error leyendo base de datos de caché. Continuando con memoria.", dbErr.message);
    }
  }

  return null;
}

async function saveTileToCache(hash, loteId, tileUrl, avgValue, indexType, extraData = null) {
  const now = new Date();
  const cacheObj = {
    tileUrl,
    avgValue,
    stats: extraData?.stats || null,
    distribution: extraData?.distribution || null,
    histogram: extraData?.histogram || null,
    createdAt: now
  };

  memoryCache.set(hash, cacheObj);

  if (supabaseDb) {
    try {
      await supabaseDb.from('gee_cache').delete().eq('polygon_hash', hash);

      const insertData = {
        lote_id: loteId || null,
        polygon_hash: hash,
        index_type: indexType || 'NDVI',
        tile_url: tileUrl,
        avg_value: avgValue,
        created_at: now.toISOString()
      };

      if (extraData) {
        insertData.histogram_data = extraData;
      }

      const { error } = await supabaseDb
        .from('gee_cache')
        .insert([insertData]);

      if (error) {
        console.warn("⚠️ GEE CACHE: No se pudo insertar en la DB (¿falta ejecutar script SQL?). Detalles:", error.message);
        // Fallback si la columna histogram_data no existe en la DB
        if (error.message.includes('column') || error.message.includes('histogram_data')) {
          delete insertData.histogram_data;
          await supabaseDb.from('gee_cache').insert([insertData]);
        }
      } else {
        console.log(`[CACHE SET] Guardado en PostgreSQL para hash: ${hash}`);
      }
    } catch (dbErr) {
      console.warn("⚠️ GEE CACHE: Excepción guardando caché en DB:", dbErr.message);
    }
  }
}

// --- HELPER PARA GENERAR HISTOGRAMA Y ESTADÍSTICAS SIMULADAS ---
function generateMockHistogramAndStats(indexType, sumCoordinates) {
  let mean = 0.74;
  let stdDev = 0.12;
  if (indexType === 'NDVI') {
    mean = parseFloat((0.65 + (Math.abs(sumCoordinates) % 0.15)).toFixed(2));
    stdDev = parseFloat((0.08 + (Math.abs(sumCoordinates) % 0.05)).toFixed(2));
  } else if (indexType === 'NDRE') {
    mean = parseFloat((0.45 + (Math.abs(sumCoordinates) % 0.15)).toFixed(2));
    stdDev = parseFloat((0.06 + (Math.abs(sumCoordinates) % 0.04)).toFixed(2));
  } else if (indexType === 'SAVI') {
    mean = parseFloat((0.55 + (Math.abs(sumCoordinates) % 0.15)).toFixed(2));
    stdDev = parseFloat((0.07 + (Math.abs(sumCoordinates) % 0.05)).toFixed(2));
  } else if (indexType === 'HUMEDAD') {
    mean = parseFloat((0.15 + (Math.abs(sumCoordinates) % 0.2)).toFixed(2));
    stdDev = parseFloat((0.1 + (Math.abs(sumCoordinates) % 0.08)).toFixed(2));
  }

  const min = parseFloat(Math.max(indexType === 'HUMEDAD' ? -0.5 : 0.0, mean - 2.5 * stdDev).toFixed(2));
  const max = parseFloat(Math.min(1.0, mean + 2.0 * stdDev).toFixed(2));
  const median = parseFloat((mean + 0.02).toFixed(2));
  const cv = parseFloat(((stdDev / mean) * 100).toFixed(1));

  const stats = { mean, median, stdDev, min, max, cv };

  // Generar 40 barras para la distribución normal (campana de Gauss)
  const histogram = [];
  const numBuckets = 40;
  const startVal = indexType === 'HUMEDAD' ? -0.2 : 0.0;
  const endVal = 1.0;
  const step = (endVal - startVal) / numBuckets;

  let criticoPixels = 0;
  let bajoPixels = 0;
  let medioPixels = 0;
  let altoPixels = 0;
  let excelentePixels = 0;
  let totalPixels = 0;

  for (let i = 0; i < numBuckets; i++) {
    const val = startVal + i * step;
    const exponent = -0.5 * Math.pow((val - mean) / stdDev, 2);
    let count = Math.round(18000 * Math.exp(exponent));

    // Ruido aleatorio moderado
    count = Math.max(10, count + Math.round((Math.random() - 0.5) * 500));
    totalPixels += count;

    if (indexType === 'HUMEDAD') {
      if (val < 0.0) criticoPixels += count;
      else if (val < 0.3) medioPixels += count;
      else excelentePixels += count;
    } else {
      if (val < 0.3) criticoPixels += count;
      else if (val < 0.5) bajoPixels += count;
      else if (val < 0.7) medioPixels += count;
      else if (val < 0.85) altoPixels += count;
      else excelentePixels += count;
    }

    histogram.push({
      value: parseFloat(val.toFixed(3)),
      count: count
    });
  }

  let distribution = {};
  if (indexType === 'HUMEDAD') {
    distribution = {
      baja: Math.round((criticoPixels / totalPixels) * 100) || 15,
      media: Math.round((medioPixels / totalPixels) * 100) || 50,
      alta: Math.round((excelentePixels / totalPixels) * 100) || 35
    };
  } else {
    distribution = {
      critico: Math.round((criticoPixels / totalPixels) * 100) || 5,
      bajo: Math.round((bajoPixels / totalPixels) * 100) || 15,
      medio: Math.round((medioPixels / totalPixels) * 100) || 40,
      alto: Math.round((altoPixels / totalPixels) * 100) || 30,
      excelente: Math.round((excelentePixels / totalPixels) * 100) || 10
    };

    const sum = distribution.critico + distribution.bajo + distribution.medio + distribution.alto + distribution.excelente;
    if (sum !== 100 && sum > 0) {
      const diff = 100 - sum;
      distribution.medio += diff;
    }
  }

  return { stats, distribution, histogram };
}

// --- ENDPOINT PARA CÁLCULO E IMÁGENES GEE ---
app.post('/api/gee/index', express.json(), async (req, res) => {
  const { coordinates, indexType = 'NDVI', loteId } = req.body;

  if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
    return res.status(400).json({ success: false, error: 'Coordenadas inválidas o ausentes.' });
  }

  const hash = getPolygonHash(coordinates, indexType);

  // 1. Verificar Caché
  const cachedData = await getCachedTile(hash);
  if (cachedData && cachedData.stats && cachedData.histogram) {
    return res.json({
      success: true,
      tileUrl: cachedData.tileUrl,
      avgValue: cachedData.avgValue,
      stats: cachedData.stats,
      distribution: cachedData.distribution,
      histogram: cachedData.histogram,
      cached: true,
      mocked: !geeInitialized
    });
  }

  // Calcular la suma de coordenadas para inicializar los mocks de forma determinista para cada lote
  let sumCoords = 0;
  coordinates.forEach(c => {
    sumCoords += (c[0] || 0) + (c[1] || 0);
  });

  // 2. Fallback a Modo Simulado/Mock si GEE no está inicializado
  if (!geeInitialized) {
    console.log(`[GEE MOCK MODE] Generando datos simulados para el polígono e índice: ${indexType}`);

    const mockData = generateMockHistogramAndStats(indexType, sumCoords);
    const mockTileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    const avgValue = mockData.stats.mean;

    await saveTileToCache(hash, loteId, mockTileUrl, avgValue, indexType, mockData);

    return res.json({
      success: true,
      tileUrl: mockTileUrl,
      avgValue: avgValue,
      stats: mockData.stats,
      distribution: mockData.distribution,
      histogram: mockData.histogram,
      cached: false,
      mocked: true,
      warning: 'Ejecutando en Modo Simulación. Configure GEE_SERVICE_ACCOUNT_KEY en el backend para conectar GEE real.'
    });
  }

  // 3. Procesamiento real en Google Earth Engine
  try {
    console.log(`[GEE ACTIVE] Procesando índice ${indexType} para polígono de ${coordinates.length} vértices`);

    // Invertir coordenadas Leaflet [lat, lng] -> GEE [lng, lat]
    const coordinatesGEE = coordinates.map(coord => [coord[1], coord[0]]);
    const polygonEE = ee.Geometry.Polygon([coordinatesGEE]);

    const endDate = new Date().toISOString().split('T')[0];
    const startDateObj = new Date();
    startDateObj.setMonth(startDateObj.getMonth() - 6);
    const startDate = startDateObj.toISOString().split('T')[0];

    // OPTIMIZACIÓN: Filtrado espacial temprano
    let s2Collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(polygonEE)
      .filterDate(startDate, endDate)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

    const image = s2Collection.median();

    let indexImage;
    let visParams = {};

    if (indexType === 'NDVI') {
      indexImage = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
      visParams = {
        min: 0.1,
        max: 0.85,
        palette: ['#d73027', '#fdae61', '#fee08b', '#d9ef8b', '#66bd63', '#1a9850']
      };
    } else if (indexType === 'NDRE') {
      indexImage = image.normalizedDifference(['B8', 'B5']).rename('NDRE');
      visParams = {
        min: 0.1,
        max: 0.6,
        palette: ['#d73027', '#fdae61', '#fee08b', '#d9ef8b', '#66bd63', '#1a9850']
      };
    } else if (indexType === 'SAVI') {
      indexImage = image.expression(
        '((NIR - RED) / (NIR + RED + 0.5)) * 1.5', {
        'NIR': image.select('B8'),
        'RED': image.select('B4')
      }
      ).rename('SAVI');
      visParams = {
        min: 0.15,
        max: 0.85,
        palette: ['#d73027', '#fdae61', '#fee08b', '#d9ef8b', '#66bd63', '#1a9850']
      };
    } else if (indexType === 'HUMEDAD') {
      indexImage = image.normalizedDifference(['B3', 'B8']).rename('HUMEDAD');
      visParams = {
        min: -0.25,
        max: 0.4,
        palette: ['#ece7f2', '#d0d1e6', '#a6bddb', '#74a9cf', '#3690c0', '#0570b0', '#045a8d', '#023858']
      };
    } else {
      indexImage = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
      visParams = {
        min: 0.1,
        max: 0.85,
        palette: ['#d73027', '#fdae61', '#fee08b', '#d9ef8b', '#66bd63', '#1a9850']
      };
    }

    // OPTIMIZACIÓN: Recorte al final
    const clippedImage = indexImage.clip(polygonEE);

    // Calcular estadísticas (mean, stdDev, min, max, median) combinando reducciones
    const statsReducers = ee.Reducer.mean()
      .combine(ee.Reducer.stdDev(), '', true)
      .combine(ee.Reducer.min(), '', true)
      .combine(ee.Reducer.max(), '', true)
      .combine(ee.Reducer.median(), '', true);

    const statsPromise = new Promise((resolve) => {
      indexImage.reduceRegion({
        reducer: statsReducers,
        geometry: polygonEE,
        scale: 10,
        maxPixels: 1e8
      }).evaluate((result, err) => {
        const bandName = indexType;
        if (err || !result || result[`${bandName}_mean`] === undefined) {
          console.warn(`⚠️ GEE: Error calculando estadísticas regionales de ${indexType}.`);
          resolve(null);
        } else {
          resolve({
            mean: result[`${bandName}_mean`],
            stdDev: result[`${bandName}_stdDev`],
            min: result[`${bandName}_min`],
            max: result[`${bandName}_max`],
            median: result[`${bandName}_median`]
          });
        }
      });
    });

    // Calcular histograma
    const histogramPromise = new Promise((resolve) => {
      indexImage.reduceRegion({
        reducer: ee.Reducer.histogram({
          maxBuckets: 40
        }),
        geometry: polygonEE,
        scale: 10,
        maxPixels: 1e8
      }).evaluate((result, err) => {
        const bandName = indexType;
        if (err || !result || !result[bandName]) {
          console.warn(`⚠️ GEE: Error calculando histograma regional de ${indexType}.`);
          resolve(null);
        } else {
          resolve(result[bandName]);
        }
      });
    });

    const tilePromise = new Promise((resolve, reject) => {
      clippedImage.getMap(visParams, (mapInfo, err) => {
        if (err || !mapInfo || !mapInfo.urlFormat) {
          reject(err || new Error(`No se pudo generar el urlFormat de GEE para ${indexType}`));
        } else {
          resolve(mapInfo.urlFormat);
        }
      });
    });

    const [statsResult, histogramResult, tileUrl] = await Promise.all([statsPromise, histogramPromise, tilePromise]);

    let finalStats = null;
    let finalDistribution = null;
    let finalHistogram = null;

    if (statsResult && histogramResult) {
      const cv = statsResult.mean ? parseFloat(((statsResult.stdDev / statsResult.mean) * 100).toFixed(1)) : 0;
      finalStats = {
        mean: parseFloat(statsResult.mean.toFixed(2)),
        median: parseFloat(statsResult.median.toFixed(2)),
        stdDev: parseFloat(statsResult.stdDev.toFixed(2)),
        min: parseFloat(statsResult.min.toFixed(2)),
        max: parseFloat(statsResult.max.toFixed(2)),
        cv: cv
      };

      const buckets = histogramResult.histogram;
      const bMin = histogramResult.bucketMin;
      const bWidth = histogramResult.bucketWidth;

      let totalPixels = 0;
      let criticoCount = 0;
      let bajoCount = 0;
      let medioCount = 0;
      let altoCount = 0;
      let excelenteCount = 0;

      finalHistogram = buckets.map((count, idx) => {
        const val = bMin + idx * bWidth;
        totalPixels += count;

        if (indexType === 'HUMEDAD') {
          if (val < 0.0) criticoCount += count;
          else if (val < 0.3) medioCount += count;
          else excelenteCount += count;
        } else {
          if (val < 0.3) criticoCount += count;
          else if (val < 0.5) bajoCount += count;
          else if (val < 0.7) medioCount += count;
          else if (val < 0.85) altoCount += count;
          else excelenteCount += count;
        }

        return {
          value: parseFloat(val.toFixed(3)),
          count: count
        };
      });

      if (totalPixels > 0) {
        if (indexType === 'HUMEDAD') {
          finalDistribution = {
            baja: Math.round((criticoCount / totalPixels) * 100),
            media: Math.round((medioCount / totalPixels) * 100),
            alta: Math.round((excelenteCount / totalPixels) * 100)
          };
        } else {
          finalDistribution = {
            critico: Math.round((criticoCount / totalPixels) * 100),
            bajo: Math.round((bajoCount / totalPixels) * 100),
            medio: Math.round((medioCount / totalPixels) * 100),
            alto: Math.round((altoCount / totalPixels) * 100),
            excelente: Math.round((excelenteCount / totalPixels) * 100)
          };

          const sum = finalDistribution.critico + finalDistribution.bajo + finalDistribution.medio + finalDistribution.alto + finalDistribution.excelente;
          if (sum !== 100 && sum > 0) {
            const diff = 100 - sum;
            finalDistribution.medio += diff;
          }
        }
      }
    } else {
      // Fallback a simulación si fallan los reducciones de GEE pero el tile se cargó
      console.warn("⚠️ GEE: Fallback de simulación para histograma y estadísticas.");
      const mock = generateMockHistogramAndStats(indexType, sumCoords);
      finalStats = mock.stats;
      finalDistribution = mock.distribution;
      finalHistogram = mock.histogram;
    }

    const avgValue = finalStats ? finalStats.mean : (statsResult ? parseFloat(statsResult.mean.toFixed(2)) : 0.70);
    const extraData = { stats: finalStats, distribution: finalDistribution, histogram: finalHistogram };

    await saveTileToCache(hash, loteId, tileUrl, avgValue, indexType, extraData);

    return res.json({
      success: true,
      tileUrl: tileUrl,
      avgValue: avgValue,
      stats: finalStats,
      distribution: finalDistribution,
      histogram: finalHistogram,
      cached: false,
      mocked: false
    });

  } catch (geeErr) {
    console.error(`❌ GEE: Falló el procesamiento en la API de Google Earth Engine para ${indexType}:`, geeErr.message);

    const fallbackTile = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    const mock = generateMockHistogramAndStats(indexType, sumCoords);

    return res.json({
      success: true,
      tileUrl: fallbackTile,
      avgValue: mock.stats.mean,
      stats: mock.stats,
      distribution: mock.distribution,
      histogram: mock.histogram,
      cached: false,
      mocked: true,
      error: geeErr.message,
      warning: `Fallo en GEE (${geeErr.message}). Utilizando simulación de contingencia.`
    });
  }
});

// Endpoint de salud
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend proxy is running',
    target: supabaseUrl
  });
});

// =============================================================================
// ENDPOINTS MASTER DATA: PRODUCTOS FITOSANITARIOS
// Deben ir ANTES del proxy para no ser reenviados a Supabase
// =============================================================================

// Helper: cliente Supabase con service_role para queries SQL directas
function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
  return createClient(supabaseUrl, serviceKey);
}

/**
 * GET /api/productos?q=glifosato
 * Búsqueda rápida de productos por nombre comercial o ingrediente activo (autocompletado).
 * Devuelve lista resumida mapeada para la UI.
 */
app.get('/api/productos', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const db = getSupabaseAdmin();

    let query = db
      .from('productos')
      .select(`
        id,
        nombre_producto,
        reg_ica,
        ingrediente_activo,
        concentracion,
        categoria_toxicologica,
        clase_producto,
        tipo_formulacion
      `)
      .limit(15)
      .order('nombre_producto', { ascending: true });

    if (q.length > 0) {
      // Búsqueda en nombre_producto o ingrediente_activo
      query = query.or(`nombre_producto.ilike.%${q}%,ingrediente_activo.ilike.%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[PRODUCTOS SEARCH] Error:', error.message);
      return res.status(500).json({ error: 'Error buscando productos', detail: error.message });
    }

    const result = (data || []).map(p => ({
      id: p.id,
      nombre: p.nombre_producto,
      tipo: p.clase_producto,
      tipo_formulacion: p.tipo_formulacion,
      ingrediente_activo: p.ingrediente_activo,
      concentracion: p.concentracion,
      categoria_toxicologica: p.categoria_toxicologica,
      registro_ica: p.reg_ica || '—',
      fabricante: '—'
    }));

    return res.json(result);
  } catch (err) {
    console.error('[PRODUCTOS SEARCH] Excepción:', err.message);
    return res.status(500).json({ error: 'Error interno', detail: err.message });
  }
});

/**
 * GET /api/productos/:id
 * Detalle completo de un producto mapeado a la estructura que consume el frontend.
 */
app.get('/api/productos/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'ID de producto inválido' });
    }

    const db = getSupabaseAdmin();

    const { data: producto, error: prodErr } = await db
      .from('productos')
      .select(`
        id,
        nombre_producto,
        reg_ica,
        ingrediente_activo,
        concentracion,
        categoria_toxicologica,
        clase_producto,
        tipo_formulacion,
        codigo_frac,
        codigo_irac,
        codigo_hrac,
        grupo_quimico
      `)
      .eq('id', productId)
      .single();

    if (prodErr || !producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Fallbacks locales para alertas de categoría IA/IB si no están en base de datos
    const FALLBACK_ALERTAS = {
      IA: {
        categoria: 'IA',
        titulo: 'PELIGRO EXTREMO (Categoría IA)',
        mensaje: 'Este ingrediente activo es altamente mortal si se inhala o se tiene exposición prolongada. Es extremadamente peligroso para las personas, entomofauna y animales acuáticos. Su manipulación requiere capacitación, uso obligatorio de EPP completo y prescripción por parte de un ingeniero agrónomo.',
        recomendaciones: [
          'Utilizar EPP completo.',
          'No inhalar vapores ni nieblas.',
          'Evitar el contacto con piel y ojos.',
          'No contaminar fuentes de agua.',
          'Mantener fuera del alcance de niños y animales.'
        ]
      },
      IB: {
        categoria: 'IB',
        titulo: 'ALTA TOXICIDAD (Categoría IB)',
        mensaje: 'Este ingrediente activo pertenece a la categoría toxicológica IB. Mortal en exposiciones prolongadas, mortal a la entomofauna y animales acuáticos. Utilice EPP completo y evite cualquier exposición directa durante la preparación y aplicación. Su formulación requiere prescripción por parte de un ingeniero agrónomo.',
        recomendaciones: [
          'Utilizar EPP completo.',
          'No inhalar vapores ni nieblas.',
          'Evitar el contacto con piel y ojos.',
          'No contaminar fuentes de agua.',
          'Mantener fuera del alcance de niños y animales.'
        ]
      }
    };

    // Intentar cargar relaciones
    let ingredientes = [];
    try {
      const { data: rels, error: relsErr } = await db
        .from('producto_ingrediente')
        .select(`
          ingrediente:ingredientes (
            id,
            nombre,
            propiedades (
              categoria_toxicologica,
              titulo_alerta,
              mensaje_alerta,
              recomendaciones
            )
          )
        `)
        .eq('producto_id', productId);

      if (!relsErr && rels && rels.length > 0) {
        ingredientes = rels.map(r => {
          const ing = r.ingrediente;
          if (!ing) return null;

          // Buscar propiedad que coincida con la categoría toxicológica del producto
          const targetCat = (producto.categoria_toxicologica || '').toUpperCase().trim();
          const prop = Array.isArray(ing.propiedades)
            ? ing.propiedades.find(p => (p.categoria_toxicologica || '').toUpperCase().trim() === targetCat)
            : null;

          let alerta = null;
          if (prop) {
            alerta = {
              categoria: prop.categoria_toxicologica,
              titulo: prop.titulo_alerta,
              mensaje: prop.mensaje_alerta,
              recomendaciones: prop.recomendaciones
            };
          } else if (targetCat === 'IA' || targetCat === 'IB' || targetCat === '1A' || targetCat === '1B') {
            const normalCat = targetCat.includes('A') ? 'IA' : 'IB';
            alerta = FALLBACK_ALERTAS[normalCat];
          }

          return {
            nombre: ing.nombre,
            concentracion: producto.concentracion || '',
            grupo_quimico: (producto.grupo_quimico || '').replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim() || '—',
            registro_ica: producto.reg_ica || '—',
            frac: (producto.codigo_frac || '').replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim() || '—',
            irac: (producto.codigo_irac || '').replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim() || '—',
            hrac: (producto.codigo_hrac || '').replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim() || '—',
            funcion: producto.clase_producto || '—',
            carencia_dias: 0,
            residualidad_dias: 0,
            cat_toxicologica: producto.categoria_toxicologica || '—',
            alerta
          };
        }).filter(Boolean);
      }
    } catch (err) {
      console.warn('[PRODUCTOS DETAIL] Error consultando relación ingredientes:', err.message);
    }

    // Fallback si no hay ingredientes asociados en la tabla intermedia
    if (ingredientes.length === 0) {
      const targetCat = (producto.categoria_toxicologica || '').toUpperCase().trim();
      let alerta = null;
      if (targetCat === 'IA' || targetCat === 'IB' || targetCat === '1A' || targetCat === '1B') {
        const normalCat = targetCat.includes('A') ? 'IA' : 'IB';
        alerta = FALLBACK_ALERTAS[normalCat];
      }

      ingredientes = [{
        nombre: producto.ingrediente_activo || '',
        concentracion: producto.concentracion || '',
        grupo_quimico: (producto.grupo_quimico || '').replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim() || '—',
        registro_ica: producto.reg_ica || '—',
        frac: (producto.codigo_frac || '').replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim() || '—',
        irac: (producto.codigo_irac || '').replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim() || '—',
        hrac: (producto.codigo_hrac || '').replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim() || '—',
        funcion: producto.clase_producto || '—',
        carencia_dias: 0,
        residualidad_dias: 0,
        cat_toxicologica: producto.categoria_toxicologica || '—',
        alerta
      }];
    }

    return res.json({
      id: producto.id,
      nombre: producto.nombre_producto,
      fabricante: '—',
      tipo: producto.clase_producto,
      tipo_formulacion: producto.tipo_formulacion,
      dosis_recomendada: 0,
      dosis_max: 0,
      unidad_dosis: 'L/ha',
      costo_estimado: 0,
      registro_ica: producto.reg_ica || '—',
      ingredientes,
      carencia_dias: 0,
      residualidad_dias: 0
    });
  } catch (err) {
    console.error('[PRODUCTOS DETAIL] Excepción:', err.message);
    return res.status(500).json({ error: 'Error interno', detail: err.message });
  }
});

// =============================================================================
// FIN ENDPOINTS MASTER DATA
// =============================================================================

// =============================================================================
// ENDPOINT AUDITORÍA: CONFIRMACIÓN DE ADVERTENCIA ALTA TOXICIDAD (IA/IB)
// =============================================================================

/**
 * POST /api/auditoria/alta-toxicidad
 * Registra en Supabase la confirmación del profesional responsable de haber
 * leído y aceptado las advertencias de seguridad de ingredientes IA/IB antes
 * de generar una prescripción fitosanitaria.
 *
 * Body esperado:
 *   {
 *     aplicacion_id         : string,
 *     usuario_id            : string  (opcional, default 'anonimo'),
 *     ingredientes          : [{ nombre, categoria }],
 *     advertencia_confirmada: boolean,
 *     declaracion_profesional: boolean,
 *     geolocalizacion       : { lat, lng, accuracy } | null
 *   }
 */
app.post('/api/auditoria/alta-toxicidad', express.json(), async (req, res) => {
  try {
    const {
      aplicacion_id,
      usuario_id = 'anonimo',
      ingredientes = [],
      advertencia_confirmada = false,
      declaracion_profesional = false,
      geolocalizacion = null
    } = req.body;

    if (!aplicacion_id) {
      return res.status(400).json({ error: 'aplicacion_id es requerido.' });
    }

    // Capturar IP real (soporte para proxies / Vercel / Cloudflare)
    const ip_cliente =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      null;

    // Extraer categorías únicas de los ingredientes
    const categorias_toxicologicas = [
      ...new Set((ingredientes).map(i => (i.categoria || '').toUpperCase()).filter(Boolean))
    ];

    const db = getSupabaseAdmin();

    const { data, error } = await db
      .from('auditoria_prescripcion_alta_toxicidad')
      .insert([{
        usuario_id,
        aplicacion_id,
        ingredientes_detectados: ingredientes,
        categorias_toxicologicas,
        advertencia_confirmada,
        declaracion_profesional,
        ip_cliente,
        geolocalizacion: geolocalizacion || null,
        created_at: new Date().toISOString()
      }])
      .select('id')
      .single();

    if (error) {
      console.error('[AUDITORÍA AT] Error insertando registro:', error.message);
      return res.status(500).json({ error: 'Error al registrar la auditoría.', detail: error.message });
    }

    console.log(`[AUDITORÍA AT] Registro guardado. ID: ${data.id} | App: ${aplicacion_id} | IP: ${ip_cliente}`);
    return res.json({ success: true, audit_id: data.id });

  } catch (err) {
    console.error('[AUDITORÍA AT] Excepción:', err.message);
    return res.status(500).json({ error: 'Error interno al registrar auditoría.', detail: err.message });
  }
});

// =============================================================================
// FIN AUDITORÍA
// =============================================================================

// =============================================================================
// ENDPOINT AUDITORÍA: CAMBIO DE ESTADO DE APLICACIÓN
// Completa el registro de auditoría generado por el trigger PostgreSQL añadiendo
// la IP real del cliente y el User-Agent (no accesibles desde un trigger).
// =============================================================================

/**
 * POST /api/auditoria/estado-aplicacion
 *
 * Body esperado:
 *   { aplicacion_id: string (UUID) }
 *
 * El trigger trg_auditoria_estado ya insertó la fila en auditoria_aplicaciones.
 * Este endpoint llama a rpc_completar_auditoria para añadir ip_address y user_agent.
 */
app.post('/api/auditoria/estado-aplicacion', express.json(), async (req, res) => {
  try {
    const { aplicacion_id } = req.body;

    if (!aplicacion_id) {
      return res.status(400).json({ error: 'aplicacion_id es requerido.' });
    }

    // Capturar IP real (soporte para proxies / Vercel / Cloudflare)
    const ip_address =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      null;

    const user_agent = req.headers['user-agent'] || null;

    const db = getSupabaseAdmin();

    const { error } = await db.rpc('rpc_completar_auditoria', {
      p_aplicacion_id: aplicacion_id,
      p_ip_address:    ip_address,
      p_user_agent:    user_agent
    });

    if (error) {
      console.warn('[AUDITORÍA ESTADO] RPC falló:', error.message);
      // No retornar error al cliente — la auditoría básica ya fue guardada por el trigger
    } else {
      console.log(`[AUDITORÍA ESTADO] IP capturada para app ${aplicacion_id}: ${ip_address}`);
    }

    return res.json({ success: true });

  } catch (err) {
    console.error('[AUDITORÍA ESTADO] Excepción:', err.message);
    // No bloquear al cliente — es un enriquecimiento opcional
    return res.json({ success: false, detail: err.message });
  }
});


// Middleware de Proxy para interceptar peticiones a Supabase (usando interfaz legacy)
app.use('/api', legacyCreateProxyMiddleware({
  target: supabaseUrl,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '', // Quitar el prefijo /api antes de redirigir a Supabase
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log('--- NUEVA PETICION PROXY ---');
    console.log('URL original:', req.url);
    console.log('Headers recibidos:', req.headers);

    // Reemplazar la API key de prueba por la clave real de Supabase
    const apiKey = req.headers['apikey'];
    if (apiKey === 'dummy-key' || !apiKey) {
      proxyReq.setHeader('apikey', supabaseAnonKey);
    }

    // Si la autorización es con la dummy key, reemplazarla por la real.
    // Si no hay cabecera de autorización (usuario no autenticado), no enviamos nada
    // para evitar errores con claves que no son JWT (ej. sb_publishable_*).
    const auth = req.headers['authorization'];
    if (auth === 'Bearer dummy-key') {
      proxyReq.setHeader('authorization', `Bearer ${supabaseAnonKey}`);
    } else if (auth) {
      // Si el cliente envía un JWT real de usuario, nos aseguramos de mantenerlo
      proxyReq.setHeader('authorization', auth);
    }

    // Evitar problemas de compresión en las respuestas
    proxyReq.setHeader('accept-encoding', 'identity');

    console.log('Headers enviados a Supabase:', proxyReq.getHeaders());
  },
  onError: (err, req, res) => {
    console.error('Error en el proxy de Supabase:', err);
    res.status(500).json({ error: 'Proxy Error', message: err.message });
  }
}));

// Exportar para Vercel
export default app;
