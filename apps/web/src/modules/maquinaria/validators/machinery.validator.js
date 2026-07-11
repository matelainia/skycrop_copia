/**
 * Validator for Machinery (Machine) CRUD operations
 */
export const validateMachine = (machine, existingMachines = []) => {
  const errors = {};

  if (!machine.codigoId || !machine.codigoId.trim()) {
    errors.codigoId = 'El código ID es obligatorio.';
  } else {
    const isDuplicate = existingMachines.some(
      m => m.codigoId.toUpperCase() === machine.codigoId.toUpperCase() && m.id !== machine.id
    );
    if (isDuplicate) {
      errors.codigoId = 'El código ID ya está registrado en la flota.';
    }
  }

  if (!machine.name || !machine.name.trim()) {
    errors.name = 'El nombre del equipo es obligatorio.';
  }

  if (!machine.type) {
    errors.type = 'El tipo de equipo es obligatorio.';
  }

  if (machine.hoursOfOperation < 0) {
    errors.hoursOfOperation = 'El horómetro inicial no puede ser negativo.';
  }

  if (machine.nextMaintenanceHours < 0) {
    errors.nextMaintenanceHours = 'La frecuencia de mantenimiento no puede ser negativa.';
  }

  if (machine.costOperator < 0) errors.costOperator = 'El costo de operador no puede ser negativo.';
  if (machine.costFuel < 0) errors.costFuel = 'El costo de combustible no puede ser negativo.';
  if (machine.costMaintenance < 0) errors.costMaintenance = 'El costo de mantenimiento no puede ser negativo.';
  if (machine.costDepreciation < 0) errors.costDepreciation = 'La depreciación no puede ser negativa.';

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
