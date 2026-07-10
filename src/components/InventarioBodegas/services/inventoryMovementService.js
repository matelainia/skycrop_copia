import { supabase } from '../../../lib/supabaseClient';
import { movementToClient } from '../adapters/movement.adapter';

export const adjustStock = async (itemId, quantity, type, reason, warehouseId = null) => {
  const { data, error } = await supabase.rpc('registrar_movimiento_inventario', {
    p_item_id: itemId,
    p_cantidad: Number(quantity),
    p_tipo: type, // 'entrada' or 'salida'
    p_motivo: reason || '',
    p_warehouse_id: warehouseId || null
  });

  if (error) {
    console.error('Error in RPC adjustStock:', error.message);
    throw error;
  }
  return data;
};

export const fetchMovements = async (itemId = null) => {
  let query = supabase
    .from('movimientos_inventario')
    .select('*')
    .order('created_at', { ascending: false });

  if (itemId) {
    query = query.eq('item_id', itemId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(movementToClient);
};
