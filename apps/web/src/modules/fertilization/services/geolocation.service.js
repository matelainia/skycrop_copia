/**
 * geolocation.service.js
 * Servicio de geolocalización envolviendo navigator.geolocation
 * Estados: idle | requesting | success | error
 */

export const geolocationService = {
  /**
   * Obtiene la ubicación actual del navegador.
   * @param {PositionOptions} [options]
   * @returns {Promise<{latitude:number, longitude:number, accuracy:number, altitude:number|null, capturedAt:string}>}
   */
  getCurrentPosition(options = {}) {
    const defaultOpts = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
      ...options,
    };

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no disponible en este dispositivo.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            capturedAt: new Date().toISOString(),
          });
        },
        (err) => {
          let msg = 'No fue posible obtener la ubicación.';
          switch (err.code) {
            case 1:
              msg = 'Permiso de ubicación denegado. Actívalo en la configuración del navegador.';
              break;
            case 2:
              msg = 'Ubicación no disponible. Verifica que el GPS esté activo.';
              break;
            case 3:
              msg = 'Tiempo de espera agotado al obtener la ubicación.';
              break;
            default:
              msg = err.message || msg;
          }
          const e = new Error(msg);
          e.code = err.code;
          reject(e);
        },
        defaultOpts
      );
    });
  },

  /**
   * Formatea coordenadas para display
   * @param {number} lat
   * @param {number} lng
   * @returns {string} "4.123456° N, -73.123456° W"
   */
  formatLatLng(lat, lng) {
    if (lat == null || lng == null) return '—';
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lng).toFixed(6)}° ${lngDir}`;
  },

  /**
   * Genera URL de OSM para abrir ubicación en mapa externo
   */
  getOsmUrl(lat, lng, zoom = 16) {
    if (lat == null || lng == null) return null;
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
  },

  getGoogleMapsUrl(lat, lng) {
    if (lat == null || lng == null) return null;
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
};
