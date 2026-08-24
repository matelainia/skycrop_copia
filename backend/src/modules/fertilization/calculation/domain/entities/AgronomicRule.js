/**
 * AgronomicRule.js
 * Entidad: Regla agronómica configurable sin modificar código.
 * Permite ajustar el comportamiento del motor por condiciones del contexto.
 */
import { RULE_SCOPE, RULE_STATUS, RULE_OPERATOR, RULE_ACTION_TYPE } from '../types/rule.types.js';
import { RULE_PRIORITY } from '../types/fertilization-calc.types.js';
import { InvalidRuleError, InvalidInputError } from '../errors/FertilizationErrors.js';

/**
 * @typedef {Object} RuleCondition
 * @property {string} field - Campo del contexto a evaluar (ver RULE_CONTEXT_FIELD)
 * @property {string} operator - Operador de comparación (ver RULE_OPERATOR)
 * @property {unknown} value - Valor a comparar
 * @property {string} [nutrientCode] - Para condiciones sobre nutrientes específicos
 */

/**
 * @typedef {Object} RuleAction
 * @property {string} type - Tipo de acción (ver RULE_ACTION_TYPE)
 * @property {string} [nutrientCode] - Nutriente afectado
 * @property {number} [factor] - Factor multiplicador (para ADJUST_*)
 * @property {number} [value] - Valor fijo (para SET_*)
 * @property {string} [message] - Mensaje de advertencia (para EMIT_WARNING)
 * @property {string} [warningType] - Tipo de warning (ver WARNING_TYPE)
 */

/**
 * @typedef {Object} AgronomicRuleData
 * @property {string} id - UUID de la regla
 * @property {string} [companyId] - null para reglas globales
 * @property {string} [userId] - null para reglas de empresa/globales
 * @property {string} name - Nombre descriptivo de la regla
 * @property {string} [description] - Descripción agronómica
 * @property {RuleCondition[]} conditions - Condiciones que deben cumplirse
 * @property {string} conditionLogic - 'AND'|'OR' para combinar condiciones
 * @property {RuleAction[]} actions - Acciones a ejecutar si se cumple
 * @property {number} priority - Prioridad (ver RULE_PRIORITY)
 * @property {string} scope - 'global'|'company'|'user'
 * @property {string} version - Versión de la regla (semver)
 * @property {string} status - Estado: active|inactive|deprecated|draft
 * @property {string} [cropId] - Si aplica solo a un cultivo específico
 * @property {string} [stageId] - Si aplica solo a una etapa específica
 * @property {string[]} [nutrientCodes] - Si aplica solo a ciertos nutrientes
 */

export class AgronomicRule {
  /** @param {AgronomicRuleData} data */
  constructor({
    id,
    companyId = null,
    userId = null,
    name,
    description = null,
    conditions = [],
    conditionLogic = 'AND',
    actions = [],
    priority = RULE_PRIORITY.GLOBAL,
    scope = RULE_SCOPE.GLOBAL,
    version = '1.0.0',
    status = RULE_STATUS.ACTIVE,
    cropId = null,
    stageId = null,
    nutrientCodes = []
  }) {
    if (!id) throw new InvalidInputError('AgronomicRule: id es requerido.');
    if (!name) throw new InvalidInputError('AgronomicRule: name es requerido.');
    if (!conditions || conditions.length === 0) {
      throw new InvalidRuleError(`Regla "${name}": debe tener al menos una condición.`);
    }
    if (!actions || actions.length === 0) {
      throw new InvalidRuleError(`Regla "${name}": debe tener al menos una acción.`);
    }
    if (!['AND', 'OR'].includes(conditionLogic)) {
      throw new InvalidRuleError(`Regla "${name}": conditionLogic debe ser 'AND' o 'OR'.`);
    }

    this.id = id;
    this.companyId = companyId;
    this.userId = userId;
    this.name = name;
    this.description = description;
    this.conditions = [...conditions];
    this.conditionLogic = conditionLogic;
    this.actions = [...actions];
    this.priority = priority;
    this.scope = scope;
    this.version = version;
    this.status = status;
    this.cropId = cropId;
    this.stageId = stageId;
    this.nutrientCodes = [...nutrientCodes];
  }

  /** @returns {boolean} */
  get isActive() {
    return this.status === RULE_STATUS.ACTIVE;
  }

  /** @returns {boolean} */
  get isGlobal() {
    return this.scope === RULE_SCOPE.GLOBAL;
  }

  /**
   * Verifica si la regla aplica a un cultivo y/o nutriente específico.
   * @param {string} [cropId]
   * @param {string} [nutrientCode]
   * @returns {boolean}
   */
  appliesTo(cropId = null, nutrientCode = null) {
    const cropMatch = !this.cropId || this.cropId === cropId;
    const nutrientMatch =
      !this.nutrientCodes.length || (nutrientCode && this.nutrientCodes.includes(nutrientCode));
    return cropMatch && nutrientMatch;
  }

  /**
   * Serializa a objeto plano (para snapshot inmutable).
   * @returns {AgronomicRuleData}
   */
  toObject() {
    return {
      id: this.id,
      companyId: this.companyId,
      userId: this.userId,
      name: this.name,
      description: this.description,
      conditions: [...this.conditions],
      conditionLogic: this.conditionLogic,
      actions: [...this.actions],
      priority: this.priority,
      scope: this.scope,
      version: this.version,
      status: this.status,
      cropId: this.cropId,
      stageId: this.stageId,
      nutrientCodes: [...this.nutrientCodes]
    };
  }

  /** @returns {string} */
  toString() {
    return `AgronomicRule(${this.name} [v${this.version}, prioridad: ${this.priority}])`;
  }

  /**
   * Factory desde fila de Supabase.
   * @param {Object} row
   * @returns {AgronomicRule}
   */
  static fromRow(row) {
    return new AgronomicRule({
      id: row.id,
      companyId: row.company_id ?? null,
      userId: row.user_id ?? null,
      name: row.name,
      description: row.description ?? null,
      conditions: row.conditions ?? [],
      conditionLogic: row.condition_logic ?? 'AND',
      actions: row.actions ?? [],
      priority: row.priority ?? RULE_PRIORITY.GLOBAL,
      scope: row.scope ?? RULE_SCOPE.GLOBAL,
      version: row.version ?? '1.0.0',
      status: row.status ?? RULE_STATUS.ACTIVE,
      cropId: row.crop_id ?? null,
      stageId: row.stage_id ?? null,
      nutrientCodes: row.nutrient_codes ?? []
    });
  }
}
