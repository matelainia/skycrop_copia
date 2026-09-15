import { supabase } from '../../../lib/supabaseClient';
import { Operation } from '../types/Operation';

/**
 * Data Access Layer for Machinery Operations — contrato 052/054.
 * Lee de maquinaria_operaciones (select explícito + join mínimo).
 * Escrituras por RPC nuevas; la resolución lote/operador (texto UI → FK)
 * vive aquí porque es acceso a datos, no regla de negocio.
 */
const OP_COLUMNS = [
  'id', 'company_id', 'maquinaria_id',
  'operador_id', 'operador_nombre', 'labor',
  'lote_id', 'lote_nombre',
  'inicio', 'fin', 'horometro_inicio', 'horometro_fin',
  'horas', 'combustible_l', 'costo_total',
  'estado', 'notas', 'created_at',
  'maquinaria(codigo,nombre,photo_url,image_url)'
].join(',');

export class OperationRepository {
  /**
   * Fetch operations history (paginado en servidor; lote amplio por defecto
   * para no romper la UI actual — paso 9 lo migra a paginación real).
   */
  async getAll({ limit = 500, offset = 0 } = {}) {
    const { data, error } = await supabase
      .from('maquinaria_operaciones')
      .select(OP_COLUMNS)
      .order('inicio', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Database error fetching operations:', error.message);
      throw error;
    }
    return (data || []).map(Operation.fromDatabase);
  }

  /**
   * Resuelve el texto libre de lote a FK (nombre o código interno, tenant
   * actual vía RLS). Sin match → null y el llamador decide (la RPC exige
   * lote_id: el servicio aborta con guía, no inventa FK).
   */
  async resolveLoteId(loteNombre) {
    const nombre = String(loteNombre ?? '').replace(/[,()]/g, '').trim();
    if (!nombre) return null;
    const { data, error } = await supabase
      .from('lotes')
      .select('id,nombre')
      .or(`nombre.ilike.${nombre},codigo_interno.ilike.${nombre}`)
      .limit(2);
    if (error) {
      console.error('Database error resolving lote:', error.message);
      throw error;
    }
    if (!data || data.length === 0) return null;
    const exact = data.find(
      (l) => l.nombre?.toLowerCase() === nombre.toLowerCase()
    );
    return (exact ?? (data.length === 1 ? data[0] : null))?.id ?? null;
  }

  /**
   * Best-effort operador (texto UI → trabajadores.id). Sin match → null y la
   * RPC 054 conserva el texto como snapshot (puente paso 8).
   */
  async resolveOperadorId(operadorNombre) {
    const nombre = String(operadorNombre ?? '').trim();
    if (!nombre) return null;
    const firstToken = nombre.split(/\s+/)[0].replace(/[%(),]/g, '');
    const { data, error } = await supabase
      .from('trabajadores')
      .select('id,nombres,apellidos')
      .ilike('nombres', `%${firstToken}%`)
      .limit(10);
    if (error) {
      console.error('Database error resolving operador:', error.message);
      throw error;
    }
    const exact = (data || []).find(
      (t) => `${t.nombres} ${t.apellidos}`.trim().toLowerCase() === nombre.toLowerCase()
    );
    return exact?.id ?? null;
  }

  /**
   * Start a machinery operation transactionally via RPC 052/054.
   */
  async startLabor({ maquinariaId, operadorId, operadorNombre, loteId, labor, startTime, startHorometro }) {
    const { data, error } = await supabase.rpc('iniciar_jornada_maquinaria', {
      p_maquinaria_id: maquinariaId,
      p_operador_id: operadorId ?? null,
      p_lote_id: loteId,
      p_labor: labor,
      p_inicio: startTime,
      p_horometro_inicio: Number(startHorometro),
      p_operador_nombre: operadorNombre ?? null
    });

    if (error) {
      console.error('RPC error in startLabor:', error.message);
      throw error;
    }
    return data;
  }

  /**
   * End a machinery operation transactionally via RPC 052.
   * combustible_l en litros; null cuando la UI no lo captura en litros
   * (los % de tanque legacy no son litros: no inventar unidades).
   */
  async endLabor({ jornadaId, endTime, endHorometro, combustibleL, notes }) {
    const { data, error } = await supabase.rpc('finalizar_jornada_maquinaria', {
      p_operacion_id: jornadaId,
      p_fin: endTime,
      p_horometro_fin: Number(endHorometro),
      p_combustible_l: combustibleL ?? null,
      p_notas: notes || ''
    });

    if (error) {
      console.error('RPC error in endLabor:', error.message);
      throw error;
    }
    return data;
  }
}

export const operationRepository = new OperationRepository();
export default operationRepository;
