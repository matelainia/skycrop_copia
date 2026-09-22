/**
 * costs.service.js — Consola de VALIDACIÓN del módulo Costos de Producción.
 * Rama draft: expone el ciclo register→value→allocate→post→reverse,
 * resúmenes, entradas e issues para prueba conjunta con el backend.
 * Escrituras SOLO vía /api/v1/costos (service_role + tenant verificado).
 * Lecturas de catálogos (lotes/maquinaria) vía proxy Supabase con RLS.
 */
import { supabase } from '../../../lib/supabaseClient';

const API_URL = (() => {
  const isDev = import.meta.env.DEV;
  return isDev ? 'http://localhost:3000/api' : 'https://backend.skycrop.app/api';
})();

function getToken() {
  try {
    return sessionStorage.getItem('sb_access_token') || null;
  } catch {
    return null;
  }
}

async function apiFetch(path, opts = {}) {
  const token = getToken();
  if (!token) {
    // Sin token el backend dev deja pasar pero todos los usecases devuelven
    // 403 "Empresa no identificada". Fallar aquí con mensaje accionable.
    const err = new Error(
      'Sin token de sesión API (sb_access_token). Cierra sesión y vuelve a entrar; si persiste, revisa la consola del navegador (errores de /auth/me).'
    );
    err.status = 0;
    err.code = 'NO_API_SESSION';
    throw err;
  }
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...opts, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      json?.error?.message || json?.error?.code || `Error ${res.status}`
    );
    err.status = res.status;
    err.code = json?.error?.code || null;
    err.details = json?.error?.details || null;
    throw err;
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

export const SOURCE_MODULES = [
  'labores',
  'maquinaria',
  'combustible',
  'mantenimiento',
  'inventario',
  'aplicaciones',
  'fertilization',
  'nominas',
  'cosecha',
  'ventas',
  'finanzas',
  'manual'
];

export const EVENT_TYPES = [
  'input_consumption',
  'labor_usage',
  'machine_usage',
  'fuel_consumption',
  'maintenance_cost',
  'external_service',
  'depreciation',
  'overhead_expense',
  'harvest_output',
  'sale_revenue',
  'estimated_revenue',
  'other_income',
  'other_expense',
  'correction'
];

export const EVENT_STATUSES = [
  'received',
  'validated',
  'pending_price',
  'pending_allocation',
  'priced',
  'allocated',
  'posted',
  'reversed',
  'invalid',
  'ignored'
];

export const costsService = {
  async registerEvent(payload) {
    const json = await apiFetch('/v1/costos/eventos', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return json?.data;
  },
  async driveEvent(id, stage) {
    const json = await apiFetch(`/v1/costos/eventos/${id}/${stage}`, { method: 'POST' });
    return json?.data;
  },
  async reverseEvent(id, reason) {
    const json = await apiFetch(`/v1/costos/eventos/${id}/reversar`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
    return json?.data;
  },
  async recalculate(scope) {
    const json = await apiFetch('/v1/costos/recalcular', {
      method: 'POST',
      body: JSON.stringify(scope || { mode: 'incremental' })
    });
    return json?.data;
  },
  async listEvents(filters = {}) {
    const q = toQuery(filters);
    const json = await apiFetch(`/v1/costos/eventos${q ? `?${q}` : ''}`);
    return { data: json?.data || [], pagination: json?.pagination || {} };
  },
  async listEntries(filters = {}) {
    const q = toQuery(filters);
    const json = await apiFetch(`/v1/costos/entradas${q ? `?${q}` : ''}`);
    return { data: json?.data || [], pagination: json?.pagination || {} };
  },
  async listIssues(filters = {}) {
    const q = toQuery(filters);
    const json = await apiFetch(`/v1/costos/issues${q ? `?${q}` : ''}`);
    return { data: json?.data || [], pagination: json?.pagination || {} };
  },
  async laborSummary(laborId) {
    const json = await apiFetch(`/v1/costos/labores/${laborId}/resumen`);
    return json?.data;
  },
  async loteSummary(loteId) {
    const json = await apiFetch(`/v1/costos/lotes/${loteId}/resumen`);
    return json?.data;
  },
  async listLotes() {
    const { data, error } = await supabase
      .from('lotes')
      .select('id,codigo_interno,nombre,area_ha')
      .is('deleted_at', null)
      .order('codigo_interno')
      .limit(200);
    if (error) throw error;
    return data || [];
  },
  async listMaquinarias() {
    const { data, error } = await supabase
      .from('maquinaria')
      .select('id,codigo,nombre,estado')
      .order('codigo')
      .limit(200);
    if (error) throw error;
    return data || [];
  }
};

export default costsService;
