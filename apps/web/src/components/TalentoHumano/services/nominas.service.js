import { supabase } from '../../../lib/supabaseClient';

export const getNominas = async () => {
  const { data, error } = await supabase
    .from('nominas')
    .select('*, trabajadores(*)');

  if (error) throw error;

  return (data || []).map(n => ({
    id: n.id,
    trabajador_id: n.trabajador_id,
    periodo: n.periodo,
    salario_neto: Number(n.salario_neto) || 0,
    horas_extras: Number(n.horas_extras) || 0,
    retenciones: Number(n.retenciones) || 0,
    total_neto: Number(n.total_neto) || 0,
    estado: n.estado,
    fecha_pago: n.fecha_pago,
    metodo_pago: n.metodo_pago,
    comentarios: n.comentarios,
    trabajador: n.trabajadores ? {
      id: n.trabajadores.id,
      nombres: n.trabajadores.nombres,
      apellidos: n.trabajadores.apellidos,
      identificacion: n.trabajadores.identificacion,
      rol: n.trabajadores.rol,
      foto: n.trabajadores.foto,
      tipoContrato: n.trabajadores.tipo_contrato
    } : null
  }));
};

export const createNomina = async (nominaForm) => {
  const valorHoraExtra = 15000;
  const totNeto = Number(nominaForm.salarioNeto) + (Number(nominaForm.horasExtras) * valorHoraExtra) - Number(nominaForm.retenciones);

  const dbNomina = {
    trabajador_id: nominaForm.trabajadorId,
    periodo: nominaForm.periodo,
    salario_neto: Number(nominaForm.salarioNeto),
    horas_extras: Number(nominaForm.horasExtras),
    retenciones: Number(nominaForm.retenciones),
    total_neto: totNeto,
    estado: nominaForm.estado,
    fecha_pago: nominaForm.fechaPago || null,
    metodo_pago: nominaForm.metodoPago || null,
    comentarios: nominaForm.comentarios || ''
  };

  const { data, error } = await supabase
    .from('nominas')
    .insert([dbNomina])
    .select();

  if (error) throw error;
  if (!data || !data[0]) throw new Error('No data returned');

  return {
    ...data[0],
    salario_neto: Number(data[0].salario_neto),
    horas_extras: Number(data[0].horas_extras),
    retenciones: Number(data[0].retenciones),
    total_neto: Number(data[0].total_neto)
  };
};

export const updateNomina = async (id, nominaForm) => {
  const valorHoraExtra = 15000;
  const totNeto = Number(nominaForm.salarioNeto) + (Number(nominaForm.horasExtras) * valorHoraExtra) - Number(nominaForm.retenciones);

  const dbNomina = {
    salario_neto: Number(nominaForm.salarioNeto),
    horas_extras: Number(nominaForm.horasExtras),
    retenciones: Number(nominaForm.retenciones),
    total_neto: totNeto,
    estado: nominaForm.estado,
    fecha_pago: nominaForm.fechaPago || null,
    metodo_pago: nominaForm.metodoPago || null,
    comentarios: nominaForm.comentarios || ''
  };

  const { error } = await supabase
    .from('nominas')
    .update(dbNomina)
    .eq('id', id);

  if (error) throw error;

  return {
    id,
    ...dbNomina
  };
};

export const deleteNomina = async (id) => {
  const { error } = await supabase
    .from('nominas')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return id;
};
