/**
 * SoilSupplyEngine.js
 * ═══════════════════════════════════════════════════════════════════════════════
 * MOTOR DE OFERTA NUTRICIONAL DEL SUELO
 *
 * Arquitectura propuesta (§12):
 *   PASO 1 (Análisis de suelo) → SoilSupplyEngine → Oferta nutricional
 *                                      ↓
 *                           NutrientBalanceEngine ← PASO 2 (Demanda)
 *                                      ↓
 *                                 Déficit / Balance
 *
 * RESPONSABILIDAD:
 *   Convierte el análisis de suelo (ppm, cmol/kg, % MO, pH, CIC, textura)
 *   en una estimación agronómicamente válida del aporte efectivo del suelo
 *   expresado en kg/ha disponibles por nutriente.
 *
 * NO hace:
 *   - Resta directa de unidades heterogéneas (ej: 40 kg P2O5 - 10 ppm P)
 *   - Eso sería agronómicamente incorrecto (§11).
 *   En su lugar:
 *     ppm → kg/ha (densidad aparente × profundidad) → factor de disponibilidad
 *     cmol/kg → mg/kg → kg/ha → disponibilidad
 *     MO% → N mineralizable → disponibilidad
 *
 * CAPA DE CONVERSIÓN (§11):
 *   10 ppm P
 *     ↓ método de extracción (Bray II / Mehlich)
 *     ↓ profundidad de muestreo (0-20, 0-30)
 *     ↓ densidad aparente (bulk density)
 *     ↓ estimación de P disponible
 *     ↓ factor de aprovechamiento
 *     ↓ aporte efectivo estimado (kg P2O5/ha)
 *
 * Delega la matemática pura a soil.formulas.js; aquí orquesta clasificación,
 * conversión y advertencias.
 *
 * COMPATIBILIDAD:
 *   Alias semántico de SoilAdjustmentEngine. Mantiene API idéntica para
 *   no romper FertilizationEngine existente, pero expone nombre alineado
 *   al diagrama solicitado.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import { SoilAdjustmentEngine as _SoilAdjustmentEngine } from './SoilAdjustmentEngine.js';

export class SoilSupplyEngine extends _SoilAdjustmentEngine {
  /**
   * Versión alias con nombre agronómico explícito.
   * @param {Object} params
   * @param {import('../domain/entities/SoilAnalysis.js').SoilAnalysis} params.soilAnalysis
   * @param {Object.<string, number>} [params.availabilityOverrides]
   * @param {string[]} [params.requiredNutrients]
   * @returns {{ soilContext: Object, soilContributions: Object.<string, number>, warnings: string[] }}
   */
  estimateSupply(params) {
    // Delegar a analyze() del engine base
    return this.analyze(params);
  }

  /**
   * Alias directo para compatibilidad con FertilizationEngine.
   * Permite usar soilSupplyEngine.analyze() o soilSupplyEngine.estimateSupply()
   */
  analyze(params) {
    return super.analyze(params);
  }
}

// Export por defecto también como SoilAdjustmentEngine para migración gradual
export const SoilAdjustmentEngineAlias = SoilSupplyEngine;
