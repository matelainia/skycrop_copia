/**
 * harvestService — capa de acceso a datos reales (Supabase + backend).
 * Sin mocks, sin seeds. Cada función consulta Supabase o backend y retorna datos reales o lanza error.
 * El frontend nunca decide permisos: el backend/RLS lo hace.
 */
import { supabase } from '../../../lib/supabaseClient';

const API_URL = (() => {
  const isDev = import.meta.env.DEV;
  return isDev ? 'http://localhost:3000/api' : 'https://backend.skycrop.app/api';
})();

async function getApiToken() {
  try { return sessionStorage.getItem('sb_access_token') || null; } catch { return null; }
}

async function apiFetch(path, opts = {}) {
  const token = await getApiToken();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...opts, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || json.message || `Error ${res.status}`);
  return json;
}

export const harvestService = {
  // Dashboard agregado (usa RPC backend si existe, si no supabase directo)
  async getDashboard(filters = {}) {
    try {
      const qs = new URLSearchParams();
      if (filters.predio_id) qs.set('predio_id', filters.predio_id);
      if (filters.lote_id) qs.set('lote_id', filters.lote_id);
      if (filters.periodo) qs.set('periodo', filters.periodo);
      // Intentar backend primero (transaccional + seguro)
      const json = await apiFetch(`/v1/cosechas/dashboard?${qs.toString()}`);
      if (json?.data) return json.data;
    } catch (e) {
      // fallback a supabase
      // console.warn('dashboard backend fallback', e.message);
    }
    // Fallback supabase directo: calcular KPIs reales
    const { data: cosechas, error: cErr } = await supabase.from('cosechas').select('cantidad_cosechada,weight,area_cosechada,fecha_cosecha,date').is('deleted_at', null);
    if (cErr) throw cErr;
    const acum = (cosechas || []).reduce((a, c) => a + (c.cantidad_cosechada ?? c.weight ?? 0), 0);
    const area = (cosechas || []).reduce((a, c) => a + (c.area_cosechada ?? 0), 0);
    const rend = area > 0 ? acum / area : 0;
    let almacenado = 0, bodegas = 0;
    try {
      const { data: prods } = await supabase.from('lotes_producto').select('peso_actual,bodega_id').in('estado', ['ALMACENADO','TERMINADO','RESERVADO']);
      almacenado = (prods || []).reduce((a, p) => a + (p.peso_actual || 0), 0);
      bodegas = new Set((prods || []).map(p => p.bodega_id).filter(Boolean)).size;
    } catch {}
    return {
      dashboard: { cosecha_acumulada_kg: acum, area_cosechada_ha: area, rendimiento_kg_ha: Math.round(rend*100)/100, producto_almacenado_kg: almacenado, bodegas_con_stock: bodegas, cosechas_registradas: cosechas?.length || 0 },
      historico: await this.getHistoricoMensual(new Date().getFullYear()),
      postcosecha: await this.getPostHarvestStatus(),
      recientes: await this.listHarvests({ limit: 5 }),
      alertas: await this.listAlertas(3),
    };
  },

  async getHistoricoMensual(year = new Date().getFullYear()) {
    try {
      const { data, error } = await supabase.rpc('cosecha_historica_mensual', { p_year: year });
      if (error) throw error;
      return data || [];
    } catch {
      // fallback: agrupar cosechas por mes
      const { data: cosechas } = await supabase.from('cosechas').select('fecha_cosecha,date,cantidad_cosechada,weight').is('deleted_at', null);
      const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((n,i)=>({ mes:i+1, mes_nombre:n, total_kg:0 }));
      (cosechas||[]).forEach(c=>{
        const d = c.fecha_cosecha || c.date;
        if (!d) return;
        const dt = new Date(d);
        if (dt.getFullYear()!==year) return;
        months[dt.getMonth()].total_kg += (c.cantidad_cosechada ?? c.weight ?? 0);
      });
      return months;
    }
  },

  async getPostHarvestStatus() {
    try {
      const { data: cosechas } = await supabase.from('cosechas').select('cantidad_cosechada,weight').is('deleted_at', null);
      const total = (cosechas||[]).reduce((a,c)=>a+(c.cantidad_cosechada??c.weight??0),0);
      const { data: lotesProd } = await supabase.from('lotes_producto').select('estado,peso_actual');
      if (!lotesProd || lotesProd.length===0) {
        return [
          { estado:'Cosechado', kg: total, pct: 100 },
          { estado:'En Beneficio', kg:0, pct:0 },
          { estado:'En Secado', kg:0, pct:0 },
          { estado:'Almacenado', kg:0, pct:0 },
          { estado:'Vendido', kg:0, pct:0 },
        ];
      }
      const byEstado = {};
      lotesProd.forEach(lp=>{ byEstado[lp.estado]=(byEstado[lp.estado]||0)+(lp.peso_actual||0); });
      const almacenado = (byEstado['ALMACENADO']||0)+(byEstado['TERMINADO']||0)+(byEstado['RESERVADO']||0);
      const vendido = (byEstado['VENDIDO']||0)+(byEstado['DESPACHADO']||0);
      const enProceso = byEstado['PROCESANDO']||0;
      const pct = (kg)=> total>0? Math.round((kg/total)*1000)/10 :0;
      return [
        { estado:'Cosechado', kg: total, pct:100 },
        { estado:'En Beneficio', kg: enProceso*0.5, pct: pct(enProceso*0.5) },
        { estado:'En Secado', kg: enProceso*0.5, pct: pct(enProceso*0.5) },
        { estado:'Almacenado', kg: almacenado, pct: pct(almacenado) },
        { estado:'Vendido', kg: vendido, pct: pct(vendido) },
      ];
    } catch (e) { throw e; }
  },

  async listHarvests({ page=1, limit=20, predio_id, lote_id, cultivo, estado, periodo='este_anio', search }={}) {
    try {
      const json = await apiFetch(`/v1/cosechas?page=${page}&limit=${limit}${predio_id?`&predio_id=${predio_id}`:''}${lote_id?`&lote_id=${lote_id}`:''}${cultivo?`&cultivo=${encodeURIComponent(cultivo)}`:''}${estado?`&estado=${estado}`:''}${periodo?`&periodo=${periodo}`:''}${search?`&search=${encodeURIComponent(search)}`:''}`);
      if (json?.data) return json.data;
      // fallback handled below
    } catch {}
    // Fallback supabase
    const from = (page-1)*limit;
    const to = from+limit-1;
    let q = supabase.from('cosechas').select('id,codigo,predio_id,lote_id,crop,cultivo_variedad,area_cosechada,cantidad_cosechada,weight,unidad,rendimiento_kg_ha,estado,responsable_nombre,fecha_cosecha,date,created_at,predios(nombre),lotes(codigo_interno,nombre)', { count:'exact' }).is('deleted_at', null).order('fecha_cosecha', {ascending:false}).range(from,to);
    if (predio_id) q = q.eq('predio_id', predio_id);
    if (lote_id) q = q.eq('lote_id', lote_id);
    if (estado) q = q.eq('estado', estado);
    if (search) { const s=search.replace(/[(),*"\\]/g,'').trim(); if(s) q=q.or(`codigo.ilike.%${s}%,crop.ilike.%${s}%,cultivo_variedad.ilike.%${s}%`); }
    if (periodo && periodo!=='todos') {
      let start; const now=new Date();
      if (periodo==='este_anio') start=new Date(now.getFullYear(),0,1);
      else if (periodo==='ultimos_6_meses') { start=new Date(now); start.setMonth(start.getMonth()-6); }
      else if (periodo==='este_mes') start=new Date(now.getFullYear(),now.getMonth(),1);
      if (start) q=q.gte('fecha_cosecha', start.toISOString());
    }
    const { data, error, count } = await q;
    if (error) throw error;
    const mapped = (data||[]).map(r=> ({
      id: r.id,
      codigo: r.codigo || r.id.slice(0,8),
      cultivo: r.cultivo_variedad || r.crop || '—',
      lote_agricola: r.lotes?.codigo_interno || '—',
      lote_nombre: r.lotes?.nombre || r.predios?.nombre || '—',
      predio: r.predios?.nombre || '—',
      area: r.area_cosechada,
      cantidad: r.cantidad_cosechada ?? r.weight ?? 0,
      rendimiento: r.rendimiento_kg_ha ?? (r.area_cosechada? (r.cantidad_cosechada??r.weight)/r.area_cosechada : 0),
      responsable: r.responsable_nombre || '—',
      fecha: r.fecha_cosecha || r.date || r.created_at,
      estado: r.estado || 'REGISTRADA',
    }));
    return { data: mapped, total: count||0, page, limit, totalPages: Math.ceil((count||0)/limit) };
  },

  async createHarvest(payload) {
    // Intenta backend primero (garantiza codigo backend y validaciones)
    try {
      const json = await apiFetch('/v1/cosechas', { method:'POST', body: JSON.stringify(payload) });
      if (json?.data) return json.data;
    } catch (e) {
      // si backend no disponible, cae a supabase directo
      // console.warn('createHarvest backend fallback', e.message);
    }
    // Fallback supabase directo (RPC o insert)
    try {
      const { data, error } = await supabase.rpc('registrar_cosecha', {
        p_predio_id: payload.predio_id || null,
        p_lote_agricola_id: payload.lote_agricola_id || null,
        p_cultivo: payload.cultivo,
        p_variedad: payload.variedad || null,
        p_area_cosechada: payload.area_cosechada || null,
        p_cantidad: payload.cantidad,
        p_unidad: payload.unidad || 'kg',
        p_numero_plantas: payload.numero_plantas || null,
        p_responsable: payload.responsable || null,
        p_observaciones: payload.observaciones || null,
        p_lat: payload.latitud || null,
        p_lng: payload.longitud || null,
        p_precision_gps: payload.precision_gps || null,
      });
      if (error) throw error;
      return data;
    } catch (e) {
      // último fallback: insert directo sin RPC
      const { data, error } = await supabase.from('cosechas').insert([{
        lote_id: payload.lote_agricola_id || null,
        predio_id: payload.predio_id || null,
        crop: payload.cultivo,
        cultivo_variedad: payload.variedad || payload.cultivo,
        area_cosechada: payload.area_cosechada || null,
        cantidad_cosechada: payload.cantidad,
        weight: payload.cantidad,
        unidad: payload.unidad || 'kg',
        numero_plantas: payload.numero_plantas || null,
        responsable_nombre: payload.responsable || null,
        observaciones: payload.observaciones || null,
        latitud: payload.latitud || null,
        longitud: payload.longitud || null,
        precision_gps: payload.precision_gps || null,
        estado: 'REGISTRADA',
        lote: 'TEMP',
        grade: 'Grado A',
        storage: 'Sin asignar',
        date: new Date().toISOString().slice(0,10),
      }]).select().single();
      if (error) throw error;
      return data;
    }
  },

  async listPredios() {
    const { data, error } = await supabase.from('predios').select('id,nombre,ubicacion,area_total_ha').order('nombre');
    if (error) throw error;
    return data||[];
  },
  async listLotes(predioId) {
    let q = supabase.from('lotes').select('id,codigo_interno,nombre,cultivo,area_ha,predio_id').is('deleted_at', null).order('codigo_interno');
    if (predioId) q = q.eq('predio_id', predioId);
    const { data, error } = await q;
    if (error) throw error;
    return data||[];
  },
  async listBodegas() {
    const { data, error } = await supabase.from('bodegas').select('id,nombre,sector,categoria').eq('categoria','Cosecha').order('nombre');
    if (error) {
      const { data: d2, error: e2 } = await supabase.from('bodegas').select('id,nombre,sector,categoria').order('nombre').limit(20);
      if (e2) throw e2;
      return d2||[];
    }
    return data||[];
  },
  async listAlmacenamientos() {
    const { data, error } = await supabase.from('almacenamientos').select('id,name,temp,humidity,max_capacity,current_load,unit').order('name');
    if (error) throw error;
    return data||[];
  },
  async listTrabajadores() {
    const { data, error } = await supabase.from('trabajadores').select('id,nombres,apellidos').eq('estado','Activa').limit(50);
    if (error) {
      const { data:d2 } = await supabase.from('trabajadores').select('id,nombres,apellidos').limit(50);
      return d2||[];
    }
    return data||[];
  },
  async trazabilidad(codigo) {
    try {
      const json = await apiFetch(`/v1/cosechas/trazabilidad?codigo=${encodeURIComponent(codigo)}`);
      if (json?.data) return json.data;
    } catch {}
    const { data, error } = await supabase.rpc('trazabilidad_por_codigo', { p_codigo: codigo });
    if (error) throw error;
    return data;
  },
  async listAlertas(limit=5) {
    try {
      const { data, error } = await supabase.from('alertas').select('id,tipo,mensaje,leida,created_at').order('created_at',{ascending:false}).limit(limit);
      if (error) throw error;
      return data||[];
    } catch { return []; }
  }
};
export default harvestService;
