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

  if (!data.tipo || !['entrada', 'salida', 'ajuste', 'transferencia'].includes(data.tipo)) {
    errors.tipo = "El tipo de movimiento debe ser 'entrada', 'salida', 'ajuste' o 'transferencia'.";
  }

  if (data.tipo === 'transferencia' && !data.destWarehouseId) {
    errors.destWarehouseId = "La transferencia requiere bodega destino.";
  }

  return {
    success: Object.keys(errors).length === 0,
    errors,
  };
};
