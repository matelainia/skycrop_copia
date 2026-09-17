import { useState, useCallback, useEffect } from 'react';
import * as trabajadoresService from '../services/trabajadores.service';
import { TRABAJADOR_ESTADOS_UI } from '../constants/taxonomia';
import { isAuthenticated, subscribeAuthChange } from '../../../lib/supabaseClient';

export function useTrabajadores() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await trabajadoresService.getTrabajadores();
      setWorkers(data);
    } catch (err) {
      console.error('Error fetching workers:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createWorker = useCallback(async (workerForm) => {
    setError(null);
    try {
      const newWorker = await trabajadoresService.createTrabajador(workerForm);
      setWorkers(prev => [newWorker, ...prev]);
      return newWorker;
    } catch (err) {
      console.error('Error creating worker:', err);
      setError(err);
      throw err;
    }
  }, []);

  const deleteWorker = useCallback(async (id) => {
    setError(null);
    try {
      await trabajadoresService.deleteTrabajador(id);
      setWorkers(prev => prev.filter(w => w.id !== id));
    } catch (err) {
      console.error('Error deleting worker:', err);
      setError(err);
      throw err;
    }
  }, []);

  const toggleEstado = useCallback(async (id) => {
    setError(null);
    const worker = workers.find(w => w.id === id);
    if (!worker) return;
    const states = TRABAJADOR_ESTADOS_UI;
    const nextStatus = states[(states.indexOf(worker.estado) + 1) % states.length];
    
    try {
      await trabajadoresService.updateEstadoTrabajador(id, nextStatus);
      setWorkers(prev => prev.map(w => w.id === id ? { ...w, estado: nextStatus } : w));
    } catch (err) {
      console.error('Error toggling worker status:', err);
      setError(err);
      throw err;
    }
  }, [workers]);

  // Esperar al token RLS antes del primer fetch (evita lectura anónima vacía al recargar).
  useEffect(() => {
    if (isAuthenticated()) { refresh(); return undefined; }
    return subscribeAuthChange((ok) => { if (ok) refresh(); });
  }, [refresh]);

  return {
    workers,
    loading,
    error,
    createWorker,
    deleteWorker,
    toggleEstado,
    refresh
  };
}
