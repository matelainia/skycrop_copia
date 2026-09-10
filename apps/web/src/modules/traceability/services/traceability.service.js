/**
 * traceability.service.js — acceso a datos reales de evidencia productiva.
 * Prioridad: backend /api/v1/trazabilidad (RLS + hash). Fallback: Supabase directo.
 * Cero mocks: si no hay eventos, retorna vacío, nunca inventa.
 */
import { supabase } from '../../../lib/supabaseClient';

const API_URL = (() => {
  const isDev = import.meta.env.DEV;
  return isDev ? 'http://localhost:3000/api' : 'https://backend.skycrop.app/api';
})();

function getToken() {
  try { return sessionStorage.getItem('sb_access_token') || null; } catch { return null; }
}

async function apiFetch(path, opts = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...opts, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || json?.message || `Error ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return json;
}

function toQuery(filters = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, String(v));
  }
  return qs.toString();
}

export const traceabilityService = {
  async listEvents(filters = {}) {
    const q = toQuery(filters);
    try {
      const json = await apiFetch(`/v1/trazabilidad${q ? `?${q}` : ''}`);
      return {
        data: json?.data || [],
        total: json?.pagination?.total ?? (json?.data?.length || 0),
        page: json?.pagination?.page || filters.page || 1,
        limit: json?.pagination?.limit || filters.limit || 20,
        totalPages: json?.pagination?.totalPages || 1
      };
    } catch {
      // Fallback Supabase directo (RLS aplica)
      const page = Number(filters.page) || 1;
      const limit = Math.min(100, Number(filters.limit) || 20);
      const from = (page - 1) * limit;
      let query = supabase.from('traceability_events').select('*', { count: 'exact' })
        .order('event_date', { ascending: false }).range(from, from + limit - 1);
      const loteId = filters.lote_id || filters.lot_id;
      if (loteId) query = query.or(`lot_id.eq.${loteId},lote_id.eq.${loteId}`);
      if (filters.event_type && filters.event_type !== 'todas') query = query.eq('event_type', filters.event_type);
      if (filters.source_module && filters.source_module !== 'todas') query = query.eq('source_module', filters.source_module);
      if (filters.desde) query = query.gte('event_date', new Date(filters.desde).toISOString());
      if (filters.hasta) query = query.lte('event_date', new Date(filters.hasta).toISOString());
      const { data, error, count } = await query;
      if (error) throw error;
      let rows = data || [];
      if (filters.responsable) {
        const s = String(filters.responsable).toLowerCase();
        rows = rows.filter((r) => String(r.executor_name || r.created_by_name || '').toLowerCase().includes(s));
      }
      return { data: rows, total: count || 0, page, limit, totalPages: Math.ceil((count || 0) / limit) };
    }
  },

  async getEvent(id) {
    try {
      const json = await apiFetch(`/v1/trazabilidad/${id}`);
      return json?.data || null;
    } catch {
      const { data, error } = await supabase.from('traceability_events').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    }
  },

  async verifyEvent(id) {
    const json = await apiFetch(`/v1/trazabilidad/${id}/verify`);
    return json?.data || null;
  },

  async auditEvent(id) {
    const json = await apiFetch(`/v1/trazabilidad/${id}/audit`);
    return json?.data || null;
  },

  async verifyChain(loteId) {
    const json = await apiFetch(`/v1/trazabilidad/chain?lote_id=${encodeURIComponent(loteId)}`);
    return json?.data || null;
  },

  async lotSummary(loteId) {
    try {
      const json = await apiFetch(`/v1/trazabilidad/summary?lote_id=${encodeURIComponent(loteId)}`);
      return json?.data || null;
    } catch { return null; }
  },

  exportCsvUrl(filters = {}) {
    const token = getToken();
    const q = toQuery(filters);
    // Descarga vía backend con token Bearer; se abre con fetch+blob en el componente.
    return { url: `${API_URL}/v1/trazabilidad/export.csv${q ? `?${q}` : ''}`, token };
  },

  async downloadCsv(filters = {}) {
    const { url, token } = this.exportCsvUrl(filters);
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Exportación falló (${res.status})`);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'trazabilidad_lote.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  async listLotes(predioId) {
    let q = supabase.from('lotes').select('id,codigo_interno,nombre,cultivo,variedad,area_ha,predio_id,predios(nombre)').is('deleted_at', null).order('codigo_interno').limit(200);
    if (predioId) q = q.eq('predio_id', predioId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async listPredios() {
    const { data, error } = await supabase.from('predios').select('id,nombre').order('nombre').limit(100);
    if (error) throw error;
    return data || [];
  }
};

export default traceabilityService;
