import { useState, useMemo, useCallback } from 'react';
import { useMachineryContext } from '../context/MachineryProvider';
import { maintenanceService } from '../services/maintenance.service';
import { maintenanceScheduler } from '../scheduler/maintenanceScheduler';

export const useMaintenance = () => {
  const { machinery } = useMachineryContext();
  const [isMaintModalOpen, setIsMaintModalOpen] = useState(false);

  const [maintForm, setMaintForm] = useState({
    maquinariaId: '',
    date: new Date().toISOString().split('T')[0],
    horometro: 0,
    notes: ''
  });

  // Calculate scheduler alerts for preventative warnings
  const alerts = useMemo(() => {
    return maintenanceScheduler.getAlerts(machinery);
  }, [machinery]);

  const handleRegisterMaintenance = useCallback(async (e) => {
    e.preventDefault();
    const target = machinery.find(m => m.id === maintForm.maquinariaId);

    try {
      await maintenanceService.registerService(maintForm, target);
      setIsMaintModalOpen(false);
    } catch (err) {
      alert(err.message);
    }
  }, [maintForm, machinery]);

  const openMaintenanceForm = useCallback((machineId = '') => {
    const defaultId = machineId || (machinery.find(m => m.status === 'Disponible' || m.status === 'En mantenimiento')?.id) || '';
    const target = machinery.find(m => m.id === defaultId);

    setMaintForm({
      maquinariaId: defaultId,
      date: new Date().toISOString().split('T')[0],
      horometro: target ? target.hoursOfOperation : 0,
      notes: ''
    });
    setIsMaintModalOpen(true);
  }, [machinery]);

  return {
    isMaintModalOpen,
    setIsMaintModalOpen,
    maintForm,
    setMaintForm,
    alerts,
    handleRegisterMaintenance,
    openMaintenanceForm
  };
};
export default useMaintenance;
