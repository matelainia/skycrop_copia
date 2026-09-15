import { supabase } from '../../../lib/supabaseClient';

/**
 * Data Access Layer for Maintenance — contrato 052.
 * Programar y ejecutar van por RPC; el historial lee la tabla nueva.
 * No existe escritura directa: los ejecutados son inmutables (§7).
 */
const MTO_COLUMNS = [
  'id', 'company_id', 'maquinaria_id',
  'tipo', 'estado', 'descripcion',
  'fecha_programada', 'fecha_ejecucion', 'horometro',
  'costo', 'proveedor', 'responsable',
  'created_at', 'executed_at'
].join(',');

export class MaintenanceRepository {
  /**
   * Programar mantenimiento (Preventivo | Correctivo).
   */
  async programar({ maquinariaId, tipo, descripcion, fechaProgramada, horometroRef, iniciarEjecucion = false }) {
    const { data, error } = await supabase.rpc('programar_mantenimiento_maquinaria', {
      p_maquinaria_id: maquinariaId,
      p_tipo: tipo,
      p_descripcion: descripcion,
      p_fecha_programada: fechaProgramada,
      p_horometro_ref: Number(horometroRef),
      p_iniciar_ejecucion: iniciarEjecucion
    });

    if (error) {
      console.error('RPC error in programar mantenimiento:', error.message);
      throw error;
    }
    return data;
  }

  /**
   * Registrar ejecución de un mantenimiento programado/en ejecución.
   */
  async registrarEjecucion({ mantenimientoId, fechaEjecucion, horometro, costo = 0, proveedor = null, responsable = null }) {
    const { data, error } = await supabase.rpc('registrar_mantenimiento_maquinaria_v2', {
      p_mantenimiento_id: mantenimientoId,
      p_fecha_ejecucion: fechaEjecucion,
      p_horometro: Number(horometro),
      p_costo: Number(costo) || 0,
      p_proveedor: proveedor,
      p_responsable: responsable
    });

    if (error) {
      console.error('RPC error in registrar mantenimiento:', error.message);
      throw error;
    }
    return data;
  }

  /**
   * Historial de mantenimientos (lectura; más recientes primero).
   */
  async getHistorial({ maquinariaId = null, limit = 200 } = {}) {
    let query = supabase
      .from('maquinaria_mantenimientos')
      .select(MTO_COLUMNS)
      .order('fecha_programada', { ascending: false })
      .limit(limit);
    if (maquinariaId) {
      query = query.eq('maquinaria_id', maquinariaId);
    }
    const { data, error } = await query;
    if (error) {
      console.error('Database error fetching maintenance:', error.message);
      throw error;
    }
    return data || [];
  }
}

export const maintenanceRepository = new MaintenanceRepository();
export default maintenanceRepository;
