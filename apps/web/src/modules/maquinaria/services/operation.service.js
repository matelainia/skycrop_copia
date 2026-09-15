import { operationRepository } from '../repository/operation.repository';
import { validateStartLabor, validateEndLabor } from '../validators/operation.validator';
import { canStartOperation } from '../permissions/canStartOperation';
import { translateRpcError } from './rpcErrors';
import { audit } from '../audit/audit.service';
import { emit } from '../events/machinery.events';

class OperationService {
  /**
   * Fetch work history
   */
  async getHistory() {
    try {
      return await operationRepository.getAll();
    } catch (err) {
      throw new Error(translateRpcError(err, 'No se pudo cargar el historial de operaciones.'), { cause: err });
    }
  }

  /**
   * Start a new agricultural labor journey (RPC 052/054).
   * Resuelve lote (obligatorio FK) y operador (best-effort; 054 conserva
   * el texto como snapshot si no existe en Talento Humano).
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

    // 3. Resolve lote FK (sin inventar: si no resuelve, aborta con guía).
    let loteId;
    try {
      loteId = await operationRepository.resolveLoteId(laborForm.lot);
    } catch (err) {
      throw new Error(translateRpcError(err), { cause: err });
    }
    if (!loteId) {
      throw new Error(
        `No se encontró el lote "${laborForm.lot}" en tu empresa. Selecciónalo de la lista de lotes para trazabilidad.`
      );
    }
    let operadorId;
    try {
      operadorId = await operationRepository.resolveOperadorId(laborForm.operator);
    } catch (err) {
      throw new Error(translateRpcError(err), { cause: err });
    }

    // 4. Database RPC Transaction execution
    let rpcResult;
    try {
      rpcResult = await operationRepository.startLabor({
        maquinariaId: laborForm.maquinariaId,
        operadorId,
        operadorNombre: laborForm.operator.trim(),
        loteId,
        labor: laborForm.activity,
        startTime: new Date(laborForm.startTime).toISOString(),
        startHorometro: parseFloat(laborForm.startHorometro)
      });
    } catch (err) {
      throw new Error(translateRpcError(err, 'La base de datos rechazó la solicitud de inicio de labor.'), { cause: err });
    }

    if (!rpcResult || !rpcResult.success) {
      throw new Error('La base de datos rechazó la solicitud de inicio de labor.');
    }

    // 5. Audit logging
    audit.log({
      action: 'START_LABOR',
      description: `Iniciada labor agrícola: ${laborForm.activity} en ${laborForm.lot} con máquina ${targetMachine?.codigoId || ''}`,
      newValues: { ...laborForm, targetMachine }
    });

    // 6. Emit event (jornada_id legacy + operacion_id canónico)
    emit('OperationStarted', {
      jornadaId: rpcResult.operacion_id,
      operacionId: rpcResult.operacion_id,
      maquinariaId: laborForm.maquinariaId,
      operator: laborForm.operator,
      lot: laborForm.lot,
      activity: laborForm.activity
    });

    return { ...rpcResult, jornada_id: rpcResult.operacion_id };
  }

  /**
   * Finalize an active labor journey (RPC 052).
   * combustible_l queda null: los % de tanque de la UI legacy no son litros.
   */
  async endOperation(endForm, activeJornada, targetMachine) {
    // 1. Validate
    const { isValid, errors } = validateEndLabor(endForm, activeJornada);
    if (!isValid) {
      const firstError = Object.values(errors)[0];
      throw new Error(firstError);
    }

    // 2. Database RPC Transaction execution
    let rpcResult;
    try {
      rpcResult = await operationRepository.endLabor({
        jornadaId: endForm.jornadaId,
        endTime: new Date(endForm.endTime).toISOString(),
        endHorometro: parseFloat(endForm.endHorometro),
        combustibleL: null,
        notes: endForm.notes?.trim()
      });
    } catch (err) {
      throw new Error(translateRpcError(err, 'La base de datos rechazó la solicitud de cierre de labor.'), { cause: err });
    }

    if (!rpcResult || !rpcResult.success) {
      throw new Error('La base de datos rechazó la solicitud de cierre de labor.');
    }

    const normalized = {
      ...rpcResult,
      hours_worked: rpcResult.horas ?? rpcResult.hours_worked ?? 0,
      fuel_consumed: rpcResult.fuel_consumed ?? null,
      cost: rpcResult.costo ?? rpcResult.cost ?? 0
    };

    // 3. Audit logging
    audit.log({
      action: 'END_LABOR',
      description: `Finalizada labor de equipo ${targetMachine?.codigoId || ''} en lote ${activeJornada?.lot || ''}. Duración: ${normalized.hours_worked} h.`,
      previousValues: activeJornada,
      newValues: normalized
    });

    // 4. Emit decoupled domain event
    emit('OperationCompleted', {
      jornadaId: endForm.jornadaId,
      operacionId: endForm.jornadaId,
      maquinariaId: activeJornada?.maquinariaId,
      hoursWorked: normalized.hours_worked,
      fuelConsumed: normalized.fuel_consumed,
      calculatedCost: normalized.cost,
      lot: activeJornada?.lot
    });

    return normalized;
  }
}

export const operationService = new OperationService();
export default operationService;
