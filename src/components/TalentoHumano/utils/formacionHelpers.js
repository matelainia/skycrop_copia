export const INITIAL_CURSOS = [
  { id: 'c1', nombre: 'Curso de Seguridad y Salud', tipo: 'Seguridad y Salud', total_horas: 16 },
  { id: 'c2', nombre: 'Manejo de Tractor', tipo: 'Operación', total_horas: 24 },
  { id: 'c3', nombre: 'Taller de Buenas Prácticas Agrícolas', tipo: 'Técnica', total_horas: 12 },
  { id: 'c4', nombre: 'Capacitación de Primeros Auxilios', tipo: 'Seguridad y Salud', total_horas: 8 }
];

export const buildMockRegistros = (workersList) => {
  if (!workersList || workersList.length === 0) return [];
  const records = [];
  const courses = INITIAL_CURSOS;
  
  const states = ['Completada', 'Completada', 'Completada', 'En Curso', 'Completada', 'Vencida', 'Vencida'];
  const dates = ['2026-04-28', '2026-05-02', '2026-05-02', '2026-05-03', '2026-05-02', '2026-05-03', '2026-05-02'];
  const scores = ['10/10', '10/10', '7/10', 'En Curso', '7/10', '8/10', '10/10'];
  const courseMap = [courses[2], courses[1], courses[1], courses[1], courses[3], courses[3], courses[3]];
  
  workersList.forEach((w, idx) => {
    const mIdx = idx % states.length;
    records.push({
      id: `r-${idx}`,
      trabajador_id: w.id,
      curso_id: courseMap[mIdx].id,
      fecha: dates[mIdx],
      resultado: scores[mIdx],
      estado: states[mIdx],
      certificado_url: states[mIdx] === 'Completada' ? '#' : null
    });
  });
  return records;
};
