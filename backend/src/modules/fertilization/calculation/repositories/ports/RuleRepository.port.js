/**
 * RuleRepository.port.js
 * Puerto del repositorio de reglas agronómicas.
 */

/**
 * @typedef {Object} RuleRepositoryPort
 *
 * @property {function(string, string|null, string|null): Promise<import('../../domain/entities/AgronomicRule.js').AgronomicRule[]>} findActive
 *   Obtiene las reglas activas aplicables a una empresa, predio y lote.
 *   Incluye reglas globales (companyId=null) + reglas de la empresa + reglas de predio/lote.
 *   @param {string} companyId
 *   @param {string|null} farmId
 *   @param {string|null} lotId
 *
 * @property {function(string, string): Promise<import('../../domain/entities/AgronomicRule.js').AgronomicRule[]>} findByCrop
 *   Obtiene reglas aplicables a un cultivo específico.
 *   @param {string} cropId
 *   @param {string} companyId
 *
 * @property {function(string): Promise<import('../../domain/entities/AgronomicRule.js').AgronomicRule>} findById
 *   Obtiene una regla por ID.
 */

export {};
