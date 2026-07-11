/**
 * Validator for Maintenance registration
 */
export const validateMaintenance = (maintForm, targetMachine) => {
  const errors = {};

  if (!maintForm.maquinariaId) {
    errors.maquinariaId = 'Debe seleccionar un equipo.';
  }

  if (!maintForm.date) {
    errors.date = 'La fecha de servicio es obligatoria.';
  }

  if (targetMachine && Number(maintForm.horometro) < 0) {
    errors.horometro = 'El horómetro de servicio no puede ser negativo.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
