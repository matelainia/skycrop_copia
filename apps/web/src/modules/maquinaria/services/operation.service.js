import { operationRepository } from '../repository/operation.repository';
import { validateStartLabor, validateEndLabor } from '../validators/operation.validator';
import { canStartOperation } from '../permissions/canStartOperation';
import { audit } from '../audit/audit.service';
import { emit } from '../events/machinery.events';

class OperationService {
  /**
   * Fetch work history
   */
  async getHistory() {
    return await operationRepository.getAll();
  }

  /**
   * Start a new agricultural labor journey
   */
  async startOperation(laborForm, targetMachine) {
    // 1. Policy check
    if (!canStartOperation()) {
      throw new Error('No tiene permisos para registrar operaciones.');
    }

    // 2. Validate
    const { isValid, errors } = validateStartLabor(laborForm, targetMachine);
    if (!isValid) {
      const firstError = Object.values(errors)[0];
      throw new Error(firstError);
    }

    // 3. Database RPC Transaction execution
    const rpcResult = await operationRepository.startLabor({
      maquinariaId: laborForm.maquinariaId,
      operator: laborForm.operator.trim(),
      lot: laborForm.lot.trim(),
      activity: laborForm.activity,
      startTime: new Date(laborForm.startTime).toISOString(),
      startHorometro: parseFloat(laborForm.startHorometro),
      startFuel: parseFloat(laborForm.startFuel)
    });

    if (!rpcResult || !rpcResult.success) {
      throw new Error('La base de datos rechazó la solicitud de inicio de labor.');
    }

    // 4. Audit logging
    audit.log({
      action: 'START_LABOR',
      description: `Iniciada labor agrícola: ${laborForm.activity} en ${laborForm.lot} con máquina ${targetMachine?.codigoId || ''}`,
      newValues: { ...laborForm, targetMachine }
    });

    // 5. Emit event
    emit('OperationStarted', {
      jornadaId: rpcResult.jornada_id,
      maquinariaId: laborForm.maquinariaId,
      operator: laborForm.operator,
      lot: laborForm.lot,
      activity: laborForm.activity
    });

    return rpcResult;
  }

  /**
   * Finalize an active labor journey
   */
  async endOperation(endForm, activeJornada, targetMachine) {
    // 1. Validate
    const { isValid, errors } = validateEndLabor(endForm, activeJornada);
    if (!isValid) {
      const firstError = Object.values(errors)[0];
      throw new Error(firstError);
    }

    // 2. Database RPC Transaction execution
    const rpcResult = await operationRepository.endLabor({
      jornadaId: endForm.jornadaId,
      endTime: new Date(endForm.endTime).toISOString(),
      endHorometro: parseFloat(endForm.endHorometro),
      endFuel: parseFloat(endForm.endFuel),
      notes: endForm.notes?.trim()
    });

    if (!rpcResult || !rpcResult.success) {
      throw new Error('La base de datos rechazó la solicitud de cierre de labor.');
    }

    // 3. Audit logging
    audit.log({
      action: 'END_LABOR',
      description: `Finalizada labor de equipo ${targetMachine?.codigoId || ''} en lote ${activeJornada?.lot || ''}. Duración: ${rpcResult.hours_worked || 0} h.`,
      previousValues: activeJornada,
      newValues: rpcResult
    });

    // 4. Emit decoupled domain event
    emit('OperationCompleted', {
      jornadaId: endForm.jornadaId,
      maquinariaId: activeJornada?.maquinariaId,
      hoursWorked: rpcResult.hours_worked,
      fuelConsumed: rpcResult.fuel_consumed,
      calculatedCost: rpcResult.cost,
      lot: activeJornada?.lot
    });

    return rpcResult;
  }
}

export const operationService = new OperationService();
export default operationService;
