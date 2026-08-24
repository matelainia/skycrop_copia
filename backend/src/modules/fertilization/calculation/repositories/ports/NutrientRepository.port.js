/**
 * NutrientRepository.port.js
 * Puerto del repositorio de nutrientes.
 */

/**
 * @typedef {Object} NutrientRepositoryPort
 *
 * @property {function(): Promise<import('../../domain/entities/Nutrient.js').Nutrient[]>} findAll
 *   Lista todos los nutrientes del catálogo.
 *
 * @property {function(string): Promise<import('../../domain/entities/Nutrient.js').Nutrient>} findByCode
 *   Obtiene un nutriente por código (ej. 'N', 'P2O5'). Lanza NotFoundError si no existe.
 *
 * @property {function(string[]): Promise<Map<string, import('../../domain/entities/Nutrient.js').Nutrient>>} findByCodes
 *   Obtiene múltiples nutrientes por código. Retorna Map<code, Nutrient>.
 */

export {};
