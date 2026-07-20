import React from 'react';
import { useMonitoringContext } from '../../context/MonitoringContext';
import { useLotsContext } from '../../context/LotsContext';
import DynamicMonitoringForm from './DynamicMonitoringForm';

export default function MonitoringForm() {
  const { lotes } = useLotsContext();
  const {
    newMonitoreo,
    setNewMonitoreo,
    addMonitoreo,
    setIsMonDrawerOpen,
    formularioMonitoreo,
    formularioCargando,
    formularioError,
    objetoSeleccionado,
    alertasUmbral,
    seleccionarObjeto,
    actualizarValorEvaluacion
  } = useMonitoringContext();

  const handleSubmit = (e) => {
    e.preventDefault();
    addMonitoreo();
  };

  return (
    <form className="drawer-form" onSubmit={handleSubmit}>

      {/* ── Lote ── */}
      <div>
        <label className="form-label">Lote</label>
        <select
          className="input-glass select-glass"
          style={{ width: '100%' }}
          value={newMonitoreo.lote_id}
          onChange={e => setNewMonitoreo(p => ({ ...p, lote_id: e.target.value }))}
          required
        >
          <option value="" disabled>Seleccione un lote...</option>
          {lotes.map(l => (
            <option key={l.id} value={l.id}>
              {l.codigo_interno} — {l.cultivo_ref?.nombre_comun || l.cultivo}
            </option>
          ))}
        </select>
      </div>

      {/* ── Responsable ── */}
      <div>
        <label className="form-label">Responsable</label>
        <input
          type="text"
          className="input-glass"
          style={{ width: '100%' }}
          required
          placeholder="Nombre del responsable del monitoreo"
          value={newMonitoreo.responsable}
          onChange={e => setNewMonitoreo(p => ({ ...p, responsable: e.target.value }))}
        />
      </div>

      {/* ── Tipo de Monitoreo ── */}
      <div>
        <label className="form-label">Tipo de Monitoreo</label>
        <select
          className="input-glass select-glass"
          style={{ width: '100%' }}
          value={newMonitoreo.tipo_monitoreo}
          onChange={e => setNewMonitoreo(p => ({ ...p, tipo_monitoreo: e.target.value }))}
        >
          <option>Sanitario</option>
          <option>Preventivo</option>
          <option>Seguimiento</option>
          <option>Emergencia</option>
        </select>
      </div>

      {/* ── Formulario Dinámico Data-Driven ── */}
      <div style={{
        padding: '16px',
        background: 'var(--color-surface-2, #1e293b)',
        border: '1px solid var(--color-border, #334155)',
        borderRadius: '12px'
      }}>
        <DynamicMonitoringForm
          formularioMonitoreo={formularioMonitoreo}
          formularioCargando={formularioCargando}
          formularioError={formularioError}
          objetoSeleccionado={objetoSeleccionado}
          newMonitoreo={newMonitoreo}
          alertasUmbral={alertasUmbral}
          onObjetoSelect={seleccionarObjeto}
          onValorChange={actualizarValorEvaluacion}
          onFieldChange={(campo, valor) => setNewMonitoreo(p => ({ ...p, [campo]: valor }))}
        />
      </div>

      {/* ── Observaciones generales ── */}
      <div>
        <label className="form-label">Observaciones Generales</label>
        <textarea
          className="input-glass"
          style={{ width: '100%', resize: 'vertical', minHeight: '72px' }}
          placeholder="Notas adicionales sobre el monitoreo..."
          value={newMonitoreo.observaciones}
          onChange={e => setNewMonitoreo(p => ({ ...p, observaciones: e.target.value }))}
          rows={3}
        />
      </div>

      {/* ── Acciones ── */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ flexGrow: 1 }}
          onClick={() => setIsMonDrawerOpen(false)}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          style={{ flexGrow: 2, background: 'var(--color-accent-green, #22c55e)', color: '#000', fontWeight: '700' }}
          disabled={!newMonitoreo.lote_id || !newMonitoreo.objeto_evaluacion_id}
        >
          Guardar Evaluación
        </button>
      </div>
    </form>
  );
}
