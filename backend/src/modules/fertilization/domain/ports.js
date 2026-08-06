/**
 * ports.js
 * Definición de puertos (interfaces) del módulo de Fertilización.
 * En JS usamos JSDoc para documentar la "interfaz" esperada.
 * Los adaptadores de infraestructura deben implementar estos métodos.
 */

/**
 * @typedef {Object} FertilizationRepositoryPort
 *
 * @property {function(string): Promise<Object>} getPlanDetail
 *   Obtiene el detalle completo de un plan por ID.
 *   @param {string} planId - UUID del plan
 *   @returns {{ plan, items, applications, nextApp, observations, alerts, fieldCondition, nutrition }}
 *
 * @property {function(string, string, Object): Promise<Object>} savePlan
 *   Crea o actualiza un plan.
 *   @param {string} companyId
 *   @param {string|null} planId - null para crear, UUID para actualizar
 *   @param {Object} data
 *
 * @property {function(string, string, Object): Promise<Object>} saveObservation
 *   Registra o actualiza una observación con adjuntos y nutrientes.
 *   @param {string} planId
 *   @param {string} companyId
 *   @param {Object} payload
 *
 * @property {function(string, string, Object): Promise<Object>} completeApplication
 *   Marca una aplicación como realizada y recalcula métricas.
 *   @param {string} applicationId
 *   @param {string} companyId
 *   @param {Object} completionData
 *
 * @property {function(string, string, string): Promise<Object>} addComment
 *   Agrega un comentario a una observación.
 *   @param {string} observationId
 *   @param {string} companyId
 *   @param {Object} commentData
 */

/**
 * @typedef {Object} FertilizationStoragePort
 *
 * @property {function(string, string, Buffer, string): Promise<string>} uploadAttachment
 *   Sube un archivo al bucket de Storage.
 *   @param {string} companyId
 *   @param {string} observationId
 *   @param {Buffer} fileBuffer
 *   @param {string} fileName
 *   @returns {Promise<string>} filePath en Storage
 *
 * @property {function(string): Promise<string>} getSignedUrl
 *   Genera una URL firmada para acceder a un archivo.
 *   @param {string} filePath
 *   @returns {Promise<string>} URL firmada
 */

/**
 * @typedef {Object} FertilizationPdfPort
 *
 * @property {function(Object): Promise<Buffer>} generatePlanPdf
 *   Genera el PDF del plan de fertilización.
 *   @param {Object} planDetail - Detalle completo del plan
 *   @returns {Promise<Buffer>} Buffer del PDF
 */

export {};
