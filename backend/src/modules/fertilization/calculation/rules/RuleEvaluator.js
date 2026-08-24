/**
 * RuleEvaluator.js
 * Evalúa condiciones individuales de reglas agronómicas contra un contexto.
 *
 * OPERADORES SOPORTADOS:
 *   '<'       → valor < umbral
 *   '>'       → valor > umbral
 *   '<='      → valor <= umbral
 *   '>='      → valor >= umbral
 *   '=='      → valor == umbral (igualdad estricta de número o string)
 *   '!='      → valor != umbral
 *   'between' → min <= valor <= max (condition.value = [min, max])
 *   'in'      → valor está en el array (condition.value = ['a', 'b'])
 *   'not_in'  → valor NO está en el array
 *   'exists'  → el campo existe y no es null/undefined
 *   'not_exists'  → el campo no existe o es null
 *
 * CAMPOS DEL CONTEXTO:
 *   Notación con punto para acceder a objetos anidados:
 *   'soil.pH'            → context.soil.pH
 *   'soil.K.value'       → context.soil.K.value
 *   'soil.K.classification' → context.soil.K.classification
 *   'crop.id'            → context.crop.id
 *   'stage.name'         → context.stage.name
 *   'targetYield'        → context.targetYield
 *   'soil.organicMatter' → context.soil.organicMatter
 *   'soil.cec'           → context.soil.cec
 */

/**
 * Obtiene un valor del contexto usando notación de punto.
 *
 * @param {Object} context
 * @param {string} field - Ruta con puntos (ej. 'soil.K.value')
 * @returns {*}
 */
function getContextValue(context, field) {
  return field.split('.').reduce((obj, key) => {
    if (obj === null || obj === undefined) return undefined;
    return obj[key];
  }, context);
}

/**
 * Evalúa una condición individual contra el contexto.
 *
 * @param {import('../domain/entities/AgronomicRule.js').RuleCondition} condition
 * @param {Object} context
 * @returns {boolean}
 */
export function evaluateCondition(condition, context) {
  const fieldValue = getContextValue(context, condition.field);
  const { operator, value: condValue } = condition;

  // Operadores de existencia
  if (operator === 'exists') return fieldValue !== null && fieldValue !== undefined;
  if (operator === 'not_exists') return fieldValue === null || fieldValue === undefined;

  // Si el campo no existe, la condición falla para operadores de comparación
  if (fieldValue === null || fieldValue === undefined) return false;

  switch (operator) {
    case '<':
      return fieldValue < condValue;
    case '>':
      return fieldValue > condValue;
    case '<=':
      return fieldValue <= condValue;
    case '>=':
      return fieldValue >= condValue;
    case '==':
      return fieldValue == condValue; // eslint-disable-line eqeqeq
    case '!=':
      return fieldValue != condValue; // eslint-disable-line eqeqeq
    case 'between': {
      const [min, max] = Array.isArray(condValue) ? condValue : [condValue, condValue];
      return fieldValue >= min && fieldValue <= max;
    }
    case 'in':
      return Array.isArray(condValue) && condValue.includes(fieldValue);
    case 'not_in':
      return Array.isArray(condValue) && !condValue.includes(fieldValue);
    default:
      throw new Error(`RuleEvaluator: operador desconocido: ${operator}`);
  }
}

/**
 * Evalúa todas las condiciones de una regla contra un contexto.
 * Combina las condiciones con lógica AND por defecto.
 * Si una condición tiene .logic = 'OR', se combina con OR con la siguiente.
 *
 * @param {import('../domain/entities/AgronomicRule.js').RuleCondition[]} conditions
 * @param {Object} context
 * @returns {boolean} true si todas las condiciones se cumplen
 */
export function evaluateAllConditions(conditions, context) {
  if (!conditions || conditions.length === 0) return true;

  let result = evaluateCondition(conditions[0], context);

  for (let i = 1; i < conditions.length; i++) {
    const prevLogic = conditions[i - 1].logic ?? 'AND';
    const condResult = evaluateCondition(conditions[i], context);
    if (prevLogic === 'OR') {
      result = result || condResult;
    } else {
      result = result && condResult;
    }
  }

  return result;
}
