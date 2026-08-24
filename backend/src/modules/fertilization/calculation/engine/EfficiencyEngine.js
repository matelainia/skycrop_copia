/**
 * EfficiencyEngine.js
 * Aplica factores de eficiencia a las demandas netas.
 */

import { buildEfficiencyMap, applyEfficiencies } from '../formulas/efficiency.formulas.js';

export class EfficiencyEngine {
  /**
   * @param {Object} params
   * @param {Object.<string, number>} params.netDemands - Demandas netas kg/ha
   * @param {Object.<string, number>} [params.ruleEfficiencies] - Eficiencias desde RuleEngine
   * @param {'granular'|'liquid'|'foliar'} [params.defaultApplicationMethod]
   * @returns {{ effectiveDemands: Object.<string, number>, efficiencies: Object.<string, number> }}
   */
  calculate({ netDemands, ruleEfficiencies = {}, defaultApplicationMethod = 'granular' }) {
    const nutrients = Object.keys(netDemands);
    const efficiencies = buildEfficiencyMap(nutrients, ruleEfficiencies, defaultApplicationMethod);
    const effectiveDemands = applyEfficiencies(netDemands, efficiencies);

    return { effectiveDemands, efficiencies };
  }
}
