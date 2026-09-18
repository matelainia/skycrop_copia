/**
 * Módulo Costos de Producción — DRAFT (rama draft/costos-produccion).
 * NO montado en app.js todavía. Para activar en dev, agregar en
 * backend/src/app.js junto a los demás routers:
 *
 *   import { costsRouter } from './modules/costs/infrastructure/adapters/inbound/ExpressCostsRouter.js';
 *   import { subscribeCostsEvents } from './modules/costs/infrastructure/CostsEventSubscriber.js';
 *   app.use('/api/v1/costos', costsRouter);
 *   app.use('/api/costos', costsRouter); // alias legacy, opcional
 *   try { subscribeCostsEvents(); } catch (e) { console.error('[Costs]', e?.message || e); }
 *
 * Alcance: register + ciclo de vida 066 (valorizar/asignar/publicar/reversar)
 * + lecturas. Recalcular responde 501 (stub seguro 066 §7).
 */
export { costsRouter } from './infrastructure/adapters/inbound/ExpressCostsRouter.js';
export { ExpressCostsController } from './infrastructure/adapters/inbound/ExpressCostsController.js';
export { SupabaseCostsRepository } from './infrastructure/adapters/outbound/SupabaseCostsRepository.js';
export { subscribeCostsEvents } from './infrastructure/CostsEventSubscriber.js';
export default {};
