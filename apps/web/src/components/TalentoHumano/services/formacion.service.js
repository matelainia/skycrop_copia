import { supabase } from '../../../lib/supabaseClient';

export const getCursos = async () => {
  const { data, error } = await supabase
    .from('cursos_formacion')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getRegistros = async () => {
  const { data, error } = await supabase
    .from('registros_formacion')
    .select('*')
    .order('fecha', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const createCurso = async (newCursoForm) => {
  const dbCurso = {
    nombre: newCursoForm.nombre.trim(),
    tipo: newCursoForm.tipo,
    total_horas: Number(newCursoForm.total_horas) || 8
  };

  const { data, error } = await supabase
    .from('cursos_formacion')
    .insert([dbCurso])
    .select();

  if (error) throw error;
  if (!data || !data[0]) throw new Error('No data returned from insert');
  return data[0];
};

export const createRegistro = async (newRegistroForm) => {
  const dbReg = {
    trabajador_id: newRegistroForm.trabajadorId,
    curso_id: newRegistroForm.cursoId,
    fecha: newRegistroForm.fecha,
    resultado: newRegistroForm.resultado,
    estado: newRegistroForm.estado,
    certificado_url: newRegistroForm.estado === 'Completada' 
      ? (newRegistroForm.certificadoBase64 || '#') 
      : null
  };

  const { data, error } = await supabase
    .from('registros_formacion')
    .insert([dbReg])
    .select();

  if (error) throw error;
  if (!data || !data[0]) throw new Error('No data returned from insert');
  return data[0];
};

export const deleteRegistro = async (id) => {
  const { error } = await supabase
    .from('registros_formacion')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return id;
};
