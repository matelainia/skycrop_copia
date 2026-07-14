/**
 * Puerto de Salida (Outbound Port) para interacciones con Google Earth Engine.
 * Desacopla al dominio del SDK de Google Earth Engine (@google/earthengine).
 */
export class GeeServicePort {
  /**
   * Procesa un índice satelital para un polígono de coordenadas.
   * @param {Array} coordinates Coordenadas del lote [[lat, lng], ...]
   * @param {string} indexType Tipo de índice (ej. 'NDVI', 'NDRE', 'SAVI', 'HUMEDAD')
   * @param {number} sumCoords Suma de coordenadas (utilizada para simulación determinista)
   * @returns {Promise<object>} Resultados con tileUrl, stats y histograma
   */
  async processIndex(coordinates, indexType, sumCoords) {
    throw new Error('Método no implementado');
  }

  /**
   * Retorna si el servicio de Earth Engine está inicializado.
   * @returns {boolean} True si está inicializado y autenticado
   */
  isInitialized() {
    throw new Error('Método no implementado');
  }

  /**
   * Retorna el error de inicialización de GEE si existe.
   * @returns {string|null} Error de inicialización
   */
  getInitializationError() {
    throw new Error('Método no implementado');
  }
}

export default GeeServicePort;
