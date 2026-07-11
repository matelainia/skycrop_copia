import express from 'express';
import cors from 'cors';
import { legacyCreateProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import ee from '@google/earthengine';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { createClerkClient } from '@clerk/backend';
import { Webhook } from 'svix';

// Cargar variables de entorno localmente si están disponibles
dotenv.config();

const app = express();

// --- CONFIGURACIÓN DE CLERK Y JWT DE SUPABASE ---
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY || 'sk_test_mock_secret_key_for_local_development',
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_mock_publishable_key',
});

const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET || 'super-secret-supabase-jwt-key-change-me-in-prod';
const jwtCache = new Map();

function getCachedSupabaseToken(userId) {
  const cached = jwtCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[JWT CACHE HIT] Reutilizando token de Supabase para usuario: ${userId}`);
    return cached.token;
  }
  return null;
}

function cacheSupabaseToken(userId, token, expiresInMs = 10 * 60 * 1000) {
  jwtCache.set(userId, {
    token,
    expiresAt: Date.now() + expiresInMs
  });
}

function generateSupabaseJwt(userId, email, empresaId, roleId) {
  const payload = {
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 60 * 15, // Válido por 15 minutos
    sub: userId,
    email: email,
    role: 'authenticated',
    app_metadata: {
      provider: 'clerk',
      providers: ['clerk']
    },
    user_metadata: {},
    empresa_id: empresaId,
    rol_id: roleId
  };
  
  return jwt.sign(payload, supabaseJwtSecret);
}

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

// Memoria caché en backend como contingencia
const weatherMemoryCache = new Map();

// Endpoint de Clima Inteligente (V1)
app.get('/api/weather', async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, error: 'Coordenadas (latitude y longitude) son requeridas.' });
    }

    const latVal = parseFloat(latitude);
    const lonVal = parseFloat(longitude);

    if (isNaN(latVal) || isNaN(lonVal)) {
      return res.status(400).json({ success: false, error: 'Coordenadas numéricas inválidas.' });
    }

    // Hash de coordenadas redondeado a 3 decimales (grilla ~110m)
    const roundedLat = latVal.toFixed(3);
    const roundedLon = lonVal.toFixed(3);
    const coordHash = `${roundedLat}_${roundedLon}`;
    const now = new Date();

    // 1. Intentar obtener desde caché en Supabase
    const db = getSupabaseAdmin();
    if (db) {
      try {
        const { data, error } = await db
          .from('clima_cache')
          .select('weather_data, expires_at')
          .eq('coord_hash', coordHash)
          .single();

        if (!error && data) {
          const expiresAt = new Date(data.expires_at);
          if (expiresAt > now) {
            console.log(`[WEATHER CACHE HIT - PostgreSQL] coords: ${coordHash}`);
            const cachedResponse = data.weather_data;
            cachedResponse.metadata.cached = true;
            return res.json(cachedResponse);
          }
        }
      } catch (dbErr) {
        console.warn(`[WEATHER CACHE] Error consultando Supabase, usando contingencia:`, dbErr.message);
      }
    }

    // 2. Intentar obtener desde caché en memoria del backend
    if (weatherMemoryCache.has(coordHash)) {
      const cached = weatherMemoryCache.get(coordHash);
      if (cached.expiresAt > now.getTime()) {
        console.log(`[WEATHER CACHE HIT - Memoria] coords: ${coordHash}`);
        const cachedResponse = cached.data;
        cachedResponse.metadata.cached = true;
        return res.json(cachedResponse);
      } else {
        weatherMemoryCache.delete(coordHash);
      }
    }

    // 3. Consultar la API correspondiente (Google Weather API o Open-Meteo como fallback)
    const googleApiKey = process.env.GOOGLE_WEATHER_API_KEY;
    let normalized;

    // Helper para mapear tipos de Google a WMO
    const mapGoogleTypeToWmo = (type) => {
      switch (type?.toUpperCase()) {
        case 'CLEAR': return 0;
        case 'MOSTLY_CLEAR': return 1;
        case 'PARTLY_CLOUDY': return 2;
        case 'MOSTLY_CLOUDY': return 3;
        case 'CLOUDY': return 3;
        case 'FOG': return 45;
        case 'DRIZZLE': return 51;
        case 'LIGHT_RAIN': return 61;
        case 'RAIN': return 63;
        case 'HEAVY_RAIN': return 65;
        case 'SHOWER': return 80;
        case 'STORM': return 95;
        case 'THUNDERSTORM': return 95;
        case 'SNOW': return 71;
        case 'HAIL': return 77;
        default: return 1;
      }
    };

    const generatedAtStr = now.toISOString();
    const expiresAtMs = now.getTime() + 15 * 60 * 1000; // 15 minutos
    const expiresAtStr = new Date(expiresAtMs).toISOString();

    if (googleApiKey) {
      console.log(`[WEATHER API FETCH] Consultando Google Weather API para coords: ${roundedLat}, ${roundedLon}`);
      
      const currentUrl = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${googleApiKey}&location.latitude=${roundedLat}&location.longitude=${roundedLon}`;
      const hourlyUrl = `https://weather.googleapis.com/v1/forecast/hours:lookup?key=${googleApiKey}&location.latitude=${roundedLat}&location.longitude=${roundedLon}&hours=24`;
      const dailyUrl = `https://weather.googleapis.com/v1/forecast/days:lookup?key=${googleApiKey}&location.latitude=${roundedLat}&location.longitude=${roundedLon}&days=7`;

      const [resCurrent, resHourly, resDaily] = await Promise.all([
        fetch(currentUrl).then(r => r.ok ? r.json() : null),
        fetch(hourlyUrl).then(r => r.ok ? r.json() : null),
        fetch(dailyUrl).then(r => r.ok ? r.json() : null)
      ]);

      if (!resCurrent) {
        throw new Error('Google Weather API falló al retornar condiciones actuales o la API key es inválida.');
      }

      const currentWind = resCurrent.wind?.speed?.value || 0;
      const currentRain = resCurrent.precipitation?.qpf?.quantity || 0;
      const currentUv = resCurrent.uvIndex || 0;

      // Mapear alertas
      const alerts = [];
      if (currentWind > 20) {
        alerts.push({
          type: 'wind',
          severity: 'warn',
          title: 'Rachas de viento moderadas',
          message: `Vientos de hasta ${currentWind.toFixed(1)} km/h detectados por Google Weather.`
        });
      }
      if (currentRain > 2.0) {
        alerts.push({
          type: 'rain',
          severity: 'danger',
          title: 'Lluvia persistente',
          message: `Precipitación de ${currentRain.toFixed(1)} mm detectada por Google Weather.`
        });
      }
      if (currentUv >= 8) {
        alerts.push({
          type: 'uv',
          severity: 'warn',
          title: 'Índice UV Extremo',
          message: `Radiación UV solar de ${currentUv.toFixed(1)} (Evitar exposición).`
        });
      }

      // Mapear pronóstico horario (24 horas)
      const hourlyData = [];
      if (resHourly && Array.isArray(resHourly.forecastHours)) {
        const limit = Math.min(resHourly.forecastHours.length, 24);
        for (let i = 0; i < limit; i++) {
          const h = resHourly.forecastHours[i];
          hourlyData.push({
            time: h.forecastTime,
            temperature: h.temperature?.degrees || 0,
            precipitationProbability: h.precipitation?.probability?.percent || 0,
            relativeHumidity: h.relativeHumidity || 80,
            windSpeed: h.wind?.speed?.value || 0
          });
        }
      }

      // Mapear pronóstico diario (7 días)
      const dailyData = [];
      if (resDaily && Array.isArray(resDaily.forecastDays)) {
        const limit = Math.min(resDaily.forecastDays.length, 7);
        for (let i = 0; i < limit; i++) {
          const d = resDaily.forecastDays[i];
          const year = d.displayDate?.year;
          const month = String(d.displayDate?.month || 1).padStart(2, '0');
          const dayNum = String(d.displayDate?.day || 1).padStart(2, '0');
          const dateStr = `${year}-${month}-${dayNum}`;

          dailyData.push({
            date: dateStr,
            temperatureMax: d.daytimeForecast?.temperature?.degrees || d.temperatureMax?.degrees || 30,
            temperatureMin: d.nighttimeForecast?.temperature?.degrees || d.temperatureMin?.degrees || 20,
            precipitationProbability: d.daytimeForecast?.precipitation?.probability?.percent || 0,
            weatherCode: mapGoogleTypeToWmo(d.daytimeForecast?.weatherCondition?.type)
          });
        }
      }

      normalized = {
        version: 1,
        metadata: {
          provider: 'google-weather-api',
          generatedAt: generatedAtStr,
          cached: false,
          expires: expiresAtStr,
          location: {
            lat: latVal,
            lon: lonVal
          },
          timezone: resCurrent.timeZone?.id || 'America/Bogota'
        },
        current: {
          temperature: resCurrent.temperature?.degrees || 0,
          apparentTemperature: resCurrent.feelsLikeTemperature?.degrees || resCurrent.temperature?.degrees || 0,
          relativeHumidity: resCurrent.relativeHumidity || 0,
          windSpeed: currentWind,
          windDirection: resCurrent.wind?.direction?.degrees || 0,
          pressure: resCurrent.pressure || 1013,
          precipitationProbability: resCurrent.precipitation?.probability?.percent || 0,
          uvIndex: currentUv,
          visibility: resCurrent.visibility?.distance || 10,
          dewPoint: resCurrent.dewPoint?.degrees || 0,
          weatherCode: mapGoogleTypeToWmo(resCurrent.weatherCondition?.type)
        },
        hourly: hourlyData,
        daily: dailyData,
        alerts: alerts
      };

    } else {
      console.log(`[WEATHER API FETCH] Consultando Open-Meteo (contingencia) para coords: ${roundedLat}, ${roundedLon}`);
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${roundedLat}&longitude=${roundedLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m,uv_index,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant&timezone=auto`;

      const apiResponse = await fetch(weatherUrl);
      if (!apiResponse.ok) {
        throw new Error(`Open-Meteo respondió con estado ${apiResponse.status}`);
      }

      const raw = await apiResponse.json();

      const currentWind = raw.current?.wind_speed_10m || 0;
      const currentRain = raw.current?.rain || raw.current?.precipitation || 0;
      const currentUv = raw.hourly?.uv_index ? raw.hourly.uv_index[0] : 0;

      const alerts = [];
      if (currentWind > 20) {
        alerts.push({
          type: 'wind',
          severity: 'warn',
          title: 'Rachas de viento moderadas',
          message: `Vientos de hasta ${currentWind.toFixed(1)} km/h en curso. Tenga precaución con aplicaciones y derivas.`
        });
      }
      if (currentRain > 2.0) {
        alerts.push({
          type: 'rain',
          severity: 'danger',
          title: 'Lluvia persistente',
          message: `Precipitación de ${currentRain.toFixed(1)} mm detectada. Alto riesgo de lavado para fitosanitarios.`
        });
      }
      if (currentUv >= 8) {
        alerts.push({
          type: 'uv',
          severity: 'warn',
          title: 'Índice UV Extremo',
          message: `Radiación UV solar de ${currentUv.toFixed(1)}. Evite la exposición prolongada de operarios en campo.`
        });
      }

      const hourlyData = [];
      if (raw.hourly && Array.isArray(raw.hourly.time)) {
        const limit = Math.min(raw.hourly.time.length, 24);
        for (let i = 0; i < limit; i++) {
          hourlyData.push({
            time: raw.hourly.time[i],
            temperature: raw.hourly.temperature_2m[i],
            precipitationProbability: raw.hourly.precipitation_probability ? raw.hourly.precipitation_probability[i] : 0,
            relativeHumidity: raw.hourly.relative_humidity_2m[i],
            windSpeed: raw.hourly.wind_speed_10m[i]
          });
        }
      }

      const dailyData = [];
      if (raw.daily && Array.isArray(raw.daily.time)) {
        const limit = Math.min(raw.daily.time.length, 7);
        for (let i = 0; i < limit; i++) {
          dailyData.push({
            date: raw.daily.time[i],
            temperatureMax: raw.daily.temperature_2m_max[i],
            temperatureMin: raw.daily.temperature_2m_min[i],
            precipitationProbability: raw.daily.precipitation_probability_max ? raw.daily.precipitation_probability_max[i] : 0,
            weatherCode: raw.daily.weather_code[i]
          });
        }
      }

      normalized = {
        version: 1,
        metadata: {
          provider: 'open-meteo',
          generatedAt: generatedAtStr,
          cached: false,
          expires: expiresAtStr,
          location: {
            lat: latVal,
            lon: lonVal
          },
          timezone: raw.timezone || 'America/Bogota'
        },
        current: {
          temperature: raw.current?.temperature_2m || 0,
          apparentTemperature: raw.current?.apparent_temperature || raw.current?.temperature_2m || 0,
          relativeHumidity: raw.current?.relative_humidity_2m || 0,
          windSpeed: currentWind,
          windDirection: raw.current?.wind_direction_10m || 0,
          pressure: raw.current?.pressure_msl || 1013,
          precipitationProbability: raw.hourly?.precipitation_probability ? raw.hourly.precipitation_probability[0] : 0,
          uvIndex: currentUv,
          visibility: raw.hourly?.visibility ? (raw.hourly.visibility[0] / 1000) : 10,
          dewPoint: raw.hourly?.dew_point_2m ? raw.hourly.dew_point_2m[0] : 0,
          weatherCode: raw.current?.weather_code || 0
        },
        hourly: hourlyData,
        daily: dailyData,
        alerts: alerts
      };
    }

    // 5. Guardar en cachés
    if (db) {
      try {
        await db.from('clima_cache').upsert([{
          coord_hash: coordHash,
          latitude: latVal,
          longitude: lonVal,
          weather_data: normalized,
          expires_at: expiresAtStr
        }], { onConflict: 'coord_hash' });
        console.log(`[WEATHER CACHE SET - PostgreSQL] coords: ${coordHash}`);
      } catch (dbErr) {
        console.warn(`[WEATHER CACHE SET] Error insertando en Supabase (¿falta ejecutar script SQL?):`, dbErr.message);
      }
    }

    weatherMemoryCache.set(coordHash, {
      data: normalized,
      expiresAt: expiresAtMs
    });
    console.log(`[WEATHER CACHE SET - Memoria] coords: ${coordHash}`);

    return res.json(normalized);

  } catch (err) {
    console.error('❌ [WEATHER ERROR] Falló la API de clima:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Error interno al consultar datos del clima.',
      detail: err.message
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



// Webhook de Clerk para sincronización de usuarios, empresas y roles
app.post('/api/webhooks/clerk', express.raw({ type: 'application/json' }), async (req, res) => {
  const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!SIGNING_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET no está configurada.');
    return res.status(500).json({ error: 'Webhook secret is not configured' });
  }

  // Obtener headers de svix
  const svix_id = req.headers['svix-id'];
  const svix_timestamp = req.headers['svix-timestamp'];
  const svix_signature = req.headers['svix-signature'];

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).json({ error: 'Faltan headers de Svix' });
  }

  // El cuerpo debe ser raw para verificar la firma
  const payload = req.body.toString();
  const headers = {
    'svix-id': svix_id,
    'svix-timestamp': svix_timestamp,
    'svix-signature': svix_signature,
  };

  const wh = new Webhook(SIGNING_SECRET);
  let evt;

  try {
    evt = wh.verify(payload, headers);
  } catch (err) {
    console.error('Firma de webhook de Clerk no válida:', err.message);
    return res.status(400).json({ error: 'Firma inválida' });
  }

  const { id: userId, email_addresses, first_name, last_name } = evt.data;
  const eventType = evt.type;
  const email = email_addresses?.[0]?.email_address || '';

  const db = getSupabaseAdmin();

  try {
    if (eventType === 'user.created') {
      console.log(`[Clerk Webhook] Creando usuario: ${userId} (${email})`);
      
      // 1. Crear una nueva empresa por defecto para el usuario nuevo
      const empresaNombre = `Mi Empresa de ${first_name || 'Cultivo'}`;
      const { data: empresa, error: empErr } = await db
        .from('empresas')
        .insert([{ nombre: empresaNombre }])
        .select()
        .single();
        
      if (empErr) {
        console.error('Error creando empresa:', empErr.message);
        throw empErr;
      }

      // 2. Insertar usuario en Supabase con rol administrador
      const { error: usrErr } = await db
        .from('usuarios')
        .insert([{
          id: userId,
          email: email,
          nombre: first_name || '',
          apellido: last_name || '',
          empresa_id: empresa.id,
          rol_id: 'administrador'
        }]);

      if (usrErr) {
        console.error('Error creando usuario en Supabase:', usrErr.message);
        throw usrErr;
      }

      // 3. Escribir metadatos privados en Clerk
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
          empresa_id: empresa.id,
          rol_id: 'administrador'
        }
      });
      
      console.log(`[Clerk Webhook] Sincronización exitosa para user.created: ${userId}`);

    } else if (eventType === 'user.updated') {
      console.log(`[Clerk Webhook] Actualizando usuario: ${userId}`);
      
      const { error: usrErr } = await db
        .from('usuarios')
        .update({
          nombre: first_name || '',
          apellido: last_name || '',
          email: email
        })
        .eq('id', userId);

      if (usrErr) {
        console.error('Error actualizando usuario en Supabase:', usrErr.message);
        throw usrErr;
      }
      
      console.log(`[Clerk Webhook] Sincronización exitosa para user.updated: ${userId}`);

    } else if (eventType === 'user.deleted') {
      console.log(`[Clerk Webhook] Eliminando usuario: ${userId}`);
      
      const { error: usrErr } = await db
        .from('usuarios')
        .delete()
        .eq('id', userId);

      if (usrErr) {
        console.error('Error eliminando usuario de Supabase:', usrErr.message);
        throw usrErr;
      }
      
      console.log(`[Clerk Webhook] Sincronización exitosa para user.deleted: ${userId}`);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Excepción procesando webhook de Clerk:', err.message);
    return res.status(500).json({ error: 'Internal Server Error', detail: err.message });
  }
});

// Endpoint para obtener el perfil completo y el JWT de Supabase
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado. Token de Clerk faltante.' });
    }
    const clerkToken = authHeader.split(' ')[1];

    // Verificar token con Clerk
    let requestState;
    try {
      requestState = await clerkClient.verifyToken(clerkToken);
    } catch (err) {
      console.error('Error al verificar token con Clerk:', err.message);
      return res.status(401).json({ error: 'Token de Clerk inválido o expirado.' });
    }

    const clerkUserId = requestState.sub;
    const email = requestState.email || '';

    // Intentar obtener del caché primero
    const cachedToken = getCachedSupabaseToken(clerkUserId);
    if (cachedToken) {
      const { data: usuario, error: uErr } = await getSupabaseAdmin()
        .from('usuarios')
        .select('*, empresas(*), roles(*)')
        .eq('id', clerkUserId)
        .single();

      if (!uErr && usuario) {
        const { data: permisos } = await getSupabaseAdmin()
          .from('permisos')
          .select('*')
          .eq('rol_id', usuario.rol_id);

        return res.json({
          user: {
            id: usuario.id,
            email: usuario.email,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            empresa_id: usuario.empresa_id,
            rol_id: usuario.rol_id,
            created_at: usuario.created_at
          },
          empresa: usuario.empresas,
          role: usuario.roles,
          permissions: permisos || [],
          supabaseToken: cachedToken
        });
      }
    }

    // Si no está en caché, obtener de Supabase y generar nuevo token
    let { data: usuario, error: uErr } = await getSupabaseAdmin()
      .from('usuarios')
      .select('*, empresas(*), roles(*)')
      .eq('id', clerkUserId)
      .single();

    if (uErr || !usuario) {
      console.warn(`Usuario ${clerkUserId} no encontrado en Supabase. Intentando sincronización bajo demanda...`);
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      const userEmail = clerkUser.emailAddresses[0]?.emailAddress || email;

      const { data: nuevaEmpresa, error: empErr } = await db
        .from('empresas')
        .insert([{ nombre: `Mi Empresa de ${clerkUser.firstName || 'Cultivo'}` }])
        .select()
        .single();

      if (empErr) throw empErr;

      const { data: nuevoUsuario, error: insErr } = await db
        .from('usuarios')
        .insert([{
          id: clerkUserId,
          email: userEmail,
          nombre: clerkUser.firstName,
          apellido: clerkUser.lastName,
          empresa_id: nuevaEmpresa.id,
          rol_id: 'administrador'
        }])
        .select('*, empresas(*), roles(*)')
        .single();

      if (insErr) throw insErr;
      usuario = nuevoUsuario;

      await clerkClient.users.updateUserMetadata(clerkUserId, {
        privateMetadata: {
          empresa_id: nuevaEmpresa.id,
          rol_id: 'administrador'
        }
      });
    }

    const { data: permisos } = await getSupabaseAdmin()
      .from('permisos')
      .select('*')
      .eq('rol_id', usuario.rol_id);

    const supabaseToken = generateSupabaseJwt(
      usuario.id,
      usuario.email,
      usuario.empresa_id,
      usuario.rol_id
    );

    cacheSupabaseToken(usuario.id, supabaseToken);

    return res.json({
      user: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        empresa_id: usuario.empresa_id,
        rol_id: usuario.rol_id,
        created_at: usuario.created_at
      },
      empresa: usuario.empresas,
      role: usuario.roles,
      permissions: permisos || [],
      supabaseToken
    });

  } catch (err) {
    console.error('Excepción en /api/auth/me:', err);
    return res.status(500).json({ error: 'Internal Server Error', detail: err.message });
  }
});

// Middleware para traducir el token de Clerk al token de Supabase con RLS en el Proxy
app.use('/api', async (req, res, next) => {
  // Ignorar endpoints que son locales y no deben ir al proxy de Supabase
  if (req.path === '/webhooks/clerk' || req.path === '/auth/me' || req.path === '/auditoria/estado-aplicacion') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ') && authHeader !== 'Bearer dummy-key') {
    const clerkToken = authHeader.split(' ')[1];
    
    try {
      const requestState = await clerkClient.verifyToken(clerkToken);
      const clerkUserId = requestState.sub;
      
      let supabaseToken = getCachedSupabaseToken(clerkUserId);
      
      if (!supabaseToken) {
        const { data: usuario } = await getSupabaseAdmin()
          .from('usuarios')
          .select('id, email, empresa_id, rol_id')
          .eq('id', clerkUserId)
          .single();
          
        if (usuario) {
          supabaseToken = generateSupabaseJwt(
            usuario.id,
            usuario.email,
            usuario.empresa_id,
            usuario.rol_id
          );
          cacheSupabaseToken(clerkUserId, supabaseToken);
        }
      }
      
      if (supabaseToken) {
        req.headers['authorization'] = `Bearer ${supabaseToken}`;
        // Reemplazar la apikey en el header
        req.headers['apikey'] = process.env.SUPABASE_ANON_KEY;
      }
    } catch (err) {
      console.warn('[PROXY AUTH] Error traduciendo token de Clerk:', err.message);
      return res.status(401).json({ error: 'Token de autenticación inválido o expirado.' });
    }
  }
  
  next();
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
