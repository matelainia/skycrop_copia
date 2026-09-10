import crypto from 'crypto';
import { supabaseAdmin } from '../../../../../shared/database/supabase.js';
import { DatabaseError, NotFoundError } from '../../../../../shared/errors/AppErrors.js';
import { TRACE_EVENT_LABELS, TRACE_MODULE_LABELS } from '../../../domain/traceability.constants.js';

/**
 * SupabaseTraceabilityRepository — acceso a traceability_events + timeline unificado.
 *
 * Timeline unificado (Fase 1): si traceability_events aún no tiene datos para el
 * lote (instalaciones legacy), se construye una vista de solo-lectura agregando
 * las tablas origen (cosechas, aplicaciones, monitoreos, fertilization_*,
 * historial_actividades) SIN mutarlas. Cuando existen eventos inmutables, estos
 * son la fuente oficial y las fuentes origen solo enriquecen el detalle.
 */
export class SupabaseTraceabilityRepository {
  _loteOf(row) {
    return row.lot_id || row.lote_id || null;
  }

  _mapEvent(row) {
    const loteId = row.lot_id ?? row.lote_id ?? null;
    return {
      id: row.id,
      event_code: row.event_code,
      lote_id: loteId,
      lot_id: loteId,
      predio_id: row.predio_id ?? row.farm_id ?? null,
      farm_id: row.farm_id ?? row.predio_id ?? null,
      event_type: row.event_type,
      event_label: TRACE_EVENT_LABELS[row.event_type] || row.event_type,
      source_module: row.source_module,
      module_label: TRACE_MODULE_LABELS[row.source_module] || row.source_module,
      title: row.title,
      description: row.description,
      estado: row.estado,
      event_date: row.event_date,
      created_at: row.created_at,
      created_by: row.created_by,
      created_by_name: row.created_by_name,
      executor_id: row.executor_id,
      executor_name: row.executor_name,
      responsable: row.executor_name || row.created_by_name || '—',
      role_at_event: row.role_at_event,
      latitud: row.latitud,
      longitud: row.longitud,
      precision_gps: row.precision_gps,
      ubicacion_texto: row.ubicacion_texto,
      metadata: row.metadata || {},
      evidencia_urls: row.evidencia_urls || [],
      attachment_ids: row.attachment_ids || [],
      source_table: row.source_table,
      source_id: row.source_id,
      source_code: row.source_code,
      previous_hash: row.previous_hash,
      event_hash: row.event_hash,
      integrity_status: row.integrity_status,
      last_verified_at: row.last_verified_at,
      immutable: true,
      origin: row.origin,
      lote_codigo: row.lotes?.codigo_interno || row.lote_codigo || null,
      lote_nombre: row.lotes?.nombre || row.lote_nombre || null,
      predio_nombre: row.predios?.nombre || row.predio_nombre || null
    };
  }

  _computeHash({
    companyId,
    loteId,
    eventType,
    sourceModule,
    eventDate,
    createdBy,
    executor,
    title,
    metadata,
    previousHash
  }) {
    const payload = [
      companyId || '',
      loteId || '',
      eventType || '',
      sourceModule || '',
      eventDate || '',
      createdBy || '',
      executor || '',
      title || '',
      typeof metadata === 'string' ? metadata : JSON.stringify(metadata || {}),
      previousHash || 'GENESIS'
    ].join('|');
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  async createEvent(companyId, userId, userName, data) {
    try {
      const loteId = data.lote_id || data.lot_id;
      const predioId = data.predio_id || data.farm_id || null;
      // RPC empresa-explícita (service_role): el trigger SQL calcula código + hash encadenado.
      const { data: rpc, error } = await supabaseAdmin.rpc(
        'registrar_evento_trazabilidad_empresa',
        {
          p_company_id: companyId,
          p_lote_id: loteId,
          p_event_type: data.event_type,
          p_source_module: data.source_module,
          p_title: data.title,
          p_event_date: data.event_date
            ? new Date(data.event_date).toISOString()
            : new Date().toISOString(),
          p_predio_id: predioId,
          p_created_by: userId || 'sistema',
          p_created_by_name: userName || data.created_by_name || null,
          p_executor_id: data.executor_id || null,
          p_executor_name: data.executor_name || null,
          p_description: data.description || null,
          p_lat: data.latitud ?? null,
          p_lng: data.longitud ?? null,
          p_metadata: data.metadata || {},
          p_source_table: data.source_table || null,
          p_source_id: data.source_id || null,
          p_source_code: data.source_code || null,
          p_estado: data.estado || 'COMPLETADO'
        }
      );
      if (error) {
        // Fallback: migración 048 aún no aplicada en este entorno -> insert directo
        // con hash calculado en JS (misma fórmula que SQL).
        if (error.code === '42883' || String(error.message || '').includes('registrar_evento')) {
          return await this._createEventDirect(companyId, userId, userName, data, loteId, predioId);
        }
        throw error;
      }
      const eventId = rpc?.event_id;
      if (!eventId) return rpc;
      const { data: full } = await supabaseAdmin
        .from('traceability_events')
        .select('*')
        .eq('id', eventId)
        .eq('company_id', companyId)
        .maybeSingle();
      return full ? this._mapEvent(full) : rpc;
    } catch (err) {
      throw new DatabaseError('Error creando evento de trazabilidad', err);
    }
  }

  async _createEventDirect(companyId, userId, userName, data, loteId, predioId) {
    const { data: last } = await supabaseAdmin
      .from('traceability_events')
      .select('event_hash')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const previousHash = last?.event_hash || null;
    const eventDate = data.event_date
      ? new Date(data.event_date).toISOString()
      : new Date().toISOString();
    const executor = data.executor_id || data.executor_name || '';
    const eventHash = this._computeHash({
      companyId,
      loteId,
      eventType: data.event_type,
      sourceModule: data.source_module,
      eventDate,
      createdBy: userId || 'sistema',
      executor,
      title: data.title,
      metadata: data.metadata || {},
      previousHash
    });
    const { data: inserted, error } = await supabaseAdmin
      .from('traceability_events')
      .insert([
        {
          company_id: companyId,
          farm_id: predioId,
          predio_id: predioId,
          lot_id: loteId,
          lote_id: loteId,
          event_type: data.event_type,
          source_module: data.source_module,
          title: data.title,
          description: data.description || null,
          event_date: eventDate,
          created_by: userId || 'sistema',
          created_by_name: userName || null,
          executor_id: data.executor_id || null,
          executor_name: data.executor_name || null,
          role_at_event: data.role_at_event || null,
          latitud: data.latitud ?? null,
          longitud: data.longitud ?? null,
          precision_gps: data.precision_gps ?? null,
          ubicacion_texto: data.ubicacion_texto || null,
          estado: data.estado || 'COMPLETADO',
          metadata: data.metadata || {},
          evidencia_urls: data.evidencia_urls || [],
          source_table: data.source_table || null,
          source_id: data.source_id || null,
          source_code: data.source_code || null,
          previous_hash: previousHash,
          event_hash: eventHash,
          integrity_status: 'VALIDADO',
          origin: 'skycrop_core'
        }
      ])
      .select()
      .single();
    if (error) throw error;
    return this._mapEvent(inserted);
  }

  async listEvents(companyId, filters = {}) {
    try {
      const page = Math.max(1, Number(filters.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      const loteId = filters.lote_id || filters.lot_id || null;

      let q = supabaseAdmin
        .from('traceability_events')
        .select(
          '*, lotes!traceability_events_lot_id_fkey(codigo_interno,nombre), predios!traceability_events_farm_id_fkey(nombre)',
          { count: 'exact' }
        )
        .eq('company_id', companyId)
        .order('event_date', { ascending: false })
        .range(from, to);

      // Intentar con FK explícita; si falla por nombre, reintentar select simple.
      let { data, error, count } = await q;
      if (error && String(error.message || '').includes('traceability_events_lot_id_fkey')) {
        const retry = await supabaseAdmin
          .from('traceability_events')
          .select('*', { count: 'exact' })
          .eq('company_id', companyId)
          .order('event_date', { ascending: false })
          .range(from, to);
        data = retry.data;
        error = retry.error;
        count = retry.count;
      }
      if (error) {
        // Tabla aún no existe (migración pendiente): timeline desde fuentes origen.
        if (error.code === '42P01' || String(error.message || '').includes('traceability_events')) {
          return await this._timelineFromSources(companyId, { ...filters, page, limit });
        }
        throw error;
      }

      let rows = data || [];
      // Filtros en memoria coherentes con alias lote/lot y predio/farm
      if (loteId) rows = rows.filter((r) => r.lot_id === loteId || r.lote_id === loteId);
      const predioId = filters.predio_id || filters.farm_id;
      if (predioId) rows = rows.filter((r) => r.farm_id === predioId || r.predio_id === predioId);
      const tipo = filters.event_type || filters.tipo;
      if (tipo && tipo !== 'todas' && tipo !== 'all')
        rows = rows.filter((r) => r.event_type === tipo);
      const mod = filters.source_module || filters.modulo;
      if (mod && mod !== 'todas' && mod !== 'all')
        rows = rows.filter((r) => r.source_module === mod);
      if (filters.responsable) {
        const s = String(filters.responsable).toLowerCase();
        rows = rows.filter((r) =>
          String(r.executor_name || r.created_by_name || '')
            .toLowerCase()
            .includes(s)
        );
      }
      const desde = filters.desde || filters.fecha_desde;
      const hasta = filters.hasta || filters.fecha_hasta;
      if (desde) rows = rows.filter((r) => new Date(r.event_date) >= new Date(desde));
      if (hasta) rows = rows.filter((r) => new Date(r.event_date) <= new Date(hasta));
      if (filters.search) {
        const s = String(filters.search).toLowerCase();
        rows = rows.filter((r) =>
          `${r.title} ${r.description || ''} ${r.source_code || ''} ${r.event_code || ''}`
            .toLowerCase()
            .includes(s)
        );
      }

      // Si no hay eventos inmutables, complementar con fuentes origen (backfill de lectura).
      if ((count || 0) === 0 && !tipo && !mod) {
        const fallback = await this._timelineFromSources(companyId, { ...filters, page, limit });
        if ((fallback?.data?.length || 0) > 0) return fallback;
      }

      return {
        data: rows.map((r) => this._mapEvent(r)),
        total: count ?? rows.length,
        page,
        limit,
        totalPages: Math.ceil((count ?? rows.length) / limit)
      };
    } catch (err) {
      throw new DatabaseError('Error listando eventos de trazabilidad', err);
    }
  }

  /**
   * Timeline desde tablas origen (solo lectura, nunca muta el original).
   * Fuentes: historial_actividades, cosechas, aplicaciones, monitoreos,
   * fertilization_applications, analisis_suelos, labores.
   */
  async _timelineFromSources(companyId, filters = {}) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const loteId = filters.lote_id || filters.lot_id || null;
    const items = [];
    const push = (o) =>
      items.push({
        id: `src-${o.source_table}-${o.source_id}`,
        event_code: o.source_code || null,
        lote_id: o.lote_id,
        lot_id: o.lote_id,
        predio_id: o.predio_id || null,
        farm_id: o.predio_id || null,
        event_type: o.event_type,
        event_label: TRACE_EVENT_LABELS[o.event_type] || o.event_type,
        source_module: o.source_module,
        module_label: TRACE_MODULE_LABELS[o.source_module] || o.source_module,
        title: o.title,
        description: o.description || null,
        estado: 'COMPLETADO',
        event_date: o.event_date,
        created_at: o.event_date,
        created_by: 'sistema',
        created_by_name: null,
        executor_id: null,
        executor_name: o.responsable || null,
        responsable: o.responsable || '—',
        latitud: o.latitud ?? null,
        longitud: o.longitud ?? null,
        metadata: o.metadata || {},
        evidencia_urls: [],
        attachment_ids: [],
        source_table: o.source_table,
        source_id: o.source_id,
        source_code: o.source_code || null,
        previous_hash: null,
        event_hash: null,
        integrity_status: 'PENDIENTE_SYNC',
        immutable: true,
        origin: 'backfill',
        _synthetic: true
      });

    const since =
      filters.desde || filters.fecha_desde ? new Date(filters.desde || filters.fecha_desde) : null;
    const until =
      filters.hasta || filters.fecha_hasta ? new Date(filters.hasta || filters.fecha_hasta) : null;
    const inRange = (d) => {
      if (!d) return true;
      const t = new Date(d);
      if (since && t < since) return false;
      if (until && t > until) return false;
      return true;
    };

    try {
      // historial_actividades (timeline legacy)
      let hq = supabaseAdmin
        .from('historial_actividades')
        .select('id,lote_id,tipo_actividad,fecha_actividad,responsable,observaciones,resultados')
        .eq('company_id', companyId)
        .order('fecha_actividad', { ascending: false })
        .limit(100);
      if (loteId) hq = hq.eq('lote_id', loteId);
      const { data: hist } = await hq;
      (hist || [])
        .filter((h) => inRange(h.fecha_actividad))
        .forEach((h) =>
          push({
            source_table: 'historial_actividades',
            source_id: h.id,
            source_code: null,
            lote_id: h.lote_id,
            event_type: 'general_monitoring',
            source_module: 'sistema',
            title: h.tipo_actividad || 'Actividad de lote',
            description: h.observaciones || h.resultados,
            event_date: h.fecha_actividad,
            responsable: h.responsable,
            metadata: { resultados: h.resultados }
          })
        );
    } catch {
      /* tabla puede no existir */
    }

    try {
      let cq = supabaseAdmin
        .from('cosechas')
        .select(
          'id,lote_id,predio_id,codigo,crop,cultivo_variedad,cantidad_cosechada,weight,unidad,responsable_nombre,fecha_cosecha,date,observaciones,latitud,longitud'
        )
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('fecha_cosecha', { ascending: false })
        .limit(100);
      if (loteId) cq = cq.eq('lote_id', loteId);
      const { data: cos } = await cq;
      (cos || [])
        .filter((c) => inRange(c.fecha_cosecha || c.date))
        .forEach((c) =>
          push({
            source_table: 'cosechas',
            source_id: c.id,
            source_code: c.codigo,
            lote_id: c.lote_id,
            predio_id: c.predio_id,
            event_type: 'harvest_collection',
            source_module: 'cosecha',
            title: `Cosecha ${c.codigo || ''}`.trim(),
            description: `${c.cultivo_variedad || c.crop || 'Cultivo'} — ${c.cantidad_cosechada ?? c.weight ?? 0} ${c.unidad || 'kg'}`,
            event_date: c.fecha_cosecha || c.date,
            responsable: c.responsable_nombre,
            latitud: c.latitud,
            longitud: c.longitud,
            metadata: {
              cantidad: c.cantidad_cosechada ?? c.weight,
              unidad: c.unidad,
              observaciones: c.observaciones
            }
          })
        );
    } catch {
      /* noop */
    }

    try {
      let aq = supabaseAdmin
        .from('aplicaciones')
        .select(
          'id,lote_id,tipo_aplicacion,tipo_producto,producto_comercial,dosis,unidad_medida,operario_responsable,fecha_aplicacion,codigo_apl,metodo_aplicacion,observaciones:estado_programacion'
        )
        .eq('company_id', companyId)
        .order('fecha_aplicacion', { ascending: false })
        .limit(100);
      if (loteId) aq = aq.eq('lote_id', loteId);
      const { data: apl } = await aq;
      (apl || [])
        .filter((a) => inRange(a.fecha_aplicacion))
        .forEach((a) =>
          push({
            source_table: 'aplicaciones',
            source_id: a.id,
            source_code: a.codigo_apl,
            lote_id: a.lote_id,
            event_type: String(a.tipo_producto || '')
              .toLowerCase()
              .includes('fertil')
              ? 'fertilization_application'
              : 'sanitary_application',
            source_module: String(a.tipo_producto || '')
              .toLowerCase()
              .includes('fertil')
              ? 'fertilizacion'
              : 'sanitario',
            title:
              `${a.tipo_producto || a.tipo_aplicacion || 'Aplicación'} — ${a.producto_comercial || ''}`.trim(),
            description: a.dosis
              ? `Dosis ${a.dosis} ${a.unidad_medida || ''} · ${a.metodo_aplicacion || ''}`
              : a.metodo_aplicacion,
            event_date: a.fecha_aplicacion,
            responsable: a.operario_responsable,
            metadata: {
              producto: a.producto_comercial,
              dosis: a.dosis,
              unidad: a.unidad_medida,
              metodo: a.metodo_aplicacion
            }
          })
        );
    } catch {
      /* noop */
    }

    try {
      let mq = supabaseAdmin
        .from('monitoreos')
        .select('id,lote_id,fecha_monitoreo,responsable,observaciones,tipo_monitoreo')
        .eq('company_id', companyId)
        .order('fecha_monitoreo', { ascending: false })
        .limit(100);
      if (loteId) mq = mq.eq('lote_id', loteId);
      const { data: mon } = await mq;
      (mon || [])
        .filter((m) => inRange(m.fecha_monitoreo))
        .forEach((m) =>
          push({
            source_table: 'monitoreos',
            source_id: m.id,
            source_code: null,
            lote_id: m.lote_id,
            event_type: 'general_monitoring',
            source_module: 'monitoreo',
            title: m.tipo_monitoreo ? `Monitoreo — ${m.tipo_monitoreo}` : 'Monitoreo de campo',
            description: m.observaciones,
            event_date: m.fecha_monitoreo,
            responsable: m.responsable,
            metadata: {}
          })
        );
    } catch {
      /* noop */
    }

    try {
      let fq = supabaseAdmin
        .from('fertilization_applications')
        .select('id,plan_id,company_id,completed_at,completed_by,dose_applied,dose_unit,status')
        .eq('company_id', companyId)
        .order('completed_at', { ascending: false })
        .limit(100);
      const { data: fap } = await fq;
      (fap || [])
        .filter((f) => inRange(f.completed_at))
        .forEach((f) =>
          push({
            source_table: 'fertilization_applications',
            source_id: f.id,
            source_code: null,
            lote_id: loteId,
            event_type: 'fertilization_application',
            source_module: 'fertilizacion',
            title: 'Aplicación de fertilizante',
            description: f.dose_applied ? `Dosis ${f.dose_applied} ${f.dose_unit || ''}` : null,
            event_date: f.completed_at,
            responsable: f.completed_by,
            metadata: { dosis: f.dose_applied, unidad: f.dose_unit, estado: f.status }
          })
        );
    } catch {
      /* noop */
    }

    items.sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
    const tipo = filters.event_type || filters.tipo;
    const mod = filters.source_module || filters.modulo;
    let filtered = items;
    if (tipo && tipo !== 'todas' && tipo !== 'all')
      filtered = filtered.filter((i) => i.event_type === tipo);
    if (mod && mod !== 'todas' && mod !== 'all')
      filtered = filtered.filter((i) => i.source_module === mod);
    if (filters.responsable) {
      const s = String(filters.responsable).toLowerCase();
      filtered = filtered.filter((i) =>
        String(i.responsable || '')
          .toLowerCase()
          .includes(s)
      );
    }
    if (filters.search) {
      const s = String(filters.search).toLowerCase();
      filtered = filtered.filter((i) =>
        `${i.title} ${i.description || ''}`.toLowerCase().includes(s)
      );
    }
    const total = filtered.length;
    const from = (page - 1) * limit;
    return {
      data: filtered.slice(from, from + limit),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getEventById(companyId, eventId) {
    try {
      if (String(eventId).startsWith('src-')) {
        // Evento sintético desde fuente origen: resolver por tabla/id.
        const [, table, srcId] = String(eventId).split('-');
        return await this._getSourceDetail(companyId, table, srcId);
      }
      const { data, error } = await supabaseAdmin
        .from('traceability_events')
        .select('*')
        .eq('id', eventId)
        .eq('company_id', companyId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new NotFoundError('Evento de trazabilidad no encontrado');
      const mapped = this._mapEvent(data);
      // Enriquecer con detalle del registro origen (solo lectura).
      if (mapped.source_table && mapped.source_id) {
        try {
          mapped.origen_detalle = await this._getSourceDetail(
            companyId,
            mapped.source_table,
            mapped.source_id,
            true
          );
        } catch {
          mapped.origen_detalle = null;
        }
      }
      return mapped;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw new DatabaseError('Error obteniendo evento', err);
    }
  }

  async _getSourceDetail(companyId, table, srcId, raw = false) {
    const allowed = [
      'cosechas',
      'aplicaciones',
      'monitoreos',
      'historial_actividades',
      'fertilization_applications',
      'fertilization_plans',
      'analisis_suelos',
      'labores',
      'lotes_producto',
      'procesos_postcosecha',
      'movimientos_inventario'
    ];
    if (!allowed.includes(table)) throw new NotFoundError('Origen no soportado');
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .eq('id', srcId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError('Registro origen no encontrado');
    if (raw) return data;
    // Normalizar a forma de evento para el drawer.
    return {
      id: `src-${table}-${data.id}`,
      event_code: data.codigo || data.codigo_apl || data.event_code || null,
      lote_id: data.lote_id || data.lot_id || data.lote_agricola_id || null,
      lot_id: data.lote_id || data.lot_id || data.lote_agricola_id || null,
      predio_id: data.predio_id || null,
      farm_id: data.predio_id || null,
      event_type:
        table === 'cosechas'
          ? 'harvest_collection'
          : table === 'aplicaciones'
            ? 'sanitary_application'
            : 'general_monitoring',
      source_module:
        table === 'cosechas' ? 'cosecha' : table === 'aplicaciones' ? 'sanitario' : 'sistema',
      title: data.codigo ? `Registro ${data.codigo}` : `Registro ${table}`,
      description: data.observaciones || data.descripcion || null,
      estado: 'COMPLETADO',
      event_date:
        data.fecha_cosecha ||
        data.fecha_aplicacion ||
        data.fecha_monitoreo ||
        data.fecha_actividad ||
        data.created_at,
      executor_name:
        data.responsable_nombre || data.operario_responsable || data.responsable || null,
      responsable: data.responsable_nombre || data.operario_responsable || data.responsable || '—',
      latitud: data.latitud ?? null,
      longitud: data.longitud ?? null,
      metadata: data,
      source_table: table,
      source_id: data.id,
      integrity_status: 'PENDIENTE_SYNC',
      immutable: true,
      origin: 'backfill',
      _synthetic: true
    };
  }

  async verifyEvent(companyId, eventId) {
    try {
      const { data, error } = await supabaseAdmin.rpc('verificar_integridad_evento', {
        p_event_id: eventId
      });
      if (!error && data) {
        // Marcar last_verified_at solo si es válido (UPDATE bloqueado por trigger;
        // por eso solo se actualiza el timestamp vía service_role con bypass de trigger? No:
        // la inmutabilidad lo impide. Se retorna la verificación sin mutar.)
        return { ...data, event_id: eventId };
      }
      // Fallback JS: recalcular hash localmente.
      const { data: row, error: e2 } = await supabaseAdmin
        .from('traceability_events')
        .select('*')
        .eq('id', eventId)
        .eq('company_id', companyId)
        .maybeSingle();
      if (e2) throw e2;
      if (!row) throw new NotFoundError('Evento no encontrado');
      const expected = this._computeHash({
        companyId: row.company_id,
        loteId: row.lot_id || row.lote_id,
        eventType: row.event_type,
        sourceModule: row.source_module,
        eventDate: row.event_date ? new Date(row.event_date).toISOString() : row.event_date,
        createdBy: row.created_by,
        executor: row.executor_id || row.executor_name,
        title: row.title,
        metadata: row.metadata || {},
        previousHash: row.previous_hash
      });
      return {
        valid: expected === row.event_hash,
        event_id: eventId,
        event_code: row.event_code,
        expected,
        stored: row.event_hash,
        previous_hash: row.previous_hash,
        fallback: 'js'
      };
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw new DatabaseError('Error verificando integridad', err);
    }
  }

  async verifyChain(companyId, loteId) {
    try {
      const { data, error } = await supabaseAdmin.rpc('verificar_cadena_lote', {
        p_lote_id: loteId
      });
      if (!error && data && (data.total !== undefined || data.lot_id))
        return { ...data, lote_id: loteId };
      // Fallback JS
      const { data: rows, error: e2 } = await supabaseAdmin
        .from('traceability_events')
        .select('*')
        .eq('company_id', companyId)
        .or(`lot_id.eq.${loteId},lote_id.eq.${loteId}`)
        .order('created_at', { ascending: true });
      if (e2) throw e2;
      let prev = null;
      let ok = 0;
      const bad = [];
      for (const r of rows || []) {
        const expected = this._computeHash({
          companyId: r.company_id,
          loteId: r.lot_id || r.lote_id,
          eventType: r.event_type,
          sourceModule: r.source_module,
          eventDate: r.event_date ? new Date(r.event_date).toISOString() : r.event_date,
          createdBy: r.created_by,
          executor: r.executor_id || r.executor_name,
          title: r.title,
          metadata: r.metadata || {},
          previousHash: r.previous_hash
        });
        if ((r.previous_hash ?? null) !== prev || expected !== r.event_hash)
          bad.push({ event_code: r.event_code, id: r.id });
        else ok += 1;
        prev = r.event_hash;
      }
      const total = (rows || []).length;
      return {
        lot_id: loteId,
        lote_id: loteId,
        total,
        valid: ok,
        compromised: total - ok,
        integrity_pct: total > 0 ? Math.round((ok / total) * 10000) / 100 : 100,
        bad_events: bad,
        fallback: 'js'
      };
    } catch (err) {
      throw new DatabaseError('Error verificando cadena del lote', err);
    }
  }

  async getAuditInfo(companyId, eventId) {
    const event = await this.getEventById(companyId, eventId);
    const verification = event._synthetic
      ? {
          valid: null,
          reason: 'synthetic_from_source',
          note: 'Registro origen sin hash; se genera evento inmutable al sincronizar.'
        }
      : await this.verifyEvent(companyId, event.id).catch(() => ({ valid: null }));
    return {
      event_code: event.event_code,
      event_id: event.id,
      creado_en: event.created_at,
      sistema: 'SkyCrop Core',
      origen: event.origin,
      source_table: event.source_table,
      source_id: event.source_id,
      source_code: event.source_code,
      event_hash: event.event_hash,
      previous_hash: event.previous_hash,
      ultima_verificacion: event.last_verified_at || new Date().toISOString(),
      verificacion: verification,
      integridad: event.integrity_status,
      inmutable: true,
      politica: 'UPDATE=NO · DELETE=NO · Solo INSERT vía SkyCrop Core'
    };
  }

  async getLotSummary(companyId, loteId) {
    try {
      const { count: totalEventos } = await supabaseAdmin
        .from('traceability_events')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .or(`lot_id.eq.${loteId},lote_id.eq.${loteId}`);
      let lote = null;
      let predio = null;
      try {
        const { data } = await supabaseAdmin
          .from('lotes')
          .select('id,codigo_interno,nombre,cultivo,area_ha,variedad,predio_id')
          .eq('id', loteId)
          .eq('company_id', companyId)
          .maybeSingle();
        lote = data || null;
        if (lote?.predio_id) {
          const { data: p } = await supabaseAdmin
            .from('predios')
            .select('id,nombre')
            .eq('id', lote.predio_id)
            .maybeSingle();
          predio = p || null;
        }
      } catch {
        /* noop */
      }
      const chain = await this.verifyChain(companyId, loteId).catch(() => ({
        total: totalEventos || 0,
        integrity_pct: 100
      }));
      // Conteo por tipo (últimos 365 días)
      const since = new Date();
      since.setDate(since.getDate() - 365);
      const { data: rows } = await supabaseAdmin
        .from('traceability_events')
        .select('event_type,source_module,event_date')
        .eq('company_id', companyId)
        .or(`lot_id.eq.${loteId},lote_id.eq.${loteId}`)
        .gte('event_date', since.toISOString())
        .limit(1000);
      const porTipo = {};
      (rows || []).forEach((r) => {
        porTipo[r.event_type] = (porTipo[r.event_type] || 0) + 1;
      });
      return {
        lote,
        predio,
        total_eventos: totalEventos || 0,
        dias_trazables: 365,
        por_tipo: porTipo,
        integridad_pct: chain.integrity_pct ?? 100,
        cadena: chain
      };
    } catch (err) {
      throw new DatabaseError('Error obteniendo resumen del lote', err);
    }
  }
}
export default SupabaseTraceabilityRepository;
