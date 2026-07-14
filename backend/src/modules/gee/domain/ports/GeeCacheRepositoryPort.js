/**
 * Puerto de Salida (Outbound Port) para la persistencia del caché satelital de GEE.
 */
export class GeeCacheRepositoryPort {
  /**
   * Obtiene una imagen satelital/tile almacenado para un hash de polígono.
   * @param {string} polygonHash Hash único del polígono e índice
   * @returns {Promise<object|null>} Registro del caché (tileUrl, avgValue, stats, etc.)
   */
  async getCachedTile(polygonHash) {
    throw new Error('Método no implementado');
  }

  /**
   * Almacena un tile satelital procesado en los repositorios de caché.
   * @param {string} polygonHash Hash único
   * @param {string} loteId ID del lote
   * @param {string} tileUrl URL de renderizado del mapa
   * @param {number} avgValue Valor promedio del índice
   * @param {string} indexType Tipo de índice
   * @param {object} extraData Datos adicionales (stats, distribución, histograma)
   */
  async saveCachedTile(polygonHash, loteId, tileUrl, avgValue, indexType, extraData) {
    throw new Error('Método no implementado');
  }
}

export default GeeCacheRepositoryPort;
