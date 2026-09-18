import eventBus from '../../../shared/events/eventBus.js';
import { SupabaseTraceabilityRepository } from '../../traceability/infrastructure/adapters/outbound/SupabaseTraceabilityRepository.js';

/**
 * CostsEventSubscriber — DRAFT, patrón TraceabilityEventSubscriber.
 * Convierte costs:registered/posted en evidencia inmutable vía
 * traceability_events (RPC empresa-explícita). Best-effort, nunca rompe.
 * Registrar en app.js junto a subscribeTraceabilityEvents() cuando se monte
 * el router (ver backend/src/modules/costs/index.js).
 */
const repository = new SupabaseTraceabilityRepository();
let subscribed = false;

async function persist(
  companyId,
  userId,
  userName,
  { loteId, predioId, title, description, metadata, sourceId }
) {
  if (!companyId || !loteId) return null;
  try {
    return await repository.createEvent(companyId, userId || 'sistema', userName || 'Costos', {
      lote_id: loteId,
      lot_id: loteId,
      predio_id: predioId || null,
      farm_id: predioId || null,
      event_type: 'other',
      source_module: 'costos',
      title: title || 'Evento de costo registrado',
      description: description || null,
      event_date: new Date().toISOString(),
      metadata: metadata || {},
      source_table: 'costos_eventos',
      source_id: sourceId || null
    });
  } catch (err) {
    console.error('[Costs] No se pudo persistir evidencia:', err?.message || err);
    return null;
  }
}

export function subscribeCostsEvents() {
  if (subscribed) return;
  subscribed = true;

  eventBus.on(
    'costs:registered',
    async ({ companyId, userId, userName, event, loteId, predioId }) => {
      await persist(companyId, userId, userName, {
        loteId: loteId || event?.lote_id,
        predioId: predioId || event?.predio_id,
        title: `Costo ${event?.event_type || ''}`.trim() || 'Evento de costo registrado',
        description: event?.source_entity ? `${event.source_module}/${event.source_entity}` : null,
        metadata: {
          event_id: event?.id || null,
          event_type: event?.event_type || null,
          status: event?.status || 'received'
        },
        sourceId: event?.id || null
      });
    }
  );

  eventBus.on('costs:posted', async ({ companyId, userId, userName, entry, loteId, predioId }) => {
    await persist(companyId, userId, userName, {
      loteId: loteId || entry?.lote_id,
      predioId: predioId || entry?.predio_id,
      title: 'Costo publicado',
      description: entry
        ? `${entry.cost_class || ''} ${entry.amount_base || ''} ${entry.currency || 'COP'}`.trim()
        : null,
      metadata: { entry_id: entry?.id || null, amount_base: entry?.amount_base ?? null },
      sourceId: entry?.source_event_id || null
    });
  });

  console.log('[Costs] Suscriptor draft activo (costs:registered/posted).');
}

export default { subscribeCostsEvents };
