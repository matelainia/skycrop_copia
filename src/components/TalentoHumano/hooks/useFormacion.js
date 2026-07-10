import { useState, useCallback, useEffect } from 'react';
import * as formacionService from '../services/formacion.service';
import * as trabajadoresService from '../services/trabajadores.service';
import { INITIAL_CURSOS, buildMockRegistros } from '../utils/formacionHelpers';

export function useFormacion(workersList = []) {
  const [cursos, setCursos] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async (currentWorkers = workersList) => {
    setLoading(true);
    setError(null);
    try {
      let courseData = [];
      try {
        courseData = await formacionService.getCursos();
      } catch (e) {
        console.warn('cursos_formacion table error, falling back to mock');
        courseData = INITIAL_CURSOS;
      }
      setCursos(courseData);

      let regData = [];
      try {
        regData = await formacionService.getRegistros();
      } catch (e) {
        console.warn('registros_formacion table error, falling back to mock');
        let list = currentWorkers;
        if (!list || list.length === 0) {
          try {
            list = await trabajadoresService.getTrabajadores();
          } catch (tErr) {
            list = [];
          }
        }
        regData = buildMockRegistros(list);
      }
      setRegistros(regData);
    } catch (err) {
      console.error('Error loading training logs:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [workersList]);

  const createCurso = useCallback(async (cursoForm) => {
    setError(null);
    try {
      const added = await formacionService.createCurso(cursoForm);
      setCursos(prev => [added, ...prev]);
      return added;
    } catch (err) {
      console.warn("Fallo en Supabase, agregando curso localmente:", err.message);
      const localNewCurso = {
        id: `c-${Date.now()}`,
        nombre: cursoForm.nombre.trim(),
        tipo: cursoForm.tipo,
        total_horas: Number(cursoForm.total_horas) || 8
      };
      setCursos(prev => [localNewCurso, ...prev]);
      return localNewCurso;
    }
  }, []);

  const createRegistro = useCallback(async (registroForm) => {
    setError(null);
    try {
      const added = await formacionService.createRegistro(registroForm);
      setRegistros(prev => [added, ...prev]);
      return added;
    } catch (err) {
      console.warn("Fallo en Supabase, agregando registro localmente:", err.message);
      const dbReg = {
        id: `r-${Date.now()}`,
        trabajador_id: registroForm.trabajadorId,
        curso_id: registroForm.cursoId,
        fecha: registroForm.fecha,
        resultado: registroForm.resultado,
        estado: registroForm.estado,
        certificado_url: registroForm.estado === 'Completada' 
          ? (registroForm.certificadoBase64 || '#') 
          : null
      };
      setRegistros(prev => [dbReg, ...prev]);
      return dbReg;
    }
  }, []);

  const deleteRegistro = useCallback(async (id) => {
    setError(null);
    try {
      await formacionService.deleteRegistro(id);
      setRegistros(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.warn("Fallo en Supabase, eliminando registro localmente:", err.message);
      setRegistros(prev => prev.filter(r => r.id !== id));
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
