/**
 * Módulo Costos de Producción — DRAFT (rama draft/costos-produccion).
 * Montado en app.js (/api/v1/costos + alias /api/costos) para validación
 * conjunta con la consola frontend (apps/web/src/modules/costs).
 *
 * Alcance: register + ciclo de vida 066 (valorizar/asignar/publicar/reversar)
 * + lecturas. Recalcular responde 501 (stub seguro 066 §7).
 */
export { costsRouter } from './infrastructure/adapters/inbound/ExpressCostsRouter.js';
export { ExpressCostsController } from './infrastructure/adapters/inbound/ExpressCostsController.js';
export { SupabaseCostsRepository } from './infrastructure/adapters/outbound/SupabaseCostsRepository.js';
export { subscribeCostsEvents } from './infrastructure/CostsEventSubscriber.js';
export default {};
