const getBackendUrl = () => {
  const isDev = import.meta.env.DEV;
  return isDev
    ? 'http://localhost:3000/api'
    : 'https://backend.skycrop.app/api';
};

export const agronomyRepository = {
  /**
   * Obtiene el formulario de monitoreo completo para un lote.
   * UNA sola llamada que retorna cultivo, estado fenológico,
   * objetos de evaluación, protocolos versionados, umbrales y reglas.
   *
   * @param {string} loteId
   * @returns {Promise<{lote, cultivo, objetos, reglas_agronomicas, metadata}>}
   */
  async getFormularioMonitoreo(loteId) {
    const url = `${getBackendUrl()}/agronomia/lotes/${loteId}/formulario-monitoreo`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Error ${res.status} al obtener formulario de monitoreo para lote ${loteId}`);
    }
    const json = await res.json();
    return json.data;
  },

  /**
   * Obtiene el catálogo maestro de cultivos activos.
   * @returns {Promise<Array<{id, nombre, nombre_cientifico, familia, ciclo}>>}
   */
  async getCultivos() {
    const url = `${getBackendUrl()}/agronomia/cultivos`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Error ${res.status} al obtener catálogo de cultivos`);
    }
    const json = await res.json();
    return json.data || [];
  },

  /**
   * Obtiene los estados fenológicos de un cultivo.
   * @param {string} cultivoId
   */
  async getEstadosFenologicos(cultivoId) {
    const url = `${getBackendUrl()}/agronomia/cultivos/${cultivoId}/estados-fenologicos`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Error ${res.status} al obtener estados fenológicos`);
    }
    const json = await res.json();
    return json.data || [];
  },

  /**
   * Obtiene tratamientos (por ingrediente activo) para un objeto de evaluación.
   * @param {string} objetoId
   */
  async getRecomendaciones(objetoId) {
    const url = `${getBackendUrl()}/agronomia/objetos/${objetoId}/recomendaciones`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Error ${res.status} al obtener recomendaciones`);
    }
    const json = await res.json();
    return json.data;
  }
};
