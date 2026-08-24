/**
 * RuleEngine.js
 * Motor de reglas agronómicas — independiente de React, Supabase y UI.
 *
 * Responsabilidades:
 *   1. Recibe reglas (array de AgronomicRule) y un contexto de evaluación
 *   2. Resuelve cuáles aplican (filtra por scope, crop, stage, nutrient)
 *   3. Evalúa sus condiciones contra el contexto
 *   4. Ejecuta sus acciones
 *   5. Devuelve ajustes, factores de corrección, advertencias y trazabilidad
 *
 * CONTEXTO DE EVALUACIÓN:
 *   {
 *     crop: { id, name },
 *     stage: { id, name },
 *     soil: { pH, organicMatter, cec, K: { value, unit, classification }, P: {...}, ... },
 *     targetYield: number (t/ha),
 *     methodology: string,
 *     companyId: string,
 *     farmId: string,
 *     lotId: string,
 *   }
 *
 * RESULTADO:
 *   {
 *     correctionFactors: { N: 1.0, K2O: 1.25 },
 *     efficiencies: { N: 0.65, K2O: 0.70 },
 *     additionalRequirements: { Ca: 20 },  // kg/ha adicionales
 *     warnings: [{ code, message, severity }],
 *     blocks: [],
 *     appliedRules: [{ ruleId, ruleName, version, actionType, actionValue }],
 *   }
 */

import { evaluateAllConditions } from './RuleEvaluator.js';
import { resolveRules } from './RuleResolver.js';
import { RULE_ACTION_TYPES } from '../domain/types/fertilization-calc.types.js';

export class RuleEngine {
  /**
   * Evalúa las reglas aplicables y retorna los ajustes a realizar.
   *
   * @param {import('../domain/entities/AgronomicRule.js').AgronomicRule[]} rules - Todas las reglas disponibles
   * @param {Object} context - Contexto de evaluación
   * @returns {RuleEngineResult}
   */
  evaluate(rules, context) {
    const resolvedRules = resolveRules(rules, context);

    const result = {
      correctionFactors: {},
      efficiencies: {},
      additionalRequirements: {},
      warnings: [],
      blocks: [],
      appliedRules: []
    };

    for (const rule of resolvedRules) {
      const conditionsMet = evaluateAllConditions(rule.conditions, context);
      if (!conditionsMet) continue;

      // Las condiciones se cumplen → ejecutar acciones
      for (const action of rule.actions) {
        this._applyAction(action, rule, result);
      }
    }

    return result;
  }

  /**
   * @private
   */
  _applyAction(action, rule, result) {
    const target = action.target; // nutrientCode o 'all' o null
    const value = action.value;

    switch (action.type) {
      case RULE_ACTION_TYPES.CORRECTION_FACTOR: {
        const factor = parseFloat(value);
        if (isNaN(factor) || factor <= 0) break;
        if (target === 'all' || !target) {
          // Aplica a todos los nutrientes — se registra como un factor general
          result.correctionFactors['_all'] = factor;
        } else {
          result.correctionFactors[target] = factor;
        }
        result.appliedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ruleVersion: rule.version,
          nutrientCode: target ?? 'all',
          actionType: RULE_ACTION_TYPES.CORRECTION_FACTOR,
          actionValue: factor
        });
        break;
      }

      case RULE_ACTION_TYPES.SET_EFFICIENCY: {
        const efficiency = parseFloat(value);
        if (isNaN(efficiency) || efficiency <= 0 || efficiency > 1) break;
        if (target && target !== 'all') {
          result.efficiencies[target] = efficiency;
          result.appliedRules.push({
            ruleId: rule.id,
            ruleName: rule.name,
            ruleVersion: rule.version,
            nutrientCode: target,
            actionType: RULE_ACTION_TYPES.SET_EFFICIENCY,
            actionValue: efficiency
          });
        }
        break;
      }

      case RULE_ACTION_TYPES.ADD_REQUIREMENT: {
        const addition = parseFloat(value);
        if (isNaN(addition) || !target) break;
        result.additionalRequirements[target] =
          (result.additionalRequirements[target] ?? 0) + addition;
        result.appliedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ruleVersion: rule.version,
          nutrientCode: target,
          actionType: RULE_ACTION_TYPES.ADD_REQUIREMENT,
          actionValue: addition
        });
        break;
      }

      case RULE_ACTION_TYPES.WARNING: {
        result.warnings.push({
          ruleId: rule.id,
          code: `RULE_${rule.id}`,
          message: action.message ?? `Advertencia: ${rule.name}`,
          severity: 'medium'
        });
        result.appliedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ruleVersion: rule.version,
          nutrientCode: target ?? null,
          actionType: RULE_ACTION_TYPES.WARNING,
          actionValue: action.message
        });
        break;
      }

      case RULE_ACTION_TYPES.BLOCK: {
        result.blocks.push({
          ruleId: rule.id,
          message: action.message ?? `Bloqueado por regla: ${rule.name}`
        });
        result.appliedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ruleVersion: rule.version,
          nutrientCode: target ?? null,
          actionType: RULE_ACTION_TYPES.BLOCK,
          actionValue: action.message
        });
        break;
      }

      default:
        // Tipo de acción desconocido — ignorar silenciosamente con log
        console.warn(`RuleEngine: tipo de acción desconocido: ${action.type}`);
    }
  }

  /**
   * Aplica correctionFactors al mapa de requerimientos.
   * Si hay un factor '_all', se aplica a todos los que no tengan factor específico.
   *
   * @param {Object.<string, number>} requirements
   * @param {Object.<string, number>} correctionFactors
   * @returns {Object.<string, number>}
   */
  applyCorrections(requirements, correctionFactors) {
    const result = { ...requirements };
    const globalFactor = correctionFactors['_all'];

    for (const [nutrient, value] of Object.entries(result)) {
      if (correctionFactors[nutrient] !== undefined) {
        result[nutrient] = value * correctionFactors[nutrient];
      } else if (globalFactor !== undefined) {
        result[nutrient] = value * globalFactor;
      }
    }

    // Agregar requisitos adicionales de reglas ADD_REQUIREMENT
    return result;
  }
}

/**
 * @typedef {Object} RuleEngineResult
 * @property {Object.<string, number>} correctionFactors
 * @property {Object.<string, number>} efficiencies
 * @property {Object.<string, number>} additionalRequirements
 * @property {Array<{ code: string, message: string, severity: string }>} warnings
 * @property {Array<{ ruleId: string, message: string }>} blocks
 * @property {Array<{ ruleId: string, ruleName: string, ruleVersion: number, nutrientCode: string, actionType: string, actionValue: any }>} appliedRules
 */
