import { supabase } from '../../../lib/supabaseClient';

export const getLabores = async () => {
  const { data, error } = await supabase
    .from('labores')
    .select('*, labor_trabajadores(trabajador_id)')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(l => ({
    id: l.id,
    titulo: l.titulo,
    tipo: l.tipo,
    descripcion: l.descripcion,
    lote: l.lote,
    fecha: l.fecha,
    estado: l.estado,
    asignacion: l.asignacion,
    cuadrillaId: l.cuadrilla_id,
    trabajadoresIds: (l.labor_trabajadores || []).map(t => t.trabajador_id),
    jornal: l.jornal !== undefined && l.jornal !== null ? Number(l.jornal) : 1.0,
  }));
};

export const createLabor = async (laborForm) => {
  const dbLabor = {
    titulo: laborForm.titulo.trim(),
    tipo: laborForm.tipo,
    descripcion: laborForm.descripcion,
    lote: laborForm.lote,
    fecha: laborForm.fecha || new Date().toISOString().split('T')[0],
    estado: laborForm.estado || 'Pendiente',
    asignacion: laborForm.asignacion,
    cuadrilla_id: laborForm.asignacion === 'cuadrilla' && laborForm.cuadrillaId ? laborForm.cuadrillaId : null,
    jornal: Number(laborForm.jornal) || 1.0
  };

  const { data: laborResult, error: laborErr } = await supabase
    .from('labores')
    .insert([dbLabor])
    .select();

  if (laborErr) throw laborErr;
  if (!laborResult || !laborResult[0]) throw new Error('Failed to insert labor');

  const newLaborId = laborResult[0].id;
  const workersIds = laborForm.asignacion === 'individual' ? (laborForm.trabajadoresIds || []) : [];

  if (workersIds.length > 0) {
    const relations = workersIds.map(wId => ({
      labor_id: newLaborId,
      trabajador_id: wId
    }));
    const { error: relErr } = await supabase.from('labor_trabajadores').insert(relations);
    if (relErr) throw relErr;
  }

  return {
    id: newLaborId,
    titulo: laborResult[0].titulo,
    tipo: laborResult[0].tipo,
    descripcion: laborResult[0].descripcion,
    lote: laborResult[0].lote,
    fecha: laborResult[0].fecha,
    estado: laborResult[0].estado,
    asignacion: laborResult[0].asignacion,
    cuadrillaId: laborResult[0].cuadrilla_id,
    trabajadoresIds: workersIds,
    jornal: Number(laborResult[0].jornal) || 1.0
  };
};

export const updateEstadoLabor = async (id, newEstado) => {
  const { error } = await supabase
    .from('labores')
    .update({ estado: newEstado })
    .eq('id', id);

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
  const { error } = await supabase
    .from('labores')
    .update({ estado: 'Archivada' })
    .in('id', activeIds);

  if (error) throw error;
  return activeIds;
};

export const unarchiveLabor = async (id, originalEstado = 'Pendiente') => {
  const { error } = await supabase
    .from('labores')
    .update({ estado: originalEstado })
    .eq('id', id);

  if (error) throw error;
  return { id, originalEstado };
};
