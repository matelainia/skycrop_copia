/**
 * Retorna la abreviación cardinal del viento en base a los grados (0 - 360).
 */
export const getWindDirection = (degrees) => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const index = Math.round(((degrees % 360) / 45)) % 8;
  return directions[index];
};

/**
 * Formatea una fecha ISO a un formato amigable en español (Ej: "Viernes, 10 de Julio").
 */
export const formatFriendlyDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const dayName = days[date.getDay()];
  const dayNum = date.getDate();
  const monthName = months[date.getMonth()];

  return `${dayName} ${dayNum} ${monthName}`;
};

/**
 * Genera el hash de coordenadas redondeadas a 3 decimales (~110m).
 */
export const getCoordinateHash = (lat, lon) => {
  const roundedLat = parseFloat(lat).toFixed(3);
  const roundedLon = parseFloat(lon).toFixed(3);
  return `${roundedLat}_${roundedLon}`;
};

/**
 * Formatea la hora a formato de 12 horas con a.m./p.m. (Ej: "10 p.m.")
 */
export const formatHour12 = (timeString) => {
  if (!timeString) return '';
  const date = new Date(timeString);
  if (isNaN(date.getTime())) return timeString;

  let hours = date.getHours();
  const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
  hours = hours % 12;
  hours = hours ? hours : 12; // la hora 0 debe ser 12
  return `${hours} ${ampm}`;
};
