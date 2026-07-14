import crypto from 'crypto';

export class ProcessGeeIndexUseCase {
  constructor(cacheRepository, geeService) {
    this.cacheRepository = cacheRepository;
    this.geeService = geeService;
  }

  async execute(coordinates, indexType = 'NDVI', loteId = null) {
    const hash = this.getPolygonHash(coordinates, indexType);

    // 1. Verificar Caché (Memoria + Supabase)
    try {
      const cachedData = await this.cacheRepository.getCachedTile(hash);
      if (cachedData && cachedData.stats && cachedData.histogram) {
        return {
          success: true,
          tileUrl: cachedData.tileUrl,
          avgValue: cachedData.avgValue,
          stats: cachedData.stats,
          distribution: cachedData.distribution,
          histogram: cachedData.histogram,
          cached: true,
          mocked: !this.geeService.isInitialized()
        };
      }
    } catch (err) {
      console.warn(
        `[ProcessGeeIndexUseCase] Error consultando caché satelital (contingencia continuará): ${err.message}`
      );
    }

    // Calcular suma de coordenadas para inicializar mocks de forma determinista para cada lote
    let sumCoords = 0;
    coordinates.forEach((c) => {
      sumCoords += (c[0] || 0) + (c[1] || 0);
    });

    // 2. Modo Simulado / Mock si el servicio GEE no está listo
    if (!this.geeService.isInitialized()) {
      console.log(`[ProcessGeeIndexUseCase] GEE no está inicializado. Ejecutando simulación.`);
      return this.generateMockResult(hash, loteId, indexType, sumCoords);
    }

    // 3. Procesamiento real en Google Earth Engine
    try {
      const { tileUrl, statsResult, histogramResult } = await this.geeService.processIndex(
        coordinates,
        indexType,
        sumCoords
      );

      const cv = statsResult.mean
        ? parseFloat(((statsResult.stdDev / statsResult.mean) * 100).toFixed(1))
        : 0;

      const finalStats = {
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

      const finalHistogram = buckets.map((count, idx) => {
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

      let finalDistribution = {};
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

          const sum =
            finalDistribution.critico +
            finalDistribution.bajo +
            finalDistribution.medio +
            finalDistribution.alto +
            finalDistribution.excelente;
          if (sum !== 100 && sum > 0) {
            const diff = 100 - sum;
            finalDistribution.medio += diff;
          }
        }
      }

      const avgValue = finalStats.mean;
      const extraData = {
        stats: finalStats,
        distribution: finalDistribution,
        histogram: finalHistogram
      };

      // Guardar en caché asíncronamente
      this.cacheRepository
        .saveCachedTile(hash, loteId, tileUrl, avgValue, indexType, extraData)
        .catch((err) => {
          console.warn(`[ProcessGeeIndexUseCase] Error guardando caché satelital: ${err.message}`);
        });

      return {
        success: true,
        tileUrl: tileUrl,
        avgValue: avgValue,
        stats: finalStats,
        distribution: finalDistribution,
        histogram: finalHistogram,
        cached: false,
        mocked: false
      };
    } catch (geeErr) {
      console.error(
        `⚠️ [ProcessGeeIndexUseCase] Falló el procesamiento real de GEE. Activando contingencia de simulación:`,
        geeErr.message
      );

      // Fallback gracioso a modo simulado (contingencia operativa de Skycrop)
      const mockResult = await this.generateMockResult(hash, loteId, indexType, sumCoords);
      mockResult.error = geeErr.message;
      mockResult.warning = `Fallo en GEE (${geeErr.message}). Utilizando simulación de contingencia.`;

      return mockResult;
    }
  }

  getPolygonHash(coordinates, indexType) {
    const coordString = JSON.stringify(coordinates);
    return crypto.createHash('sha256').update(`${coordString}_${indexType}`).digest('hex');
  }

  async generateMockResult(hash, loteId, indexType, sumCoords) {
    const mockData = this.generateMockHistogramAndStats(indexType, sumCoords);
    const mockTileUrl =
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    const avgValue = mockData.stats.mean;

    // Guardar en caché asíncronamente
    this.cacheRepository
      .saveCachedTile(hash, loteId, mockTileUrl, avgValue, indexType, mockData)
      .catch((err) => {
        console.warn(
          `[ProcessGeeIndexUseCase] Error guardando caché satelital simulado: ${err.message}`
        );
      });

    return {
      success: true,
      tileUrl: mockTileUrl,
      avgValue: avgValue,
      stats: mockData.stats,
      distribution: mockData.distribution,
      histogram: mockData.histogram,
      cached: false,
      mocked: true,
      warning:
        'Ejecutando en Modo Simulación. Configure GEE_SERVICE_ACCOUNT_KEY en el backend para conectar GEE real.'
    };
  }

  generateMockHistogramAndStats(indexType, sumCoordinates) {
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

    const min = parseFloat(
      Math.max(indexType === 'HUMEDAD' ? -0.5 : 0.0, mean - 2.5 * stdDev).toFixed(2)
    );
    const max = parseFloat(Math.min(1.0, mean + 2.0 * stdDev).toFixed(2));
    const median = parseFloat((mean + 0.02).toFixed(2));
    const cv = parseFloat(((stdDev / mean) * 100).toFixed(1));

    const stats = { mean, median, stdDev, min, max, cv };

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

      const sum =
        distribution.critico +
        distribution.bajo +
        distribution.medio +
        distribution.alto +
        distribution.excelente;
      if (sum !== 100 && sum > 0) {
        const diff = 100 - sum;
        distribution.medio += diff;
      }
    }

    return { stats, distribution, histogram };
  }
}

export default ProcessGeeIndexUseCase;
