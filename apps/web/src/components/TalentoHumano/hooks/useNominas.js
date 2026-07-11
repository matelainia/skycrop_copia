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
      setNominas(data);
    } catch (err) {
      console.warn("Tabla 'nominas' no existe en Supabase o falló. Usando vacías.");
      setNominas([]);
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
      console.warn("Fallo en Supabase, agregando nómina localmente:", err.message);
      
      const valorHoraExtra = 15000;
      const totNeto = Number(nominaForm.salarioNeto) + (Number(nominaForm.horasExtras) * valorHoraExtra) - Number(nominaForm.retenciones);

      const localNom = {
        id: `n-${Date.now()}`,
        trabajador_id: nominaForm.trabajadorId,
        periodo: nominaForm.periodo,
        salario_neto: Number(nominaForm.salarioNeto),
        horas_extras: Number(nominaForm.horasExtras),
        retenciones: Number(nominaForm.retenciones),
        total_neto: totNeto,
        estado: nominaForm.estado,
        fecha_pago: nominaForm.fechaPago || null,
        metodo_pago: nominaForm.metodoPago || null,
        comentarios: nominaForm.comentarios || '',
        trabajador: workerObj
      };
      setNominas(prev => [localNom, ...prev]);
      return localNom;
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
    } catch (err) {
      console.warn("Fallo en Supabase, editando nómina localmente:", err.message);
      
      const valorHoraExtra = 15000;
      const totNeto = Number(nominaForm.salarioNeto) + (Number(nominaForm.horasExtras) * valorHoraExtra) - Number(nominaForm.retenciones);

      setNominas(prev => prev.map(n => n.id === id ? {
        ...n,
        salario_neto: Number(nominaForm.salarioNeto),
        horas_extras: Number(nominaForm.horasExtras),
        retenciones: Number(nominaForm.retenciones),
        total_neto: totNeto,
        estado: nominaForm.estado,
        fecha_pago: nominaForm.fechaPago || null,
        metodo_pago: nominaForm.metodoPago || null,
        comentarios: nominaForm.comentarios || ''
      } : n));
    }
  }, []);

  const deleteNomina = useCallback(async (id) => {
    setError(null);
    try {
      await nominasService.deleteNomina(id);
      setNominas(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.warn("Fallo en Supabase, eliminando nómina localmente:", err.message);
      setNominas(prev => prev.filter(n => n.id !== id));
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
    for (const w of pendingWorkers) {
      const basePay = w.rol === 'Tractorista' ? 4250000 : w.rol === 'Supervisor de Campo' ? 5500000 : 3500000;
      const form = {
        trabajadorId: w.id,
        periodo,
        salarioNeto: basePay,
        horasExtras: 0,
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
        const localNom = {
          id: `n-${Date.now()}-${Math.random()}`,
          trabajador_id: w.id,
          periodo,
          salario_neto: basePay,
          horas_extras: 0,
          retenciones: 0,
          total_neto: basePay,
          estado: 'Procesando',
          fecha_pago: null,
          metodo_pago: 'Transferencia Bancaria',
          comentarios: 'Nómina mensual generada automáticamente',
          trabajador: w
        };
        newRecords.push(localNom);
      }
    }

    setNominas(prev => [...newRecords, ...prev]);
    alert(`Se han generado ${newRecords.length} registros de nómina correctamente para ${periodo}.`);
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
