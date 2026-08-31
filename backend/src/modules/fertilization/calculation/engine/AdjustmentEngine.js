/**
 * AdjustmentEngine.js
 * ═══════════════════════════════════════════════════════════════════════════════
 * MOTOR DE AJUSTES AGRONÓMICOS
 *
 * Arquitectura propuesta (§12):
 *   Déficit nutricional (NutrientBalanceEngine)
 *        ↓
 *   AdjustmentEngine  ←  pH / MO / textura / eficiencia / etapa fenológica
 *        ↓
 *   Necesidad de fertilización corregida
 *        ↓
 *   FertilizerEngine
 *
 * RESPONSABILIDAD:
 *   Aplicar correcciones agronómicas NO lineales sobre el déficit:
 *   - Corrección por pH: ej. pH <5.5 → +30% P2O5 por fijación
 *   - Corrección por MO / textura / CIC
 *   - Eficiencia de aprovechamiento del fertilizante según método de aplicación
 *     (granular / liquid / foliar) y nutriente
 *   - Factores específicos de etapa fenológica (ej. cacao floración → +20% K2O)
 *   - Reglas configurables de Supabase (fert_calc_rules + fert_calc_efficiency_factors)
 *
 * Esta capa es la que convierte:
 *   Déficit bruto (kg/ha) → Necesidad de fertilización efectiva (kg/ha)
 * considerando que no todo lo aplicado es aprovechado por la planta.
 *
 * Fórmula conceptual:
 *   Necesidad_corregida = Déficit × factor_pH × factor_textura / eficiencia
 *
 * Delega a:
 *   - RuleEngine (correctionFactors)
 *   - EfficiencyEngine (eficiencias por nutriente/método)
 *   - balance.formulas / soil.formulas para factores base
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import { EfficiencyEngine } from './EfficiencyEngine.js';
import { RuleEngine } from '../rules/RuleEngine.js';
import { applyCorrectionFactors } from '../formulas/requirement.formulas.js';

export class AdjustmentEngine {
  constructor() {
    this.efficiencyEngine = new EfficiencyEngine();
    this.ruleEngine = new RuleEngine();
  }

  /**
   * Aplica ajustes agronómicos al balance neto.
   *
   * @param {Object} params
   * @param {Object.<string, number>} params.netDemands - Déficit kg/ha (BalanceEngine)
   * @param {Object.<string, number>} [params.correctionFactors] - Factores de RuleEngine (ej. { P2O5: 1.3 })
   * @param {Object.<string, number>} [params.ruleEfficiencies] - Eficiencias de RuleEngine
   * @param {string} [params.defaultApplicationMethod] - granular|liquid|foliar
   * @param {Object} [params.soilContext] - Contexto enriquecido de suelo (pH, textura, etc.)
   * @returns {{
   *   adjustedDemands: Object.<string, number>,
   *   effectiveDemands: Object.<string, number>,
   *   efficiencies: Object.<string, number>,
   *   warnings: string[],
   *   metadata: Object
   * }}
   */
  adjust({
    netDemands,
    correctionFactors = {},
    ruleEfficiencies = {},
    defaultApplicationMethod = 'granular',
    soilContext = {}
  }) {
    // 1. Aplicar factores de corrección de suelo/etapa (ej. +30% P en pH ácido)
    const hasCorrections = correctionFactors && Object.keys(correctionFactors).length > 0;
    const adjustedDemands = hasCorrections
      ? applyCorrectionFactors(netDemands, correctionFactors)
      : { ...netDemands };

    // Redondear
    for (const k of Object.keys(adjustedDemands)) {
      adjustedDemands[k] = parseFloat(Number(adjustedDemands[k]).toFixed(4));
    }

    // 2. Aplicar eficiencias de aprovechamiento
    // effectiveDemand = adjustedDemand / eficiencia  → lo que hay que aplicar para que llegue lo requerido
    const effResult = this.efficiencyEngine.calculate({
      netDemands: adjustedDemands,
      ruleEfficiencies,
      defaultApplicationMethod
    });

    const warnings = [];
    // Advertencias por pH extremo etc. se toman del soilContext si existe
    if (soilContext?.pH !== undefined) {
      if (soilContext.pH < 5.5) {
        warnings.push(
          `Suelo ácido (pH ${soilContext.pH}): la eficiencia de P puede estar reducida; se aplicó factor de corrección.`
        );
      }
      if (soilContext.pH > 7.5) {
        warnings.push(
          `Suelo alcalino (pH ${soilContext.pH}): disponibilidad de micronutrientes reducida. Considere quelatos o aplicación foliar.`
        );
      }
    }

    return {
      adjustedDemands,
      effectiveDemands: effResult.effectiveDemands,
      efficiencies: effResult.efficiencies,
      warnings,
      metadata: {
        hasCorrectionFactors: hasCorrections,
        applicationMethod: defaultApplicationMethod,
        correctedCount: Object.keys(correctionFactors).length
      }
    };
  }

  /**
   * Versión simplificada: solo corrige sin eficiencia (para preview de balance bruto).
   * Útil para Paso 3 — Balance sin asumir eficiencia (mostrar déficit real vs corregido).
   */
  adjustWithoutEfficiency({ netDemands, correctionFactors = {} }) {
    const hasCorrections = correctionFactors && Object.keys(correctionFactors).length > 0;
    const adjusted = hasCorrections
      ? applyCorrectionFactors(netDemands, correctionFactors)
      : { ...netDemands };
    for (const k of Object.keys(adjusted)) {
      adjusted[k] = parseFloat(Number(adjusted[k]).toFixed(4));
    }
    return adjusted;
  }
}
