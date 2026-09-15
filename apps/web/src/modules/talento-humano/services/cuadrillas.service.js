import { supabase } from '../../../lib/supabaseClient';

export const getCuadrillas = async () => {
  const { data, error } = await supabase
    .from('cuadrillas')
    .select('*, cuadrilla_miembros(trabajador_id)')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;

  return (data || []).map(c => ({
    id: c.id,
    nombre: c.nombre,
    miembros: (c.cuadrilla_miembros || []).map(m => m.trabajador_id)
  }));
};

export const createCuadrilla = async (nombre) => {
  const { data, error } = await supabase.rpc('th_crear_cuadrilla', { p_nombre: nombre });
  if (error) throw error;

  const { data: row, error: e2 } = await supabase.from('cuadrillas').select('id,nombre').eq('id', data.id).maybeSingle();
  if (e2) throw e2;
  return { id: row.id, nombre: row.nombre, miembros: [] };
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
  // F2: RPC idempotente + valida trabajador activo mismo tenant (th_assert).
  const { error } = await supabase.rpc('th_agregar_miembro', {
    p_cuadrilla_id: cuadrillaId,
    p_trabajador_id: workerId
  });

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
