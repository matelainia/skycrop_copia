import { useState, useCallback, useEffect } from 'react';
import * as laboresService from '../services/labores.service';

export function useLabores() {
  const [labores, setLabores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await laboresService.getLabores();
      setLabores(data);
    } catch (err) {
      console.error('Error fetching labores:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createLabor = useCallback(async (laborForm) => {
    setError(null);
    try {
      const newLabor = await laboresService.createLabor(laborForm);
      setLabores(prev => [newLabor, ...prev]);
      return newLabor;
    } catch (err) {
      console.error('Error creating labor:', err);
      setError(err);
      throw err;
    }
  }, []);

  const changeEstadoLabor = useCallback(async (id, newEstado) => {
    setError(null);
    try {
      await laboresService.updateEstadoLabor(id, newEstado);
      setLabores(prev => prev.map(l => l.id === id ? { ...l, estado: newEstado } : l));
    } catch (err) {
      console.error('Error updating labor status:', err);
      setError(err);
      throw err;
    }
  }, []);

  const deleteLabor = useCallback(async (id) => {
    setError(null);
    try {
      await laboresService.deleteLabor(id);
      setLabores(prev => prev.filter(l => l.id !== id));
    } catch (err) {
      console.error('Error deleting labor:', err);
      setError(err);
      throw err;
    }
  }, []);

  const archiveActiveLabores = useCallback(async (activeIds) => {
    setError(null);
    try {
      await laboresService.archiveActiveLabores(activeIds);
      setLabores(prev => prev.map(l => activeIds.includes(l.id) ? { ...l, estado: 'Archivada' } : l));
    } catch (err) {
      console.error('Error archiving active labors:', err);
      setError(err);
      throw err;
    }
  }, []);

  const unarchiveLabor = useCallback(async (id, originalEstado = 'Pendiente') => {
    setError(null);
    try {
      await laboresService.unarchiveLabor(id, originalEstado);
      setLabores(prev => prev.map(l => l.id === id ? { ...l, estado: originalEstado } : l));
    } catch (err) {
      console.error('Error unarchiving labor:', err);
      setError(err);
      throw err;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    labores,
    loading,
    error,
    createWorker: createLabor, // match naming if used by other hooks, but createLabor is fine
    createLabor,
    changeEstadoLabor,
    deleteLabor,
    archiveActiveLabores,
    unarchiveLabor,
    refresh
  };
}
