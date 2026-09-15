import { useState, useCallback, useEffect } from 'react';
import * as cuadrillasService from '../services/cuadrillas.service';

export function useCuadrillas() {
  const [cuadrillas, setCuadrillas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await cuadrillasService.getCuadrillas();
      setCuadrillas(data);
    } catch (err) {
      console.error('Error fetching cuadrillas:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createCuadrilla = useCallback(async (nombre) => {
    setError(null);
    try {
      const newCuadrilla = await cuadrillasService.createCuadrilla(nombre);
      setCuadrillas(prev => [...prev, newCuadrilla]);
      return newCuadrilla;
    } catch (err) {
      console.error('Error creating cuadrilla:', err);
      setError(err);
      throw err;
    }
  }, []);

  const deleteCuadrilla = useCallback(async (id) => {
    setError(null);
    try {
      await cuadrillasService.deleteCuadrilla(id);
      setCuadrillas(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Error deleting cuadrilla:', err);
      setError(err);
      throw err;
    }
  }, []);

  const addMemberToCuadrilla = useCallback(async (cuadrillaId, workerId) => {
    setError(null);
    try {
      await cuadrillasService.addMemberToCuadrilla(cuadrillaId, workerId);
      setCuadrillas(prev => prev.map(c => 
        c.id === cuadrillaId && !c.miembros.includes(workerId)
          ? { ...c, miembros: [...c.miembros, workerId] }
          : c
      ));
    } catch (err) {
      console.error('Error adding member to cuadrilla:', err);
      setError(err);
      throw err;
    }
  }, []);

  const removeMemberFromCuadrilla = useCallback(async (cuadrillaId, workerId) => {
    setError(null);
    try {
      await cuadrillasService.removeMemberFromCuadrilla(cuadrillaId, workerId);
      setCuadrillas(prev => prev.map(c => 
        c.id === cuadrillaId
          ? { ...c, miembros: c.miembros.filter(m => m !== workerId) }
          : c
      ));
    } catch (err) {
      console.error('Error removing member from cuadrilla:', err);
      setError(err);
      throw err;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    cuadrillas,
    loading,
    error,
    createCuadrilla,
    deleteCuadrilla,
    addMemberToCuadrilla,
    removeMemberFromCuadrilla,
    refresh
  };
}
