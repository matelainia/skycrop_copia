/**
 * FertilizerRepository.port.js
 * Puerto del repositorio de fertilizantes.
 */

/**
 * @typedef {Object} FertilizerRepositoryPort
 *
 * @property {function(string): Promise<import('../../domain/entities/Fertilizer.js').Fertilizer[]>} findActive
 *   Lista fertilizantes activos para una empresa (incluye los globales).
 *   @param {string} companyId
 *
 * @property {function(string): Promise<import('../../domain/entities/Fertilizer.js').Fertilizer>} findById
 *   Obtiene un fertilizante por ID. Lanza NotFoundError si no existe.
 *
 * @property {function(string, string): Promise<import('../../domain/entities/Fertilizer.js').Fertilizer[]>} findByNutrient
 *   Lista fertilizantes que contienen un nutriente específico.
 *   @param {string} nutrientCode
 *   @param {string} companyId
 */

export {};
