import { useState, useEffect } from 'react';
import { createMonitoring } from '../types/Monitoring';
import { monitoringRepository } from '../repositories/monitoringRepository';

export const useMonitoring = () => {
  const [monitoreos, setMonitoreos] = useState(() => {
    try {
      const saved = localStorage.getItem('skycrop_monitoreos_cc');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [isMonDrawerOpen, setIsMonDrawerOpen] = useState(false);

  const [newMonitoreo, setNewMonitoreo] = useState({
    lote_id: '',
    tipo_monitoreo: 'Sanitario',
    responsable: '',
    incidencia_pct: 0,
    severidad_pct: 0,
    humedad_pct: '',
    temperatura_c: '',
    plagas_detectadas: '',
    enfermedades_detectadas: '',
    deficiencias_nutricionales: '',
    observaciones: ''
  });

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('skycrop_monitoreos_cc', JSON.stringify(monitoreos));
  }, [monitoreos]);

  const loadMonitoringForLote = async (loteId) => {
    if (!loteId) return;
    try {
      const dbMons = await monitoringRepository.getByLote(loteId);
      if (dbMons && dbMons.length > 0) {
        setMonitoreos(prev => {
          const ids = new Set(prev.map(m => String(m.id)));
          const novos = dbMons.filter(m => !ids.has(String(m.id))).map(m => createMonitoring(m));
          return novos.length ? [...novos, ...prev] : prev;
        });
      }
    } catch (err) {
      console.warn('[Monitoring Hook] Error loading monitoreos:', err.message);
    }
  };

  const handleAddMonitoreo = (lotes, selectedLote, onLoteStatusUpdated, onAuditLogged) => {
    if (!newMonitoreo.responsable || !newMonitoreo.responsable.trim()) {
      return { success: false, errors: ['El responsable es obligatorio.'] };
    }

    const item = createMonitoring({
      id: `mon-${Date.now()}`,
      lote_id: newMonitoreo.lote_id,
      tipo_monitoreo: newMonitoreo.tipo_monitoreo,
      fecha_monitoreo: new Date().toISOString(),
      responsable: newMonitoreo.responsable,
      incidencia_pct: parseFloat(newMonitoreo.incidencia_pct) || 0,
      severidad_pct: parseFloat(newMonitoreo.severidad_pct) || 0,
      humedad_pct: parseFloat(newMonitoreo.humedad_pct) || 75,
      temperatura_c: parseFloat(newMonitoreo.temperatura_c) || 28,
      plagas_detectadas: newMonitoreo.plagas_detectadas,
      enfermedades_detectadas: newMonitoreo.enfermedades_detectadas,
      deficiencias_nutricionales: newMonitoreo.deficiencias_nutricionales,
      observaciones: newMonitoreo.observaciones
    });

    setMonitoreos(prev => [item, ...prev]);

    // Calculate health based on incidence
    let health = 'excelente';
    if (item.incidencia_pct > 15) health = 'bajo';
    else if (item.incidencia_pct > 5) health = 'regular';
    else if (item.incidencia_pct > 1) health = 'bueno';

    // Trigger side effect for lot state updates
    if (onLoteStatusUpdated) {
      onLoteStatusUpdated(item.lote_id, health, item.severidad_pct, item.enfermedades_detectadas, item.incidencia_pct);
    }

    const targetL = lotes.find(l => l.id === item.lote_id);
    if (onAuditLogged) {
      onAuditLogged(targetL?.codigo_interno || "N/A", `Monitoreo fitosanitario registrado (Incidencia: ${item.incidencia_pct}%)`);
    }

    setIsMonDrawerOpen(false);

    return { success: true, item };
  };

  return {
    monitoreos,
    isMonDrawerOpen,
    newMonitoreo,
    setMonitoreos,
    setIsMonDrawerOpen,
    setNewMonitoreo,
    loadMonitoringForLote,
    handleAddMonitoreo
  };
};
