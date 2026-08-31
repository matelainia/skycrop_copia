/**
 * aplicaciones.service.js
 * Capa de negocio — transforma repository → ViewModel y expone operaciones.
 * Sin acceso directo a Supabase en componentes.
 */
import { aplicacionesRepository } from '../repository/aplicaciones.repository.js';
import { mapAplicacionesRows, mapAplicacionRow } from '../mappers/aplicacion.mapper.js';

export const aplicacionesService = {
  /**
   * Lista paginada y filtrada, ya mapeada a ViewModel.
   * @returns {Promise<{data: object[], total: number, page: number, pageSize: number, totalPages: number}>}
   */
  async getAplicaciones(params = {}) {
    const result = await aplicacionesRepository.getAplicaciones(params);
    return {
      ...result,
      data: mapAplicacionesRows(result.data),
    };
  },

  async getAplicacionById(id) {
    const raw = await aplicacionesRepository.getAplicacionById(id);
    return raw ? mapAplicacionRow(raw) : null;
  },

  async getStats() {
    const stats = await aplicacionesRepository.getStats();
    return stats;
  },

  async getLotesForFilter() {
    const lotes = await aplicacionesRepository.getLotesForFilter();
    return lotes;
  },

  async getPlanesForSelector() {
    return aplicacionesRepository.getPlanesForSelector();
  },

  async createAplicacion(payload, context) {
    const raw = await aplicacionesRepository.createAplicacion(payload, context);
    return raw ? mapAplicacionRow(raw) : null;
  },

  async updateAplicacion(id, patch, context) {
    const raw = await aplicacionesRepository.updateAplicacion(id, patch, context);
    return raw ? mapAplicacionRow(raw) : null;
  },

  async deleteAplicacion(id) {
    return aplicacionesRepository.deleteAplicacion(id);
  },
};
