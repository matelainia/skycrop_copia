/**
 * Puerto de Salida (Outbound Port) para el Repositorio de Caché de Clima.
 * Define los métodos para consultar y guardar el histórico/caché meteorológico.
 */
export class WeatherCacheRepositoryPort {
  /**
   * Recupera la información meteorológica almacenada para un hash de coordenadas.
   * @param {string} coordHash Hash único de coordenadas (ej. "lat_lon" redondeadas)
   * @returns {Promise<object|null>} Datos meteorológicos y fecha de expiración, o null
   */
  async getCachedWeather(coordHash) {
    throw new Error('Método no implementado');
  }

  /**
   * Almacena datos meteorológicos en la caché de persistencia.
   * @param {string} coordHash Hash único
   * @param {number} latitude Latitud
   * @param {number} longitude Longitud
   * @param {object} weatherData Datos normalizados
   * @param {string} expiresAt ISO string de fecha de expiración
   */
  async saveCachedWeather(coordHash, latitude, longitude, weatherData, expiresAt) {
    throw new Error('Método no implementado');
  }
}

export default WeatherCacheRepositoryPort;
