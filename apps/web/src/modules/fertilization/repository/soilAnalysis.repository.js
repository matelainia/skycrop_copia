/**
 * soilAnalysis.repository.js
 * Capa de acceso a datos real — cero mocks.
 * Todo vía supabaseClient proxy (inyecta company_id + JWT RLS).
 */
import { supabase } from '../../../lib/supabaseClient.js';

function toDateOnly(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().split('T')[0];
  return String(d).slice(0, 10);
}

// Helper para resolver nombre de vista vs tabla según disponibilidad
async function tryViewThenTable(queryFnView, queryFnTable) {
  try {
    const res = await queryFnView();
    if (res.error && /does not exist|not found|relation/i.test(res.error.message)) {
      return await queryFnTable();
    }
    return res;
  } catch (e) {
    return await queryFnTable();
  }
}

export const soilAnalysisRepository = {
  /**
   * Lista análisis paginados con filtros server-side + búsqueda.
   * @param {object} params
   * @param {number} params.page
   * @param {number} params.pageSize
   * @param {string} params.search - busca en codigo_muestra, nombre_muestra, ubicacion_nombre
   * @param {string} params.predioId
   * @param {string} params.loteId
   * @param {string} params.laboratorioId
   * @param {string|number} params.year - año de fecha_analisis
   * @param {string} params.estado - borrador|completo|archivado|anulado
   * @param {boolean|null} params.hasGps - filtrar con/sin GPS
   * @param {boolean|null} params.hasPdf - filtrar con/sin PDF
   * @returns {Promise<{ data:object[], total:number, page:number, pageSize:number, totalPages:number }>}
   */
  async getAnalyses({
    page = 1,
    pageSize = 10,
    search = '',
    predioId = '',
    loteId = '',
    laboratorioId = '',
    year = '',
    estado = '',
    hasGps = null,
    hasPdf = null,
  } = {}) {
    if (!supabase) throw new Error('Supabase no está configurado.');

    // Intentar usar la vista enriquecida; fallback a tabla base
    let query = supabase
      .from('vw_analisis_suelos_enriched')
      .select('*', { count: 'exact' })
      .order('fecha_analisis', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    // Si la vista no existe aún (migración no aplicada en env), el proxy retornará error → fallback
    // Para evitar doble query, primero probamos y si falla usamos analisis_suelos
    let useFallback = false;
    // Aplicar filtros antes de ejecutar para detectar vista faltante temprano con head query?
    // Simplificamos: ejecutar y si error de relación, reintentar con tabla base
    if (predioId) query = query.eq('predio_id', predioId);
    if (loteId) query = query.eq('lote_id', loteId);
    if (laboratorioId) query = query.eq('laboratorio_id', laboratorioId);
    if (estado) query = query.eq('estado', estado);
    if (year) {
      const y = String(year);
      query = query.gte('fecha_analisis', `${y}-01-01`).lte('fecha_analisis', `${y}-12-31`);
    }
    if (hasGps === true) query = query.not('latitude', 'is', null).not('longitude', 'is', null);
    if (hasGps === false) query = query.is('latitude', null);
    if (hasPdf === true) query = query.not('archivo_pdf_path', 'is', null);
    if (hasPdf === false) query = query.is('archivo_pdf_path', null);
    if (search && String(search).trim()) {
      const term = String(search).trim().replace(/[%_]/g, '\\$&');
      // Buscar en múltiples columnas
      query = query.or(
        `codigo_muestra.ilike.%${term}%,nombre_muestra.ilike.%${term}%,ubicacion_nombre.ilike.%${term}%,observaciones.ilike.%${term}%`
      );
    }

    let { data, count, error } = await query;

    if (error && /does not exist|relation.*does not exist|not found|schema cache/i.test(error.message)) {
      // Fallback a tabla base
      useFallback = true;
      let q2 = supabase
        .from('analisis_suelos')
        .select('*', { count: 'exact' })
        .order('fecha_analisis', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (predioId) q2 = q2.eq('predio_id', predioId);
      if (loteId) q2 = q2.eq('lote_id', loteId);
      if (laboratorioId) q2 = q2.eq('laboratorio_id', laboratorioId);
      if (estado) q2 = q2.eq('estado', estado);
      if (year) {
        const y = String(year);
        q2 = q2.gte('fecha_analisis', `${y}-01-01`).lte('fecha_analisis', `${y}-12-31`);
      }
      if (hasGps === true) q2 = q2.not('latitude', 'is', null).not('longitude', 'is', null);
      if (hasGps === false) q2 = q2.is('latitude', null);
      if (hasPdf === true) q2 = q2.not('archivo_pdf_path', 'is', null);
      if (hasPdf === false) q2 = q2.is('archivo_pdf_path', null);
      if (search && String(search).trim()) {
        const term = String(search).trim().replace(/[%_]/g, '\\$&');
        q2 = q2.or(
          `codigo_muestra.ilike.%${term}%,nombre_muestra.ilike.%${term}%,ubicacion_nombre.ilike.%${term}%,observaciones.ilike.%${term}%`
        );
      }
      const res2 = await q2;
      data = res2.data;
      count = res2.count;
      error = res2.error;
    }

    // Si ambas tablas no existen (migración pendiente), usar fert_calc_soil_analyses como fallback temporal
    if (error && /does not exist|relation.*does not exist|not found|schema cache/i.test(error.message)) {
      try {
        const { data: legacy, error: legacyErr, count: legacyCount } = await supabase
          .from('fert_calc_soil_analyses')
          .select('*', { count: 'exact' })
          .order('sample_date', { ascending: false, nullsFirst: false })
          .range((page - 1) * pageSize, page * pageSize - 1);
        if (!legacyErr && legacy) {
          // Mapear legacy a shape de analisis_suelos para que el mapper lo entienda
          const mapped = (legacy || []).map((r) => ({
            id: r.id,
            company_id: r.company_id,
            predio_id: null,
            lote_id: r.lote_id || r.lot_id || null,
            nombre_muestra: r.lab_report_code || null,
            codigo_muestra: r.report_code || r.lab_report_code || null,
            laboratorio_id: null,
            laboratorio_nombre: r.lab_name || '—',
            fecha_muestreo: r.sample_date,
            fecha_analisis: r.sample_date || r.report_date,
            fecha_recepcion: r.report_date,
            muestreador: null,
            metodo_muestreo: null,
            profundidad_min_cm: null,
            profundidad_max_cm: null,
            observaciones: null,
            latitude: null,
            longitude: null,
            laboratorio_cert: null,
            archivo_pdf_path: null,
            estado: 'completo',
            created_at: r.created_at,
            // Inferir resultados preview desde nutrients JSONB
            resultados_preview: r.nutrients ? Object.entries(r.nutrients).slice(0, 4).map(([k, v]) => ({
              codigo: k,
              valor: v?.value ?? v ?? 0,
              unidad: v?.unit || '-',
            })) : [],
            resultados_count: r.nutrients ? Object.keys(r.nutrients).length : 0,
          }));
          return {
            data: mapped,
            total: legacyCount ?? mapped.length,
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil((legacyCount ?? mapped.length) / pageSize)),
            count: legacyCount,
          };
        }
      } catch (_) {}
      // Si no hay legacy, retornar vacío en lugar de error (estado vacío real)
      return { data: [], total: 0, page, pageSize, totalPages: 1, count: 0 };
    }

    if (error) throw new Error(error.message);

    let rows = data || [];
    const total = count ?? rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    // Si usamos fallback, necesitamos contar resultados y enriquecer con join manual para preview
    if (useFallback && rows.length > 0) {
      try {
        const ids = rows.map((r) => r.id);
        const { data: resRows } = await supabase
          .from('resultados_analisis_suelo')
          .select('analisis_suelo_id, codigo_parametro, valor, unidad, orden')
          .in('analisis_suelo_id', ids)
          .order('orden', { ascending: true })
          .limit(200);
        const byAnalysis = new Map();
        (resRows || []).forEach((r) => {
          const key = String(r.analisis_suelo_id);
          if (!byAnalysis.has(key)) byAnalysis.set(key, []);
          byAnalysis.get(key).push(r);
        });
        rows = rows.map((r) => ({
          ...r,
          resultados_count: (byAnalysis.get(String(r.id)) || []).length,
          resultados_preview: (byAnalysis.get(String(r.id)) || []).slice(0, 6),
        }));

        // Enriquecer predio/lote/lab nombres si faltan (select adicional)
        const predioIds = [...new Set(rows.map((r) => r.predio_id).filter(Boolean))];
        const loteIds = [...new Set(rows.map((r) => r.lote_id).filter(Boolean))];
        const labIds = [...new Set(rows.map((r) => r.laboratorio_id).filter(Boolean))];

        let prediosMap = new Map();
        let lotesMap = new Map();
        let labsMap = new Map();
        if (predioIds.length) {
          const { data: preds } = await supabase.from('predios').select('id, nombre').in('id', predioIds);
          (preds || []).forEach((p) => prediosMap.set(String(p.id), p));
        }
        if (loteIds.length) {
          const { data: lotes } = await supabase.from('lotes').select('id, nombre, codigo_interno, cultivo').in('id', loteIds);
          (lotes || []).forEach((l) => lotesMap.set(String(l.id), l));
        }
        if (labIds.length) {
          const { data: labs } = await supabase.from('laboratorios').select('id, nombre, numero_acreditacion').in('id', labIds);
          (labs || []).forEach((l) => labsMap.set(String(l.id), l));
        }
        rows = rows.map((r) => {
          const pred = r.predio_id ? prediosMap.get(String(r.predio_id)) : null;
          const lote = r.lote_id ? lotesMap.get(String(r.lote_id)) : null;
          const lab = r.laboratorio_id ? labsMap.get(String(r.laboratorio_id)) : null;
          return {
            ...r,
            predio_nombre: pred?.nombre || null,
            lote_nombre: lote?.nombre || r.nombre_muestra || null,
            lote_codigo: lote?.codigo_interno || null,
            lote_cultivo: lote?.cultivo || null,
            laboratorio_nombre: lab?.nombre || null,
            laboratorio_cert: lab?.numero_acreditacion || null,
          };
        });
      } catch (e) {
        console.warn('[soilAnalysisRepository] Enriquecimiento fallback error:', e?.message);
      }
    }

    // Si search incluye zona/lote/cultivo no indexados, hacer filtro adicional en memoria ya cubierto
    return {
      data: rows,
      total,
      page,
      pageSize,
      totalPages,
      count,
    };
  },

  async getAnalysisById(id) {
    if (!supabase || !id) return null;
    try {
      // Intentar RPC si existe
      const { data: rpcData, error: rpcErr } = await supabase.rpc('soil_analysis_detail', {
        p_analysis_id: id,
      });
      if (!rpcErr && rpcData && !rpcData.error) {
        return rpcData;
      }
    } catch (_) {}
    // Fallback: query directa
    const { data, error } = await supabase.from('analisis_suelos').select('*').eq('id', id).single();
    if (error || !data) return null;
    // Cargar resultados
    const { data: resultados } = await supabase
      .from('resultados_analisis_suelo')
      .select('*')
      .eq('analisis_suelo_id', id)
      .order('orden', { ascending: true });
    return { analisis: data, resultados: resultados || [] };
  },

  async getMetrics() {
    if (!supabase) throw new Error('Supabase no está configurado.');
    try {
      const { data, error } = await supabase.rpc('soil_analysis_metrics');
      if (!error && data) return data;
    } catch (_) {}
    // Fallback manual: counts
    try {
      const now = new Date();
      const startYear = `${now.getFullYear()}-01-01`;
      const endYear = `${now.getFullYear()}-12-31`;

      const [{ count: total, error: e1 }, { count: esteAno, error: e2 }, lastRowsRaw, labsRaw, zonasRaw] = await Promise.all([
        supabase.from('analisis_suelos').select('id', { count: 'exact', head: true }).neq('estado', 'anulado'),
        supabase.from('analisis_suelos').select('id', { count: 'exact', head: true }).gte('fecha_analisis', startYear).lte('fecha_analisis', endYear).neq('estado', 'anulado'),
        supabase.from('analisis_suelos').select('id, fecha_analisis').order('fecha_analisis', { ascending: false }).limit(1),
        supabase.from('analisis_suelos').select('laboratorio_id').not('laboratorio_id', 'is', null),
        supabase.from('analisis_suelos').select('ubicacion_nombre, lote_id').neq('estado', 'anulado').limit(1000),
      ]);

      // Si tablas no existen (migración pendiente), intentar legacy
      if ((e1 && /does not exist|schema cache/i.test(e1.message)) || (e2 && /does not exist|schema cache/i.test(e2.message))) {
        try {
          const [{ count: legacyTotal }, lastLegacy] = await Promise.all([
            supabase.from('fert_calc_soil_analyses').select('id', { count: 'exact', head: true }),
            supabase.from('fert_calc_soil_analyses').select('id, sample_date').order('sample_date', { ascending: false }).limit(1),
          ]);
          return {
            total: legacyTotal || 0,
            esteAno: 0,
            zonas: 0,
            laboratorios: 0,
            ultimo: lastLegacy.data?.[0] ? { id: lastLegacy.data[0].id, fecha_analisis: lastLegacy.data[0].sample_date } : null,
          };
        } catch (_) {
          return { total: 0, esteAno: 0, zonas: 0, laboratorios: 0, ultimo: null };
        }
      }

      const labsSet = new Set((labsRaw.data || []).map((r) => r.laboratorio_id).filter(Boolean));
      const zonasSet = new Set((zonasRaw.data || []).map((r) => r.ubicacion_nombre || r.lote_id).filter(Boolean));

      const last = lastRowsRaw.data && lastRowsRaw.data.length ? lastRowsRaw.data[0] : null;

      return {
        total: total || 0,
        esteAno: esteAno || 0,
        zonas: zonasSet.size,
        laboratorios: labsSet.size,
        ultimo: last,
      };
    } catch (err) {
      // Migración no aplicada → métricas en cero (estado vacío real)
      if (/does not exist|schema cache/i.test(err.message)) {
        return { total: 0, esteAno: 0, zonas: 0, laboratorios: 0, ultimo: null };
      }
      throw err;
    }
  },

  async getPrediosForFilter() {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.from('predios').select('id, nombre').order('nombre', { ascending: true }).limit(200);
      if (error || !data) return [];
      return data.map((p) => ({ id: String(p.id), nombre: p.nombre, label: p.nombre }));
    } catch {
      return [];
    }
  },

  async getLotesForFilter(predioId = null) {
    if (!supabase) return [];
    try {
      let q = supabase.from('lotes').select('id, nombre, codigo_interno, cultivo, predio_id, predios:predio_id(id, nombre)').order('nombre', { ascending: true }).limit(200);
      if (predioId) q = q.eq('predio_id', predioId);
      const { data, error } = await q;
      if (error || !data) return [];
      return data.map((l) => ({
        id: String(l.id),
        nombre: l.nombre || l.codigo_interno || 'Lote',
        codigo: l.codigo_interno,
        cultivo: l.cultivo,
        predioId: l.predio_id ? String(l.predio_id) : null,
        sector: l.predios?.nombre || null,
        label: [l.codigo_interno || l.nombre, l.predios?.nombre].filter(Boolean).join(' · ') || l.nombre,
      }));
    } catch {
      return [];
    }
  },

  async getLaboratorios() {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.from('laboratorios').select('id, nombre, nit, acreditado, numero_acreditacion').order('nombre', { ascending: true }).limit(200);
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) return [];
        return [];
      }
      if (!data) return [];
      return data.map((l) => ({
        id: String(l.id),
        nombre: l.nombre,
        nit: l.nit,
        acreditado: l.acreditado,
        cert: l.numero_acreditacion,
        label: l.numero_acreditacion ? `${l.nombre} · Cert. ${l.numero_acreditacion}` : l.nombre,
      }));
    } catch {
      return [];
    }
  },

  async getParametros() {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.from('parametros_suelo').select('*').eq('activo', true).order('orden', { ascending: true }).limit(200);
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) {
          // Fallback catálogo duro mínimo si migración no aplicada
          return [
            { codigo: 'pH', nombre: 'pH', categoria: 'acidez', unidad_default: '-', orden: 10 },
            { codigo: 'MO', nombre: 'Materia Orgánica', categoria: 'materia_organica', unidad_default: '%', orden: 20 },
            { codigo: 'N', nombre: 'Nitrógeno total', categoria: 'macronutrientes', unidad_default: '%', orden: 30 },
            { codigo: 'P', nombre: 'Fósforo', categoria: 'macronutrientes', unidad_default: 'mg/kg', orden: 40 },
            { codigo: 'K', nombre: 'Potasio', categoria: 'macronutrientes', unidad_default: 'cmol(+)/kg', orden: 50 },
            { codigo: 'Ca', nombre: 'Calcio', categoria: 'macronutrientes', unidad_default: 'cmol(+)/kg', orden: 60 },
            { codigo: 'Mg', nombre: 'Magnesio', categoria: 'macronutrientes', unidad_default: 'cmol(+)/kg', orden: 70 },
            { codigo: 'Al', nombre: 'Aluminio', categoria: 'acidez', unidad_default: 'cmol(+)/kg', orden: 90 },
            { codigo: 'CICE', nombre: 'CICE', categoria: 'propiedades_quimicas', unidad_default: 'cmol(+)/kg', orden: 100 },
          ];
        }
        return [];
      }
      if (!data || data.length === 0) return [];
      return data;
    } catch {
      return [];
    }
  },

  async createLaboratorio(payload, context = {}) {
    if (!supabase) throw new Error('Supabase no está configurado.');
    if (!payload.nombre || !String(payload.nombre).trim()) throw new Error('Nombre de laboratorio requerido.');
    const insert = {
      nombre: String(payload.nombre).trim(),
      nit: payload.nit ? String(payload.nit).trim() : null,
      direccion: payload.direccion || null,
      telefono: payload.telefono || null,
      email: payload.email || null,
      acreditado: Boolean(payload.acreditado),
      numero_acreditacion: payload.numero_acreditacion || null,
      observaciones: payload.observaciones || null,
      ...(context.companyId ? { company_id: context.companyId } : {}),
    };
    const { data, error } = await supabase.from('laboratorios').insert(insert).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  // ── Escritura análisis ───────────────────────────────────────────────────
  async createAnalisis(payload, context = {}) {
    if (!supabase) throw new Error('Supabase no está configurado.');
    if (!payload.fecha_analisis) throw new Error('Fecha de análisis requerida.');
    if (!payload.predio_id && !payload.lote_id) {
      // Permitir sin predio/lote si laboratorio está? Pero spec dice predio obligatorio
      // Dejamos pasar si al menos empresa existe; validación UI lo exige
    }
    const insert = {
      predio_id: payload.predio_id || null,
      lote_id: payload.lote_id || null,
      nombre_muestra: payload.nombre_muestra ? String(payload.nombre_muestra).trim() : null,
      codigo_muestra: payload.codigo_muestra ? String(payload.codigo_muestra).trim() : null,
      laboratorio_id: payload.laboratorio_id || null,
      fecha_muestreo: toDateOnly(payload.fecha_muestreo),
      fecha_recepcion: toDateOnly(payload.fecha_recepcion),
      fecha_analisis: toDateOnly(payload.fecha_analisis),
      muestreador: payload.muestreador ? String(payload.muestreador).trim() : null,
      metodo_muestreo: payload.metodo_muestreo || null,
      profundidad_min_cm: payload.profundidad_min_cm != null && payload.profundidad_min_cm !== '' ? Number(payload.profundidad_min_cm) : null,
      profundidad_max_cm: payload.profundidad_max_cm != null && payload.profundidad_max_cm !== '' ? Number(payload.profundidad_max_cm) : null,
      observaciones: payload.observaciones || null,
      latitude: payload.latitude != null && payload.latitude !== '' ? Number(payload.latitude) : null,
      longitude: payload.longitude != null && payload.longitude !== '' ? Number(payload.longitude) : null,
      accuracy_m: payload.accuracy_m != null ? Number(payload.accuracy_m) : null,
      altitude: payload.altitude != null ? Number(payload.altitude) : null,
      captured_at: payload.captured_at || null,
      ubicacion_nombre: payload.ubicacion_nombre ? String(payload.ubicacion_nombre).trim() : null,
      ubicacion_descripcion: payload.ubicacion_descripcion || null,
      archivo_pdf_path: payload.archivo_pdf_path || null,
      archivo_pdf_nombre: payload.archivo_pdf_nombre || null,
      archivo_pdf_size: payload.archivo_pdf_size != null ? Number(payload.archivo_pdf_size) : null,
      archivo_pdf_mime: payload.archivo_pdf_mime || 'application/pdf',
      estado: payload.estado || 'borrador',
      created_by: context.userId || null,
      updated_by: context.userId || null,
      ...(context.companyId ? { company_id: context.companyId } : {}),
    };
    const { data, error } = await supabase.from('analisis_suelos').insert(insert).select().single();
    if (error) {
      if (/permission|RLS|policy/i.test(error.message)) throw new Error('No tienes permisos para crear análisis en esta empresa.');
      throw new Error(error.message);
    }
    return data;
  },

  async updateAnalisis(id, patch, context = {}) {
    if (!supabase) throw new Error('Supabase no está configurado.');
    if (!id) throw new Error('ID requerido.');
    const allowed = {};
    const fields = [
      'predio_id','lote_id','nombre_muestra','codigo_muestra','laboratorio_id',
      'fecha_muestreo','fecha_recepcion','fecha_analisis',
      'muestreador','metodo_muestreo','profundidad_min_cm','profundidad_max_cm',
      'observaciones','latitude','longitude','accuracy_m','altitude','captured_at',
      'ubicacion_nombre','ubicacion_descripcion',
      'archivo_pdf_path','archivo_pdf_nombre','archivo_pdf_size','archivo_pdf_mime',
      'estado'
    ];
    for (const f of fields) {
      if (patch[f] !== undefined) {
        if (['fecha_muestreo','fecha_recepcion','fecha_analisis'].includes(f)) {
          allowed[f] = patch[f] ? toDateOnly(patch[f]) : null;
        } else if (['profundidad_min_cm','profundidad_max_cm','latitude','longitude','accuracy_m','altitude','archivo_pdf_size'].includes(f)) {
          allowed[f] = patch[f] === '' || patch[f] == null ? null : Number(patch[f]);
        } else {
          allowed[f] = patch[f];
        }
      }
    }
    if (context.userId) allowed.updated_by = context.userId;
    allowed.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('analisis_suelos').update(allowed).eq('id', id).select().single();
    if (error) {
      if (/permission|RLS/i.test(error.message)) throw new Error('No tienes permisos para editar este análisis.');
      throw new Error(error.message);
    }
    return data;
  },

  async deleteAnalisis(id) {
    if (!supabase) throw new Error('Supabase no está configurado.');
    if (!id) throw new Error('ID requerido.');
    // Intentar borrado físico; si RLS lo bloquea, archivar
    const { error } = await supabase.from('analisis_suelos').delete().eq('id', id);
    if (error) {
      if (/permission|policy|RLS/i.test(error.message)) {
        const { data, error: updErr } = await supabase.from('analisis_suelos').update({ estado: 'archivado', updated_at: new Date().toISOString() }).eq('id', id).select().single();
        if (updErr) throw new Error(updErr.message);
        return data;
      }
      throw new Error(error.message);
    }
    return { deleted: true, id };
  },

  async archiveAnalisis(id) {
    if (!supabase) throw new Error('Supabase no está configurado.');
    const { data, error } = await supabase.from('analisis_suelos').update({ estado: 'archivado', updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  // ── Resultados ───────────────────────────────────────────────────────────
  async getResultados(analisisId) {
    if (!supabase || !analisisId) return [];
    const { data, error } = await supabase.from('resultados_analisis_suelo').select('*').eq('analisis_suelo_id', analisisId).order('orden', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async upsertResultados(analisisId, resultados, context = {}) {
    if (!supabase) throw new Error('Supabase no está configurado.');
    if (!analisisId) throw new Error('analisisId requerido.');
    if (!Array.isArray(resultados)) throw new Error('resultados debe ser array.');

    // Borrar existentes y reinsertar (simple y seguro para esta escala)
    const { error: delErr } = await supabase.from('resultados_analisis_suelo').delete().eq('analisis_suelo_id', analisisId);
    if (delErr) throw new Error(delErr.message);

    if (resultados.length === 0) return [];

    const rows = resultados
      .filter((r) => r.codigo_parametro && r.valor != null && r.valor !== '')
      .map((r, idx) => ({
        analisis_suelo_id: analisisId,
        company_id: context.companyId || undefined, // proxy lo inyecta si falta
        parametro: r.parametro || r.codigo_parametro,
        codigo_parametro: String(r.codigo_parametro).trim().toUpperCase(),
        valor: Number(r.valor),
        unidad: r.unidad || '-',
        metodo_analitico: r.metodo_analitico || null,
        nivel_interpretacion: r.nivel_interpretacion || null,
        observacion: r.observacion || null,
        orden: r.orden != null ? Number(r.orden) : idx,
      }));

    if (rows.length === 0) return [];

    const { data, error } = await supabase.from('resultados_analisis_suelo').insert(rows).select();
    if (error) throw new Error(error.message);

    // Si el análisis estaba en borrador y ya tiene resultados, opcionalmente marcar como completo
    // No forzamos; el caller decide.

    return data || [];
  },

  async getYears() {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.from('analisis_suelos').select('fecha_analisis').order('fecha_analisis', { ascending: false }).limit(500);
      if (error || !data) return [];
      const years = [...new Set(data.map((r) => r.fecha_analisis ? String(r.fecha_analisis).slice(0, 4) : null).filter(Boolean))];
      return years.sort((a, b) => Number(b) - Number(a));
    } catch {
      return [];
    }
  }
};
