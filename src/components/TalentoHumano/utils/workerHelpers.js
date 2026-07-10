export const calcularEdad = (fechaNac) => {
  if (!fechaNac) return '';
  const hoy = new Date();
  const nac = new Date(fechaNac);
  let e = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) e--;
  return e;
};

export const getInitials = (w) => {
  if (!w) return '??';
  const first = (w.nombres || '?')[0];
  const last = (w.apellidos || '?')[0];
  return `${first}${last}`.toUpperCase();
};

export const getStatusBadge = (estado) => {
  switch (estado) {
    case 'Activa':   return 'badge-green';
    case 'On Leave': return 'badge-yellow';
    case 'Inactivo': return 'badge-red';
    default:         return 'badge-blue';
  }
};
