// WMO Weather Codes mapping to Spanish description and CSS icons keys

export const weatherCodesMap = {
  0: { label: 'Despejado', icon: 'sun', description: 'Cielo completamente limpio y despejado.' },
  1: { label: 'Principalmente despejado', icon: 'cloud-sun', description: 'Cielo mayormente despejado con pocas nubes.' },
  2: { label: 'Parcialmente nublado', icon: 'cloud-sun', description: 'Cielo con presencia de nubes dispersas.' },
  3: { label: 'Nublado', icon: 'cloud', description: 'Cielo completamente cubierto de nubes.' },
  45: { label: 'Niebla', icon: 'cloud', description: 'Niebla densa con visibilidad reducida.' },
  48: { label: 'Niebla de escarcha', icon: 'cloud', description: 'Niebla helada con formación de escarcha.' },
  51: { label: 'Llovizna ligera', icon: 'cloud-drizzle', description: 'Llovizna muy fina e intermitente.' },
  53: { label: 'Llovizna moderada', icon: 'cloud-drizzle', description: 'Llovizna constante de baja intensidad.' },
  55: { label: 'Llovizna densa', icon: 'cloud-drizzle', description: 'Llovizna persistente y compacta.' },
  56: { label: 'Llovizna helada ligera', icon: 'cloud-snow', description: 'Llovizna muy fría que se congela en superficies.' },
  57: { label: 'Llovizna helada densa', icon: 'cloud-snow', description: 'Llovizna fría constante con peligro de helada.' },
  61: { label: 'Lluvia ligera', icon: 'cloud-rain', description: 'Lluvia constante de baja intensidad.' },
  63: { label: 'Lluvia moderada', icon: 'cloud-rain', description: 'Lluvia regular favorable para el suelo.' },
  65: { label: 'Lluvia fuerte', icon: 'cloud-rain', description: 'Precipitación intensa con riesgo de saturación hídrica.' },
  66: { label: 'Lluvia helada ligera', icon: 'cloud-snow', description: 'Lluvia muy fría que forma hielo al contacto.' },
  67: { label: 'Lluvia helada fuerte', icon: 'cloud-snow', description: 'Lluvia helada copiosa con riesgo de daños físicos.' },
  71: { label: 'Nieve ligera', icon: 'cloud-snow', description: 'Caída de nieve de baja intensidad.' },
  73: { label: 'Nieve moderada', icon: 'cloud-snow', description: 'Caída de nieve regular.' },
  75: { label: 'Nieve fuerte', icon: 'cloud-snow', description: 'Caída de nieve copiosa.' },
  77: { label: 'Granizo ligero', icon: 'cloud-snow', description: 'Granos de nieve o hielo pequeños.' },
  80: { label: 'Chubascos de lluvia ligeros', icon: 'cloud-rain', description: 'Lluvias breves y repentinas.' },
  81: { label: 'Chubascos de lluvia moderados', icon: 'cloud-rain', description: 'Lluvias repentinas de regular volumen.' },
  82: { label: 'Chubascos de lluvia violentos', icon: 'cloud-rain', description: 'Aguaceros torrenciales de corta duración.' },
  85: { label: 'Chubascos de nieve ligeros', icon: 'cloud-snow', description: 'Nevada breve y repentina.' },
  86: { label: 'Chubascos de nieve fuertes', icon: 'cloud-snow', description: 'Nevada repentina copiosa.' },
  95: { label: 'Tormenta eléctrica', icon: 'cloud-lightning', description: 'Tormentas con actividad eléctrica.' },
  96: { label: 'Tormenta con granizo ligero', icon: 'cloud-lightning', description: 'Actividad eléctrica con caída de granizo menor.' },
  99: { label: 'Tormenta con granizo fuerte', icon: 'cloud-lightning', description: 'Tormenta eléctrica violenta con caída de granizo severo.' }
};

export const getWeatherRule = (code) => {
  return weatherCodesMap[code] || { label: 'Desconocido', icon: 'cloud-sun', description: 'Condición atmosférica no clasificada.' };
};
