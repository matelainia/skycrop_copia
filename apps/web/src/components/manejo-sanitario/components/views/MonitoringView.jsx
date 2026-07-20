import React, { useState } from 'react';
import { Plus, Eye, Trash2, Calendar, ChevronRight, Leaf } from 'lucide-react';
import { useMonitoringContext } from '../../context/MonitoringContext';
import { useLotsContext } from '../../context/LotsContext';
import { agronomyRepository } from '../../repositories/agronomyRepository';
import EvaluationDataEntry from '../../evaluation/EvaluationDataEntry';

/* ─── Colores de estado sanitario ─────────────────────────── */
const HEALTH_COLORS = {
  excelente: { bg: 'rgba(21,128,61,0.1)',  text: '#15803d', label: 'Excelente' },
  bueno:     { bg: 'rgba(34,197,94,0.1)',  text: '#16a34a', label: 'Bueno' },
  regular:   { bg: 'rgba(234,179,8,0.1)',  text: '#a16207', label: 'Regular' },
  bajo:      { bg: 'rgba(239,68,68,0.1)',  text: '#dc2626', label: 'Bajo' },
};

const CATEGORY_ICONS = {
  'Enfermedad Fúngica': '🍄', 'Insecto': '🐛', 'Ácaro': '🕷️',
  'Maleza': '🌿', 'Deficiencia Nutricional': '🍃',
  'Daño Abiótico': '💨', 'Variable Productiva': '📊', 'Otro': '🔍',
};

/* ─── Fila de evaluación en la tabla de historial ─────────── */
const EvaluationRow = ({ monitoreo, lote, onView, onDelete }) => {
  const estadoColor = HEALTH_COLORS[monitoreo.estado_sanitario] || HEALTH_COLORS.regular;
  const fecha = monitoreo.fecha_monitoreo
    ? new Date(monitoreo.fecha_monitoreo).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  const hora = monitoreo.fecha_monitoreo
    ? new Date(monitoreo.fecha_monitoreo).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : '';
  const objIcon = CATEGORY_ICONS[monitoreo.objeto_evaluacion?.categoria] || '🔍';

  return (
    <tr style={{ transition: 'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(21,128,61,0.025)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Lote / Sector */}
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(21,128,61,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
          }}>🌿</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)' }}>
              {lote?.codigo_interno || 'N/A'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {lote?.cultivo_ref?.nombre_comun || lote?.cultivo || '—'} · {lote?.area_ha ? `${lote.area_ha} ha` : '—'}
            </div>
          </div>
        </div>
      </td>

      {/* Fecha */}
      <td>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{fecha}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hora}</div>
      </td>

      {/* Tipo */}
      <td>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 10px', borderRadius: 20,
          background: 'rgba(21,128,61,0.1)',
          color: 'var(--primary)', fontSize: 11, fontWeight: 600
        }}>
          <Leaf size={10} /> {monitoreo.tipo_monitoreo || 'Sanitario'}
        </span>
      </td>

      {/* Responsable */}
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--accent-cyan))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 10, fontWeight: 700, flexShrink: 0
          }}>
            {(monitoreo.responsable || '?').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{monitoreo.responsable || '—'}</div>
          </div>
        </div>
      </td>

      {/* Objeto evaluado */}
      <td>
        {monitoreo.objeto_evaluacion ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>{objIcon}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{monitoreo.objeto_evaluacion.nombre_comun}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{monitoreo.objeto_evaluacion.categoria}</div>
            </div>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {monitoreo.plagas_detectadas || monitoreo.enfermedades_detectadas || '—'}
          </span>
        )}
      </td>

      {/* Incidencia */}
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            height: 6, width: 60, background: 'var(--border-color)',
            borderRadius: 99, overflow: 'hidden'
          }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${Math.min(100, monitoreo.incidencia_pct || 0)}%`,
              background: (monitoreo.incidencia_pct || 0) > 15 ? '#ef4444' :
                          (monitoreo.incidencia_pct || 0) > 5  ? '#f97316' : 'var(--primary)',
            }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700 }}>{monitoreo.incidencia_pct || 0}%</span>
        </div>
      </td>

      {/* Estado */}
      <td>
        <span style={{
          padding: '4px 10px', borderRadius: 20,
          background: estadoColor.bg, color: estadoColor.text,
          fontSize: 11, fontWeight: 600
        }}>
          {estadoColor.label}
        </span>
      </td>

      {/* Acciones */}
      <td style={{ textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button
            className="btn"
            style={{
              padding: '6px 10px', borderRadius: 8,
              border: '1px solid var(--border-color)', background: 'var(--bg-card)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, color: 'var(--text-muted)', transition: 'all 0.15s'
            }}
            onClick={() => onView(monitoreo)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <Eye size={12} />
          </button>
          <button
            className="btn"
            style={{
              padding: '6px 10px', borderRadius: 8,
              border: '1px solid var(--border-color)', background: 'var(--bg-card)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, color: 'var(--text-muted)', transition: 'all 0.15s'
            }}
            onClick={() => onDelete(monitoreo.id)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
};

/* ══════════════════════════════════════════════════════════════
   MonitoringView — Vista principal del módulo
   ══════════════════════════════════════════════════════════════ */
export default function MonitoringView() {
  const { lotes, selectedLote } = useLotsContext();
  const { monitoreos, setMonitoreos, setIsMonDrawerOpen } = useMonitoringContext();

  // Estado de la pantalla: 'list' | 'entry'
  const [screen, setScreen] = useState('list');
  const [formulario, setFormulario] = useState(null);
  const [formularioCargando, setFormularioCargando] = useState(false);

  // Filtros de la tabla
  const [filtroLote, setFiltroLote] = useState('todos');
  const [filtroTipo, setFiltroTipo]  = useState('todos');

  // Cargar formulario al hacer clic en Nueva Evaluación con lote seleccionado
  const handleNuevaEvaluacion = async () => {
    if (!selectedLote?.id) {
      setScreen('entry');
      setFormulario(null);
      return;
    }
    setFormularioCargando(true);
    try {
      const data = await agronomyRepository.getFormularioMonitoreo(selectedLote.id);
      setFormulario(data);
    } catch (err) {
      console.warn('No se pudo cargar formulario:', err.message);
    } finally {
      setFormularioCargando(false);
      setScreen('entry');
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('¿Eliminar esta evaluación?')) {
      setMonitoreos(prev => prev.filter(m => m.id !== id));
    }
  };

  // Filtrar monitoreos
  const monitoreosFiltrados = monitoreos.filter(m => {
    if (filtroLote !== 'todos' && m.lote_id !== filtroLote) return false;
    if (filtroTipo !== 'todos' && m.tipo_monitoreo !== filtroTipo) return false;
    return true;
  });

  // KPIs rápidos
  const totalEvals = monitoreos.length;
  const conHallazgos = monitoreos.filter(m => (m.incidencia_pct || 0) > 0).length;
  const pendientes = monitoreos.filter(m => !m.estado_sanitario || m.estado_sanitario === 'pendiente').length;
  const promIncidencia = totalEvals > 0
    ? (monitoreos.reduce((acc, m) => acc + (m.incidencia_pct || 0), 0) / totalEvals).toFixed(1)
    : 0;

  /* ── Pantalla: Nueva Evaluación (Step 3) ── */
  if (screen === 'entry') {
    if (formularioCargando) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            border: '3px solid var(--primary)',
            borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite'
          }} />
        </div>
      );
    }
    return (
      <EvaluationDataEntry
        lote={selectedLote || lotes[0]}
        objetos={formulario?.objetos || []}
        tipoEvaluacion="Fitosanitario"
        responsable=""
        fecha={new Date().toISOString()}
        onBack={() => setScreen('list')}
        onNext={(data) => {
          console.log('Evaluación completada:', data);
          setScreen('list');
        }}
      />
    );
  }

  /* ── Pantalla: Lista de evaluaciones ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Header de la sección ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
              Monitoreos y Evaluaciones
            </span>
            <ChevronRight size={12} color="var(--text-muted)" />
            <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>
              Historial
            </span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Evaluaciones de Campo
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Seguimiento integral del estado fitosanitario y productivo
          </p>
        </div>

        <button
          type="button"
          onClick={handleNuevaEvaluacion}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '11px 22px',
            background: 'var(--primary)', color: 'white',
            border: 'none', borderRadius: 12,
            fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
            boxShadow: '0 4px 16px -4px rgba(21,128,61,0.4)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.transform = 'none'; }}
        >
          <Plus size={15} />
          Nueva Evaluación
        </button>
      </div>

      {/* ── KPI chips ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { icon: '🌿', val: totalEvals,     lbl: 'Evaluaciones Totales', sub: '+12% vs mes anterior', sub_color: 'var(--primary)', color: 'rgba(21,128,61,0.1)' },
          { icon: '🐛', val: conHallazgos,   lbl: 'Con Hallazgos',        sub: `${conHallazgos} lotes afectados`, sub_color: 'var(--accent-gold)', color: 'rgba(234,179,8,0.1)' },
          { icon: '📊', val: `${promIncidencia}%`, lbl: 'Incidencia Prom.', sub: 'Promedio general',   sub_color: 'var(--accent-blue)', color: 'rgba(37,99,235,0.1)' },
          { icon: '⏳', val: pendientes,    lbl: 'Pendientes',            sub: 'Próximos 7 días',     sub_color: 'var(--accent-red)', color: 'rgba(239,68,68,0.1)' },
        ].map((kpi, i) => (
          <div key={i} className="glass-card" style={{ padding: '18px 20px', transition: 'all 0.2s ease' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: kpi.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
              }}>{kpi.icon}</div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 28, fontFamily: 'var(--font-display)', fontWeight: 800 }}>{kpi.val}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{kpi.lbl}</div>
              <div style={{ fontSize: 11, color: kpi.sub_color, marginTop: 4, fontWeight: 600 }}>{kpi.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabla de evaluaciones ── */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>

        {/* Header de la tabla con filtros */}
        <div style={{
          padding: '18px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: 12
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Historial de Evaluaciones</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select
              value={filtroLote}
              onChange={e => setFiltroLote(e.target.value)}
              style={{
                padding: '7px 12px', borderRadius: 9,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)', color: 'var(--text-primary)',
                fontSize: 12, fontFamily: 'var(--font-sans)', cursor: 'pointer'
              }}
            >
              <option value="todos">Todos los lotes</option>
              {lotes.map(l => <option key={l.id} value={l.id}>{l.codigo_interno}</option>)}
            </select>
            <select
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
              style={{
                padding: '7px 12px', borderRadius: 9,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)', color: 'var(--text-primary)',
                fontSize: 12, fontFamily: 'var(--font-sans)', cursor: 'pointer'
              }}
            >
              <option value="todos">Tipo de evaluación</option>
              <option value="Sanitario">Sanitario</option>
              <option value="Preventivo">Preventivo</option>
              <option value="Seguimiento">Seguimiento</option>
            </select>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 9,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)', fontSize: 12, color: 'var(--text-muted)'
            }}>
              <Calendar size={13} />
              <span>Período</span>
            </div>
          </div>
        </div>

        <div className="table-container">
          <table className="custom-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Lote / Sector</th>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Responsable</th>
                <th>Objeto Evaluado</th>
                <th>Incidencia</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {monitoreosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🌿</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      Sin evaluaciones registradas
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                      Haz clic en "Nueva Evaluación" para comenzar
                    </div>
                    <button
                      onClick={handleNuevaEvaluacion}
                      style={{
                        padding: '10px 24px',
                        background: 'var(--primary)', color: 'white',
                        border: 'none', borderRadius: 10,
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                        boxShadow: '0 4px 12px -2px rgba(21,128,61,0.3)'
                      }}
                    >
                      + Nueva Evaluación
                    </button>
                  </td>
                </tr>
              ) : (
                monitoreosFiltrados.map(m => {
                  const targetL = lotes.find(l => l.id === m.lote_id);
                  return (
                    <EvaluationRow
                      key={m.id}
                      monitoreo={m}
                      lote={targetL}
                      onView={(mon) => console.log('Ver monitoreo:', mon.id)}
                      onDelete={handleDelete}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
