import { useState, useCallback, useEffect } from 'react';
import * as formacionService from '../services/formacion.service';

export function useFormacion(workersList = []) {
  const [cursos, setCursos] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const courseData = await formacionService.getCursos();
      setCursos(Array.isArray(courseData) ? courseData : []);
    } catch (e) {
      console.warn('Error cargando cursos_formacion:', e.message);
      setCursos([]);
      setError(e);
    }
    try {
      const regData = await formacionService.getRegistros();
      setRegistros(Array.isArray(regData) ? regData : []);
    } catch (e) {
      console.warn('Error cargando registros_formacion:', e.message);
      setRegistros([]);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const createCurso = useCallback(async (cursoForm) => {
    setError(null);
    try {
      const added = await formacionService.createCurso(cursoForm);
      setCursos(prev => [added, ...prev]);
      return added;
    } catch (err) {
      console.error('Error creando curso en Supabase:', err.message);
      setError(err);
      return { success: false, error: 'Persistencia no disponible' };
    }
  }, []);

  const createRegistro = useCallback(async (registroForm) => {
    setError(null);
    try {
      const added = await formacionService.createRegistro(registroForm);
      setRegistros(prev => [added, ...prev]);
      return added;
    } catch (err) {
      console.error('Error creando registro en Supabase:', err.message);
      setError(err);
      return { success: false, error: 'Persistencia no disponible' };
    }
  }, []);

  const deleteRegistro = useCallback(async (id) => {
    setError(null);
    try {
      await formacionService.deleteRegistro(id);
      setRegistros(prev => prev.filter(r => r.id !== id));
      return { success: true };
    } catch (err) {
      console.error('Error eliminando registro en Supabase:', err.message);
      setError(err);
      return { success: false, error: 'Persistencia no disponible' };
    }
  }, []);

  useEffect(() => {
    refresh();
  }, []);

  return {
    cursos,
    registros,
    loading,
    error,
    createCurso,
    createRegistro,
    deleteRegistro,
    refresh
  };
}
