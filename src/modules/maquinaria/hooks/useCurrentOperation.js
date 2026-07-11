import { useState, useMemo, useCallback } from 'react';
import { useMachineryContext } from '../context/MachineryProvider';
import { operationService } from '../services/operation.service';

export const useCurrentOperation = () => {
  const { machinery, jornadas, activeMachineId, setActiveMachineId } = useMachineryContext();

  const [isStartLaborOpen, setIsStartLaborOpen] = useState(false);
  const [isEndLaborOpen, setIsEndLaborOpen] = useState(false);

  const [laborForm, setLaborForm] = useState({
    maquinariaId: '',
    operator: '',
    lot: '',
    activity: 'Preparación de suelo',
    startHorometro: 0,
    startFuel: 100,
    startTime: new Date().toISOString().substring(0, 16)
  });

  const [endLaborForm, setEndLaborForm] = useState({
    jornadaId: '',
    endTime: new Date().toISOString().substring(0, 16),
    endHorometro: 0,
    endFuel: 80,
    notes: ''
  });

  // Fetch active operation details
  const getActiveJornadaForMachine = useCallback((machId) => {
    return jornadas.find(j => j.maquinariaId === machId && j.status === 'En Progreso');
  }, [jornadas]);

  const activeMachine = useMemo(() => {
    return machinery.find(m => m.id === activeMachineId);
  }, [machinery, activeMachineId]);

  const activeJornada = useMemo(() => {
    return activeMachine ? getActiveJornadaForMachine(activeMachine.id) : null;
  }, [activeMachine, getActiveJornadaForMachine]);

  // Operations actions
  const handleStartLabor = useCallback(async (e) => {
    e.preventDefault();
    const target = machinery.find(m => m.id === laborForm.maquinariaId);
    
    try {
      await operationService.startOperation(laborForm, target);
      setIsStartLaborOpen(false);
    } catch (err) {
      alert(err.message);
    }
  }, [laborForm, machinery]);

  const handleEndLabor = useCallback(async (e) => {
    e.preventDefault();
    const activeOp = jornadas.find(j => j.id === endLaborForm.jornadaId);
    const target = machinery.find(m => m.id === activeOp?.maquinariaId);

    try {
      await operationService.endOperation(endLaborForm, activeOp, target);
      setIsEndLaborOpen(false);
    } catch (err) {
      alert(err.message);
    }
  }, [endLaborForm, jornadas, machinery]);

  const openStartLaborForm = useCallback((machineId = '') => {
    const defaultMachineId = machineId || activeMachineId || (machinery.find(m => m.status === 'Disponible')?.id) || '';
    const targetMachine = machinery.find(m => m.id === defaultMachineId);

    setLaborForm({
      maquinariaId: defaultMachineId,
      operator: '',
      lot: '',
      activity: 'Preparación de suelo',
      startHorometro: targetMachine ? targetMachine.hoursOfOperation : 0,
      startFuel: 100,
      startTime: new Date().toISOString().substring(0, 16)
    });
    setIsStartLaborOpen(true);
  }, [machinery, activeMachineId]);

  const openEndLaborForm = useCallback((jornadaId = '') => {
    const targetJornada = jornadas.find(j => j.id === jornadaId) || activeJornada;
    if (!targetJornada) return;

    const targetMachine = machinery.find(m => m.id === targetJornada.maquinariaId);
    const estEndHorometro = targetMachine ? targetMachine.hoursOfOperation + 4 : targetJornada.startHorometro + 4;

    setEndLaborForm({
      jornadaId: targetJornada.id,
      endTime: new Date().toISOString().substring(0, 16),
      endHorometro: estEndHorometro,
      endFuel: Math.max(0, targetJornada.startFuel - 20),
      notes: ''
    });
    setIsEndLaborOpen(true);
  }, [jornadas, activeJornada, machinery]);

  return {
    jornadas,
    activeMachineId,
    setActiveMachineId,
    activeMachine,
    activeJornada,
    isStartLaborOpen,
    setIsStartLaborOpen,
    isEndLaborOpen,
    setIsEndLaborOpen,
    laborForm,
    setLaborForm,
    endLaborForm,
    setEndLaborForm,
    handleStartLabor,
    handleEndLabor,
    openStartLaborForm,
    openEndLaborForm,
    getActiveJornadaForMachine
  };
};
export default useCurrentOperation;
