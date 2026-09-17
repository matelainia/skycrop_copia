import { supabase } from '../../../lib/supabaseClient';
import { uploadCertificado } from './thStorage';

export const getCursos = async () => {
  const { data, error } = await supabase
    .from('cursos_formacion')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;
  return data || [];
};

export const getRegistros = async () => {
  const { data, error } = await supabase
    .from('registros_formacion')
    .select('*')
    .order('fecha', { ascending: false })
    .limit(500);

  if (error) throw error;
  return data || [];
};

export const createCurso = async (newCursoForm) => {
  const { data, error } = await supabase.rpc('th_crear_curso', {
    p_nombre: newCursoForm.nombre.trim(),
    p_tipo: newCursoForm.tipo,
    p_horas: Number(newCursoForm.total_horas) || 8
  });
  if (error) throw error;

  const { data: row, error: e2 } = await supabase.from('cursos_formacion').select('*').eq('id', data.id).maybeSingle();
  if (e2) throw e2;
  if (!row) throw new Error('Curso no encontrado tras registro');
  return row;
};

export const createRegistro = async (newRegistroForm) => {
  // F2: certificado a Storage tenant (columna guarda path).
  let certUrl = null;
  if (newRegistroForm.estado === 'Completada' && newRegistroForm.certificadoBase64) {
    const path = await uploadCertificado(newRegistroForm.trabajadorId, newRegistroForm.certificadoBase64);
    certUrl = (path && !path.startsWith('data:')) ? path : (newRegistroForm.certificadoBase64 || '#');
  }
  const { data, error } = await supabase.rpc('th_registrar_capacitacion', {
    p_trabajador_id: newRegistroForm.trabajadorId,
    p_curso_id: newRegistroForm.cursoId,
    p_fecha: newRegistroForm.fecha,
    p_resultado: newRegistroForm.resultado,
    p_estado: newRegistroForm.estado,
    p_certificado_url: certUrl
  });
  if (error) throw error;

  const { data: row, error: e2 } = await supabase.from('registros_formacion').select('*').eq('id', data.id).maybeSingle();
  if (e2) throw e2;
  if (!row) throw new Error('Registro no encontrado tras creación');
  return row;
};

export const deleteRegistro = async (id) => {
  const { error } = await supabase
    .from('registros_formacion')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return id;
};
