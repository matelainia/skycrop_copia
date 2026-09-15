import { fuelRepository } from '../repository/fuel.repository';
import { translateRpcError } from './rpcErrors';
import { audit } from '../audit/audit.service';
import { emit } from '../events/machinery.events';

/**
 * Servicio de combustible — nuevo en paso 8 (contrato 052 §2.4/§5).
 * Cableado a UI en paso 9; la página actual sigue derivando consumo
 * de jornadas hasta entonces.
 */
class FuelService {
  async registerFuel(fuelForm, targetMachine) {
    const cantidad = Number(fuelForm.cantidad);
    const costoUnitario = Number(fuelForm.costoUnitario);
    const horometro = Number(fuelForm.horometro);
    if (!fuelForm.maquinariaId) {
      throw new Error('Selecciona un equipo para registrar combustible.');
    }
    if (!(cantidad > 0)) {
      throw new Error('La cantidad debe ser mayor que cero.');
    }
    if (!(costoUnitario >= 0)) {
      throw new Error('El costo unitario no puede ser negativo.');
    }
    if (!(horometro >= 0)) {
      throw new Error('El horómetro no puede ser negativo.');
    }

    let result;
    try {
      result = await fuelRepository.registrar({
        maquinariaId: fuelForm.maquinariaId,
        fecha: fuelForm.fecha ? new Date(fuelForm.fecha).toISOString() : new Date().toISOString(),
        cantidad,
        unidad: fuelForm.unidad || 'L',
        costoUnitario,
        horometro,
        operadorId: fuelForm.operadorId || null,
        proveedor: fuelForm.proveedor?.trim() || null,
        observacion: fuelForm.observacion?.trim() || null
      });
    } catch (err) {
      throw new Error(translateRpcError(err, 'La base de datos rechazó el registro de combustible.'), { cause: err });
    }
    if (!result?.success) {
      throw new Error('La base de datos rechazó el registro de combustible.');
    }

    audit.log({
      action: 'REGISTER_FUEL',
      description: `Carga de combustible: ${cantidad} L en ${targetMachine?.codigoId || ''} ($${result.costo_total ?? 0})`,
      newValues: result
    });
    emit('FuelRegistered', { maquinariaId: fuelForm.maquinariaId, registroId: result.registro_id });

    return result;
  }

  async getHistorial(maquinariaId) {
    try {
      return await fuelRepository.getHistorial({ maquinariaId });
    } catch (err) {
      throw new Error(translateRpcError(err, 'No se pudo cargar el historial de combustible.'), { cause: err });
    }
  }
}

export const fuelService = new FuelService();
export default fuelService;
