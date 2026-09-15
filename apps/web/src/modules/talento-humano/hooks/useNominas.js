import { useState, useCallback, useEffect } from 'react';
import * as nominasService from '../services/nominas.service';

export function useNominas() {
  const [nominas, setNominas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await nominasService.getNominas();
      setNominas(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Error cargando nóminas desde Supabase:", err.message);
      setNominas([]);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createNomina = useCallback(async (nominaForm, workerObj) => {
    setError(null);
    try {
      const added = await nominasService.createNomina(nominaForm);
      const withWorker = {
        ...added,
        trabajador: workerObj
      };
      setNominas(prev => [withWorker, ...prev]);
      return withWorker;
    } catch (err) {
      console.error("Error creando nómina en Supabase:", err.message);
      setError(err);
      return { success: false, error: 'Persistencia no disponible' };
    }
  }, []);

  const updateNomina = useCallback(async (id, nominaForm) => {
    setError(null);
    try {
      const updated = await nominasService.updateNomina(id, nominaForm);
      setNominas(prev => prev.map(n => n.id === id ? {
        ...n,
        salario_neto: updated.salario_neto,
        horas_extras: updated.horas_extras,
        retenciones: updated.retenciones,
        total_neto: updated.total_neto,
        estado: updated.estado,
        fecha_pago: updated.fecha_pago,
        metodo_pago: updated.metodo_pago,
        comentarios: updated.comentarios
      } : n));
      return { success: true };
    } catch (err) {
      console.error("Error actualizando nómina en Supabase:", err.message);
      setError(err);
      return { success: false, error: 'Persistencia no disponible' };
    }
  }, []);

  const deleteNomina = useCallback(async (id) => {
    setError(null);
    try {
      await nominasService.deleteNomina(id);
      setNominas(prev => prev.filter(n => n.id !== id));
      return { success: true };
    } catch (err) {
      console.error("Error eliminando nómina en Supabase:", err.message);
      setError(err);
      return { success: false, error: 'Persistencia no disponible' };
    }
  }, []);

  const generateNominasPeriodo = useCallback(async (periodo, activeWorkers) => {
    const existing = nominas.filter(n => n.periodo === periodo);
    const pendingWorkers = activeWorkers.filter(w => !existing.some(e => e.trabajador_id === w.id));

    if (pendingWorkers.length === 0) {
      alert(`La nómina para todos los trabajadores activos de ${periodo} ya ha sido generada.`);
      return;
    }

    if (!window.confirm(`¿Generar nóminas iniciales para ${pendingWorkers.length} trabajadores activos para el período ${periodo}?`)) return;

    const newRecords = [];
    let failures = 0;
    for (const w of pendingWorkers) {
      const basePay = w.rol === 'Tractorista' ? 4250000 : w.rol === 'Supervisor de Campo' ? 5500000 : 3500000;
      const form = {
        trabajadorId: w.id,
        periodo,
        salarioNeto: basePay,
        horasExtras: 0,
        valorHoraExtra: 0,
        retenciones: 0,
        estado: 'Procesando',
        fechaPago: null,
        metodoPago: 'Transferencia Bancaria',
        comentarios: 'Nómina mensual generada automáticamente'
      };

      try {
        const added = await nominasService.createNomina(form);
        newRecords.push({
          ...added,
          trabajador: w
        });
      } catch (err) {
        failures++;
        console.error(`Error creando nómina para ${w.id} en Supabase:`, err.message);
      }
    }

    setNominas(prev => [...newRecords, ...prev]);
    if (failures > 0) {
      setError(new Error('Persistencia no disponible'));
      alert(`Se generaron ${newRecords.length} nóminas para ${periodo}. ${failures} no pudieron guardarse: persistencia no disponible.`);
    } else if (newRecords.length > 0) {
      alert(`Se han generado ${newRecords.length} registros de nómina correctamente para ${periodo}.`);
    }
  }, [nominas]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    nominas,
    loading,
    error,
    createNomina,
    updateNomina,
    deleteNomina,
    generateNominasPeriodo,
    refresh
  };
}
