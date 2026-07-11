import { supabase } from '../../../lib/supabaseClient';
import { Machine } from '../types/Machine';

/**
 * Data Access Layer for Machinery fleet
 */
export class MachineryRepository {
  /**
   * Fetch all machines from base
   */
  async getAll() {
    const { data, error } = await supabase
      .from('maquinaria')
      .select('*')
      .order('codigo_id', { ascending: true });

    if (error) {
      console.error('Database error fetching machinery:', error.message);
      throw error;
    }
    return (data || []).map(Machine.fromDatabase);
  }

  /**
   * Insert a new machinery record
   */
  async create(machine) {
    const dbData = Machine.toDatabase(machine);
    const { data, error } = await supabase
      .from('maquinaria')
      .insert([dbData])
      .select();

    if (error) {
      console.error('Database error creating machinery:', error.message);
      throw error;
    }
    return Machine.fromDatabase(data?.[0]);
  }

  /**
   * Update an existing machinery record
   */
  async update(id, machine) {
    const dbData = Machine.toDatabase(machine);
    const { data, error } = await supabase
      .from('maquinaria')
      .update(dbData)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Database error updating machinery:', error.message);
      throw error;
    }
    return Machine.fromDatabase(data?.[0]);
  }

  /**
   * Delete a machinery record from database
   */
  async delete(id) {
    const { error } = await supabase
      .from('maquinaria')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Database error deleting machinery:', error.message);
      throw error;
    }
    return id;
  }
}

export const machineryRepository = new MachineryRepository();
export default machineryRepository;
