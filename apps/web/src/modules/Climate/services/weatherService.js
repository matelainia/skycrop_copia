const isDev = import.meta.env.DEV;
const BASE_URL = isDev
  ? 'http://localhost:3000/api'
  : 'https://backend.skycrop.app/api';

export const weatherService = {
  /**
   * Consulta el endpoint de clima del backend con latitud y longitud.
   */
  async fetchWeather(lat, lon) {
    const url = `${BASE_URL}/weather?latitude=${lat}&longitude=${lon}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.error('[WeatherService] Error fetching weather:', err.message);
      throw err;
    }
  }
};
