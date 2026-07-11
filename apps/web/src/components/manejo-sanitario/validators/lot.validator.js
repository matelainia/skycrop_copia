export const validateLot = (lotData) => {
  const errors = [];
  if (!lotData.nombre || !lotData.nombre.trim()) {
    errors.push('El nombre del lote es obligatorio.');
  }
  if (!lotData.codigo_interno || !lotData.codigo_interno.trim()) {
    errors.push('El código interno del lote es obligatorio.');
  }
  return {
    isValid: errors.length === 0,
    errors
  };
};
