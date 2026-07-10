import { supabase } from '../../../lib/supabaseClient';
import { warehouseToClient, warehouseToDatabase } from '../adapters/warehouse.adapter';

export const fetchWarehouses = async () => {
  const { data, error } = await supabase
    .from('bodegas')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(warehouseToClient);
};

export const createWarehouse = async (warehouseForm) => {
  const dbWh = warehouseToDatabase(warehouseForm);

  const { data, error } = await supabase
    .from('bodegas')
    .insert([dbWh])
    .select();

  if (error) throw error;
  if (!data || !data[0]) throw new Error('No se recibieron datos de la base de datos al guardar.');

  return warehouseToClient(data[0]);
};

export const deleteWarehouse = async (id) => {
  const { error } = await supabase
    .from('bodegas')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return id;
};

export const fetchWorkers = async () => {
  const { data, error } = await supabase
    .from('trabajadores')
    .select('id, nombres, apellidos')
    .order('nombres', { ascending: true });

  if (error) throw error;
  return data || [];
};
