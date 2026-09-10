import eventBus from '../../../shared/events/eventBus.js';
import { SupabaseTraceabilityRepository } from './adapters/outbound/SupabaseTraceabilityRepository.js';

/**
 * TraceabilityEventSubscriber — SkyCrop Core event_generator.
 *
 * Los módulos de dominio (cosecha, fertilización, sanitario, monitoreo, ...)
 * emiten hechos en eventBus; este suscriptor los convierte en evidencia
 * inmutable vía traceability_events. Nunca muta el registro origen.
 *
 * Uso desde cualquier módulo:
 *   eventBus.emit('traceability:log', { companyId, userId, userName, event: {...} });
 * o eventos de dominio:
 *   eventBus.emit('harvest:created', { companyId, userId, userName, harvest, loteId, predioId });
 *   eventBus.emit('fertilization:completed', {...});
 *   eventBus.emit('sanitary:applied', {...});
 *   eventBus.emit('monitoring:registered', {...});
 */

const repository = new SupabaseTraceabilityRepository();
let subscribed = false;

async function persist(companyId, userId, userName, event) {
  if (!companyId || (!event?.lote_id && !event?.lot_id)) return null;
  try {
    return await repository.createEvent(
      companyId,
      userId || 'sistema',
      userName || 'SkyCrop Core',
      {
        lote_id: event.lote_id || event.lot_id,
        lot_id: event.lote_id || event.lot_id,
        predio_id: event.predio_id || event.farm_id || null,
        farm_id: event.predio_id || event.farm_id || null,
        event_type: event.event_type || 'other',
        source_module: event.source_module || 'sistema',
        title: event.title || 'Actividad registrada',
        description: event.description || null,
        event_date: event.event_date || new Date().toISOString(),
        executor_id: event.executor_id || null,
        executor_name: event.executor_name || event.responsable || null,
        latitud: event.latitud ?? null,
        longitud: event.longitud ?? null,
        precision_gps: event.precision_gps ?? null,
        ubicacion_texto: event.ubicacion_texto || null,
        estado: event.estado || 'COMPLETADO',
        metadata: event.metadata || {},
        evidencia_urls: event.evidencia_urls || [],
        source_table: event.source_table || null,
        source_id: event.source_id || null,
        source_code: event.source_code || null
      }
    );
  } catch (err) {
    console.error('[Traceability] No se pudo persistir evidencia:', err?.message || err);
    return null;
  }
}

export function subscribeTraceabilityEvents() {
  if (subscribed) return;
  subscribed = true;

  // Canal genérico (cualquier módulo)
  eventBus.on('traceability:log', async ({ companyId, userId, userName, event }) => {
    await persist(companyId, userId, userName, event);
  });

  // Cosecha creada -> evidencia harvest_collection
  eventBus.on(
    'harvest:created',
    async ({ companyId, userId, userName, harvest, loteId, predioId }) => {
      if (!harvest && !loteId) return;
      await persist(companyId, userId, userName, {
        lote_id: loteId || harvest?.lote_id || harvest?.lote_agricola_id,
        predio_id: predioId || harvest?.predio_id,
        event_type: 'harvest_collection',
        source_module: 'cosecha',
        title: `Cosecha ${harvest?.codigo || ''}`.trim() || 'Cosecha registrada',
        description: harvest
          ? `${harvest.cultivo_variedad || harvest.cultivo || harvest.crop || 'Cultivo'} — ${harvest.cantidad_cosechada ?? harvest.cantidad ?? harvest.weight ?? 0} ${harvest.unidad || 'kg'}`
          : null,
        event_date: harvest?.fecha_cosecha || harvest?.date || new Date().toISOString(),
        executor_name: harvest?.responsable || harvest?.responsable_nombre || null,
        latitud: harvest?.latitud ?? null,
        longitud: harvest?.longitud ?? null,
        metadata: {
          cantidad: harvest?.cantidad_cosechada ?? harvest?.cantidad ?? harvest?.weight ?? null,
          unidad: harvest?.unidad || 'kg',
          area_cosechada: harvest?.area_cosechada ?? null,
          responsable: harvest?.responsable || harvest?.responsable_nombre || null
        },
        source_table: 'cosechas',
        source_id: harvest?.id || null,
        source_code: harvest?.codigo || null
      });
    }
  );

  // Fertilización completada -> fertilization_application
  eventBus.on(
    'fertilization:completed',
    async ({ companyId, userId, userName, application, loteId, predioId }) => {
      await persist(companyId, userId, userName, {
        lote_id: loteId || application?.lote_id,
        predio_id: predioId || application?.predio_id,
        event_type: 'fertilization_application',
        source_module: 'fertilizacion',
        title: 'Aplicación de fertilizante',
        description: application?.completionNote || application?.description || null,
        event_date: application?.completedDate || new Date().toISOString(),
        executor_name: application?.completedBy || null,
        metadata: {
          dosis: application?.doseApplied ?? null,
          unidad: application?.doseUnit || null,
          application_id: application?.id || null
        },
        source_table: 'fertilization_applications',
        source_id: application?.id || null
      });
    }
  );

  // Aplicación sanitaria -> sanitary_application
  eventBus.on('sanitary:applied', async ({ companyId, userId, userName, aplicacion }) => {
    if (!aplicacion) return;
    const isFert = String(aplicacion.tipo_producto || '')
      .toLowerCase()
      .includes('fertil');
    await persist(companyId, userId, userName, {
      lote_id: aplicacion.lote_id,
      event_type: isFert ? 'fertilization_application' : 'sanitary_application',
      source_module: isFert ? 'fertilizacion' : 'sanitario',
      title:
        `${aplicacion.tipo_producto || 'Aplicación'} — ${aplicacion.producto_comercial || ''}`.trim(),
      description: aplicacion.dosis
        ? `Dosis ${aplicacion.dosis} ${aplicacion.unidad_medida || ''}`
        : null,
      event_date: aplicacion.fecha_aplicacion || new Date().toISOString(),
      executor_name: aplicacion.operario_responsable || null,
      metadata: {
        producto: aplicacion.producto_comercial,
        dosis: aplicacion.dosis,
        unidad: aplicacion.unidad_medida,
        metodo: aplicacion.metodo_aplicacion
      },
      source_table: 'aplicaciones',
      source_id: aplicacion.id || null,
      source_code: aplicacion.codigo_apl || null
    });
  });

  // Monitoreo -> general/sanitary monitoring
  eventBus.on('monitoring:registered', async ({ companyId, userId, userName, monitoreo }) => {
    if (!monitoreo) return;
    await persist(companyId, userId, userName, {
      lote_id: monitoreo.lote_id,
      event_type: 'general_monitoring',
      source_module: 'monitoreo',
      title: monitoreo.tipo_monitoreo
        ? `Monitoreo — ${monitoreo.tipo_monitoreo}`
        : 'Monitoreo de campo',
      description: monitoreo.observaciones || null,
      event_date: monitoreo.fecha_monitoreo || new Date().toISOString(),
      executor_name: monitoreo.responsable || null,
      metadata: {},
      source_table: 'monitoreos',
      source_id: monitoreo.id || null
    });
  });

  console.log('[Traceability] Suscriptor SkyCrop Core activo (event_generator).');
}

/** Helper directo para módulos que prefieren llamada explícita sobre eventBus. */
export async function logTraceabilityEvent(companyId, userId, userName, event) {
  return persist(companyId, userId, userName, event);
}

export default { subscribeTraceabilityEvents, logTraceabilityEvent };
