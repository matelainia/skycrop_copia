/* eslint-disable react-refresh/only-export-components, react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { machineryService } from '../services/machinery.service';
import { operationService } from '../services/operation.service';
import { audit } from '../audit/audit.service';
import { subscribe } from '../events/machinery.events';

const MachineryContext = createContext(null);

export const useMachineryContext = () => {
  const context = useContext(MachineryContext);
  if (!context) {
    throw new Error('useMachineryContext debe utilizarse dentro de un MachineryProvider');
  }
  return context;
};

export const MachineryProvider = ({ children }) => {
  const [machinery, setMachinery] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMachineId, setActiveMachineId] = useState(null);
  const [audits, setAudits] = useState(() => audit.getLogs());

  // Fetch all module data
  const fetchData = useCallback(async () => {
    // Avoid synchronous state changes in render effects
    try {
      const fleet = await machineryService.getFleet();
      const ops = await operationService.getHistory();

      setMachinery(fleet);
      setJornadas(ops);

      // Set default active machine on first load
      if (fleet.length > 0) {
        const operating = fleet.find(m => m.status === 'Operando');
        if (operating) {
          setActiveMachineId(operating.id);
        } else if (!activeMachineId) {
          setActiveMachineId(fleet[0].id);
        }
      }
    } catch (err) {
      console.error('Error cargando datos del módulo de maquinaria:', err);
    } finally {
      setLoading(false);
    }
  }, [activeMachineId]);

  // Sync state with audit changes
  useEffect(() => {
    const unsub = subscribe('AuditLogged', (entry) => {
      setAudits(prev => [entry, ...prev]);
    });
    return () => unsub();
  }, []);

  // Sync state with CRUD events to avoid reload latency when possible
  useEffect(() => {
    const unsubReg = subscribe('MachineRegistered', () => fetchData());
    const unsubUpd = subscribe('MachineUpdated', () => fetchData());
    const unsubDel = subscribe('MachineDeleted', () => fetchData());
    const unsubStart = subscribe('OperationStarted', () => fetchData());
    const unsubEnd = subscribe('OperationCompleted', () => fetchData());
    const unsubMaint = subscribe('MaintenanceRegistered', () => fetchData());

    return () => {
      unsubReg();
      unsubUpd();
      unsubDel();
      unsubStart();
      unsubEnd();
      unsubMaint();
    };
  }, [fetchData]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, []);

  const value = {
    machinery,
    setMachinery,
    jornadas,
    setJornadas,
    loading,
    setLoading,
    activeMachineId,
    setActiveMachineId,
    audits,
    refreshData: fetchData
  };

  return (
    <MachineryContext.Provider value={value}>
      {children}
    </MachineryContext.Provider>
  );
};

export default MachineryProvider;
