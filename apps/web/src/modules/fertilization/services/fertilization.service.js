/**
 * fertilization.service.js
 * Capa de lógica de negocio del módulo Fertilización.
 *
 * Responsabilidades:
 *   - Transformaciones DTO (raw → UI-ready) para plans
 *   - Reglas de versionado (un plan no se sobrescribe, se versiona)
 *   - Orquestación de operaciones CRUD delegando al repository
 *   - Mantener compatibilidad total con el dashboard existente
 *
 * NO contiene: acceso directo a Supabase/HTTP, lógica de UI, estado React.
 */

import { getDashboard } from '../api/fertilization.api.js';
import { transformDashboard } from '../models/dashboardModel.js';
import { fertilizationRepository } from '../repository/fertilization.repository.js';
import {
  PLAN_STATUS_LABELS,
  VALIDITY_STATUS_LABELS,
  STAGE_LABEL_BY_ID,
} from '../types/fertilization.types.js';

// ─── Dashboard (existente — sin cambios) ──────────────────────────────────────
export const fertilizationService = {
  getDashboard: async () => {
    const raw = await getDashboard();
    return transformDashboard(raw);
  },
};

// ─── Plans Service ─────────────────────────────────────────────────────────────
export const plansService = {
  /**
   * Consulta planes con filtros, búsqueda y paginación server-side.
   * Aplica transformación DTO sobre cada resultado.
   *
   * @param {import('../repository/fertilization.repository.js').PlansQueryParams} params
   * @returns {Promise<{ data: object[], total: number, page: number, pageSize: number, totalPages: number }>}
   */
  async getPlans(params = {}) {
    const result = await fertilizationRepository.getPlans(params);
    return {
      ...result,
      data: result.data.map(transformPlanDTO),
    };
  },

  /**
   * Obtiene un plan por ID con transformación DTO.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async getPlanById(id) {
    const raw = await fertilizationRepository.getPlanById(id);
    return raw ? transformPlanDTO(raw) : null;
  },

  /**
   * Crea un nuevo plan (v1.0, sin parent).
   * @param {object} data
   * @returns {Promise<object>}
   */
  async createPlan(data) {
    const raw = await fertilizationRepository.createPlan({
      ...data,
      version: 'v1.0',
      parentPlanId: null,
    });
    return transformPlanDTO(raw);
  },

  /**
   * Crea una nueva versión de un plan existente.
   * Nunca sobrescribe — genera una versión incremental (v1.0 → v2.0).
   * @param {string} parentId
   * @param {object} [overrides]
   * @returns {Promise<object>}
   */
  async createNewVersion(parentId, overrides = {}) {
    const parent = await fertilizationRepository.getPlanById(parentId);
    if (!parent) throw new Error(`Plan padre ${parentId} no encontrado`);

    // Incrementar versión major (v1.0 → v2.0, v2.0 → v3.0)
    const currentMajor = parseInt(parent.version.replace('v', '').split('.')[0], 10) || 1;
    const newVersion = `v${currentMajor + 1}.0`;

    const newPlan = await fertilizationRepository.createPlan({
      ...parent,
      ...overrides,
      version: newVersion,
      parentPlanId: parentId,
      status: 'draft',
      validityStatus: 'scheduled',
      approvedBy: null,
      approvedAt: null,
    });
    return transformPlanDTO(newPlan);
  },

  /**
   * Actualiza campos de un plan (no cambia la versión, solo metadatos editables).
   * Para cambios sustanciales, usar createNewVersion().
   * @param {string} id
   * @param {object} data
   * @param {{ id: string, name: string }} updatedBy
   * @returns {Promise<object>}
   */
  async updatePlan(id, data, updatedBy) {
    const raw = await fertilizationRepository.updatePlan(id, { ...data, updatedBy });
    return transformPlanDTO(raw);
  },

  /**
   * Archiva un plan (soft-delete).
   * @param {string} id
   * @returns {Promise<void>}
   */
  async archivePlan(id) {
    await fertilizationRepository.archivePlan(id);
  },

  /**
   * Elimina un plan permanentemente.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deletePlan(id) {
    await fertilizationRepository.deletePlan(id);
  },
};

// ─── DTO Transform ─────────────────────────────────────────────────────────────
/**
 * Transforma un plan raw del repository al shape UI-ready completo.
 * Resuelve etiquetas de estados, vigencia y etapa fenológica.
 * @param {import('../types/fertilization.types.js').FertilizationPlan} raw
 * @returns {object}
 */
function transformPlanDTO(raw) {
  if (!raw) return null;
  return {
    ...raw,
    // Etiquetas resueltas
    statusLabel:         PLAN_STATUS_LABELS[raw.status]          ?? raw.status,
    validityLabel:       VALIDITY_STATUS_LABELS[raw.validityStatus] ?? raw.validityStatus,
    phenologicalLabel:   STAGE_LABEL_BY_ID[raw.phenologicalStageId] ?? raw.phenologicalStage,
    // Fechas formateadas para display
    createdAtFormatted:  formatDate(raw.createdAt),
    updatedAtFormatted:  formatDate(raw.updatedAt),
    approvedAtFormatted: formatDate(raw.approvedAt),
    // Bandera de IA generado
    isAIGenerated:       raw.metadata?.recommendationEngine === 'IA',
    // Bandera de versión secundaria (tiene parent)
    isVersioned:         Boolean(raw.parentPlanId),
    // Deficiencias como array seguro
    deficiencies:        raw.nutritionalStatus?.deficiencies ?? [],
  };
}

/** Formatea ISO date → "20 jul 2024" en español */
function formatDate(isoDate) {
  if (!isoDate) return '';
  try {
    return new Date(isoDate).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}
