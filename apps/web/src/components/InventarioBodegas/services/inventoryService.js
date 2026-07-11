import { supabase } from '../../../lib/supabaseClient';
import { inventoryToClient, inventoryToDatabase } from '../adapters/inventory.adapter';

export const fetchInventory = async () => {
  const { data, error } = await supabase
    .from('inventario')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(inventoryToClient);
};

export const getInventory = fetchInventory; // Alias matching plan

export const createItem = async (itemForm) => {
  const dbItem = inventoryToDatabase(itemForm);

  const { data, error } = await supabase
    .from('inventario')
    .insert([dbItem])
    .select();

  if (error) throw error;
  if (!data || !data[0]) throw new Error('No se recibieron datos de la base de datos al guardar.');

  return inventoryToClient(data[0]);
};

export const deleteItem = async (id) => {
  const { error } = await supabase
    .from('inventario')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return id;
};

export const updateStock = async (id, newQty) => {
  const { error } = await supabase
    .from('inventario')
    .update({ quantity: newQty })
    .eq('id', id);

  if (error) throw error;
  return newQty;
};

export const updateItem = async (id, itemForm) => {
  const dbItem = inventoryToDatabase(itemForm);

  const { data, error } = await supabase
    .from('inventario')
    .update(dbItem)
    .eq('id', id)
    .select();

  if (error) throw error;
  if (!data || !data[0]) throw new Error('No se recibieron datos de la base de datos al actualizar.');

  return inventoryToClient(data[0]);
};
