import React, { useState, useCallback } from 'react';
import { CalendarDays, FileText, Plus, Clock, Search } from 'lucide-react';
import { useLabores } from '../hooks/useLabores';
import { useTrabajadores } from '../hooks/useTrabajadores';
import { useCuadrillas } from '../hooks/useCuadrillas';
import KanbanBoard from './components/KanbanBoard';
import HistorialTable from './components/HistorialTable';
import LaborModal from '../modals/LaborModal';
import { TIPOS_LABOR } from '../constants/labores';
import SectionHeader from '../components/common/SectionHeader';
import EmptyState from '../components/common/EmptyState';

export default function Labores() {
  const {
    labores,
    loading: lLoading,
    error: lError,
    createLabor,
    changeEstadoLabor,
    deleteLabor,
    archiveActiveLabores,
    unarchiveLabor
  } = useLabores();

  const { workers } = useTrabajadores();
  const { cuadrillas } = useCuadrillas();

  const [laborViewMode, setLaborViewMode] = useState('tablero'); // 'tablero' | 'historial'
  const [showAddLabor, setShowAddLabor] = useState(false);

  // History filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyType, setHistoryType] = useState('Todos');
  const [historyDateStart, setHistoryDateStart] = useState('');
  const [historyDateEnd, setHistoryDateEnd] = useState('');

  const handleCreateLabor = useCallback(async (formData) => {
    try {
      await createLabor(formData);
      setShowAddLabor(false);
    } catch (err) {
      alert("Error al registrar labor: " + err.message);
    }
  }, [createLabor]);

  const handleArchive = useCallback(async () => {
    const activeLabores = labores.filter(l => ['Pendiente', 'En Curso', 'Completada'].includes(l.estado));
    if (activeLabores.length === 0) {
      alert("No hay labores activas para archivar en este momento.");
      return;
    }
    
    if (!window.confirm(`¿Finalizar el día y archivar las ${activeLabores.length} labores del tablero activo?`)) return;
    
    const activeIds = activeLabores.map(l => l.id);
    try {
      await archiveActiveLabores(activeIds);
      alert("¡Día finalizado! Las labores se han archivado correctamente.");
    } catch (err) {
      alert("Error al archivar labores: " + err.message);
    }
  }, [labores, archiveActiveLabores]);

  const handleUnarchive = useCallback(async (id, originalEstado) => {
    try {
      await unarchiveLabor(id, originalEstado);
    } catch (err) {
      alert("Error al desarchivar la labor: " + err.message);
    }
  }, [unarchiveLabor]);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('¿Eliminar esta labor permanentemente?')) return;
    try {
      await deleteLabor(id);
    } catch (err) {
      alert("Error al eliminar labor: " + err.message);
    }
  }, [deleteLabor]);

  const handleClearFilters = useCallback(() => {
    setHistorySearch('');
    setHistoryType('Todos');
    setHistoryDateStart('');
    setHistoryDateEnd('');
  }, []);

  const hasActiveLabores = labores.some(l => ['Pendiente', 'En Curso', 'Completada'].includes(l.estado));

  return (
    <>
      {/* View Toggle */}
      <div className="view-toggle-container">
        <button 
          className={`view-toggle-btn ${laborViewMode === 'tablero' ? 'active' : ''}`}
          onClick={() => setLaborViewMode('tablero')}
        >
          <CalendarDays size={14} />
          Tablero Activo
        </button>
        <button 
          className={`view-toggle-btn ${laborViewMode === 'historial' ? 'active' : ''}`}
          onClick={() => setLaborViewMode('historial')}
        >
          <FileText size={14} />
          Historial y Trazabilidad
        </button>
      </div>

      {lLoading && <div style={{ textAlign: 'center', padding: 24 }}>Cargando labores...</div>}
      {lError && <div style={{ color: 'var(--accent-red)', padding: 16 }}>Error al cargar labores: {lError.message}</div>}

      {!lLoading && laborViewMode === 'tablero' ? (
        <>
          <SectionHeader 
            title={`Labores del Día — ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`}
          >
            <button 
              className="btn btn-secondary" 
              style={{ gap: 6, borderColor: 'var(--primary-border)', display: 'inline-flex', alignItems: 'center' }}
              onClick={handleArchive}
            >
              <Clock size={16} /> Finalizar Día
            </button>
            <button 
              className="btn btn-primary" 
              style={{ gap: 6, display: 'inline-flex', alignItems: 'center' }}
              onClick={() => setShowAddLabor(true)}
            >
              <Plus size={16} /> Registrar Labor
            </button>
          </SectionHeader>

          {!hasActiveLabores ? (
            <EmptyState 
              icon={CalendarDays}
              title="No hay labores activas en el tablero"
              description="Registra actividades diarias para comenzar o consulta el historial."
            />
          ) : (
            <KanbanBoard 
              labores={labores}
              workers={workers}
              cuadrillas={cuadrillas}
              onDeleteLabor={handleDelete}
              onChangeEstado={changeEstadoLabor}
            />
          )}
        </>
      ) : (
        !lLoading && (
          <>
            <SectionHeader title="Historial y Trazabilidad de Labores" />

            {/* History Filters */}
            <div className="history-filters-bar">
              <div className="filter-group" style={{ flexGrow: 1, minWidth: '200px' }}>
                <label>Buscar en historial</label>
                <div style={{ position: 'relative' }}>
                  <Search size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="input-glass" 
                    style={{ width: '100%', paddingLeft: '36px' }}
                    placeholder="Buscar por título, descripción o lote..."
                    value={historySearch} 
                    onChange={e => setHistorySearch(e.target.value)} 
                  />
                </div>
              </div>

              <div className="filter-group">
                <label>Tipo de Labor</label>
                <select 
                  className="input-glass select-glass" 
                  style={{ minWidth: '150px' }}
                  value={historyType} 
                  onChange={e => setHistoryType(e.target.value)}
                >
                  <option value="Todos">Todos</option>
                  {TIPOS_LABOR.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="filter-group">
                <label>Desde</label>
                <input 
                  type="date" 
                  className="input-glass" 
                  value={historyDateStart}
                  onChange={e => setHistoryDateStart(e.target.value)} 
                />
              </div>

              <div className="filter-group">
                <label>Hasta</label>
                <input 
                  type="date" 
                  className="input-glass" 
                  value={historyDateEnd}
                  onChange={e => setHistoryDateEnd(e.target.value)} 
                />
              </div>
              
              {(historySearch || historyType !== 'Todos' || historyDateStart || historyDateEnd) && (
                <button className="btn btn-secondary" style={{ height: '42px' }} onClick={handleClearFilters}>
                  Limpiar Filtros
                </button>
              )}
            </div>

            <HistorialTable 
              labores={labores}
              workers={workers}
              cuadrillas={cuadrillas}
              search={historySearch}
              type={historyType}
              dateStart={historyDateStart}
              dateEnd={historyDateEnd}
              onUnarchiveLabor={handleUnarchive}
              onDeleteLabor={handleDelete}
            />
          </>
        )
      )}

      {/* Modal: Registrar Labor */}
      {showAddLabor && (
        <LaborModal 
          workers={workers}
          cuadrillas={cuadrillas}
          onSubmit={handleCreateLabor}
          onClose={() => setShowAddLabor(false)}
        />
      )}
    </>
  );
}
