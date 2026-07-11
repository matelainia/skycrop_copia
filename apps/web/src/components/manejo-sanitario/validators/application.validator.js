export const validateApplication = (appData) => {
  const errors = [];
  if (!appData.producto_comercial || !appData.producto_comercial.trim()) {
    errors.push('El producto comercial es obligatorio.');
  }
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const checkHarvestConflict = (carenciaDays, plannedHarvests = []) => {
  const carencia = Number(carenciaDays);
  if (isNaN(carencia) || carencia <= 0) return { conflict: false };

  const appDate = new Date();
  const expiry = new Date(appDate.getTime() + carencia * 24 * 60 * 60 * 1000);

  let conflict = false;
  plannedHarvests.forEach(h => {
    if (new Date(h.fecha_programada) < expiry) {
      conflict = true;
    }
  });

  return { conflict };
};
