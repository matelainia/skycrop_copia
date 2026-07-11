import { supabase } from '../../../lib/supabaseClient';

export const getTrabajadores = async () => {
  const { data, error } = await supabase
    .from('trabajadores')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  
  return (data || []).map(w => ({
    id: w.id,
    nombres: w.nombres,
    apellidos: w.apellidos,
    identificacion: w.identificacion,
    edad: w.edad,
    fechaNacimiento: w.fecha_nacimiento,
    fechaContratacion: w.fecha_contratacion,
    tipoContrato: w.tipo_contrato,
    rhSanguineo: w.rh_sanguineo,
    tipoEps: w.tipo_eps,
    tipoArl: w.tipo_arl,
    contactoTelefonico: w.contacto_telefonico,
    contactoEmergencia: w.contacto_emergencia,
    foto: w.foto,
    copiaContratoName: w.copia_contrato_name,
    rol: w.rol,
    estado: w.estado
  }));
};

export const createTrabajador = async (workerForm) => {
  const dbWorker = {
    nombres: workerForm.nombres.trim(),
    apellidos: workerForm.apellidos.trim(),
    identificacion: workerForm.identificacion.trim(),
    edad: Number(workerForm.edad) || null,
    fecha_nacimiento: workerForm.fechaNacimiento || null,
    fecha_contratacion: workerForm.fechaContratacion || new Date().toISOString().split('T')[0],
    tipo_contrato: workerForm.tipoContrato,
    rh_sanguineo: workerForm.rhSanguineo,
    tipo_eps: workerForm.tipoEps,
    tipo_arl: workerForm.tipoArl,
    contacto_telefonico: workerForm.contactoTelefonico,
    contacto_emergencia: workerForm.contactoEmergencia,
    foto: workerForm.foto,
    copia_contrato_name: workerForm.copiaContratoName,
    rol: workerForm.rol,
    estado: workerForm.estado || 'Activa'
  };

  const { data, error } = await supabase
    .from('trabajadores')
    .insert([dbWorker])
    .select();

  if (error) throw error;
  if (!data || !data[0]) throw new Error('No data returned');

  const w = data[0];
  return {
    id: w.id,
    nombres: w.nombres,
    apellidos: w.apellidos,
    identificacion: w.identificacion,
    edad: w.edad,
    fechaNacimiento: w.fecha_nacimiento,
    fechaContratacion: w.fecha_contratacion,
    tipoContrato: w.tipo_contrato,
    rhSanguineo: w.rh_sanguineo,
    tipoEps: w.tipo_eps,
    tipoArl: w.tipo_arl,
    contactoTelefonico: w.contacto_telefonico,
    contactoEmergencia: w.contacto_emergencia,
    foto: w.foto,
    copiaContratoName: w.copia_contrato_name,
    rol: w.rol,
    estado: w.estado
  };
};

export const updateEstadoTrabajador = async (id, nextStatus) => {
  const { error } = await supabase
    .from('trabajadores')
    .update({ estado: nextStatus })
    .eq('id', id);

  if (error) throw error;
  return nextStatus;
};

export const deleteTrabajador = async (id) => {
  const { error } = await supabase
    .from('trabajadores')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return id;
};
