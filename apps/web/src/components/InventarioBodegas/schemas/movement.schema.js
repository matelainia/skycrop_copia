export const validateInventoryMovement = (data) => {
  const errors = {};

  if (data.cantidad === undefined || data.cantidad === null || data.cantidad === '') {
    errors.cantidad = "La cantidad es obligatoria.";
  } else {
    const qtyNum = Number(data.cantidad);
    if (isNaN(qtyNum)) {
      errors.cantidad = "La cantidad debe ser un número.";
    } else if (qtyNum <= 0) {
      errors.cantidad = "La cantidad debe ser mayor que cero.";
    }
  }

  if (!data.tipo || (data.tipo !== 'entrada' && data.tipo !== 'salida')) {
    errors.tipo = "El tipo de movimiento debe ser 'entrada' o 'salida'.";
  }

  return {
    success: Object.keys(errors).length === 0,
    errors,
  };
};
