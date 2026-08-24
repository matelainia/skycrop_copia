/**
 * RuleVersionManager.js
 * Gestiona versiones de reglas agronómicas.
 * Permite obtener la versión activa y mantener historial.
 */

/**
 * Obtiene la versión activa de cada regla (la más reciente con isActive=true).
 *
 * @param {import('../domain/entities/AgronomicRule.js').AgronomicRule[]} rules
 * @returns {import('../domain/entities/AgronomicRule.js').AgronomicRule[]}
 */
export function getActiveVersions(rules) {
  const byName = new Map();
  for (const rule of rules) {
    if (!rule.isActive) continue;
    const key = rule.name;
    const existing = byName.get(key);
    if (!existing || rule.version > existing.version) {
      byName.set(key, rule);
    }
  }
  return [...byName.values()];
}

/**
 * Filtra reglas por versión exacta.
 *
 * @param {import('../domain/entities/AgronomicRule.js').AgronomicRule[]} rules
 * @param {number} version
 * @returns {import('../domain/entities/AgronomicRule.js').AgronomicRule[]}
 */
export function getRulesAtVersion(rules, version) {
  return rules.filter((r) => r.version === version && r.isActive);
}

/**
 * Crea un snapshot de las versiones de reglas utilizadas en un cálculo.
 * Este snapshot debe guardarse junto con el resultado del cálculo
 * para garantizar la reproducibilidad histórica.
 *
 * @param {import('../domain/entities/AgronomicRule.js').AgronomicRule[]} appliedRules
 * @returns {Object[]} Array de { ruleId, ruleName, version, category, scope }
 */
export function createRulesSnapshot(appliedRules) {
  return appliedRules.map((rule) => ({
    ruleId: rule.id,
    ruleName: rule.name,
    version: rule.version,
    category: rule.category,
    scope: rule.scope,
    priority: rule.priority,
    conditions: JSON.parse(JSON.stringify(rule.conditions)),
    actions: JSON.parse(JSON.stringify(rule.actions)),
    snapshotAt: new Date().toISOString()
  }));
}

/**
 * Verifica que un snapshot de reglas sea compatible con las reglas actuales.
 * Útil para detectar si el resultado podría diferir si se recalcula hoy.
 *
 * @param {Object[]} snapshot - Snapshot guardado
 * @param {import('../domain/entities/AgronomicRule.js').AgronomicRule[]} currentRules
 * @returns {{ compatible: boolean, changes: string[] }}
 */
export function verifySnapshotCompatibility(snapshot, currentRules) {
  const changes = [];
  const currentByName = new Map(currentRules.map((r) => [r.name, r]));

  for (const snapRule of snapshot) {
    const current = currentByName.get(snapRule.ruleName);
    if (!current) {
      changes.push(`Regla eliminada: "${snapRule.ruleName}"`);
    } else if (current.version !== snapRule.version) {
      changes.push(
        `Regla modificada: "${snapRule.ruleName}" (v${snapRule.version} → v${current.version})`
      );
    }
  }

  return { compatible: changes.length === 0, changes };
}
