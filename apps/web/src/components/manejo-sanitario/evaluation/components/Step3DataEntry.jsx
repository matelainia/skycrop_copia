import React from 'react';
import { Camera, Plus, Trash2 } from 'lucide-react';

export default function Step3DataEntry({
  formData,
  setFormData,
  protocolInstance,
  derivedMetrics
}) {
  const variables = protocolInstance?.variables || [];

  const handleVariableChange = (clave, valor) => {
    setFormData(prev => ({
      ...prev,
      valoresEvaluacion: {
        ...prev.valoresEvaluacion,
        [clave]: valor
      }
    }));
  };

  const handleAddPhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setFormData(prev => ({
      ...prev,
      photos: [...(prev.photos || []), url]
    }));
  };

  const handleRemovePhoto = (idx) => {
    setFormData(prev => ({
      ...prev,
      photos: (prev.photos || []).filter((_, i) => i !== idx)
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Puntos Muestreados */}
      <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', background: 'rgba(0,0,0,0.01)' }}>
        <h4 style={{ fontSize: '12px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px' }}>
          Tamaño del Muestreo de Campo
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'center' }}>
          <div>
            <label className="form-label">Plantas / Puntos Evaluados *</label>
            <input
              type="number"
              className="input-glass"
              style={{ width: '100%', marginTop: '4px' }}
              placeholder={`Ej. ${protocolInstance?.tamanioMuestra || 100}`}
              value={formData.puntosEvaluados}
              onChange={e => setFormData(prev => ({ ...prev, puntosEvaluados: e.target.value }))}
              min="1"
              required
            />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            Tamaño de muestra sugerido por protocolo: <strong>{protocolInstance?.tamanioMuestra || 100} puntos</strong>. Ingrese el número total de observaciones realizadas.
          </div>
        </div>
      </div>

      {/* Variables Dinámicas */}
      <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', background: 'rgba(0,0,0,0.01)' }}>
        <h4 style={{ fontSize: '12px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px' }}>
          Valores de Variables Fitosanitarias
        </h4>
        {variables.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px italic' }}>
            El protocolo de este objeto no define variables específicas en Supabase.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {variables.map(variable => {
              const valor = formData.valoresEvaluacion[variable.clave] ?? '';

              return (
                <div key={variable.clave} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="form-label" style={{ fontSize: '11px' }}>
                    {variable.etiqueta} {variable.obligatorio && <span style={{ color: 'var(--accent-red)' }}>*</span>}
                    {variable.unidad && <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '400' }}> ({variable.unidad})</span>}
                  </label>

                  {variable.tipo === 'number' && (
                    <input
                      type="number"
                      className="input-glass"
                      style={{ width: '100%', marginTop: '4px' }}
                      value={valor}
                      placeholder={variable.unidad || '0'}
                      min={variable.min !== null ? variable.min : undefined}
                      max={variable.max !== null ? variable.max : undefined}
                      onChange={e => handleVariableChange(variable.clave, e.target.value)}
                    />
                  )}

                  {variable.tipo === 'scale' && variable.escala && (
                    <select
                      className="input-glass select-glass"
                      style={{ width: '100%', marginTop: '4px' }}
                      value={valor}
                      onChange={e => handleVariableChange(variable.clave, e.target.value)}
                    >
                      <option value="" disabled>Seleccione severidad...</option>
                      {variable.escala.map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {variable.tipo === 'boolean' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', marginTop: '4px' }}>
                      <input
                        type="checkbox"
                        checked={!!valor}
                        onChange={e => handleVariableChange(variable.clave, e.target.checked)}
                        style={{ width: '15px', height: '15px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500' }}>Confirmar Presencia / Incidencia</span>
                    </label>
                  )}

                  {variable.tipo !== 'number' && variable.tipo !== 'scale' && variable.tipo !== 'boolean' && (
                    <input
                      type="text"
                      className="input-glass"
                      style={{ width: '100%', marginTop: '4px' }}
                      value={valor}
                      onChange={e => handleVariableChange(variable.clave, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Evidencia Fotográfica */}
      <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', background: 'rgba(0,0,0,0.01)' }}>
        <h4 style={{ fontSize: '12px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px' }}>
          Fotografías de Soporte y Evidencia
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <label style={{
            width: '72px',
            height: '72px',
            borderRadius: '10px',
            border: '2px dashed var(--border-color-hover)',
            background: 'var(--bg-card)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            transition: 'all 0.2s'
          }}>
            <Camera size={18} />
            <span style={{ fontSize: '9px', fontWeight: '700' }}>Adjuntar</span>
            <input type="file" style={{ display: 'none' }} accept="image/*" onChange={handleAddPhoto} />
          </label>

          {(formData.photos || []).map((photo, i) => (
            <div key={i} style={{ position: 'relative', width: '72px', height: '72px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <img src={photo} alt="Evidencia" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={() => handleRemovePhoto(i)}
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  backgroundColor: 'var(--accent-red)',
                  color: 'white',
                  borderRadius: '50%',
                  border: 'none',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '9px'
                }}
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Observaciones generales */}
      <div>
        <label className="form-label">Notas y Observaciones de Campo</label>
        <textarea
          className="input-glass"
          style={{ width: '100%', minHeight: '64px', marginTop: '4px', resize: 'vertical' }}
          placeholder="Escriba aquí notas complementarias de campo (ej. condiciones climatológicas, hallazgos atípicos)..."
          value={formData.observaciones}
          onChange={e => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
          rows={3}
        />
      </div>
    </div>
  );
}
