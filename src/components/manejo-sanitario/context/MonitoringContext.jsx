import React, { createContext, useContext, useEffect } from 'react';
import { useMonitoring } from '../hooks/useMonitoring';
import { useCosts } from '../hooks/useCosts';
import { useWorkers } from '../hooks/useWorkers';
import { useLotsContext } from './LotsContext';

const MonitoringContext = createContext(null);

export const MonitoringProvider = ({ children }) => {
  const { lotes, selectedLote, setLotes, setSelectedLote, logAudit } = useLotsContext();

  const monitoring = useMonitoring();
  const costs = useCosts();
  const workers = useWorkers();

  const { loadMonitoringForLote, handleAddMonitoreo } = monitoring;
  const { loadCostsForLote, handleAddCosto } = costs;
  const { loadWorkersForLote, handleAddTrabajadorLog } = workers;

  // Reactively fetch data when selected lote changes
  useEffect(() => {
    if (selectedLote?.id) {
      loadMonitoringForLote(selectedLote.id);
      loadCostsForLote(selectedLote.id);
      loadWorkersForLote(selectedLote.id);
    }
  }, [selectedLote?.id]);

  const onLoteStatusUpdated = (loteId, health, severityPct, diseases, incidencePct) => {
    setLotes(prev => prev.map(l => {
      if (l.id === loteId) {
        const rawNdvi = l.ndvi_actual - (severityPct / 100);
        const nextNdvi = parseFloat(Math.max(0.15, rawNdvi).toFixed(2));
        return {
          ...l,
          estado_sanitario: health,
          ndvi_actual: nextNdvi,
          disease_detected: diseases,
          incidence_pct: incidencePct,
          severity_pct: severityPct,
          observaciones: `Última eval: Incidencia ${incidencePct}%, Severidad ${severityPct}%.`
        };
      }
      return l;
    }));

    if (selectedLote && selectedLote.id === loteId) {
      setSelectedLote(prev => ({
        ...prev,
        estado_sanitario: health,
        ndvi_actual: parseFloat(Math.max(0.15, prev.ndvi_actual - (severityPct / 100)).toFixed(2)),
        disease_detected: diseases,
        incidence_pct: incidencePct,
        severity_pct: severityPct
      }));
    }
  };

  const onLoteWorkersUpdated = (loteId, mappedWorker) => {
    setLotes(prev => prev.map(l => {
      if (l.id === loteId) {
        return {
          ...l,
          trabajadores: [mappedWorker, ...(l.trabajadores || [])]
        };
      }
      return l;
    }));

    if (selectedLote && selectedLote.id === loteId) {
      setSelectedLote(prev => ({
        ...prev,
        trabajadores: [mappedWorker, ...(prev.trabajadores || [])]
      }));
    }
  };

  const addMonitoreo = () => {
    return handleAddMonitoreo(lotes, selectedLote, onLoteStatusUpdated, logAudit);
  };

  const addCosto = () => {
    return handleAddCosto(lotes, logAudit);
  };

  const addTrabajadorLog = () => {
    return handleAddTrabajadorLog(lotes, onLoteWorkersUpdated, logAudit);
  };

  const value = {
    ...monitoring,
    ...costs,
    ...workers,
    addMonitoreo,
    addCosto,
    addTrabajadorLog
  };

  return (
    <MonitoringContext.Provider value={value}>
      {children}
    </MonitoringContext.Provider>
  );
};

export const useMonitoringContext = () => {
  const context = useContext(MonitoringContext);
  if (!context) {
    throw new Error('useMonitoringContext must be used within a MonitoringProvider');
  }
  return context;
};
