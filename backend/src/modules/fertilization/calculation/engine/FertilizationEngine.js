/**
 * FertilizationEngine.js
 * Orquestador principal del motor de cálculo de fertilización.
 *
 * PIPELINE PROPUESTO (§12) — Separación agronómica correcta:
 *                 ┌──────────────────────┐
 *                 │       PASO 1         │
 *                 │ Análisis del suelo    │
 *                 └──────────┬───────────┘
 *                            │
 *                            ▼
 *                 ┌──────────────────────┐
 *                 │ SoilSupplyEngine      │  ← Oferta nutricional (kg/ha)
 *                 │ (SoilAdjustmentEngine)│     pH, MO, CIC, textura, ppm→kg/ha
 *                 └──────────┬───────────┘
 *                            │
 *                            │
 * ┌───────────────────┐       │
 * │      PASO 2       │       │
 * │ Requerimientos    │       │
 * │ nutricionales     │       │
 * └─────────┬─────────┘       │
 *           │                 │
 *           ▼                 ▼
 *  ┌────────────────────────────────┐
 *  │      NutrientBalanceEngine     │  ← Demanda - Oferta = Déficit
 *  │      (BalanceEngine)           │
 *  └───────────────┬────────────────┘
 *                 │
 *                 ▼
 *       ┌────────────────────┐
 *       │ AdjustmentEngine   │  ← pH / MO / textura / eficiencia / etapa
 *       └─────────┬──────────┘
 *                 │
 *                 ▼
 *       ┌────────────────────┐
 *       │ FertilizerEngine   │  ← NPK + secundarios + micronutrientes
 *       │ (Selection/Formulation) │
 *       └─────────┬──────────┘
 *                 │
 *                 ▼
 *       ┌────────────────────┐
 *       │ Recommendation     │  ← dosis / ha, dosis / planta, bultos, kg
 *       └────────────────────┘
 *
 * PIPELINE DETALLADO:
 *   input (Paso1 lote+suelo + Paso2 requerimientos)
 *     ↓
 *   validate (ValidationEngine)
 *     ↓
 *   load rules + requirements (via repository / o customRequirements del Paso2)
 *     ↓
 *   build evaluation context
 *     ↓
 *   evaluate rules (RuleEngine) → correctionFactors, efficiencies, warnings
 *     ↓
 *   SoilSupplyEngine → soilContributions, soilContext   (oferta efectiva kg/ha)
 *     ↓
 *   RequirementEngine → requirements (post-corrección) (demanda nutricional)
 *     ↓
 *   NutrientBalanceEngine → netDemands, balanceDetail   (déficit)
 *     ↓
 *   AdjustmentEngine → adjustedDemands, effectiveDemands (necesidad corregida)
 *     ↓
 *   [RAMA A — catálogo] select fertilizers (FertilizerSelectionEngine)
 *   [RAMA B — fuentes del usuario] formulate (FormulationEngine + ResultBuilder)
 *     ↓
 *   generate recommendation → resultado / FertilizationResult
 *     ↓
 *   validate result (ValidationEngine) → warnings finales
 *     ↓
 *   create snapshot (FertilizationResult.toSnapshot())
 *
 * PRINCIPIO DE DETERMINISMO:
 *   Mismo input + mismas reglas + misma versión = mismo resultado.
 *   El engine NO usa random, no llama a AI, no tiene estado entre llamadas.
 *
 * SEPARACIÓN:
 *   Este archivo coordina; no contiene matemáticas.
 *   Las matemáticas están en formulas/*.
 *   Las reglas están en rules/*.
 *   Los datos vienen de los repositories.
 */

import { RuleEngine } from '../rules/RuleEngine.js';
import { getActiveVersions } from '../rules/RuleVersionManager.js';
import { RequirementEngine } from './RequirementEngine.js';
import { SoilAdjustmentEngine } from './SoilAdjustmentEngine.js';
import { SoilSupplyEngine } from './SoilSupplyEngine.js';
import { BalanceEngine } from './BalanceEngine.js';
import { NutrientBalanceEngine } from './NutrientBalanceEngine.js';
import { EfficiencyEngine } from './EfficiencyEngine.js';
import { AdjustmentEngine } from './AdjustmentEngine.js';
import { FertilizerSelectionEngine } from './FertilizerSelectionEngine.js';
import { FormulationEngine } from './FormulationEngine.js';
import { FormulationResultBuilder } from './FormulationResultBuilder.js';
import { ValidationEngine } from './ValidationEngine.js';
import { RecommendationEngine } from './RecommendationEngine.js';
import { FertilizationResult } from '../domain/entities/FertilizationResult.js';
import { SoilAnalysis } from '../domain/entities/SoilAnalysis.js';
import { normalizeFertilizerSources } from '../formulas/formulation.formulas.js';
import { createRulesSnapshot } from '../rules/RuleVersionManager.js';
import {
  CalcCalculationFailedError,
  CalcInvalidInputError
} from '../domain/errors/FertilizationErrors.js';
import { ENGINE_VERSION } from '../domain/types/fertilization-calc.types.js';

export class FertilizationEngine {
  /**
   * @param {Object} repositories
   * @param {Object} repositories.cropRepo
   * @param {Object} repositories.requirementRepo
   * @param {Object} repositories.ruleRepo
   * @param {Object} repositories.fertilizerRepo
   * @param {Object} repositories.soilAnalysisRepo
   * @param {Object} [repositories.calculationRepo]
   */
  constructor(repositories) {
    this.cropRepo = repositories.cropRepo;
    this.requirementRepo = repositories.requirementRepo;
    this.ruleRepo = repositories.ruleRepo;
    this.fertilizerRepo = repositories.fertilizerRepo;
    this.soilAnalysisRepo = repositories.soilAnalysisRepo;
    this.calculationRepo = repositories.calculationRepo ?? null;

    // Sub-engines — nombres alineados a arquitectura propuesta (§12), alias para compatibilidad
    this.validationEngine = new ValidationEngine();
    this.ruleEngine = new RuleEngine();
    this.requirementEngine = new RequirementEngine();
    // SoilSupplyEngine es el nombre agronómico; SoilAdjustmentEngine se mantiene como alias
    this.soilEngine = new SoilSupplyEngine();
    this.soilSupplyEngine = this.soilEngine;
    // NutrientBalanceEngine es el nombre agronómico; BalanceEngine alias
    this.balanceEngine = new NutrientBalanceEngine();
    this.nutrientBalanceEngine = this.balanceEngine;
    this.efficiencyEngine = new EfficiencyEngine();
    this.adjustmentEngine = new AdjustmentEngine();
    this.selectionEngine = new FertilizerSelectionEngine();
    this.formulationEngine = new FormulationEngine();
    this.formulationResultBuilder = new FormulationResultBuilder();
    this.recommendationEngine = new RecommendationEngine();
  }

  /**
   * Ejecuta el pipeline completo de cálculo de fertilización.
   *
   * @param {Object} rawInput - Datos de entrada sin validar
   * @param {string} [userId] - ID del usuario para trazabilidad
   * @returns {Promise<FertilizationResult>}
   * @throws {CalcCalculationFailedError | CalcInvalidInputError | ...}
   */
  async calculate(rawInput, userId = null) {
    // ── PASO 1: Validar entrada ─────────────────────────────────────────────
    const input = this.validationEngine.validateInput(rawInput);
    const {
      cropId,
      stageId,
      targetYieldTHa,
      methodology,
      requirementSource,
      customRequirements,
      requirementDistributions,
      variety,
      productionSystem,
      soilAnalysisId,
      soilAnalysis: soilAnalysisInline,
      companyId,
      lotId,
      farmId,
      applicationMethod,
      constraints,
      fertilizerSources,
      areaHa,
      plantsHa,
      formulationConfig
    } = input;

    try {
      // ── PASO 2: Cargar datos desde repositorios ─────────────────────────
      // Soil inline (Paso1) tiene prioridad si no hay soilAnalysisId persistido
      // Permite calcular sin haber persistido el análisis: oferta se estima transientemente
      const soilInlinePromise = (() => {
        if (soilAnalysisId) return this.soilAnalysisRepo.findById(soilAnalysisId);
        if (
          soilAnalysisInline &&
          typeof soilAnalysisInline === 'object' &&
          soilAnalysisInline.pH !== undefined &&
          soilAnalysisInline.pH !== null &&
          soilAnalysisInline.pH !== ''
        ) {
          try {
            const nutrients = {};
            for (const code of ['N', 'P', 'K', 'Ca', 'Mg', 'S']) {
              const v = soilAnalysisInline[code];
              if (v !== null && v !== undefined && v !== '' && !isNaN(Number(v))) {
                const isCmol = ['K', 'Ca', 'Mg'].includes(code);
                nutrients[code] = { value: Number(v), unit: isCmol ? 'cmol/kg' : 'mg/kg' };
              }
            }
            // También tomar nutrientes si vienen como objeto anidado P:{value,unit} etc.
            for (const code of ['P', 'K', 'Ca', 'Mg']) {
              if (
                soilAnalysisInline[code] &&
                typeof soilAnalysisInline[code] === 'object' &&
                soilAnalysisInline[code].value !== undefined
              ) {
                nutrients[code] = {
                  value: Number(soilAnalysisInline[code].value),
                  unit:
                    soilAnalysisInline[code].unit ||
                    (['K', 'Ca', 'Mg'].includes(code) ? 'cmol/kg' : 'mg/kg')
                };
              }
            }
            return Promise.resolve(
              new SoilAnalysis({
                id: 'inline-transient',
                ph: Number(soilAnalysisInline.pH) || 6.5,
                organicMatter:
                  soilAnalysisInline.organicMatter != null &&
                  soilAnalysisInline.organicMatter !== ''
                    ? Number(soilAnalysisInline.organicMatter)
                    : null,
                cec:
                  soilAnalysisInline.cec != null && soilAnalysisInline.cec !== ''
                    ? Number(soilAnalysisInline.cec)
                    : null,
                texture: soilAnalysisInline.texture || soilAnalysisInline.textura || null,
                nutrients,
                metadata: { inline: true, variety, productionSystem }
              })
            );
          } catch {
            return Promise.resolve(null);
          }
        }
        return Promise.resolve(null);
      })();

      // Si el Paso 2 envió customRequirements, no es necesario cargar de DB (pero igual cargamos para trazabilidad)
      const shouldLoadRequirements = !(
        customRequirements && Object.keys(customRequirements).length > 0
      );
      const [crop, stage, cropRequirements, allRules, fertilizers, soilAnalysis] =
        await Promise.all([
          this.cropRepo.findById(cropId),
          this.cropRepo.findStageById(stageId),
          shouldLoadRequirements
            ? this.requirementRepo.findByCropAndStage(cropId, stageId, companyId)
            : Promise.resolve([]),
          this.ruleRepo.findActive(companyId, farmId, lotId),
          this.fertilizerRepo.findActive(companyId),
          soilInlinePromise
        ]);

      // ── PASO 3: Activar solo las versiones vigentes de reglas ───────────
      const activeRules = getActiveVersions(allRules);

      // ── PASO 4: Construir contexto de evaluación para las reglas ────────
      const evaluationContext = this._buildEvaluationContext({
        crop,
        stage,
        targetYieldTHa,
        soilAnalysis,
        companyId,
        farmId,
        lotId,
        methodology
      });

      // ── PASO 5: Evaluar reglas ───────────────────────────────────────────
      const ruleResult = this.ruleEngine.evaluate(activeRules, evaluationContext);

      if (ruleResult.blocks.length > 0) {
        throw new CalcCalculationFailedError(
          `Cálculo bloqueado por regla: ${ruleResult.blocks[0].message}`
        );
      }

      // ── PASO 6: Diagnóstico de suelo ─────────────────────────────────────
      const requiredNutrients = ['N', 'P2O5', 'K2O', 'Ca', 'Mg', 'S'];
      const soilResult = soilAnalysis
        ? this.soilEngine.analyze({ soilAnalysis, requiredNutrients })
        : { soilContext: {}, soilContributions: {}, warnings: [] };

      // Actualizar contexto con clasificaciones de suelo (para re-evaluación de reglas si necesario)
      if (soilResult.soilContext) {
        evaluationContext.soil = soilResult.soilContext;
        // Re-evaluar reglas que dependen de clasificación de suelo
        const ruleResultFull = this.ruleEngine.evaluate(activeRules, evaluationContext);
        Object.assign(ruleResult.correctionFactors, ruleResultFull.correctionFactors);
        Object.assign(ruleResult.efficiencies, ruleResultFull.efficiencies);
        ruleResult.warnings.push(
          ...ruleResultFull.warnings.filter(
            (w) => !ruleResult.warnings.find((ex) => ex.ruleId === w.ruleId)
          )
        );
        ruleResult.appliedRules.push(
          ...ruleResultFull.appliedRules.filter(
            (r) => !ruleResult.appliedRules.find((ex) => ex.ruleId === r.ruleId)
          )
        );
      }

      // ── PASO 7: Calcular requerimientos ──────────────────────────────────
      // SoilSupplyEngine ya no se llama aquí para oferta; pero la DEMANDA proviene del Paso 2
      // Si customRequirements existe, RequirementEngine lo usa directamente (fuente = técnico)
      // Si no, escala desde DB según metodología y targetYield
      const reqResult = this.requirementEngine.calculate({
        requirements: cropRequirements,
        targetYieldTHa,
        methodology: methodology ?? null,
        correctionFactors: ruleResult.correctionFactors,
        additionalRequirements: ruleResult.additionalRequirements,
        customRequirements: customRequirements ?? null,
        requirementDistributions: requirementDistributions ?? null
      });

      // ── PASO 8: Balance nutricional ──────────────────────────────────────
      const balanceResult = this.balanceEngine.calculate({
        requirements: reqResult.requirements,
        soilContributions: soilResult.soilContributions
      });

      // ── RAMA FORMULACIÓN (Paso 3 — Fuentes Fertilizantes) ────────────────
      // Cuando el usuario registra fuentes fertilizantes, el motor formula
      // exclusivamente con ellas: el requerimiento neto proviene del
      // diagnóstico y la combinación/dosis se resuelve automáticamente.
      if (Array.isArray(fertilizerSources) && fertilizerSources.length > 0) {
        return this._calculateWithFormulation({
          fertilizerSources,
          netDemands: balanceResult.netDemands,
          areaHa,
          plantsHa,
          formulationConfig,
          context: {
            crop,
            stage,
            targetYieldTHa,
            methodology,
            soilAnalysis,
            companyId,
            cropId,
            stageId,
            lotId,
            farmId,
            soilAnalysisId,
            userId,
            warningsDiagnostico: [
              ...ruleResult.warnings.map((w) => w.message),
              ...soilResult.warnings
            ]
          }
        });
      }

      // ── PASO 9: Aplicar eficiencias ──────────────────────────────────────
      const effResult = this.efficiencyEngine.calculate({
        netDemands: balanceResult.netDemands,
        ruleEfficiencies: ruleResult.efficiencies,
        defaultApplicationMethod: applicationMethod
      });

      // ── PASO 10: Selección de fertilizantes ─────────────────────────────
      const selectionResult = this.selectionEngine.select({
        availableFertilizers: fertilizers,
        effectiveDemands: effResult.effectiveDemands,
        constraints
      });

      // ── PASO 11: Generar recomendación ───────────────────────────────────
      const calculationVersion = this._generateCalculationVersion();
      const allWarnings = [
        ...ruleResult.warnings.map((w) => w.message),
        ...soilResult.warnings,
        ...selectionResult.warnings
      ];

      const resultData = this.recommendationEngine.generate({
        crop,
        stage,
        targetYield: { value: targetYieldTHa, unit: 't/ha' },
        methodology: methodology ?? 'auto',
        soilAnalysis,
        requirements: reqResult.requirements,
        balanceDetail: balanceResult.balanceDetail,
        efficiencies: effResult.efficiencies,
        selectedDoses: selectionResult.doses,
        totalApplied: selectionResult.totalApplied,
        warnings: allWarnings,
        appliedRules: ruleResult.appliedRules,
        calculationVersion
      });

      const fertilizationResult = new FertilizationResult(resultData);

      // ── PASO 12: Validar resultado ───────────────────────────────────────
      const validationResult = this.validationEngine.validateResult(fertilizationResult);
      // Los warnings de validación ya están en el resultado

      // ── PASO 13: Guardar en BD (si hay repositorio de cálculos) ─────────
      if (this.calculationRepo && userId) {
        const snapshot = fertilizationResult.toSnapshot();
        const rulesSnapshot = createRulesSnapshot(
          ruleResult.appliedRules.map((ar) => ({
            ...ar,
            conditions: activeRules.find((r) => r.id === ar.ruleId)?.conditions ?? [],
            actions: activeRules.find((r) => r.id === ar.ruleId)?.actions ?? [],
            scope: activeRules.find((r) => r.id === ar.ruleId)?.scope ?? {}
          }))
        );
        // Fire-and-forget — no bloqueamos el resultado
        this.calculationRepo
          .save({
            userId,
            companyId,
            cropId,
            stageId,
            lotId,
            targetYieldTHa,
            methodology,
            soilAnalysisId,
            calculationVersion,
            result: fertilizationResult.toJSON(),
            snapshot,
            rulesSnapshot
          })
          .catch((err) => console.error('Error guardando cálculo en BD:', err));
      }

      return fertilizationResult;
    } catch (err) {
      if (err.code && err.code.startsWith('CALC_')) throw err;
      throw new CalcCalculationFailedError(err.message, err);
    }
  }

  /**
   * @private
   * Rama de formulación con fuentes registradas por el usuario.
   *
   * EFICIENCIA (§22): la capa de eficiencia NO se aplica por defecto.
   * El requerimiento canónico es el neto del diagnóstico
   * (requerimiento − aporte de suelo). RequerimientoBruto =
   * RequerimientoNeto/Eficiencia solo cuando la metodología agronómica
   * seleccionada lo indique (config.efficiency.enabled).
   */
  _calculateWithFormulation({
    fertilizerSources,
    netDemands,
    areaHa,
    plantsHa,
    formulationConfig,
    context
  }) {
    let sources;
    try {
      sources = normalizeFertilizerSources(fertilizerSources);
    } catch (err) {
      throw new CalcInvalidInputError(
        `Fuentes fertilizantes inválidas: ${err.message}`,
        err.details ?? null
      );
    }

    // Aplicar capa de eficiencia solo si está explícitamente activada
    const cfgWithEfficiency = { ...(formulationConfig ?? {}) };
    if (
      cfgWithEfficiency.efficiency?.enabled &&
      cfgWithEfficiency.efficiency.factors &&
      Object.keys(cfgWithEfficiency.efficiency.factors).length > 0
    ) {
      for (const [nutrient, demand] of Object.entries(netDemands)) {
        const factor = cfgWithEfficiency.efficiency.factors[nutrient];
        if (typeof factor === 'number' && factor > 0 && factor <= 1) {
          netDemands[nutrient] = demand / factor; // RequerimientoBruto = Neto/Eficiencia
        }
      }
    }

    const solveResult = this.formulationEngine.solve({
      sources,
      demands: netDemands,
      config: formulationConfig
    });

    const calculationVersion = this._generateCalculationVersion();
    const result = this.formulationResultBuilder.build({
      solveResult,
      sources,
      requirements: netDemands,
      areaHa,
      plantsHa,
      context: {
        crop: context.crop,
        stage: context.stage,
        targetYieldTHa: context.targetYieldTHa,
        methodology: context.methodology,
        soilAnalysis: context.soilAnalysis,
        lotId: context.lotId,
        farmId: context.farmId
      },
      calculationVersion
    });

    result.warnings = [...context.warningsDiagnostico, ...result.warnings];

    // ── Persistir snapshot (fire-and-forget) ────────────────────────────────
    if (this.calculationRepo && context.userId) {
      this.calculationRepo
        .save({
          userId: context.userId,
          companyId: context.companyId,
          cropId: context.cropId,
          stageId: context.stageId,
          lotId: context.lotId,
          targetYieldTHa: context.targetYieldTHa,
          methodology: context.methodology,
          soilAnalysisId: context.soilAnalysisId,
          calculationVersion,
          result,
          snapshot: result.snapshot,
          rulesSnapshot: null
        })
        .catch((err) => console.error('Error guardando cálculo en BD:', err));
    }

    return {
      ...result,
      toObject() {
        return result;
      },
      toJSON() {
        return result;
      }
    };
  }

  /**
   * @private
   * Construye el contexto de evaluación para el RuleEngine.
   */
  _buildEvaluationContext({
    crop,
    stage,
    targetYieldTHa,
    soilAnalysis,
    companyId,
    farmId,
    lotId,
    methodology
  }) {
    return {
      crop: { id: crop?.id, name: crop?.name },
      stage: { id: stage?.id, name: stage?.name },
      targetYield: targetYieldTHa,
      methodology: methodology ?? null,
      companyId,
      farmId,
      lotId,
      soil: soilAnalysis
        ? {
            pH: soilAnalysis.pH,
            organicMatter: soilAnalysis.organicMatter,
            cec: soilAnalysis.cec,
            texture: soilAnalysis.texture,
            K: soilAnalysis.K,
            P: soilAnalysis.P,
            Ca: soilAnalysis.Ca,
            Mg: soilAnalysis.Mg,
            S: soilAnalysis.S
          }
        : {}
    };
  }

  /**
   * @private
   * Genera un identificador de versión del cálculo.
   * Formato: ENGINE_VERSION-YYYYMMDD-HHMMSS
   */
  _generateCalculationVersion() {
    const now = new Date();
    const ts = now
      .toISOString()
      .replace(/[-T:Z.]/g, '')
      .slice(0, 14);
    return `${ENGINE_VERSION}-${ts}`;
  }
}
