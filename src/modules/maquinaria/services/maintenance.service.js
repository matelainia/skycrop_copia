import { maintenanceRepository } from '../repository/maintenance.repository';
import { validateMaintenance } from '../validators/maintenance.validator';
import { canRegisterMaintenance } from '../permissions/canRegisterMaintenance';
import { audit } from '../audit/audit.service';
import { emit } from '../events/machinery.events';

class MaintenanceService {
  /**
   * Register maintenance service details
   */
  async registerService(maintForm, targetMachine) {
    // 1. Policy check
    if (!canRegisterMaintenance()) {
      throw new Error('No tiene permisos para programar o registrar mantenimientos.');
    }

    // 2. Validate
    const { isValid, errors } = validateMaintenance(maintForm, targetMachine);
    if (!isValid) {
      const firstError = Object.values(errors)[0];
      throw new Error(firstError);
    }

    // 3. Database RPC Transaction execution
    const rpcResult = await maintenanceRepository.registerMaintenance({
      maquinariaId: maintForm.maquinariaId,
      date: maintForm.date,
      horometro: parseFloat(maintForm.horometro)
    });

    if (!rpcResult || !rpcResult.success) {
      throw new Error('La base de datos rechazó el registro de mantenimiento.');
    }

    // 4. Audit logging
    audit.log({
      action: 'REGISTER_MAINTENANCE',
      description: `Registrado mantenimiento completado para: ${targetMachine?.codigoId || ''} - ${targetMachine?.name || ''} en horómetro ${maintForm.horometro} h`,
      previousValues: targetMachine,
      newValues: rpcResult
    });

    // 5. Emit domain event
    emit('MaintenanceRegistered', {
      maquinariaId: maintForm.maquinariaId,
      date: maintForm.date,
      horometro: maintForm.horometro,
      nextMaintenance: rpcResult.next_maintenance,
      nextMaintenanceHours: rpcResult.next_maintenance_hours
    });

    return rpcResult;
  }
}

export const maintenanceService = new MaintenanceService();
export default maintenanceService;
