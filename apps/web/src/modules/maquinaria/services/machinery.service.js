import { machineryRepository } from '../repository/machinery.repository';
import { validateMachine } from '../validators/machinery.validator';
import { canCreateMachine } from '../permissions/canCreateMachine';
import { canDeleteMachine } from '../permissions/canDeleteMachine';
import { audit } from '../audit/audit.service';
import { emit } from '../events/machinery.events';

class MachineryService {
  /**
   * Fetch all fleet machinery
   */
  async getFleet() {
    return await machineryRepository.getAll();
  }

  /**
   * Register a new machinery item
   */
  async registerMachine(machineData, existingFleet = []) {
    // 1. Authorization Policy check
    if (!canCreateMachine()) {
      throw new Error('No tiene permisos suficientes para agregar maquinaria.');
    }

    // 2. Validate input fields
    const { isValid, errors } = validateMachine(machineData, existingFleet);
    if (!isValid) {
      const firstError = Object.values(errors)[0];
      throw new Error(firstError);
    }

    // 3. Database insert
    const registered = await machineryRepository.create(machineData);

    // 4. Audit Log
    audit.log({
      action: 'CREATE_MACHINE',
      description: `Registrado nuevo equipo agrícola: ${registered.codigoId} - ${registered.name}`,
      newValues: registered
    });

    // 5. Emit domain event
    emit('MachineRegistered', registered);

    return registered;
  }

  /**
   * Edit/Update machinery details
   */
  async updateMachine(id, machineData, existingFleet = []) {
    // 1. Validate
    const { isValid, errors } = validateMachine(machineData, existingFleet);
    if (!isValid) {
      const firstError = Object.values(errors)[0];
      throw new Error(firstError);
    }

    const previousRecord = existingFleet.find(m => m.id === id);

    // 2. Database update
    const updated = await machineryRepository.update(id, machineData);

    // 3. Audit Log
    audit.log({
      action: 'UPDATE_MACHINE',
      description: `Actualizado equipo agrícola: ${updated.codigoId} - ${updated.name}`,
      previousValues: previousRecord,
      newValues: updated
    });

    // 4. Emit domain event
    emit('MachineUpdated', updated);

    return updated;
  }

  /**
   * Delete machinery item
   */
  async removeMachine(id, machineRecord) {
    // 1. Authorization Policy check
    if (!canDeleteMachine()) {
      throw new Error('No tiene permisos para eliminar maquinaria.');
    }

    // 2. Database deletion
    const deletedId = await machineryRepository.delete(id);

    // 3. Audit Log
    audit.log({
      action: 'DELETE_MACHINE',
      description: `Eliminado equipo agrícola de la flota: ${machineRecord?.codigoId || id}`,
      previousValues: machineRecord
    });

    // 4. Emit domain event
    emit('MachineDeleted', { id });

    return deletedId;
  }
}

export const machineryService = new MachineryService();
export default machineryService;
