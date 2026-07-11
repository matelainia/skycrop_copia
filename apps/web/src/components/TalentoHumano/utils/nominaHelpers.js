export const formatCOP = (val) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
};

export const formatCOPMillon = (val) => {
  if (val >= 1000000) {
    return `$${(val / 1000000).toFixed(1)}M COP`;
  }
  return formatCOP(val);
};
