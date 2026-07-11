export const generateMockHistogramAndStats = (indexType, sumCoordinates, actualValue) => {
  let mean = 0.74;
  if (typeof actualValue === 'number') {
    mean = actualValue;
  } else if (actualValue !== undefined && actualValue !== null && !isNaN(parseFloat(actualValue))) {
    mean = parseFloat(actualValue);
  } else {
    if (indexType === 'NDVI') {
      mean = parseFloat((0.65 + (Math.abs(sumCoordinates) % 0.15)).toFixed(2));
    } else if (indexType === 'NDRE') {
      mean = parseFloat((0.45 + (Math.abs(sumCoordinates) % 0.15)).toFixed(2));
    } else if (indexType === 'SAVI') {
      mean = parseFloat((0.55 + (Math.abs(sumCoordinates) % 0.15)).toFixed(2));
    } else if (indexType === 'HUMEDAD') {
      mean = parseFloat((0.15 + (Math.abs(sumCoordinates) % 0.2)).toFixed(2));
    }
  }

  let stdDev = 0.10;
  if (indexType === 'HUMEDAD') {
    stdDev = 0.12;
  } else {
    if (mean > 0.8) stdDev = 0.05;
    else if (mean > 0.7) stdDev = 0.07;
    else stdDev = 0.09;
  }

  const min = parseFloat(Math.max(indexType === 'HUMEDAD' ? -0.5 : 0.0, mean - 2.5 * stdDev).toFixed(2));
  const max = parseFloat(Math.min(1.0, mean + 2.0 * stdDev).toFixed(2));
  const median = parseFloat(Math.max(min, Math.min(max, mean + 0.01)).toFixed(2));
  const cv = parseFloat(((stdDev / Math.max(0.01, mean)) * 100).toFixed(1));

  const stats = { mean, median, stdDev, min, max, cv };

  const histogram = [];
  const numBuckets = 30; // 30 bars looks clean
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

    count = Math.max(10, count + Math.round((Math.random() - 0.5) * 400));
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
};

export const getHistoricalIndexPoints = (lote, indexType) => {
  if (!lote) return {
    points: [0.60, 0.62, 0.65, 0.68, 0.70, 0.72],
    labels: ['Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May']
  };

  const charSum = lote.codigo_interno.charCodeAt(0) + (lote.codigo_interno.charCodeAt(1) || 0);
  let baseValue = 0.72;
  if (indexType === 'NDRE') baseValue = 0.48;
  else if (indexType === 'SAVI') baseValue = 0.58;
  else if (indexType === 'HUMEDAD') baseValue = 0.22;

  const points = [];
  const count = 6;

  let currentVal = baseValue;
  if (indexType === 'NDVI') currentVal = lote.ndvi_actual;
  else if (indexType === 'NDRE') currentVal = parseFloat(lote.ndre_actual) || 0.48;
  else if (indexType === 'SAVI') currentVal = parseFloat(lote.savi_actual) || 0.58;
  else if (indexType === 'HUMEDAD') currentVal = parseFloat(lote.humedad_actual) || 0.22;

  for (let i = 0; i < count; i++) {
    const wave = Math.sin((charSum + i) * 0.8) * 0.08;
    const step = (currentVal - (baseValue + wave)) * (i / (count - 1));
    const val = baseValue + wave + step;
    points.push(parseFloat(Math.max(indexType === 'HUMEDAD' ? -0.15 : 0.05, Math.min(1.0, val)).toFixed(2)));
  }

  points[count - 1] = currentVal;

  const labels = [];
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const today = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    labels.push(monthNames[d.getMonth()]);
  }

  return { points, labels };
};
