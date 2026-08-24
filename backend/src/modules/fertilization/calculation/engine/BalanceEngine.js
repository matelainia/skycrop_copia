/**
 * BalanceEngine.js
 * Calcula la demanda neta descontando el aporte del suelo.
 *
 * NOTA: calculateBalance() de balance.formulas.js calcula el balance aplicado
 * vs demanda (números). El detalle por nutriente se construye aquí con
 * calculateNetDemand() para mantener trazabilidad por nutriente.
 */

import { calculateNetDemand } from '../formulas/balance.formulas.js';

export class BalanceEngine {
  /**
   * @param {Object} params
   * @param {Object.<string, number>} params.requirements - kg/ha por nutriente (post-corrección)
   * @param {Object.<string, number>} params.soilContributions - kg/ha aportados por el suelo
   * @returns {{ netDemands: Object.<string, number>, balanceDetail: Object }}
   */
  calculate({ requirements, soilContributions }) {
    const balanceDetail = {};

    for (const [nutrient, rawRequirement] of Object.entries(requirements ?? {})) {
      const requirement = Number(rawRequirement) || 0;
      const soilContribution = Number(soilContributions?.[nutrient]) || 0;
      const netDemandKgHa = calculateNetDemand(requirement, soilContribution);

      // `netDemand` y `netDemandKgHa` se exponen con ambos nombres por
      // compatibilidad con los consumidores existentes (buildFullBalance,
      // frontend del diagnóstico).
      balanceDetail[nutrient] = {
        nutrientCode: nutrient,
        requirement,
        soilContribution,
        netDemand: netDemandKgHa,
        netDemandKgHa,
        status: netDemandKgHa <= 0 ? 'covered' : 'deficit'
      };
    }

    const netDemands = {};
    for (const [nutrient, data] of Object.entries(balanceDetail)) {
      netDemands[nutrient] = data.netDemandKgHa;
    }

    return { netDemands, balanceDetail };
  }
}
