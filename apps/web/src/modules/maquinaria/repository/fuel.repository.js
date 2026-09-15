import { supabase } from '../../../lib/supabaseClient';
import { FuelRecord } from '../types/FuelRecord';

/**
 * Data Access Layer for Fuel — contrato 052 §2.4/§5.
 * Tabla propia e inmutable; registro solo vía RPC. Nuevo en paso 8
 * (antes el combustible vivía dentro de la jornada sin persistencia).
 * Cableado a UI en paso 9.
 */
const FUEL_COLUMNS = [
  'id', 'company_id', 'maquinaria_id',
  'fecha', 'cantidad', 'unidad',
  'costo_unitario', 'costo_total', 'horometro',
  'operador_id', 'proveedor', 'observacion', 'created_at'
].join(',');

export class FuelRepository {
  async registrar({ maquinariaId, fecha, cantidad, unidad = 'L', costoUnitario, horometro, operadorId = null, proveedor = null, observacion = null }) {
    const { data, error } = await supabase.rpc('registrar_combustible_maquinaria', {
      p_maquinaria_id: maquinariaId,
      p_fecha: fecha,
      p_cantidad: Number(cantidad),
      p_unidad: unidad,
      p_costo_unitario: Number(costoUnitario),
      p_horometro: Number(horometro),
      p_operador_id: operadorId,
      p_proveedor: proveedor,
      p_observacion: observacion
    });

    if (error) {
      console.error('RPC error in registrar combustible:', error.message);
      throw error;
    }
    return data;
  }

  async getHistorial({ maquinariaId = null, limit = 200 } = {}) {
    let query = supabase
      .from('maquinaria_combustible')
      .select(FUEL_COLUMNS)
      .order('fecha', { ascending: false })
      .limit(limit);
    if (maquinariaId) {
      query = query.eq('maquinaria_id', maquinariaId);
    }
    const { data, error } = await query;
    if (error) {
      console.error('Database error fetching fuel:', error.message);
      throw error;
    }
    return (data || []).map((row) => (typeof FuelRecord.fromDatabase === 'function' ? FuelRecord.fromDatabase(row) : row));
  }
}

export const fuelRepository = new FuelRepository();
export default fuelRepository;
