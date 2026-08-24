/**
 * RequirementRepository.port.js
 * Puerto del repositorio de requerimientos nutricionales.
 */

/**
 * @typedef {Object} RequirementRepositoryPort
 *
 * @property {function(string, string|null, string): Promise<import('../../domain/entities/CropRequirement.js').CropRequirement[]>} findByCropAndStage
 *   Obtiene los requerimientos de un cultivo para una etapa específica (o el total del ciclo si stageId=null).
 *   @param {string} cropId
 *   @param {string|null} stageId - null para requerimientos del ciclo completo
 *   @param {string} companyId
 *
 * @property {function(string): Promise<import('../../domain/entities/CropRequirement.js').CropRequirement[]>} findByCrop
 *   Obtiene todos los requerimientos de un cultivo (todas las etapas).
 *   @param {string} cropId
 */

export {};
