import ee from '@google/earthengine';
import { GeeServicePort } from '../../../domain/ports/GeeServicePort.js';
import env from '../../../../shared/config/env.js';
import { ExternalApiError } from '../../../../shared/errors/AppErrors.js';

export class EarthEngineServiceAdapter extends GeeServicePort {
  constructor() {
    super();
    this.geeInitialized = false;
    this.geeInitializationError = null;
    this.initialize();
  }

  async initialize() {
    const serviceAccountKey = env.GEE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      console.warn(
        '⚠️ GEE: GEE_SERVICE_ACCOUNT_KEY no está configurada en las variables de entorno. Ejecutando en Modo Simulación.'
      );
      this.geeInitializationError = 'GEE_SERVICE_ACCOUNT_KEY is missing';
      return;
    }

    try {
      let privateKey;
      try {
        privateKey = JSON.parse(serviceAccountKey);
      } catch (parseErr) {
        console.warn(
          '⚠️ GEE: Cuenta de servicio no es un JSON limpio directamente. Reemplazando retornos...'
        );
        privateKey = JSON.parse(serviceAccountKey.replace(/\\n/g, '\n'));
      }

      console.log('🔄 GEE: Iniciando autenticación con Google Earth Engine...');

      await new Promise((resolve, reject) => {
        ee.data.authenticateViaPrivateKey(
          privateKey,
          () => {
            ee.initialize(
              null,
              null,
              () => {
                this.geeInitialized = true;
                console.log('✅ GEE: Google Earth Engine inicializado y autenticado con éxito!');
                resolve();
              },
              (err) => {
                console.error('❌ GEE: Fallo durante la inicialización:', err);
                reject(err);
              }
            );
          },
          (err) => {
            console.error('❌ GEE: Fallo durante la autenticación de la llave privada:', err);
            reject(err);
          }
        );
      });
    } catch (err) {
      this.geeInitializationError = err.message;
      console.error('⚠️ GEE: Error en la inicialización de Earth Engine:', err.message);
    }
  }

  isInitialized() {
    return this.geeInitialized;
  }

  getInitializationError() {
    return this.geeInitializationError;
  }

  async processIndex(coordinates, indexType, sumCoords) {
    if (!this.geeInitialized) {
      throw new Error('Servicio de Google Earth Engine no está inicializado.');
    }

    try {
      console.log(
        `[EarthEngineServiceAdapter] Procesando índice ${indexType} para polígono de ${coordinates.length} vértices`
      );

      // Invertir coordenadas Leaflet [lat, lng] -> GEE [lng, lat]
      const coordinatesGEE = coordinates.map((coord) => [coord[1], coord[0]]);
      const polygonEE = ee.Geometry.Polygon([coordinatesGEE]);

      const endDate = new Date().toISOString().split('T')[0];
      const startDateObj = new Date();
      startDateObj.setMonth(startDateObj.getMonth() - 6);
      const startDate = startDateObj.toISOString().split('T')[0];

      // Filtrado espacial temprano
      let s2Collection = ee
        .ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
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
        indexImage = image
          .expression('((NIR - RED) / (NIR + RED + 0.5)) * 1.5', {
            NIR: image.select('B8'),
            RED: image.select('B4')
          })
          .rename('SAVI');
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
          palette: [
            '#ece7f2',
            '#d0d1e6',
            '#a6bddb',
            '#74a9cf',
            '#3690c0',
            '#0570b0',
            '#045a8d',
            '#023858'
          ]
        };
      } else {
        indexImage = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
        visParams = {
          min: 0.1,
          max: 0.85,
          palette: ['#d73027', '#fdae61', '#fee08b', '#d9ef8b', '#66bd63', '#1a9850']
        };
      }

      const clippedImage = indexImage.clip(polygonEE);

      // Calcular estadísticas regionalizadas
      const statsReducers = ee.Reducer.mean()
        .combine(ee.Reducer.stdDev(), '', true)
        .combine(ee.Reducer.min(), '', true)
        .combine(ee.Reducer.max(), '', true)
        .combine(ee.Reducer.median(), '', true);

      const statsPromise = new Promise((resolve) => {
        indexImage
          .reduceRegion({
            reducer: statsReducers,
            geometry: polygonEE,
            scale: 10,
            maxPixels: 1e8
          })
          .evaluate((result, err) => {
            const bandName = indexType;
            if (err || !result || result[`${bandName}_mean`] === undefined) {
              console.warn(`⚠️ GEE: Error evaluando estadísticas de ${indexType}.`);
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

      // Calcular histograma regional
      const histogramPromise = new Promise((resolve) => {
        indexImage
          .reduceRegion({
            reducer: ee.Reducer.histogram({
              maxBuckets: 40
            }),
            geometry: polygonEE,
            scale: 10,
            maxPixels: 1e8
          })
          .evaluate((result, err) => {
            const bandName = indexType;
            if (err || !result || !result[bandName]) {
              console.warn(`⚠️ GEE: Error evaluando histograma de ${indexType}.`);
              resolve(null);
            } else {
              resolve(result[bandName]);
            }
          });
      });

      // Obtener URL del Tile
      const tilePromise = new Promise((resolve, reject) => {
        clippedImage.getMap(visParams, (mapInfo, err) => {
          if (err || !mapInfo || !mapInfo.urlFormat) {
            reject(
              err || new Error(`No se pudo obtener urlFormat de mapa de GEE para ${indexType}`)
            );
          } else {
            resolve(mapInfo.urlFormat);
          }
        });
      });

      const [statsResult, histogramResult, tileUrl] = await Promise.all([
        statsPromise,
        histogramPromise,
        tilePromise
      ]);

      if (!statsResult || !histogramResult) {
        throw new Error(
          'Las reducciones espaciales de Earth Engine no devolvieron resultados válidos.'
        );
      }

      return {
        tileUrl,
        statsResult,
        histogramResult
      };
    } catch (err) {
      throw new ExternalApiError(err.message, 'GoogleEarthEngine', err);
    }
  }
}

export default EarthEngineServiceAdapter;
