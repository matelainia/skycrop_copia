import React, { useState, useCallback } from 'react';
import { Plus, X, UsersRound } from 'lucide-react';
import { useCuadrillas } from '../hooks/useCuadrillas';
import { useTrabajadores } from '../hooks/useTrabajadores';
import CuadrillaCard from './components/CuadrillaCard';
import EmptyState from '../components/common/EmptyState';
import SectionHeader from '../components/common/SectionHeader';

export default function Cuadrillas() {
  const { 
    cuadrillas, 
    loading: cLoading, 
    error: cError,
    createCuadrilla, 
    deleteCuadrilla, 
    addMemberToCuadrilla, 
    removeMemberFromCuadrilla 
  } = useCuadrillas();

  const { workers } = useTrabajadores();

  const [showNewCuadrilla, setShowNewCuadrilla] = useState(false);
  const [newCuadrillaName, setNewCuadrillaName] = useState('');
  const [addingMemberTo, setAddingMemberTo] = useState(null); // cuadrillaId

  const handleCreateCuadrilla = useCallback(async () => {
    if (!newCuadrillaName.trim()) return;
    try {
      await createCuadrilla(newCuadrillaName.trim());
      setNewCuadrillaName('');
      setShowNewCuadrilla(false);
    } catch (err) {
      alert("Error al crear cuadrilla: " + err.message);
    }
  }, [newCuadrillaName, createCuadrilla]);

  const handleDeleteCuadrilla = useCallback(async (id) => {
    if (!window.confirm('¿Eliminar esta cuadrilla?')) return;
    try {
      await deleteCuadrilla(id);
    } catch (err) {
      alert("Error al eliminar cuadrilla: " + err.message);
    }
  }, [deleteCuadrilla]);

  const handleAddMember = useCallback(async (cuadrillaId, workerId) => {
    try {
      await addMemberToCuadrilla(cuadrillaId, workerId);
      setAddingMemberTo(null);
    } catch (err) {
      alert("Error al agregar miembro: " + err.message);
    }
  }, [addMemberToCuadrilla]);

  const handleRemoveMember = useCallback(async (cuadrillaId, workerId) => {
    try {
      await removeMemberFromCuadrilla(cuadrillaId, workerId);
    } catch (err) {
      alert("Error al remover miembro: " + err.message);
    }
  }, [removeMemberFromCuadrilla]);

  return (
    <>
      <SectionHeader title="Administración de Cuadrillas">
        <button 
          className="btn btn-primary" 
          style={{ gap: 6, display: 'inline-flex', alignItems: 'center' }}
          onClick={() => setShowNewCuadrilla(true)}
        >
          <Plus size={16} /> Nueva Cuadrilla
        </button>
      </SectionHeader>

      {cLoading && <div style={{ textAlign: 'center', padding: 24 }}>Cargando cuadrillas...</div>}
      {cError && <div style={{ color: 'var(--accent-red)', padding: 16 }}>Error al cargar cuadrillas: {cError.message}</div>}

      {!cLoading && cuadrillas.length === 0 ? (
        <EmptyState 
          icon={UsersRound} 
          title="No hay cuadrillas creadas" 
          description="Crea una cuadrilla para organizar al personal por actividad." 
        />
      ) : (
        <div className="cuadrilla-manager-grid">
          {cuadrillas.map(c => (
            <CuadrillaCard 
              key={c.id}
              cuadrilla={c}
              workers={workers}
              isAddingMember={addingMemberTo === c.id}
              onStartAddMember={(id) => setAddingMemberTo(id)}
              onCancelAddMember={() => setAddingMemberTo(null)}
              onAddMember={handleAddMember}
              onRemoveMember={handleRemoveMember}
              onDeleteCuadrilla={handleDeleteCuadrilla}
            />
          ))}
        </div>
      )}

      {/* Modal: Nueva Cuadrilla */}
      {showNewCuadrilla && (
        <div className="modal-overlay" onClick={() => setShowNewCuadrilla(false)}>
          <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nueva Cuadrilla</h3>
              <button className="btn btn-secondary" style={{ padding: 6 }} onClick={() => setShowNewCuadrilla(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <label className="form-label">Nombre de la cuadrilla</label>
              <input 
                type="text" 
                className="input-glass" 
                style={{ width: '100%', marginBottom: 16 }}
                placeholder="Ej. Cuadrilla 6 – Empaque" 
                autoFocus
                value={newCuadrillaName} 
                onChange={e => setNewCuadrillaName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateCuadrilla(); }} 
              />
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setShowNewCuadrilla(false)}>
                  Cancelar
                </button>
                <button className="btn btn-primary" style={{ flexGrow: 1 }} onClick={handleCreateCuadrilla}>
                  Crear Cuadrilla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
