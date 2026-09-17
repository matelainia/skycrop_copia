import { supabase } from '../../../lib/supabaseClient';

const mapLabor = (l, workersIds) => ({
  id: l.id,
  titulo: l.titulo,
  tipo: l.tipo,
  descripcion: l.descripcion,
  lote: l.lote,
  loteId: l.lote_id || null,
  fecha: l.fecha,
  estado: l.estado,
  asignacion: l.asignacion,
  cuadrillaId: l.cuadrilla_id,
  trabajadoresIds: workersIds ?? (l.labor_trabajadores || []).map(t => t.trabajador_id),
  jornal: l.jornal !== undefined && l.jornal !== null && l.jornal !== '' ? Number(l.jornal) : null,
});

export const getLotes = async () => {
  const { data, error } = await supabase
    .from('lotes')
    .select('id,nombre,codigo_interno')
    .order('nombre')
    .limit(200);

  if (error) throw error;
  return data || [];
};

export const getLabores = async () => {
  const { data, error } = await supabase
    .from('labores')
    .select('*, labor_trabajadores(trabajador_id)')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;
  return (data || []).map(l => mapLabor(l));
};

export const createLabor = async (laborForm) => {
  // F2: registro atómico cabecera + miembros (una transacción server).
  const workersIds = laborForm.asignacion === 'individual' ? (laborForm.trabajadoresIds || []) : [];
  const { data, error } = await supabase.rpc('th_registrar_labor', {
    p_titulo: laborForm.titulo.trim(),
    p_tipo: laborForm.tipo,
    p_descripcion: laborForm.descripcion || null,
    p_lote: laborForm.lote || null,
    p_lote_id: laborForm.loteId || null,
    p_fecha: laborForm.fecha || new Date().toISOString().split('T')[0],
    p_estado: laborForm.estado || 'Pendiente',
    p_asignacion: laborForm.asignacion,
    p_cuadrilla_id: laborForm.asignacion === 'cuadrilla' && laborForm.cuadrillaId ? laborForm.cuadrillaId : null,
    p_jornal: laborForm.jornal === '' || laborForm.jornal == null ? 1 : Number(laborForm.jornal),
    p_trabajadores: workersIds
  });
  if (error) throw error;

  const { data: row, error: e2 } = await supabase.from('labores').select('*').eq('id', data.id).maybeSingle();
  if (e2) throw e2;
  if (!row) throw new Error('Labor no encontrada tras registro');
  return mapLabor(row, workersIds);
};

export const updateEstadoLabor = async (id, newEstado) => {
  const { error } = await supabase.rpc('th_cambiar_estado_labor', { p_labor_id: id, p_estado: newEstado });
  if (error) throw error;
  return { id, newEstado };
};

export const deleteLabor = async (id) => {
  const { error } = await supabase
    .from('labores')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return id;
};

export const archiveActiveLabores = async (activeIds) => {
  // Archivado masivo vía cambios de estado individuales (trazables por RPC).
  for (const id of activeIds) {
    const { error } = await supabase.rpc('th_cambiar_estado_labor', { p_labor_id: id, p_estado: 'Archivada' });
    if (error) throw error;
  }
  return activeIds;
};

export const unarchiveLabor = async (id, originalEstado = 'Pendiente') => {
  const { error } = await supabase.rpc('th_cambiar_estado_labor', { p_labor_id: id, p_estado: originalEstado });
  if (error) throw error;
  return { id, originalEstado };
};
