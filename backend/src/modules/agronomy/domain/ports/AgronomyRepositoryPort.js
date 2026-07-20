/**
 * AgronomyRepositoryPort.js
 * Puerto (interfaz) del dominio agronómico.
 * Define el contrato que toda implementación de repositorio debe cumplir.
 */
export class AgronomyRepositoryPort {
  /** @returns {Promise<Array>} Lista de cultivos activos */
  async getCultivos() {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<Array>} Estados fenológicos de un cultivo */
  async getEstadosFenologicos(cultivoId) {
    throw new Error('Not implemented');
  }

  /**
   * Retorna los objetos de evaluación activos para un cultivo y etapa fenológica.
   * @param {string} cultivoId
   * @param {string|null} estadoFenologicoId
   */
  async getObjetosEvaluacion(cultivoId, estadoFenologicoId) {
    throw new Error('Not implemented');
  }

  /**
   * Retorna el protocolo de evaluación vigente para un objeto/cultivo/etapa.
   * @param {string} objetoEvaluacionId
   * @param {string} cultivoId
   * @param {string|null} estadoFenologicoId
   */
  async getProtocoloVigente(objetoEvaluacionId, cultivoId, estadoFenologicoId) {
    throw new Error('Not implemented');
  }

  /**
   * Retorna los umbrales económicos para un objeto y cultivo.
   */
  async getUmbralesEconomicos(objetoEvaluacionId, cultivoId, estadoFenologicoId) {
    throw new Error('Not implemented');
  }

  /**
   * Retorna las reglas agronómicas activas para un cultivo.
   */
  async getReglasAgronomicas(cultivoId) {
    throw new Error('Not implemented');
  }

  /**
   * Retorna los tratamientos disponibles para un objeto de evaluación.
   * Incluye ingredientes activos y recomendaciones.
   */
  async getTratamientos(objetoEvaluacionId) {
    throw new Error('Not implemented');
  }

  /**
   * Retorna el lote con su cultivo y estado fenológico actual.
   */
  async getLoteConCultivo(loteId) {
    throw new Error('Not implemented');
  }
}
