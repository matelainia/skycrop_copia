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

  // ─── Requerimientos nutricionales (Paso 2) ──────────────────────────────────

  /**
   * Obtiene requerimientos nutricionales escalados para el Paso 2.
   * @param {Object} params
   * @param {string} params.cropId
   * @param {string|null} params.stageId
   * @param {number} params.targetYieldTHa
   * @param {string|null} [params.methodology]
   * @param {string|null} [params.productionSystem]
   * @param {string|null} [params.variety]
   * @param {string|null} [params.companyId]
   * @returns {Promise<Object>} { requirements: Record<code,kgHa>, metadata }
   */
  async getRequirements({
    cropId,
    stageId,
    targetYieldTHa,
    methodology,
    productionSystem,
    variety,
    companyId
  }) {
    try {
      // Cargar requerimientos base desde DB
      const requirements = await this.requirementRepo.findByCropAndStage(
        cropId,
        stageId,
        companyId
      );
      // Filtrar por sistema productivo / variedad si el repo no lo hizo
      let filtered = requirements;
      if (productionSystem) {
        const psFiltered = filtered.filter(
          (r) => !r.productionSystem || r.productionSystem === productionSystem
        );
        if (psFiltered.length) filtered = psFiltered;
      }
      if (variety) {
        const varFiltered = filtered.filter((r) => !r.variety || r.variety === variety);
        if (varFiltered.length) filtered = varFiltered;
      }
      // Usar RequirementEngine para escalar
      const { RequirementEngine } = await import('../engine/RequirementEngine.js');
      const engine = new RequirementEngine();
      const result = engine.calculate({
        requirements: filtered,
        targetYieldTHa,
        methodology: methodology || null
      });
      return {
        requirements: result.requirements,
        metadata: result.metadata,
        source: result.metadata.source,
        cropId,
        stageId,
        targetYieldTHa,
        methodology: methodology || 'any',
        productionSystem: productionSystem || null,
        variety: variety || null
      };
    } catch (err) {
      throw new DatabaseError('Error obteniendo requerimientos nutricionales', err);
    }
  }

  /**
   * Preview de balance sin fertilizantes: Demanda vs Oferta vs Déficit
   * @param {Object} input - mismo shape que calculate pero sin fertilizerSources
   * @returns {Promise<Object>} { requirements, soilContributions, balanceDetail, netDemands }
   */
  async getBalancePreview(input) {
    try {
      // Validar mínimamente
      const {
        cropId,
        stageId,
        targetYieldTHa,
        methodology,
        customRequirements,
        requirementDistributions,
        soilAnalysisId,
        soilAnalysis,
        companyId
      } = input;
      if (!cropId || !stageId || !targetYieldTHa) {
        throw new DatabaseError(
          'cropId, stageId y targetYieldTHa son requeridos para el balance preview'
        );
      }
      // Reutilizar el engine sin pasar por validación completa de fertilizantes
      // Llamar a calculate con fertilizerSources vacío y capturar balance
      // Mejor: instanciar engines directamente para preview lightweight
      const { RequirementEngine } = await import('../engine/RequirementEngine.js');
      const { SoilSupplyEngine } = await import('../engine/SoilSupplyEngine.js');
      const { NutrientBalanceEngine } = await import('../engine/NutrientBalanceEngine.js');
      const { RuleEngine } = await import('../rules/RuleEngine.js');
      const { getActiveVersions } = await import('../rules/RuleVersionManager.js');

      const [crop, stage, cropRequirements, allRules, soil] = await Promise.all([
        this.cropRepo.findById(cropId).catch(() => ({ id: cropId, name: cropId })),
        this.cropRepo.findStageById(stageId).catch(() => ({ id: stageId, name: stageId })),
        customRequirements && Object.keys(customRequirements).length
          ? Promise.resolve([])
          : this.requirementRepo.findByCropAndStage(cropId, stageId, companyId).catch(() => []),
        this.ruleRepo.findActive(companyId, null, null).catch(() => []),
        soilAnalysisId
          ? this.soilAnalysisRepo.findById(soilAnalysisId).catch(() => null)
          : soilAnalysis && soilAnalysis.pH
            ? (async () => {
                const { SoilAnalysis } = await import('../domain/entities/SoilAnalysis.js');
                const nutrients = {};
                for (const code of ['N', 'P', 'K', 'Ca', 'Mg', 'S']) {
                  const v = soilAnalysis[code] ?? soilAnalysis[code.toLowerCase?.()] ?? null;
                  if (v !== null && v !== '' && !isNaN(Number(v))) {
                    const isCmol = ['K', 'Ca', 'Mg'].includes(code);
                    nutrients[code] = { value: Number(v), unit: isCmol ? 'cmol/kg' : 'mg/kg' };
                  }
                }
                return new SoilAnalysis({
                  id: 'inline-preview',
                  ph: Number(soilAnalysis.pH) || 6.5,
                  organicMatter: soilAnalysis.organicMatter
                    ? Number(soilAnalysis.organicMatter)
                    : null,
                  cec: soilAnalysis.cec ? Number(soilAnalysis.cec) : null,
                  texture: soilAnalysis.texture || null,
                  nutrients
                });
              })()
            : Promise.resolve(null)
      ]);

      const activeRules = getActiveVersions(allRules || []);
      const ruleEngine = new RuleEngine();
      const evaluationContext = {
        crop: { id: crop?.id, name: crop?.name },
        stage: { id: stage?.id, name: stage?.name },
        targetYield: targetYieldTHa,
        methodology: methodology || null,
        companyId,
        soil: soil
          ? { pH: soil.pH, organicMatter: soil.organicMatter, cec: soil.cec, texture: soil.texture }
          : {}
      };
      const ruleResult = ruleEngine.evaluate(activeRules, evaluationContext);

      const soilEngine = new SoilSupplyEngine();
      const soilResult = soil
        ? soilEngine.analyze({
            soilAnalysis: soil,
            requiredNutrients: ['N', 'P2O5', 'K2O', 'Ca', 'Mg', 'S']
          })
        : { soilContext: {}, soilContributions: {}, warnings: [] };

      const reqEngine = new RequirementEngine();
      const reqResult = reqEngine.calculate({
        requirements: cropRequirements,
        targetYieldTHa,
        methodology: methodology || null,
        correctionFactors: ruleResult.correctionFactors,
        additionalRequirements: ruleResult.additionalRequirements,
        customRequirements: customRequirements || null,
        requirementDistributions: requirementDistributions || null
      });

      const balanceEngine = new NutrientBalanceEngine();
      const balanceResult = balanceEngine.calculate({
        requirements: reqResult.requirements,
        soilContributions: soilResult.soilContributions
      });

      return {
        requirements: reqResult.requirements,
        requirementMetadata: reqResult.metadata,
        soilContributions: soilResult.soilContributions,
        soilContext: soilResult.soilContext,
        balanceDetail: balanceResult.balanceDetail,
        netDemands: balanceResult.netDemands,
        summary: balanceResult.summary || null,
        warnings: [...ruleResult.warnings.map((w) => w.message), ...soilResult.warnings],
        methodology: methodology || 'auto'
      };
    } catch (err) {
      throw new DatabaseError('Error generando preview de balance', err);
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
