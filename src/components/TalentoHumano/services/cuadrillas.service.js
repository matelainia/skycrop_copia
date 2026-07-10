import { supabase } from '../../../lib/supabaseClient';

export const getCuadrillas = async () => {
  const { data, error } = await supabase
    .from('cuadrillas')
    .select('*, cuadrilla_miembros(trabajador_id)');

  if (error) throw error;

  return (data || []).map(c => ({
    id: c.id,
    nombre: c.nombre,
    miembros: (c.cuadrilla_miembros || []).map(m => m.trabajador_id)
  }));
};

export const createCuadrilla = async (nombre) => {
  const { data, error } = await supabase
    .from('cuadrillas')
    .insert([{ nombre }])
    .select();

  if (error) throw error;
  if (!data || !data[0]) throw new Error('No data returned');

  return {
    id: data[0].id,
    nombre: data[0].nombre,
    miembros: []
  };
};

export const deleteCuadrilla = async (id) => {
  const { error } = await supabase
    .from('cuadrillas')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return id;
};

export const addMemberToCuadrilla = async (cuadrillaId, workerId) => {
  const { error } = await supabase
    .from('cuadrilla_miembros')
    .insert([{ cuadrilla_id: cuadrillaId, trabajador_id: workerId }]);

  if (error) throw error;
  return { cuadrillaId, workerId };
};

export const removeMemberFromCuadrilla = async (cuadrillaId, workerId) => {
  const { error } = await supabase
    .from('cuadrilla_miembros')
    .delete()
    .eq('cuadrilla_id', cuadrillaId)
    .eq('trabajador_id', workerId);

  if (error) throw error;
  return { cuadrillaId, workerId };
};
