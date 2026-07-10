import React, { useState, useMemo, useCallback } from 'react';
import { UserPlus, X } from 'lucide-react';
import { useTrabajadores } from '../hooks/useTrabajadores';
import { useCuadrillas } from '../hooks/useCuadrillas';
import WorkerTable from './components/WorkerTable';
import WorkerCard from './components/WorkerCard';
import WorkerForm from './forms/WorkerForm';
import WorkerModal from '../modals/WorkerModal';
import { TIPOS_CONTRATO } from '../constants/contratos';
import SearchBar from '../components/common/SearchBar';
import FilterBar from '../components/common/FilterBar';

export default function GestionPersonal() {
  const { workers, loading, error, createWorker, deleteWorker, toggleEstado } = useTrabajadores();
  const { cuadrillas } = useCuadrillas();

  const [search, setSearch] = useState('');
  const [cuadrillaFilter, setCuadrillaFilter] = useState('todas');
  const [tipoFilter, setTipoFilter] = useState('Todos');
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [viewWorker, setViewWorker] = useState(null);

  const filteredWorkers = useMemo(() => {
    return workers.filter(w => {
      const matchCuadrilla = cuadrillaFilter === 'todas' || 
        (cuadrillas || []).find(c => c.id === cuadrillaFilter)?.miembros.includes(w.id);
      const matchTipo = tipoFilter === 'Todos' || w.tipoContrato === tipoFilter;
      const matchSearch = `${w.nombres} ${w.apellidos} ${w.identificacion}`.toLowerCase().includes(search.toLowerCase());
      return matchCuadrilla && matchTipo && matchSearch;
    });
  }, [workers, cuadrillas, cuadrillaFilter, tipoFilter, search]);

  const handleAddWorker = useCallback(async (workerData) => {
    try {
      await createWorker(workerData);
      setShowAddWorker(false);
    } catch (err) {
      alert("Error al registrar trabajador: " + err.message);
    }
  }, [createWorker]);

  const handleToggleStatus = useCallback(async (id) => {
    try {
      await toggleEstado(id);
    } catch (err) {
      alert("Error al cambiar estado: " + err.message);
    }
  }, [toggleEstado]);

  const handleDeleteWorker = useCallback(async (id) => {
    if (!window.confirm('¿Eliminar este trabajador?')) return;
    try {
      await deleteWorker(id);
    } catch (err) {
      alert("Error al eliminar trabajador: " + err.message);
    }
  }, [deleteWorker]);

  const handleViewWorker = useCallback((w) => {
    setViewWorker(w);
  }, []);

  const handleCloseView = useCallback(() => {
    setViewWorker(null);
  }, []);

  return (
    <>
      {/* Filter Bar */}
      <FilterBar>
        <div className="filter-group" style={{ minWidth: '220px' }}>
          <label>Filtrar por Cuadrilla</label>
          <select 
            className="input-glass select-glass" 
            style={{ width: '100%' }}
            value={cuadrillaFilter} 
            onChange={e => setCuadrillaFilter(e.target.value)}
          >
            <option value="todas">Todas</option>
            {cuadrillas.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Tipo de Empleado</label>
          <div className="toggle-group">
            {['Todos', ...TIPOS_CONTRATO].map(tipo => (
              <button 
                key={tipo} 
                className={`toggle-btn ${tipoFilter === tipo ? 'active' : ''}`}
                onClick={() => setTipoFilter(tipo)}
              >
                {tipo}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group" style={{ flexGrow: 1, minWidth: '200px' }}>
          <label>Buscar</label>
          <SearchBar 
            placeholder="Buscar por nombre o identificación..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <button 
          className="btn btn-primary" 
          onClick={() => setShowAddWorker(true)}
          style={{ height: '42px', whiteSpace: 'nowrap', alignSelf: 'flex-end', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <UserPlus size={17} /> <span>Agregar Trabajador</span>
        </button>
      </FilterBar>

      {/* Cuadrilla summary pills */}
      <div className="cuadrilla-row">
        {cuadrillas.map(c => (
          <div 
            key={c.id}
            className={`cuadrilla-card ${cuadrillaFilter === c.id ? 'selected' : ''}`}
            onClick={() => setCuadrillaFilter(p => p === c.id ? 'todas' : c.id)}
          >
            <h4>{c.nombre}</h4>
            <dl className="cuadrilla-stats">
              <dt>Miembros</dt>
              <dd>{c.miembros.length}</dd>
              <dt>Activos</dt>
              <dd>{c.miembros.filter(id => workers.find(w => w.id === id)?.estado === 'Activa').length}</dd>
            </dl>
          </div>
        ))}
      </div>

      {/* Loading & Error States */}
      {loading && <div style={{ textAlign: 'center', padding: 24 }}>Cargando personal...</div>}
      {error && <div style={{ color: 'var(--accent-red)', padding: 16 }}>Error al cargar trabajadores: {error.message}</div>}

      {/* Table view (Desktop) */}
      {!loading && (
        <WorkerTable 
          workers={filteredWorkers}
          onViewWorker={handleViewWorker}
          onToggleStatus={handleToggleStatus}
          onDeleteWorker={handleDeleteWorker}
        />
      )}

      {/* Cards view (Mobile) */}
      {!loading && filteredWorkers.length > 0 && (
        <div className="workers-cards-grid">
          {filteredWorkers.map(w => (
            <WorkerCard 
              key={w.id}
              worker={w}
              onViewWorker={handleViewWorker}
              onToggleStatus={handleToggleStatus}
              onDeleteWorker={handleDeleteWorker}
            />
          ))}
        </div>
      )}

      {!loading && workers.length > 0 && (
        <div style={{ display: 'flex', gap: 24, fontSize: 13, color: 'var(--text-muted)', marginTop: 8, flexWrap: 'wrap' }}>
          <span>Total: <strong style={{ color: 'var(--text-primary)' }}>{workers.length}</strong></span>
          <span>Activos: <strong style={{ color: 'var(--primary)' }}>{workers.filter(w => w.estado === 'Activa').length}</strong></span>
          <span>Mostrando: <strong style={{ color: 'var(--text-primary)' }}>{filteredWorkers.length}</strong></span>
        </div>
      )}

      {/* Modal: Agregar Trabajador */}
      {showAddWorker && (
        <div className="modal-overlay" onClick={() => setShowAddWorker(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Registrar Nuevo Trabajador</h3>
              <button className="btn btn-secondary" style={{ padding: 6 }} onClick={() => setShowAddWorker(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <WorkerForm 
                onSubmit={handleAddWorker}
                onCancel={() => setShowAddWorker(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ficha del Trabajador */}
      {viewWorker && (
        <WorkerModal 
          worker={viewWorker}
          cuadrillas={cuadrillas}
          onClose={handleCloseView}
        />
      )}
    </>
  );
}
