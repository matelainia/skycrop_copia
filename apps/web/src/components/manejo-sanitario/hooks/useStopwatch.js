import { useState, useEffect } from 'react';

export const useStopwatch = () => {
  const [activeOperations, setActiveOperations] = useState({});
  const [operationTime, setOperationTime] = useState(0);
  const [isOperationActive, setIsOperationActive] = useState(false);

  // Synchronize elapsed time when selected lote changes
  const syncActiveOperation = (selectedLoteId) => {
    const activeOp = activeOperations[selectedLoteId];
    if (activeOp) {
      const elapsed = Math.floor((Date.now() - activeOp.startTime) / 1000);
      setOperationTime(elapsed);
      setIsOperationActive(true);
    } else {
      setIsOperationActive(false);
      setOperationTime(0);
    }
  };

  // Bucle active timer
  useEffect(() => {
    let timer;
    if (isOperationActive) {
      timer = setInterval(() => {
        setOperationTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOperationActive]);

  const startOperation = (loteId, type, operator = 'Pedro Gómez', machinery = 'Manual', product = 'N/A', dosis = 'N/A') => {
    setActiveOperations(prev => ({
      ...prev,
      [loteId]: {
        tipo_operacion: type,
        actividad: type === 'Aplicación' ? 'Aplicación Fitosanitaria' : type,
        producto: type === 'Aplicación' ? 'Azoxistrobin 250 SC' : product,
        dosis: type === 'Aplicación' ? '0.5 L/ha' : dosis,
        startTime: Date.now(),
        operator,
        machinery
      }
    }));
    setOperationTime(0);
    setIsOperationActive(true);
  };

  const finishOperation = (loteId) => {
    const activeOp = activeOperations[loteId];
    const elapsed = operationTime;

    // Delete operation
    setActiveOperations(prev => {
      const copy = { ...prev };
      delete copy[loteId];
      return copy;
    });
    setIsOperationActive(false);
    setOperationTime(0);

    return {
      activeOp,
      elapsedSeconds: elapsed
    };
  };

  return {
    activeOperations,
    operationTime,
    isOperationActive,
    syncActiveOperation,
    startOperation,
    finishOperation,
    setActiveOperations,
    setIsOperationActive,
    setOperationTime
  };
};
