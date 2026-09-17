export const validateWarehouse = (data) => {
  const errors = {};

  if (!data.nombre || !data.nombre.trim()) {
    errors.nombre = "El nombre de la bodega es obligatorio.";
  }

  if (!data.sector || !data.sector.trim()) {
    errors.sector = "El sector o área es obligatorio.";
  }

  if (data.coordenadaX !== undefined && data.coordenadaX !== null && data.coordenadaX !== '') {
    if (isNaN(Number(data.coordenadaX))) {
      errors.coordenadaX = "La coordenada X debe ser un número.";
    }
  }

  if (data.coordenadaY !== undefined && data.coordenadaY !== null && data.coordenadaY !== '') {
    if (isNaN(Number(data.coordenadaY))) {
      errors.coordenadaY = "La coordenada Y debe ser un número.";
    }
  }

  if (!data.categoria) {
    errors.categoria = "La categoría es obligatoria.";
  } else if (data.categoria === 'Otro' && (!data.categoriaOtro || !data.categoriaOtro.trim())) {
    errors.categoriaOtro = "Debe especificar la categoría alternativa.";
  }

  if (data.capacidad !== undefined && data.capacidad !== null && data.capacidad !== '') {
    if (!Number.isInteger(Number(data.capacidad)) || Number(data.capacidad) < 1) {
      errors.capacidad = "La capacidad debe ser un entero mayor que cero.";
    }
  }

  return {
    success: Object.keys(errors).length === 0,
    errors,
  };
};
