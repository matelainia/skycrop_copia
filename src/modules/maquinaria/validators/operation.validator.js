/**
 * Validator for Operation / Labor starts and ends
 */
export const validateStartLabor = (laborForm, targetMachine) => {
  const errors = {};

  if (!laborForm.maquinariaId) {
    errors.maquinariaId = 'Debe seleccionar un equipo.';
  }

  if (!laborForm.operator || !laborForm.operator.trim()) {
    errors.operator = 'El nombre del operador es obligatorio.';
  }

  if (!laborForm.lot || !laborForm.lot.trim()) {
    errors.lot = 'El lote o campo es obligatorio.';
  }

  if (targetMachine && Number(laborForm.startHorometro) < targetMachine.hoursOfOperation) {
    errors.startHorometro = `El horómetro inicial no puede ser menor que el actual (${targetMachine.hoursOfOperation} h).`;
  }

  if (Number(laborForm.startFuel) < 0 || Number(laborForm.startFuel) > 1000) {
    errors.startFuel = 'Nivel de combustible no válido.';
  }

  if (!laborForm.startTime) {
    errors.startTime = 'La hora de inicio es obligatoria.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateEndLabor = (endForm, activeJornada) => {
  const errors = {};

  if (!endForm.jornadaId) {
    errors.jornadaId = 'ID de jornada no especificado.';
  }

  if (activeJornada && Number(endForm.endHorometro) < activeJornada.startHorometro) {
    errors.endHorometro = `El horómetro final no puede ser menor que el inicial (${activeJornada.startHorometro} h).`;
  }

  if (Number(endForm.endFuel) < 0) {
    errors.endFuel = 'El combustible restante no puede ser menor a 0.';
  }

  if (!endForm.endTime) {
    errors.endTime = 'La hora final es obligatoria.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
