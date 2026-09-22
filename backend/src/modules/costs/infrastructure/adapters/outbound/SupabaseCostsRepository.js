import { CostsRepositoryPort } from '../../../domain/ports/CostsRepositoryPort.js';
import { supabaseAdmin } from '../../../../../shared/database/supabase.js';
import {
  DatabaseError,
  NotFoundError,
  AppError,
  AuthenticationError
} from '../../../../../shared/errors/AppErrors.js';
import {
  mapCostsRpcError,
  isMissingRpcError,
  isAuthRpcError
} from '../../../application/costsRpcErrors.js';

/**
 * Repositorio Costos — RPCs 066 + lecturas.
 * Lee/escribe SIEMPRE con company_id explícito aunque RLS exista,
 * porque supabaseAdmin (service_role) bypasea RLS. Patrón harvest/047:
 * las RPC reciben p_company_id/p_user_id del tenant verificado (resolveTenant),
 * jamás del body del cliente. Escrituras directas desde frontend revocadas en 065.
 */
export class SupabaseCostsRepository extends CostsRepositoryPort {
  async _callRpc(fn, args, fallbackMessage) {
    const { data, error } = await supabaseAdmin.rpc(fn, args);
    if (error) {
      if (isAuthRpcError(error)) {
        throw new AuthenticationError(
          'Backend sin acceso a Supabase: revisa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY del backend (.env dev).'
        );
      }
      throw mapCostsRpcError(error, fallbackMessage);
    }
    return data;
  }

  async registerEvent(companyId, userId, data) {
    // ÚNICA vía: RPC 066 (validación, periodo, idempotencia, issues, hashes).
    // Sin fallback directo: un insert saltearía validación/permisos/periodo.
    // Si 066 no está aplicada, el endpoint falla 503 (nunca escribe a ciegas).
    try {
      return await this._callRpc(
        'costos_register_event',
        { p_company_id: companyId, p_user_id: userId || 'sistema', p_payload: toRpcPayload(data) },
        'Error registrando evento de costo'
      );
    } catch (err) {
      const raw = err?.rawError || err;
      console.error(
        '[costos] registerEvent RPC error crudo:',
        JSON.stringify({
          message: raw?.message,
          code: raw?.code,
          details: raw?.details,
          hint: raw?.hint
        })
      );
      if (isMissingRpcError(raw)) {
        throw new AppError(
          'Motor de costos no disponible: migración 066 pendiente en la base.',
          503,
          'COSTS_NOT_AVAILABLE'
        );
      }
      throw err;
    }
  }

  async getEventById(companyId, eventId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('costos_eventos')
        .select('*')
        .eq('id', eventId)
        .eq('company_id', companyId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new NotFoundError('Evento de costo no encontrado');
      return data;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw new DatabaseError('Error obteniendo evento de costo', err);
    }
  }

  /** Ciclo de vida 066: valorizar → asignar → publicar → reversar. */
  async valueEvent(companyId, userId, eventId) {
    try {
      return await this._callRpc(
        'costos_value_event',
        { p_company_id: companyId, p_user_id: userId || 'sistema', p_event_id: eventId },
        'Error valorizando evento de costo'
      );
    } catch (err) {
      if (err instanceof DatabaseError && isMissingRpcError(err.rawError)) {
        throw new AppError(
          'Motor de costos no disponible: migración 066 pendiente en la base.',
          503,
          'COSTS_NOT_AVAILABLE'
        );
      }
      throw err;
    }
  }

  async allocateEvent(companyId, userId, eventId) {
    return await this._callRpc(
      'costos_allocate_event',
      { p_company_id: companyId, p_user_id: userId || 'sistema', p_event_id: eventId },
      'Error asignando evento de costo'
    );
  }

  async postEvent(companyId, userId, eventId) {
    return await this._callRpc(
      'costos_post_event',
      { p_company_id: companyId, p_user_id: userId || 'sistema', p_event_id: eventId },
      'Error publicando evento de costo'
    );
  }

  async reverseEvent(companyId, userId, eventId, reason) {
    return await this._callRpc(
      'costos_reverse_event',
      {
        p_company_id: companyId,
        p_user_id: userId || 'sistema',
        p_event_id: eventId,
        p_reason: reason
      },
      'Error reversando evento de costo'
    );
  }

  async recalculate(companyId, userId, scope) {
    const res = await this._callRpc(
      'costos_recalculate',
      { p_company_id: companyId, p_user_id: userId || 'sistema', p_scope: scope || {} },
      'Error recalculando costos'
    );
    if (res?.status === 'not_implemented') {
      throw new AppError(
        'Recálculo pendiente de fase posterior (stub seguro).',
        501,
        'COSTS_NOT_IMPLEMENTED'
      );
    }
    return res;
  }

  async getLaborSummary(companyId, laborId) {
    try {
      const [{ data: labor }, { data: entries }] = await Promise.all([
        supabaseAdmin
          .from('labores')
          .select(
            'id, titulo, lote_id, jornal, estado, fecha, lotes(id, nombre, codigo_interno, area_ha)'
          )
          .eq('id', laborId)
          .eq('company_id', companyId)
          .maybeSingle(),
        supabaseAdmin
          .from('costos_entradas')
          .select(
            'entry_kind, cost_class, directness, allocation_quality, sign, amount_base, currency'
          )
          .eq('company_id', companyId)
          .eq('labor_id', laborId)
          .eq('status', 'posted')
      ]);
      if (!labor) throw new NotFoundError('Labor no encontrada');
      const list = entries || [];
      const sum = (fn) =>
        list.filter(fn).reduce((a, e) => a + Number(e.amount_base || 0) * (e.sign ?? 1), 0);
      const total = sum((e) => e.entry_kind === 'cost' || e.entry_kind === 'expense');
      const ingreso = sum((e) => e.entry_kind === 'revenue');
      const area = Number(labor?.lotes?.area_ha || 0);
      const byClass = {};
      for (const e of list) {
        if (e.entry_kind !== 'cost' && e.entry_kind !== 'expense') continue;
        const k = e.cost_class || 'other';
        byClass[k] = (byClass[k] || 0) + Number(e.amount_base || 0) * (e.sign ?? 1);
      }
      const { data: issues } = await supabaseAdmin
        .from('costos_issues')
        .select('id, issue_type, severity, message, status')
        .eq('company_id', companyId)
        .eq('status', 'open')
        .limit(20);
      return {
        labor_id: labor.id,
        labor_titulo: labor.titulo,
        lote_id: labor.lote_id,
        lote_nombre: labor?.lotes?.nombre || labor?.lotes?.codigo_interno || null,
        area_ha: area || null,
        total,
        ingreso,
        margen_neto: ingreso - total,
        costo_ha: area > 0 ? total / area : null,
        moneda: 'COP',
        componentes: Object.entries(byClass).map(([cost_class, monto]) => ({ cost_class, monto })),
        issues: issues || [],
        nota_calidad:
          'direct/inferred/estimated/manual visible por entrada en GET /entradas?labor_id='
      };
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw new DatabaseError('Error resumen de labor', err);
    }
  }

  async getLoteSummary(companyId, loteId, opts = {}) {
    try {
      const { data: lote } = await supabaseAdmin
        .from('lotes')
        .select('id, nombre, codigo_interno, area_ha, predio_id')
        .eq('id', loteId)
        .eq('company_id', companyId)
        .maybeSingle();
      if (!lote) throw new NotFoundError('Lote no encontrado');
      let q = supabaseAdmin
        .from('costos_entradas')
        .select('entry_kind, cost_class, directness, sign, amount_base, business_date')
        .eq('company_id', companyId)
        .eq('lote_id', loteId)
        .eq('status', 'posted');
      if (opts.period_start) q = q.gte('business_date', opts.period_start);
      if (opts.period_end) q = q.lte('business_date', opts.period_end);
      const { data: entries, error } = await q;
      if (error) throw error;
      const list = entries || [];
      const sum = (fn) =>
        list.filter(fn).reduce((a, e) => a + Number(e.amount_base || 0) * (e.sign ?? 1), 0);
      const total = sum((e) => e.entry_kind === 'cost' || e.entry_kind === 'expense');
      const directo = sum(
        (e) => (e.entry_kind === 'cost' || e.entry_kind === 'expense') && e.directness === 'direct'
      );
      const ingreso = sum((e) => e.entry_kind === 'revenue');
      const area = Number(lote.area_ha || 0);
      return {
        lote_id: lote.id,
        lote_nombre: lote.nombre || lote.codigo_interno,
        predio_id: lote.predio_id,
        area_ha: area || null,
        total,
        directo,
        indirecto: total - directo,
        ingreso,
        margen_neto: ingreso - total,
        costo_ha: area > 0 ? total / area : null,
        moneda: 'COP'
      };
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw new DatabaseError('Error resumen de lote', err);
    }
  }

  async getPredioKpis(companyId, predioId) {
    try {
      const { data: predio } = await supabaseAdmin
        .from('predios')
        .select('id, nombre')
        .eq('id', predioId)
        .eq('company_id', companyId)
        .maybeSingle();
      if (!predio) throw new NotFoundError('Predio no encontrado');
      const { data: entries } = await supabaseAdmin
        .from('costos_entradas')
        .select('entry_kind, directness, sign, amount_base')
        .eq('company_id', companyId)
        .eq('predio_id', predioId)
        .eq('status', 'posted');
      const list = entries || [];
      const sum = (fn) =>
        list.filter(fn).reduce((a, e) => a + Number(e.amount_base || 0) * (e.sign ?? 1), 0);
      const total = sum((e) => e.entry_kind === 'cost' || e.entry_kind === 'expense');
      const ingreso = sum((e) => e.entry_kind === 'revenue');
      return {
        predio_id: predio.id,
        predio_nombre: predio.nombre,
        total,
        ingreso,
        margen_neto: ingreso - total,
        moneda: 'COP'
      };
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw new DatabaseError('Error KPIs de predio', err);
    }
  }

  async getMachineryKpis(companyId, maquinariaId) {
    try {
      const [{ data: maq }, { data: entries }, { data: ops }] = await Promise.all([
        supabaseAdmin
          .from('maquinaria')
          .select('id, nombre, codigo')
          .eq('id', maquinariaId)
          .eq('company_id', companyId)
          .maybeSingle(),
        supabaseAdmin
          .from('costos_entradas')
          .select('entry_kind, cost_class, sign, amount_base')
          .eq('company_id', companyId)
          .eq('maquinaria_id', maquinariaId)
          .eq('status', 'posted'),
        supabaseAdmin
          .from('maquinaria_operaciones')
          .select('horas, combustible_l')
          .eq('company_id', companyId)
          .eq('maquinaria_id', maquinariaId)
      ]);
      if (!maq) throw new NotFoundError('Maquinaria no encontrada');
      const list = entries || [];
      const total = list
        .filter((e) => e.entry_kind !== 'revenue')
        .reduce((a, e) => a + Number(e.amount_base || 0) * (e.sign ?? 1), 0);
      const horas = (ops || []).reduce((a, o) => a + Number(o.horas || 0), 0);
      const litros = (ops || []).reduce((a, o) => a + Number(o.combustible_l || 0), 0);
      return {
        maquinaria_id: maq.id,
        nombre: maq.nombre,
        total,
        horas_maquina: horas || null,
        litros_combustible: litros || null,
        costo_hora: horas > 0 ? total / horas : null,
        litros_hora: horas > 0 ? litros / horas : null,
        moneda: 'COP'
      };
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw new DatabaseError('Error KPIs de maquinaria', err);
    }
  }

  async listEntries(companyId, f) {
    try {
      const page = f.page || 1;
      const limit = Math.min(f.limit || 20, 100);
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      let q = supabaseAdmin
        .from('costos_entradas')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId)
        .order('business_date', { ascending: false })
        .range(from, to);
      if (f.labor_id) q = q.eq('labor_id', f.labor_id);
      if (f.lote_id) q = q.eq('lote_id', f.lote_id);
      if (f.predio_id) q = q.eq('predio_id', f.predio_id);
      if (f.maquinaria_id) q = q.eq('maquinaria_id', f.maquinaria_id);
      if (f.cost_class) q = q.eq('cost_class', f.cost_class);
      if (f.status) q = q.eq('status', f.status);
      if (f.date_from) q = q.gte('business_date', new Date(f.date_from).toISOString().slice(0, 10));
      if (f.date_to) q = q.lte('business_date', new Date(f.date_to).toISOString().slice(0, 10));
      const { data, error, count } = await q;
      if (error) throw error;
      return {
        data: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (err) {
      throw new DatabaseError('Error listando entradas de costo', err);
    }
  }

  async listEvents(companyId, f) {
    try {
      const page = f.page || 1;
      const limit = Math.min(f.limit || 20, 100);
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      let q = supabaseAdmin
        .from('costos_eventos')
        .select(
          'id, source_module, source_entity, source_id, event_type, status, occurred_at, business_date, lote_id, labor_id, maquinaria_id, quantity, source_unit, valued_amount, amount_base, currency',
          { count: 'exact' }
        )
        .eq('company_id', companyId)
        .order('occurred_at', { ascending: false })
        .range(from, to);
      if (f.status) q = q.eq('status', f.status);
      if (f.source_module) q = q.eq('source_module', f.source_module);
      if (f.event_type) q = q.eq('event_type', f.event_type);
      if (f.lote_id) q = q.eq('lote_id', f.lote_id);
      if (f.maquinaria_id) q = q.eq('maquinaria_id', f.maquinaria_id);
      const { data, error, count } = await q;
      if (error) throw error;
      return {
        data: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (err) {
      throw new DatabaseError('Error listando eventos de costo', err);
    }
  }

  async listIssues(companyId, f) {
    try {
      const page = f.page || 1;
      const limit = Math.min(f.limit || 20, 100);
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      let q = supabaseAdmin
        .from('costos_issues')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (f.status) q = q.eq('status', f.status);
      if (f.issue_type) q = q.eq('issue_type', f.issue_type);
      if (f.severity) q = q.eq('severity', f.severity);
      const { data, error, count } = await q;
      if (error) throw error;
      return {
        data: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (err) {
      throw new DatabaseError('Error listando issues de costo', err);
    }
  }
}

/**
 * Normaliza el payload zod (Dates, undefined) al JSONB que espera
 * costos_register_event. No incluye company_id: la RPC lo recibe por
 * parámetro explícito verificado (patrón 047).
 */
function toRpcPayload(data) {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (v === undefined) continue;
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

export default SupabaseCostsRepository;
