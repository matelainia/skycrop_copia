import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLots } from '../hooks/useLots';
import { useStopwatch } from '../hooks/useStopwatch';

const LotsContext = createContext(null);

export const LotsProvider = ({ children }) => {
  const lots = useLots();
  const stopwatch = useStopwatch();

  const { selectedLote } = lots;
  const { syncActiveOperation } = stopwatch;

  // Audit Logs State
  const [auditorias, setAuditorias] = useState(() => {
    try {
      const saved = localStorage.getItem('skycrop_auditorias_cc');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('skycrop_auditorias_cc', JSON.stringify(auditorias));
  }, [auditorias]);

  // NOTA: bitacora solo visual/local (no es trazabilidad). El actor se inyecta
  // por llamada; si falta, se registra ausencia (null), nunca persona ficticia.
  const logAudit = (loteCode, actionText, usuario = null) => {
    const log = {
      id: `aud-${Date.now()}`,
      fecha: new Date().toISOString(),
      usuario,
      lote_codigo: loteCode,
      accion: actionText
    };
    setAuditorias(prev => [log, ...prev]);
  };

  // Sync active operation whenever selected lote changes
  useEffect(() => {
    if (selectedLote) {
      syncActiveOperation(selectedLote.id);
    }
  }, [selectedLote?.id]);

  const value = {
    ...lots,
    ...stopwatch,
    auditorias,
    setAuditorias,
    logAudit
  };

  return (
    <LotsContext.Provider value={value}>
      {children}
    </LotsContext.Provider>
  );
};

export const useLotsContext = () => {
  const context = useContext(LotsContext);
  if (!context) {
    throw new Error('useLotsContext must be used within a LotsProvider');
  }
  return context;
};
