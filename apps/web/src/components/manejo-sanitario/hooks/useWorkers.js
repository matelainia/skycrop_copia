import { useState, useEffect } from 'react';
import { createWorkerLog } from '../types/Worker';
import { workerRepository } from '../repositories/workerRepository';

export const useWorkers = () => {
  const [trabajadores, setTrabajadores] = useState(() => {
    try {
      const saved = localStorage.getItem('skycrop_trabajadores_cc');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [isTrabajadorDrawerOpen, setIsTrabajadorDrawerOpen] = useState(false);

  const [newTrabajador, setNewTrabajador] = useState({
    lote_id: '',
    nombre: '',
    actividad_realizada: '',
    tiempo_permanencia_hours: ''
  });

  // LocalStorage sync
  useEffect(() => {
    localStorage.setItem('skycrop_trabajadores_cc', JSON.stringify(trabajadores));
  }, [trabajadores]);

  const loadWorkersForLote = async (loteId) => {
    if (!loteId) return;
    try {
      const dbWorkers = await workerRepository.getByLote(loteId);
      if (dbWorkers && dbWorkers.length > 0) {
        setTrabajadores(prev => {
          const ids = new Set(prev.map(t => String(t.id)));
          const novos = dbWorkers.filter(t => !ids.has(String(t.id))).map(t => createWorkerLog(t));
          return novos.length ? [...novos, ...prev] : prev;
        });
      }
    } catch (err) {
      console.warn('[Workers Hook] Error loading worker logs:', err.message);
    }
  };

  const handleAddTrabajadorLog = (lotes, onLoteWorkersUpdated, onAuditLogged) => {
    if (!newTrabajador.nombre) return { success: false, errors: ['El nombre es obligatorio.'] };

    const item = createWorkerLog({
      id: `t-${Date.now()}`,
      lote_id: newTrabajador.lote_id,
      nombre: newTrabajador.nombre,
      fecha_ingreso: new Date().toISOString(),
      actividad_realizada: newTrabajador.actividad_realizada,
      tiempo_permanencia_horas: parseFloat(newTrabajador.tiempo_permanencia_hours) || 8.0,
      estado: "activo"
    });

    setTrabajadores(prev => [item, ...prev]);

    // Side effect triggers (Lotes)
    if (onLoteWorkersUpdated) {
      onLoteWorkersUpdated(
        item.lote_id,
        {
          id: item.id,
          nombre: item.nombre,
          actividad: item.actividad_realizada,
          ingreso: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
          duracion: `${item.tiempo_permanencia_horas}h`
        }
      );
    }

    setIsTrabajadorDrawerOpen(false);

    const targetL = lotes.find(l => l.id === item.lote_id);
    if (onAuditLogged) {
      onAuditLogged(targetL?.codigo_interno || "N/A", `Ingreso de operario registrado: ${item.nombre}`);
    }

    return { success: true, item };
  };

  return {
    trabajadores,
    isTrabajadorDrawerOpen,
    newTrabajador,
    setTrabajadores,
    setIsTrabajadorDrawerOpen,
    setNewTrabajador,
    loadWorkersForLote,
    handleAddTrabajadorLog
  };
};
