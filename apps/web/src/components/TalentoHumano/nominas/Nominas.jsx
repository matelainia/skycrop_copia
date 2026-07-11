import React, { useState, useMemo, useCallback } from 'react';
import { CreditCard, Plus } from 'lucide-react';
import { useNominas } from '../hooks/useNominas';
import { useTrabajadores } from '../hooks/useTrabajadores';
import NominasTable from './components/NominasTable';
import NominaModal from '../modals/NominaModal';
import FilterBar from '../components/common/FilterBar';
import { formatCOP as formatCurrency } from '../utils/nominaHelpers';

export default function Nominas() {
  const { workers } = useTrabajadores();
  const {
    nominas,
    loading: nLoading,
    error: nError,
    createNomina,
    updateNomina,
    deleteNomina,
    generateNominasPeriodo
  } = useNominas();

  const [periodoSelect, setPeriodoSelect] = useState('Abril');
  const [activeKpiFilter, setActiveKpiFilter] = useState('todos');
  const [showAddNomina, setShowAddNomina] = useState(false);
  const [editingNomina, setEditingNomina] = useState(null);

  const periodNominas = useMemo(() => {
    return nominas.filter(n => n.periodo === periodoSelect);
  }, [nominas, periodoSelect]);

  const kpiStats = useMemo(() => {
    let totalEgresos = 0;
    let completedCount = 0;
    let processingCount = 0;
    let incidentCount = 0;
    let totalHE = 0;

    periodNominas.forEach(n => {
      const sBase = n.salario_neto || 0;
      const hEx = n.horas_extras || 0;
      const desc = n.retenciones || 0;
      const net = n.total_neto || (sBase + (hEx * 15000) - desc);

      totalEgresos += net;
      totalHE += hEx;

      if (n.estado === 'Completado') completedCount++;
      else if (n.estado === 'Procesando') processingCount++;
      else if (n.estado === 'Fallido' || n.estado === 'Vencida') incidentCount++;
    });

    return { totalEgresos, completedCount, processingCount, incidentCount, totalHE };
  }, [periodNominas]);

  const filteredNominas = useMemo(() => {
    return periodNominas.filter(n => {
      if (activeKpiFilter === 'todos') return true;
      if (activeKpiFilter === 'incidentes') return n.estado === 'Fallido' || n.estado === 'Vencida';
      return n.estado === activeKpiFilter;
    });
  }, [periodNominas, activeKpiFilter]);

  const roleStats = useMemo(() => {
    const sumByRole = {
      'Tractorista': 0,
      'Supervisor de Campo': 0,
      'Operario General': 0,
      'Otros': 0
    };

    periodNominas.forEach(n => {
      const w = n.trabajador || workers.find(work => work.id === n.trabajador_id);
      const rol = w ? w.rol : 'Otros';
      const sBase = n.salario_neto || 0;
      const hEx = n.horas_extras || 0;
      const desc = n.retenciones || 0;
      const net = n.total_neto || (sBase + (hEx * 15000) - desc);

      if (sumByRole[rol] !== undefined) {
        sumByRole[rol] += net;
      } else {
        sumByRole['Otros'] += net;
      }
    });

    const total = Math.max(1, Object.values(sumByRole).reduce((a, b) => a + b, 0));
    const percentages = {
      'Tractorista': (sumByRole['Tractorista'] / total) * 100,
      'Supervisor de Campo': (sumByRole['Supervisor de Campo'] / total) * 100,
      'Operario General': (sumByRole['Operario General'] / total) * 100,
      'Otros': (sumByRole['Otros'] / total) * 100
    };

    return { sumByRole, percentages };
  }, [periodNominas, workers]);

  const handleGeneratePeriod = useCallback(() => {
    const activeWorkers = workers.filter(w => w.estado === 'Activa');
    generateNominasPeriodo(periodoSelect, activeWorkers);
  }, [workers, periodoSelect, generateNominasPeriodo]);

  const handleSaveNomina = useCallback(async (formData) => {
    const w = workers.find(work => work.id === formData.trabajadorId);
    try {
      if (editingNomina) {
        await updateNomina(editingNomina.id, formData);
        setEditingNomina(null);
      } else {
        await createNomina(formData, w);
        setShowAddNomina(false);
      }
    } catch (err) {
      alert("Error al guardar nómina: " + err.message);
    }
  }, [editingNomina, workers, createNomina, updateNomina]);

  const handleDeleteNomina = useCallback(async (id) => {
    if (!window.confirm("¿Eliminar este registro de nómina?")) return;
    try {
      await deleteNomina(id);
    } catch (err) {
      alert("Error al eliminar nómina: " + err.message);
    }
  }, [deleteNomina]);

  const compPct = roleStats.percentages['Tractorista'];
  const supPct = compPct + roleStats.percentages['Supervisor de Campo'];
  const operPct = supPct + roleStats.percentages['Operario General'];

  return (
    <>
      {/* Filters & Actions Bar */}
      <FilterBar>
        <div className="filter-group" style={{ minWidth: '180px' }}>
          <label>Periodo de Nómina</label>
          <select 
            className="input-glass select-glass" 
            style={{ width: '100%' }}
            value={periodoSelect} 
            onChange={e => {
              setPeriodoSelect(e.target.value);
              setActiveKpiFilter('todos');
            }}
          >
            <option value="Enero">Enero 2026</option>
            <option value="Febrero">Febrero 2026</option>
            <option value="Marzo">Marzo 2026</option>
            <option value="Abril">Abril 2026</option>
            <option value="Mayo">Mayo 2026</option>
          </select>
        </div>

        <div style={{ flexGrow: 1 }} />

        <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
          <button 
            className="btn btn-secondary" 
            style={{ height: '42px', gap: 6, borderColor: 'var(--primary-border)', display: 'inline-flex', alignItems: 'center' }}
            onClick={handleGeneratePeriod}
          >
            <CreditCard size={16} /> <span>Generar Nómina Periodo</span>
          </button>
          <button 
            className="btn btn-primary" 
            style={{ height: '42px', gap: 6, display: 'inline-flex', alignItems: 'center' }}
            onClick={() => setShowAddNomina(true)}
          >
            <Plus size={16} /> <span>Registrar Pago Individual</span>
          </button>
        </div>
      </FilterBar>

      {nLoading && <div style={{ textAlign: 'center', padding: 24 }}>Cargando nóminas...</div>}
      {nError && <div style={{ color: 'var(--accent-red)', padding: 16 }}>Error: {nError.message}</div>}

      {!nLoading && (
        <div className="nominas-layout">
          {/* Main Content Area */}
          <div className="nominas-main">
            {/* KPI Row */}
            <div className="kpi-row">
              <div 
                className={`kpi-card ${activeKpiFilter === 'todos' ? 'active' : ''}`}
                onClick={() => setActiveKpiFilter('todos')}
              >
                <div className="kpi-card-header">Egresos Totales</div>
                <div className="kpi-card-value">{formatCurrency(kpiStats.totalEgresos)}</div>
                <div className="kpi-card-footer">{periodNominas.length} registros en {periodoSelect}</div>
              </div>

              <div 
                className={`kpi-card ${activeKpiFilter === 'Completado' ? 'active' : ''}`}
                onClick={() => setActiveKpiFilter('Completado')}
              >
                <div className="kpi-card-header">Pagos Completados</div>
                <div className="kpi-card-value" style={{ color: 'var(--primary)' }}>{kpiStats.completedCount}</div>
                <div className="kpi-card-footer">Transferidos / Pagados</div>
              </div>

              <div 
                className={`kpi-card ${activeKpiFilter === 'Procesando' ? 'active' : ''}`}
                onClick={() => setActiveKpiFilter('Procesando')}
              >
                <div className="kpi-card-header">Pagos Procesando</div>
                <div className="kpi-card-value" style={{ color: 'var(--accent-gold)' }}>{kpiStats.processingCount}</div>
                <div className="kpi-card-footer">Pendientes de dispersión</div>
              </div>

              <div 
                className={`kpi-card ${activeKpiFilter === 'incidentes' ? 'active' : ''}`}
                onClick={() => setActiveKpiFilter('incidentes')}
              >
                <div className="kpi-card-header">Incidentes</div>
                <div className="kpi-card-value" style={{ color: 'var(--accent-red)' }}>{kpiStats.incidentCount}</div>
                <div className="kpi-card-footer">Pagos fallidos o vencidos</div>
              </div>
            </div>

            {/* Slips Grid */}
            <NominasTable 
              nominas={filteredNominas}
              workers={workers}
              onEdit={setEditingNomina}
              onDelete={handleDeleteNomina}
            />
          </div>

          {/* Sidebar Analytics Panel */}
          <div className="nominas-sidebar">
            {/* Sidebar Metrics Summary */}
            <div className="glass-card" style={{ padding: 20, width: '100%' }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Nómina {periodoSelect} 2026</h3>
              <div className="sidebar-metrics-list">
                <div className="sidebar-metric-card">
                  <div className="sidebar-metric-title">Horas Extras Reportadas</div>
                  <div className="sidebar-metric-value">{kpiStats.totalHE} hrs</div>
                  <div className="sidebar-metric-desc">Equivalente a {formatCurrency(kpiStats.totalHE * 15000)} COP</div>
                </div>

                <div className="sidebar-metric-card">
                  <div className="sidebar-metric-title">Salario Neto Promedio</div>
                  <div className="sidebar-metric-value">
                    {periodNominas.length > 0 
                      ? formatCurrency(Math.round(kpiStats.totalEgresos / periodNominas.length)) 
                      : '$0'}
                  </div>
                  <div className="sidebar-metric-desc">Por cada operario registrado</div>
                </div>
              </div>
            </div>

            {/* Historical Evolution Bar Chart */}
            <div className="glass-card" style={{ padding: 20, width: '100%' }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Histórico Mensual Netos</h3>
              <div className="evolution-bars-container">
                {[
                  { name: 'Feb', value: 32400000 },
                  { name: 'Mar', value: 35100000 },
                  { name: 'Abr', value: kpiStats.totalEgresos || 38200000, current: true }
                ].map((bar, i) => {
                  const maxB = 45000000;
                  const hPct = (bar.value / maxB) * 100;
                  return (
                    <div key={i} className="evolution-bar-wrapper">
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                        {(bar.value / 1000000).toFixed(1)}M
                      </span>
                      <div className="evolution-bar-fill-container">
                        <div 
                          className={`evolution-bar-fill ${bar.current ? '' : 'secondary'}`} 
                          style={{ height: `${hPct}%` }} 
                        />
                      </div>
                      <span className="evolution-bar-label" style={{ color: bar.current ? 'var(--primary)' : '' }}>
                        {bar.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Expenses by role Donut */}
            <div className="glass-card" style={{ padding: 20, width: '100%' }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Egresos por Cargo</h3>
              <div className="role-donut-chart">
                <div 
                  className="role-donut-visual" 
                  style={{
                    background: `conic-gradient(
                      var(--primary) 0% ${compPct}%,
                      var(--accent-blue) ${compPct}% ${supPct}%,
                      var(--accent-cyan) ${supPct}% ${operPct}%,
                      var(--border-color) ${operPct}% 100%
                    )`
                  }}
                />
                <div className="role-donut-legend">
                  <div className="role-legend-item">
                    <span className="role-legend-label">
                      <span className="legend-color" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }} />
                      Tractoristas
                    </span>
                    <span className="role-legend-value">{formatCurrency(roleStats.sumByRole['Tractorista'])}</span>
                  </div>
                  <div className="role-legend-item">
                    <span className="role-legend-label">
                      <span className="legend-color" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-blue)', display: 'inline-block' }} />
                      Supervisores
                    </span>
                    <span className="role-legend-value">{formatCurrency(roleStats.sumByRole['Supervisor de Campo'])}</span>
                  </div>
                  <div className="role-legend-item">
                    <span className="role-legend-label">
                      <span className="legend-color" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-cyan)', display: 'inline-block' }} />
                      Operarios
                    </span>
                    <span className="role-legend-value">{formatCurrency(roleStats.sumByRole['Operario General'])}</span>
                  </div>
                  <div className="role-legend-item">
                    <span className="role-legend-label">
                      <span className="legend-color" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border-color)', display: 'inline-block' }} />
                      Otros
                    </span>
                    <span className="role-legend-value">{formatCurrency(roleStats.sumByRole['Otros'])}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Registrar / Editar Pago */}
      {(showAddNomina || editingNomina) && (
        <NominaModal 
          selectedNomina={editingNomina}
          workers={workers}
          initialPeriod={periodoSelect}
          onSubmit={handleSaveNomina}
          onClose={() => {
            setShowAddNomina(false);
            setEditingNomina(null);
          }}
        />
      )}
    </>
  );
}
