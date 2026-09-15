import { supabase } from '../../../lib/supabaseClient';
import { uploadFotoTrabajador } from './thStorage';

const mapWorker = (w) => ({
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
});

const fetchWorker = async (id) => {
  const { data, error } = await supabase.from('trabajadores').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Trabajador no encontrado');
  return mapWorker(data);
};

export const getTrabajadores = async () => {
  const { data, error } = await supabase
    .from('trabajadores')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;
  return (data || []).map(mapWorker);
};

export const createTrabajador = async (workerForm) => {
  // F2: foto a Storage tenant (columna guarda path; base64 solo en transición).
  let foto = workerForm.foto || null;
  if (foto && String(foto).startsWith('data:')) {
    const path = await uploadFotoTrabajador(workerForm.identificacion, foto);
    if (path && !path.startsWith('data:')) foto = path;
  }
  const extra = {
    edad: workerForm.edad === '' || workerForm.edad == null ? null : String(workerForm.edad),
    fecha_nacimiento: workerForm.fechaNacimiento || null,
    fecha_contratacion: workerForm.fechaContratacion || null,
    tipo_contrato: undefined,
    rh_sanguineo: workerForm.rhSanguineo,
    tipo_eps: workerForm.tipoEps,
    tipo_arl: workerForm.tipoArl,
    contacto_telefonico: workerForm.contactoTelefonico,
    contacto_emergencia: workerForm.contactoEmergencia,
    foto,
    copia_contrato_name: workerForm.copiaContratoName,
    estado: workerForm.estado || 'Activa'
  };
  const { data, error } = await supabase.rpc('th_crear_trabajador', {
    p_nombres: workerForm.nombres.trim(),
    p_apellidos: workerForm.apellidos.trim(),
    p_identificacion: workerForm.identificacion.trim(),
    p_tipo_contrato: workerForm.tipoContrato,
    p_rol: workerForm.rol,
    p_extra: extra
  });
  if (error) throw error;
  return fetchWorker(data.id);
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
  // F2: retiro lógico vía RPC (rol supervisor+, auditable). Reactivar: Fase 2 UI admin.
  const { error } = await supabase.rpc('th_retirar_trabajador', { p_trabajador_id: id });
  if (error) throw error;
  return id;
};

export const reactivateTrabajador = async (id) => {
  const { error } = await supabase.rpc('th_reactivar_trabajador', { p_trabajador_id: id });
  if (error) throw error;
  return id;
};
