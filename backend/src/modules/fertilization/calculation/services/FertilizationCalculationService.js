/**
 * FertilizationCalculationService.js
 * Servicio de aplicación principal del motor de cálculo de fertilización.
 *
 * Punto de entrada para el controller HTTP.
 * Orquesta la composición de dependencias y delega al FertilizationEngine.
 */
import { FertilizationEngine } from '../engine/FertilizationEngine.js';
import { SupabaseCropRepository } from '../repositories/supabase/SupabaseCropRepository.js';
import { SupabaseNutrientRepository } from '../repositories/supabase/SupabaseNutrientRepository.js';
import { SupabaseFertilizerRepository } from '../repositories/supabase/SupabaseFertilizerRepository.js';
import { SupabaseRequirementRepository } from '../repositories/supabase/SupabaseRequirementRepository.js';
import { SupabaseRuleRepository } from '../repositories/supabase/SupabaseRuleRepository.js';
import { SupabaseCalculationRepository } from '../repositories/supabase/SupabaseCalculationRepository.js';
import { SupabaseSoilAnalysisRepository } from '../repositories/supabase/SupabaseSoilAnalysisRepository.js';
import { DatabaseError, AuthorizationError } from '../../../../shared/errors/AppErrors.js';

export class FertilizationCalculationService {
  constructor() {
    // Inicializar repositorios
    this.cropRepo = new SupabaseCropRepository();
    this.nutrientRepo = new SupabaseNutrientRepository();
    this.fertilizerRepo = new SupabaseFertilizerRepository();
    this.requirementRepo = new SupabaseRequirementRepository();
    this.ruleRepo = new SupabaseRuleRepository();
    this.calculationRepo = new SupabaseCalculationRepository();
    this.soilAnalysisRepo = new SupabaseSoilAnalysisRepository();

    // Inicializar motor con los repositorios
    this.engine = new FertilizationEngine({
      cropRepo: this.cropRepo,
      requirementRepo: this.requirementRepo,
      ruleRepo: this.ruleRepo,
      fertilizerRepo: this.fertilizerRepo,
      soilAnalysisRepo: this.soilAnalysisRepo,
      calculationRepo: this.calculationRepo
    });
  }

  // ─── Cálculo principal ─────────────────────────────────────────────────────

  /**
   * Ejecuta el cálculo de fertilización determinístico.
   *
   * @param {Object} input - Datos de entrada del cálculo
   * @param {string} input.cropId - UUID del cultivo
   * @param {string} input.stageId - UUID de la etapa fenológica
   * @param {number} input.targetYieldTHa - Rendimiento objetivo (t/ha)
   * @param {string} [input.methodology] - Metodología: extraction|stage_fixed|balance
   * @param {string} [input.soilAnalysisId] - UUID del análisis de suelo
   * @param {string} [input.companyId] - UUID de la empresa
   * @param {string} [input.lotId] - UUID del lote
   * @param {string} [input.farmId] - UUID del predio
   * @param {string} [input.applicationMethod] - granular|liquid|foliar
   * @param {Object} [input.constraints] - Restricciones de selección de fertilizantes
   * @param {Object[]} [input.userOverrides] - Ajustes manuales del usuario sobre fertilizantes
   * @param {string} [userId] - ID del usuario para trazabilidad
   * @returns {Promise<import('../domain/entities/FertilizationResult.js').FertilizationResult>}
   */
  async calculate(input, userId = null) {
    return await this.engine.calculate(input, userId);
  }

  // ─── Catálogos ─────────────────────────────────────────────────────────────

  /**
   * Lista los cultivos disponibles.
   * @returns {Promise<import('../domain/entities/Crop.js').Crop[]>}
   */
  async getCrops() {
    try {
      return await this.cropRepo.findAll();
    } catch (err) {
      throw new DatabaseError('Error obteniendo catálogo de cultivos', err);
    }
  }

  /**
   * Lista las etapas fenológicas de un cultivo.
   * @param {string} cropId
   * @returns {Promise<import('../domain/entities/PhenologicalStage.js').PhenologicalStage[]>}
   */
  async getStages(cropId) {
    try {
      return await this.cropRepo.findStagesByCrop(cropId);
    } catch (err) {
      throw new DatabaseError(`Error obteniendo etapas del cultivo ${cropId}`, err);
    }
  }

  /**
   * Lista el catálogo de nutrientes.
   * @returns {Promise<import('../domain/entities/Nutrient.js').Nutrient[]>}
   */
  async getNutrients() {
    try {
      return await this.nutrientRepo.findAll();
    } catch (err) {
      throw new DatabaseError('Error obteniendo catálogo de nutrientes', err);
    }
  }

  /**
   * Lista los fertilizantes disponibles para una empresa.
   * @param {string} companyId
   * @returns {Promise<import('../domain/entities/Fertilizer.js').Fertilizer[]>}
   */
  async getFertilizers(companyId) {
    try {
      return await this.fertilizerRepo.findActive(companyId);
    } catch (err) {
      throw new DatabaseError('Error obteniendo catálogo de fertilizantes', err);
    }
  }

  /**
   * Lista las reglas agronómicas activas para una empresa.
   * @param {string} companyId
   * @returns {Promise<import('../domain/entities/AgronomicRule.js').AgronomicRule[]>}
   */
  async getRules(companyId) {
    try {
      return await this.ruleRepo.findActive(companyId, null, null);
    } catch (err) {
      throw new DatabaseError('Error obteniendo reglas agronómicas', err);
    }
  }

  // ─── Análisis de suelo ─────────────────────────────────────────────────────

  /**
   * Registra un análisis de suelo.
   * @param {string} companyId
   * @param {Object} data - Datos del análisis
   * @returns {Promise<Object>}
   */
  async saveSoilAnalysis(companyId, data) {
    try {
      return await this.soilAnalysisRepo.save(companyId, data);
    } catch (err) {
      throw new DatabaseError('Error guardando análisis de suelo', err);
    }
  }

  // ─── Historial de cálculos ─────────────────────────────────────────────────

  /**
   * Consulta el historial de cálculos de una empresa.
   * @param {string} companyId
   * @param {{ limit?: number, offset?: number }} [options]
   * @returns {Promise<Object[]>}
   */
  async getCalculationHistory(companyId, options = {}) {
    try {
      return await this.calculationRepo.findByCompany(companyId, options);
    } catch (err) {
      throw new DatabaseError('Error obteniendo historial de cálculos', err);
    }
  }

  /**
   * Obtiene el detalle de un cálculo específico con su snapshot.
   * @param {string} calculationId
   * @param {string|null} expectedCompanyId - UUID del tenant autenticado (aislamiento multi-tenant)
   * @returns {Promise<Object>}
   */
  async getCalculation(calculationId, expectedCompanyId = null) {
    try {
      const detail = await this.calculationRepo.findById(calculationId);

      // Verificación de ownership: el cálculo debe pertenecer a la empresa del token
      if (expectedCompanyId && detail) {
        const ownerCompanyId =
          detail.companyId ?? detail.company_id ?? detail.toObject?.().companyId ?? null;
        if (ownerCompanyId && ownerCompanyId !== expectedCompanyId) {
          throw new AuthorizationError('El cálculo solicitado no pertenece a su empresa.');
        }
      }

      return detail;
    } catch (err) {
      if (err instanceof AuthorizationError) throw err;
      throw new DatabaseError(`Error obteniendo cálculo ${calculationId}`, err);
    }
  }
}
