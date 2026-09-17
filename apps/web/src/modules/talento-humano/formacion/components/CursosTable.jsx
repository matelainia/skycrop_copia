import React from 'react';

export const CursosTable = React.memo(function CursosTable({
  cursos = [],
  registros = [],
  onSelectCourse
}) {
  const courseEnrolledStats = (courseId) => {
    const courseRegs = registros.filter(r => r.curso_id === courseId);
    const completed = courseRegs.filter(r => r.estado === 'Completada').length;
    const pending = courseRegs.filter(r => r.estado === 'En Curso').length;
    const expired = courseRegs.filter(r => r.estado === 'Vencida').length;
    return { total: courseRegs.length, completed, pending, expired };
  };

  return (
    <div className="courses-summary-row">
      {cursos.map(c => {
        const stats = courseEnrolledStats(c.id);
        return (
          <div key={c.id} className="course-summary-card" onClick={() => onSelectCourse(c)}>
            <div>
              <h4>{c.nombre}</h4>
              <span className="course-type">{c.tipo}</span>
            </div>
            <div className="course-card-metrics">
              <div className="course-metric-item">
                <div className="course-metric-label">Total</div>
                <div className="course-metric-value">{stats.total}</div>
              </div>
              <div className="course-metric-item">
                <div className="course-metric-label">Comp.</div>
                <div className="course-metric-value" style={{ color: 'var(--primary)' }}>{stats.completed}</div>
              </div>
              <div className="course-metric-item">
                <div className="course-metric-label">Pend.</div>
                <div className="course-metric-value" style={{ color: 'var(--accent-gold)' }}>
                  {stats.pending + stats.expired}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default CursosTable;
