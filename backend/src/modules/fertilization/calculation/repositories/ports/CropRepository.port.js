/**
 * CropRepository.port.js
 * Puerto (interfaz) del repositorio de cultivos.
 * Los adaptadores de infraestructura deben implementar estos métodos.
 */

/**
 * @typedef {Object} CropRepositoryPort
 *
 * @property {function(string): Promise<import('../../domain/entities/Crop.js').Crop>} findById
 *   Obtiene un cultivo por ID. Lanza NotFoundError si no existe.
 *
 * @property {function(string): Promise<import('../../domain/entities/Crop.js').Crop[]>} findAll
 *   Lista todos los cultivos activos.
 *
 * @property {function(string): Promise<import('../../domain/entities/PhenologicalStage.js').PhenologicalStage>} findStageById
 *   Obtiene una etapa fenológica por ID.
 *
 * @property {function(string): Promise<import('../../domain/entities/PhenologicalStage.js').PhenologicalStage[]>} findStagesByCrop
 *   Lista todas las etapas de un cultivo, ordenadas por order.
 */

export {};
