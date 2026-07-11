import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function DashboardDrawer({ 
  workers = [], 
  cursos = [], 
  registros = [], 
  onClose 
}) {
  const [activeDashboardTab, setActiveDashboardTab] = useState('graficos');

  const activeWorkers = workers.filter(w => w.estado === 'Activa');
  const trainedSet = new Set(registros.filter(r => r.estado === 'Completada').map(r => r.trabajador_id));
  const trainedPercentage = activeWorkers.length > 0 
    ? `${Math.round((trainedSet.size / activeWorkers.length) * 100)}%` 
    : '85%';

  const totalHours = registros
    .filter(r => r.estado === 'Completada')
    .reduce((sum, r) => {
      const c = cursos.find(cur => cur.id === r.curso_id);
      return sum + (c ? Number(c.total_horas) : 8);
    }, 0);

  const expiredCount = registros.filter(r => r.estado === 'Vencida').length;

  const completedByType = registros
    .filter(r => r.estado === 'Completada')
    .reduce((acc, r) => {
      const c = cursos.find(cur => cur.id === r.curso_id);
      const type = c ? c.tipo : 'Otros';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, { 'Seguridad y Salud': 0, 'Técnica': 0, 'Operación': 0 });

  const maxVal = Math.max(1, ...Object.values(completedByType));

  const statusCounts = registros.reduce((acc, r) => {
    acc[r.estado] = (acc[r.estado] || 0) + 1;
    return acc;
  }, { 'Completada': 0, 'En Curso': 0, 'Vencida': 0 });

  const totalStatus = Math.max(1, registros.length);
  const compPct = (statusCounts['Completada'] / totalStatus) * 100;
  const inPrPct = compPct + (statusCounts['En Curso'] / totalStatus) * 100;

  const calendarDays = [];
  for (let i = 27; i <= 30; i++) calendarDays.push({ day: i, active: false, hasEvent: false });
  for (let i = 1; i <= 31; i++) {
    const dayStr = i < 10 ? `0${i}` : `${i}`;
    const dateKey = `2026-05-${dayStr}`;
    const hasEvent = registros.some(r => r.fecha === dateKey);
    calendarDays.push({ day: i, active: true, hasEvent, dateKey });
  }
  const rem = 42 - calendarDays.length;
  for (let i = 1; i <= rem; i++) calendarDays.push({ day: i, active: false, hasEvent: false });

  const upcomingRegistros = registros
    .filter(r => r.fecha.startsWith('2026-05'))
    .slice(0, 3);

  return (
    <>
      <div className="side-drawer-overlay" onClick={onClose} />
      <div className="side-drawer">
        <div className="side-drawer-header">
          <h3>Cuadro de Mando de Capacitación</h3>
          <button className="btn btn-secondary" style={{ padding: 4 }} onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="side-drawer-tabs">
          <button 
            className={`side-drawer-tab-btn ${activeDashboardTab === 'graficos' ? 'active' : ''}`}
            onClick={() => setActiveDashboardTab('graficos')}
          >
            Seguimiento y Gráficas
          </button>
          <button 
            className={`side-drawer-tab-btn ${activeDashboardTab === 'calendario' ? 'active' : ''}`}
            onClick={() => setActiveDashboardTab('calendario')}
          >
            Calendario y Planificación
          </button>
        </div>
        <div className="side-drawer-body">
          {activeDashboardTab === 'graficos' ? (
            <>
              {/* Metric cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="glass-card" style={{ padding: 12, textAlign: 'center' }}>
                  <div className="course-metric-label">Capacitados %</div>
                  <div className="course-metric-value" style={{ fontSize: 22, color: 'var(--primary)' }}>
                    {trainedPercentage}
                  </div>
                </div>
                <div className="glass-card" style={{ padding: 12, textAlign: 'center' }}>
                  <div className="course-metric-label">Horas Formación</div>
                  <div className="course-metric-value" style={{ fontSize: 22, color: 'var(--accent-blue)' }}>
                    {totalHours} hrs
                  </div>
                </div>
                <div className="glass-card" style={{ padding: 12, textAlign: 'center' }}>
                  <div className="course-metric-label">Completados Mes</div>
                  <div className="course-metric-value" style={{ fontSize: 22, color: 'var(--accent-gold)' }}>5</div>
                </div>
                <div className="glass-card" style={{ padding: 12, textAlign: 'center' }}>
                  <div className="course-metric-label">Críticas por vencer</div>
                  <div className="course-metric-value" style={{ fontSize: 22, color: 'var(--accent-red)' }}>
                    {expiredCount}
                  </div>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="glass-card" style={{ padding: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Cumplimiento por Tipo</h4>
                <div className="custom-bar-chart">
                  {Object.entries(completedByType).map(([type, count]) => {
                    const pct = (count / maxVal) * 100;
                    let typeClass = 'seguridad';
                    if (type === 'Técnica') typeClass = 'tecnica';
                    if (type === 'Operación') typeClass = 'operacion';
                    return (
                      <div key={type} className="bar-item">
                        <div className="bar-fill-container">
                          <div className={`bar-fill ${typeClass}`} style={{ height: `${pct}%` }} />
                        </div>
                        <div className="bar-label">{type.split(' ')[0]} ({count})</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Donut Chart */}
              <div className="glass-card" style={{ padding: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Distribución de Estados</h4>
                <div 
                  className="custom-donut-chart" 
                  style={{
                    '--completed-pct': `${compPct}%`,
                    '--in-progress-pct': `${inPrPct}%`
                  }}
                >
                  <div className="donut-visual" />
                  <div className="donut-legend">
                    <div className="legend-item">
                      <span className="legend-color" style={{ background: 'var(--primary)' }} />
                      <span>Completada ({statusCounts['Completada']})</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color" style={{ background: 'var(--accent-blue)' }} />
                      <span>En Curso ({statusCounts['En Curso']})</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color" style={{ background: 'var(--accent-red)' }} />
                      <span>Vencida ({statusCounts['Vencida']})</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Mini Calendar Tab */}
              <div className="mini-calendar-container">
                <div className="mini-calendar-header">Mayo 2026</div>
                <div className="mini-calendar-grid">
                  {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map(d => (
                    <div key={d} className="calendar-day-header">{d}</div>
                  ))}
                  {calendarDays.map((c, i) => (
                    <div key={i} className={`calendar-day-cell ${c.active ? 'active-month' : ''} ${c.hasEvent ? 'has-event' : ''}`}>
                      {c.day}
                    </div>
                  ))}
                </div>
                
                <div className="calendar-events-list">
                  <h4 style={{ fontSize: 12, fontWeight: 700, margin: '14px 0 6px 0' }}>Próximas Capacitaciones</h4>
                  {upcomingRegistros.map(r => {
                    const c = cursos.find(cur => cur.id === r.curso_id);
                    const w = workers.find(work => work.id === r.trabajador_id);
                    let typeClass = 'tecnica';
                    if (c && c.tipo === 'Seguridad y Salud') typeClass = 'seguridad';
                    if (c && c.tipo === 'Operación') typeClass = 'operacion';

                    return (
                      <div key={r.id} className={`calendar-event-card ${typeClass}`}>
                        <div>
                          <strong>{c ? c.nombre : 'Capacitación'}</strong>
                          <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                            {w ? `${w.nombres} ${w.apellidos}` : 'Varios'}
                          </div>
                        </div>
                        <span style={{ fontWeight: 600 }}>{r.fecha.split('-')[2]} may</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
