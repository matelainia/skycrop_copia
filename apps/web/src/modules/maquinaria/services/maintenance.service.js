import { maintenanceRepository } from '../repository/maintenance.repository';
import { validateMaintenance } from '../validators/maintenance.validator';
import { canRegisterMaintenance } from '../permissions/canRegisterMaintenance';
import { translateRpcError } from './rpcErrors';
import { audit } from '../audit/audit.service';
import { emit } from '../events/machinery.events';

/**
 * TRANSICIONAL paso 8: la UI actual solo captura {fecha, horómetro, notas},
 * sin tipo/descripción/costo. Se programa como Correctivo con ejecución
 * inmediata y se registra la ejecución (costo 0). El paso 9 pedirá
 * tipo/descripción/costo/proveedor en el formulario y eliminará este rodeo,
 * además de programar el siguiente Preventivo de forma explícita.
 */
const AUTO_PREVENTIVO_DIAS = 90;
const AUTO_PREVENTIVO_HORAS = 250;

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

    // 3. Programar (Correctivo, ejecución inmediata) + registrar ejecución.
    let programado;
    try {
      programado = await maintenanceRepository.programar({
        maquinariaId: maintForm.maquinariaId,
        tipo: 'Correctivo',
        descripcion: maintForm.notes?.trim() || 'Mantenimiento registrado desde flota (transicional paso 8)',
        fechaProgramada: maintForm.date,
        horometroRef: parseFloat(maintForm.horometro),
        iniciarEjecucion: true
      });
    } catch (err) {
      throw new Error(translateRpcError(err, 'La base de datos rechazó la programación del mantenimiento.'), { cause: err });
    }
    if (!programado?.success || !programado?.mantenimiento_id) {
      throw new Error('La base de datos rechazó la programación del mantenimiento.');
    }

    let rpcResult;
    try {
      rpcResult = await maintenanceRepository.registrarEjecucion({
        mantenimientoId: programado.mantenimiento_id,
        fechaEjecucion: maintForm.date,
        horometro: parseFloat(maintForm.horometro),
        costo: 0
      });
    } catch (err) {
      throw new Error(translateRpcError(err, 'La base de datos rechazó el registro de mantenimiento.'), { cause: err });
    }

    // 4. Preventivo siguiente automático (réplica del ciclo legacy 90d/250h;
    // el paso 9 lo hará explícito con política por equipo).
    try {
      const fecha = new Date(`${maintForm.date}T12:00:00`);
      fecha.setDate(fecha.getDate() + AUTO_PREVENTIVO_DIAS);
      await maintenanceRepository.programar({
        maquinariaId: maintForm.maquinariaId,
        tipo: 'Preventivo',
        descripcion: 'Preventivo programado automático (ciclo 90d/250h, transicional paso 8)',
        fechaProgramada: fecha.toISOString().split('T')[0],
        horometroRef: parseFloat(maintForm.horometro) + AUTO_PREVENTIVO_HORAS,
        iniciarEjecucion: false
      });
    } catch (err) {
      console.error('No se pudo programar el preventivo siguiente:', err.message);
    }

    // 5. Audit logging
    audit.log({
      action: 'REGISTER_MAINTENANCE',
      description: `Registrado mantenimiento completado para: ${targetMachine?.codigoId || ''} - ${targetMachine?.name || ''} en horómetro ${maintForm.horometro} h`,
      previousValues: targetMachine,
      newValues: rpcResult
    });

    // 6. Emit domain event
    emit('MaintenanceRegistered', {
      maquinariaId: maintForm.maquinariaId,
      mantenimientoId: programado.mantenimiento_id,
      date: maintForm.date,
      horometro: maintForm.horometro
    });

    return { ...rpcResult, mantenimiento_id: programado.mantenimiento_id };
  }

  /**
   * Historial de mantenimientos por equipo (paso 9: tabs Preventivo/Correctivo).
   */
  async getHistorial(maquinariaId) {
    try {
      return await maintenanceRepository.getHistorial({ maquinariaId });
    } catch (err) {
      throw new Error(translateRpcError(err, 'No se pudo cargar el historial de mantenimientos.'), { cause: err });
    }
  }
}

export const maintenanceService = new MaintenanceService();
export default maintenanceService;
