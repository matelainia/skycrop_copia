import React from 'react';
import { ClipboardCheck, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function Step4Review({
  formData,
  setFormData,
  selectedLoteData,
  selectedObjetoData,
  derivedMetrics,
  protocolInstance
}) {
  const variables = protocolInstance?.variables || [];
  
  const validations = [
    { label: 'Responsable técnico asignado', done: !!formData.responsable.trim() },
    { label: 'Fecha de la evaluación registrada', done: !!formData.fecha },
    { label: `Puntos evaluados registrados (${formData.puntosEvaluados || 0})`, done: parseFloat(formData.puntosEvaluados) > 0 },
    { label: 'Variables obligatorias diligenciadas', done: Object.keys(formData.valoresEvaluacion).length > 0 },
    { label: 'Cobertura del muestreo (Recomendado > 80%)', done: derivedMetrics.coberturaPct >= 80, warningOnly: true }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Cierre de Registro */}
      <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', background: 'rgba(0,0,0,0.01)' }}>
        <h4 style={{ fontSize: '12px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px' }}>
          Cierre y Validación del Reporte
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <label className="form-label">Responsable Técnico *</label>
            <input
              type="text"
              className="input-glass"
              style={{ width: '100%', marginTop: '4px' }}
              placeholder="Nombre del ingeniero inspector"
              value={formData.responsable}
              onChange={e => setFormData(prev => ({ ...prev, responsable: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="form-label">Fecha de Evaluación *</label>
            <input
              type="date"
              className="input-glass"
              style={{ width: '100%', marginTop: '4px' }}
              value={formData.fecha}
              onChange={e => setFormData(prev => ({ ...prev, fecha: e.target.value }))}
              required
            />
          </div>
        </div>
      </div>

      {/* Resumen de Ficha y Variables */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        
        {/* Ficha General */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', background: 'var(--bg-card)' }}>
          <h4 style={{ fontSize: '12px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={14} style={{ color: 'var(--primary)' }} /> Resumen del Reporte
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Lote</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: '600', textAlign: 'right' }}>{selectedLoteData?.nombre || '—'}</span>

            <span style={{ color: 'var(--text-muted)' }}>Monitoreo</span>
            <span style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{formData.tipoMonitoreo}</span>

            <span style={{ color: 'var(--text-muted)' }}>Objeto</span>
            <span style={{ color: 'var(--primary)', fontWeight: '700', textAlign: 'right' }}>{selectedObjetoData?.nombre_comun}</span>

            <span style={{ color: 'var(--text-muted)' }}>Muestra Evaluada</span>
            <span style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{formData.puntosEvaluados} pts</span>

            <span style={{ color: 'var(--text-muted)' }}>Área Monitoreada</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: '600', textAlign: 'right' }}>{derivedMetrics.areaEvaluada} ha</span>

            <span style={{ color: 'var(--text-muted)' }}>Cobertura %</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: '700', textAlign: 'right' }}>{derivedMetrics.coberturaPct}%</span>

            <span style={{ color: 'var(--text-muted)' }}>Incidencia %</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: '700', textAlign: 'right' }}>{derivedMetrics.incidenciaPct}%</span>
          </div>
        </div>

        {/* Variables Evaluadas */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', background: 'var(--bg-card)' }}>
          <h4 style={{ fontSize: '12px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px' }}>
            Variables Registradas
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '130px', overflowY: 'auto' }}>
            {variables.map(v => {
              const val = formData.valoresEvaluacion[v.clave];
              const displayVal = val === true ? 'Sí' : val === false ? 'No' : val || '—';
              return (
                <div key={v.clave} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{v.etiqueta}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{displayVal} {v.unidad && ` ${v.unidad}`}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Checklist de Validación */}
      <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', background: 'rgba(0,0,0,0.01)' }}>
        <h4 style={{ fontSize: '12px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ClipboardCheck size={14} style={{ color: 'var(--primary)' }} /> Lista de Chequeo de Aprobación
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
          {validations.map((v, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {v.done ? (
                <CheckCircle2 size={15} style={{ color: 'var(--primary)' }} />
              ) : v.warningOnly ? (
                <AlertTriangle size={15} style={{ color: 'var(--accent-gold)' }} />
              ) : (
                <div style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  border: '1.5px solid var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  color: 'var(--text-muted)',
                  fontWeight: '700'
                }}>!</div>
              )}
              <span style={{ color: v.done ? 'var(--text-primary)' : v.warningOnly ? 'var(--accent-gold)' : 'var(--text-muted)' }}>
                {v.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
