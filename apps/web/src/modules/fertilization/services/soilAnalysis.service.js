/**
 * soilAnalysis.service.js
 * Capa de negocio — transforma repository → ViewModel
 */
import { soilAnalysisRepository } from '../repository/soilAnalysis.repository.js';
import { mapSoilAnalysisRows, mapSoilAnalysisRow, mapSoilAnalysisDetail } from '../mappers/soilAnalysis.mapper.js';

export const soilAnalysisService = {
  async getAnalyses(params = {}) {
    const result = await soilAnalysisRepository.getAnalyses(params);
    return {
      ...result,
      data: mapSoilAnalysisRows(result.data),
    };
  },

  async getAnalysisById(id) {
    const raw = await soilAnalysisRepository.getAnalysisById(id);
    if (!raw) return null;
    // raw puede ser { analisis, resultados } o solo row
    if (raw.analisis) {
      return mapSoilAnalysisDetail(raw);
    }
    return { analisis: mapSoilAnalysisRow(raw), resultados: [], hasResults: false };
  },

  async getMetrics() {
    const metrics = await soilAnalysisRepository.getMetrics();
    return metrics;
  },

  async getPredios() {
    return soilAnalysisRepository.getPrediosForFilter();
  },

  async getLotes(predioId) {
    return soilAnalysisRepository.getLotesForFilter(predioId);
  },

  async getLaboratorios() {
    return soilAnalysisRepository.getLaboratorios();
  },

  async getParametros() {
    return soilAnalysisRepository.getParametros();
  },

  async createLaboratorio(payload, context) {
    const raw = await soilAnalysisRepository.createLaboratorio(payload, context);
    return raw;
  },

  async createAnalisis(payload, context) {
    const raw = await soilAnalysisRepository.createAnalisis(payload, context);
    return mapSoilAnalysisRow(raw);
  },

  async updateAnalisis(id, patch, context) {
    const raw = await soilAnalysisRepository.updateAnalisis(id, patch, context);
    return mapSoilAnalysisRow(raw);
  },

  async deleteAnalisis(id) {
    return soilAnalysisRepository.deleteAnalisis(id);
  },

  async archiveAnalisis(id) {
    const raw = await soilAnalysisRepository.archiveAnalisis(id);
    return mapSoilAnalysisRow(raw);
  },

  async getResultados(analisisId) {
    return soilAnalysisRepository.getResultados(analisisId);
  },

  async saveResultados(analisisId, resultados, context) {
    return soilAnalysisRepository.upsertResultados(analisisId, resultados, context);
  },

  async getYears() {
    return soilAnalysisRepository.getYears();
  }
};
