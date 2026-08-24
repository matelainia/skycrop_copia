/**
 * RuleResolver.js
 * Resuelve conflictos entre reglas usando la jerarquía de ámbito y prioridad.
 *
 * JERARQUÍA (menor → mayor):
 *   global (0) → region (1) → company (2) → farm (3) → lot (4) → user (5)
 *
 * RESOLUCIÓN:
 *   1. Primero gana el mayor nivel de ámbito (lot > company > global)
 *   2. En empate de nivel, gana mayor prioridad numérica
 *   3. En empate de todo, gana la regla con versión más reciente
 *
 * Esto permite que un agrónomo de empresa sobreescriba una regla global,
 * y que una regla de lote sobreescriba una de empresa.
 */

/**
 * Filtra las reglas que aplican al contexto dado.
 *
 * @param {import('../domain/entities/AgronomicRule.js').AgronomicRule[]} rules
 * @param {{ cropId?: string, stageId?: string, nutrientCode?: string, scope?: Object }} context
 * @returns {import('../domain/entities/AgronomicRule.js').AgronomicRule[]}
 */
export function filterApplicableRules(rules, context) {
  return rules.filter((rule) => rule.appliesTo(context));
}

/**
 * Agrupa las reglas por categoría y nutriente para facilitar la resolución.
 *
 * @param {import('../domain/entities/AgronomicRule.js').AgronomicRule[]} rules
 * @returns {Map<string, import('../domain/entities/AgronomicRule.js').AgronomicRule[]>}
 *   Clave: `${category}::${nutrientCode}` o `${category}::all`
 */
export function groupRulesByTarget(rules) {
  const groups = new Map();
  for (const rule of rules) {
    const category = rule.category ?? 'general';
    const nutrient = rule.nutrientCode ?? 'all';
    const key = `${category}::${nutrient}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rule);
  }
  return groups;
}

/**
 * Ordena las reglas por precedencia (de mayor a menor).
 * La primera regla de la lista tiene la mayor prioridad.
 *
 * Criterio de orden:
 *   1. Mayor nivel de ámbito (lot > company > global)
 *   2. Mayor prioridad numérica
 *   3. Mayor versión (más reciente)
 *
 * @param {import('../domain/entities/AgronomicRule.js').AgronomicRule[]} rules
 * @returns {import('../domain/entities/AgronomicRule.js').AgronomicRule[]}
 */
export function sortByPrecedence(rules) {
  return [...rules].sort((a, b) => {
    const scopeDiff = b.getScopeLevel() - a.getScopeLevel();
    if (scopeDiff !== 0) return scopeDiff;
    const priorityDiff = b.priority - a.priority;
    if (priorityDiff !== 0) return priorityDiff;
    return b.version - a.version;
  });
}

/**
 * Resuelve las reglas activas para un contexto dado, aplicando la jerarquía.
 * Para cada combinación category::nutrient, devuelve solo la regla de mayor precedencia.
 *
 * NOTA: No todas las categorías se resuelven por "winner takes all".
 *       Las reglas de tipo 'warning' y 'block' se acumulan (todas aplican).
 *       Las reglas de tipo 'correction_factor' y 'set_efficiency' se resuelven por precedencia.
 *
 * @param {import('../domain/entities/AgronomicRule.js').AgronomicRule[]} allRules
 * @param {Object} context
 * @returns {import('../domain/entities/AgronomicRule.js').AgronomicRule[]} Reglas activas resueltas
 */
export function resolveRules(allRules, context) {
  const applicable = filterApplicableRules(allRules, context);
  const sorted = sortByPrecedence(applicable);

  // Reglas acumulativas (warnings, blocks → todas aplican)
  const accumulativeActionTypes = new Set(['warning', 'block']);

  // Para reglas resolutivas, solo la de mayor precedencia por target
  const resolvedKeys = new Set();
  const result = [];

  for (const rule of sorted) {
    const isAccumulative = rule.actions.every((a) => accumulativeActionTypes.has(a.type));

    if (isAccumulative) {
      result.push(rule);
      continue;
    }

    // Para cada acción no acumulativa, verificar si ya fue resuelta
    const category = rule.category ?? 'general';
    const nutrient = rule.nutrientCode ?? 'all';
    const key = `${category}::${nutrient}`;

    if (!resolvedKeys.has(key)) {
      resolvedKeys.add(key);
      result.push(rule);
    }
    // Si ya hay una regla de mayor precedencia, esta queda descartada
  }

  return result;
}
