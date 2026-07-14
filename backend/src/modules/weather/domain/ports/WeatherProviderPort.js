/**
 * Puerto de Salida (Outbound Port) para Proveedores de Clima.
 * Define la interfaz que deben implementar los adaptadores de clima externos (ej. Google Weather, Open-Meteo).
 */
export class WeatherProviderPort {
  /**
   * Obtiene la previsión meteorológica para las coordenadas dadas.
   * @param {number} latitude Latitud geográfica
   * @param {number} longitude Longitud geográfica
   * @returns {Promise<object>} Datos meteorológicos normalizados
   */
  async getForecast(latitude, longitude) {
    throw new Error('Método no implementado');
  }

  /**
   * Retorna el identificador del proveedor.
   * @returns {string} Nombre del proveedor (ej. 'google-weather-api')
   */
  getName() {
    throw new Error('Método no implementado');
  }
}

export default WeatherProviderPort;
