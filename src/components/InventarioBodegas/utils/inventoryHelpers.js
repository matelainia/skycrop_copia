export const getItemIcon = (category = '', name = '') => {
  const n = name.toLowerCase();
  const c = category.toLowerCase();
  if (n.includes('urea') || n.includes('fertiliz')) return '🌾';
  if (n.includes('glypho') || n.includes('herbici') || n.includes('pestici') || n.includes('fungici')) return '🧴';
  if (n.includes('maize') || n.includes('seed') || n.includes('semill')) return '🌽';
  if (n.includes('oil') || n.includes('aceite') || n.includes('grasa') || n.includes('diesel')) return '🛢️';
  if (n.includes('glove') || n.includes('guante') || n.includes('helmet') || n.includes('boot') || n.includes('goggle') || c.includes('seguridad')) return '🧤';
  if (n.includes('spade') || n.includes('fork') || n.includes('tool') || n.includes('herram') || n.includes('shear')) return '🛠️';

  if (c.includes('semill')) return '🌱';
  if (c.includes('fertiliz')) return '📦';
  if (c.includes('plaguicid') || c.includes('pestici') || c.includes('herbici')) return '🧪';
  if (c.includes('herramient')) return '🔧';
  if (c.includes('seguridad')) return '🦺';
  if (c.includes('equipo')) return '⚙️';
  return '📦';
};

export const getResponsableName = (id, workers = []) => {
  const worker = workers.find(w => w.id === id);
  return worker ? `${worker.nombres} ${worker.apellidos}` : 'Sin asignar';
};
