export const validateInventoryItem = (data) => {
  const errors = {};

  if (!data.name || !data.name.trim()) {
    errors.name = "El nombre del artículo es obligatorio.";
  }

  if (data.quantity === undefined || data.quantity === null || data.quantity === '') {
    errors.quantity = "La cantidad inicial es obligatoria.";
  } else if (Number(data.quantity) < 0) {
    errors.quantity = "La cantidad no puede ser negativa.";
  }

  if (data.minQuantity === undefined || data.minQuantity === null || data.minQuantity === '') {
    errors.minQuantity = "El stock mínimo es obligatorio.";
  } else if (Number(data.minQuantity) < 0) {
    errors.minQuantity = "El stock mínimo no puede ser negativo.";
  }

  if (!data.warehouseId) {
    errors.warehouseId = "Debe asignar una bodega.";
  }

  return {
    success: Object.keys(errors).length === 0,
    errors,
  };
};
