import { supabase } from '../../../lib/supabaseClient';

export const getNominas = async () => {
  const { data, error } = await supabase
    .from('nominas')
    .select('*, trabajadores(*)')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;

  return (data || []).map(n => ({
    id: n.id,
    trabajador_id: n.trabajador_id,
    periodo: n.periodo,
    salario_neto: Number(n.salario_neto) || 0,
    horas_extras: Number(n.horas_extras) || 0,
    valor_hora_extra: Number(n.valor_hora_extra) || 0,
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

const requireTasa = (nominaForm) => {
  const valorHoraExtra = Number(nominaForm.valorHoraExtra ?? nominaForm.valor_hora_extra);
  if (!Number.isFinite(valorHoraExtra) || valorHoraExtra < 0) {
    throw new Error('valor_hora_extra requerido: indique el valor de la hora extra (COP).');
  }
  return valorHoraExtra;
};

export const createNomina = async (nominaForm) => {
  // F2: cálculo autoritativo en servidor (th_registrar_nomina); el total
  // cliente solo se usa como referencia optimista.
  const valorHoraExtra = requireTasa(nominaForm);
  const { data, error } = await supabase.rpc('th_registrar_nomina', {
    p_trabajador_id: nominaForm.trabajadorId,
    p_periodo: nominaForm.periodo,
    p_salario_neto: Number(nominaForm.salarioNeto),
    p_horas_extras: Number(nominaForm.horasExtras),
    p_valor_hora_extra: valorHoraExtra,
    p_retenciones: Number(nominaForm.retenciones),
    p_estado: nominaForm.estado,
    p_fecha_pago: nominaForm.fechaPago || null,
    p_metodo_pago: nominaForm.metodoPago || null,
    p_comentarios: nominaForm.comentarios || ''
  });
  if (error) throw error;

  const { data: row, error: e2 } = await supabase.from('nominas').select('*').eq('id', data.id).maybeSingle();
  if (e2) throw e2;
  return {
    ...row,
    salario_neto: Number(row.salario_neto),
    horas_extras: Number(row.horas_extras),
    valor_hora_extra: Number(row.valor_hora_extra),
    retenciones: Number(row.retenciones),
    total_neto: Number(row.total_neto)
  };
};

export const updateNomina = async (id, nominaForm) => {
  const valorHoraExtra = requireTasa(nominaForm);
  const { error } = await supabase.rpc('th_actualizar_nomina', {
    p_nomina_id: id,
    p_salario_neto: Number(nominaForm.salarioNeto),
    p_horas_extras: Number(nominaForm.horasExtras),
    p_valor_hora_extra: valorHoraExtra,
    p_retenciones: Number(nominaForm.retenciones),
    p_estado: nominaForm.estado,
    p_fecha_pago: nominaForm.fechaPago || null,
    p_metodo_pago: nominaForm.metodoPago || null,
    p_comentarios: nominaForm.comentarios || ''
  });
  if (error) throw error;

  const { data: row, error: e2 } = await supabase.from('nominas').select('*').eq('id', id).maybeSingle();
  if (e2) throw e2;
  return {
    id,
    salario_neto: Number(row.salario_neto),
    horas_extras: Number(row.horas_extras),
    valor_hora_extra: Number(row.valor_hora_extra),
    retenciones: Number(row.retenciones),
    total_neto: Number(row.total_neto),
    estado: row.estado,
    fecha_pago: row.fecha_pago,
    metodo_pago: row.metodo_pago,
    comentarios: row.comentarios
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
