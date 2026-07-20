import React from 'react';
import { ShieldAlert, BookOpen, Settings } from 'lucide-react';

const MONITORING_TYPES = [
  { value: 'Sanitario', label: 'Sanitario (Fitosanitario)', desc: 'Detección de plagas, malezas y enfermedades foliares.' },
  { value: 'Agronómico', label: 'Agronómico (Vigor / Nutricional)', desc: 'Deficiencias nutricionales y estimación de vigor.' },
  { value: 'Post-Aplicación', label: 'Post-Aplicación (Eficacia)', desc: 'Evaluación del impacto del tratamiento químico o biológico.' }
];

export default function Step2EvaluationType({
  formData,
  setFormData,
  agronomyForm,
  selectedObjetoData
}) {
  const objetos = agronomyForm?.objetos || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* ── Tipo de Monitoreo ── */}
      <div>
        <h4 className="form-label" style={{ fontWeight: '700', marginBottom: '8px' }}>1. Seleccione el Tipo de Monitoreo</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {MONITORING_TYPES.map(type => {
            const isSelected = formData.tipoMonitoreo === type.value;
            return (
              <label
                key={type.value}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  padding: '16px',
                  borderRadius: '12px',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: isSelected ? 'var(--primary-light)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <input
                  type="radio"
                  name="tipoMonitoreo"
                  value={type.value}
                  checked={formData.tipoMonitoreo === type.value}
                  onChange={e => setFormData(prev => ({ ...prev, tipoMonitoreo: e.target.value }))}
                  style={{ display: 'none' }}
                />
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{type.label}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{type.desc}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* ── Objeto de Evaluación ── */}
      <div>
        <h4 className="form-label" style={{ fontWeight: '700', marginBottom: '8px' }}>2. Seleccione el Objeto de Muestreo</h4>
        {objetos.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '24px', border: '1px dashed var(--border-color)', borderRadius: '12px', background: 'rgba(0,0,0,0.01)' }}>
            No se encontraron objetos de evaluación o protocolos configurados para el cultivo de este lote en Supabase.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {objetos.map(obj => {
              const isSelected = formData.objetoEvaluacionId === obj.id;
              const protocol = obj.protocolo;
              
              // Determinar color de badge
              let badgeColor = 'green';
              if (obj.categoria.toLowerCase().includes('plaga')) badgeColor = 'orange';
              if (obj.categoria.toLowerCase().includes('enfermedad')) badgeColor = 'red';

              return (
                <div
                  key={obj.id}
                  onClick={() => setFormData(prev => ({ ...prev, objetoEvaluacionId: obj.id }))}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '16px',
                    borderRadius: '12px',
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    background: isSelected ? 'var(--primary-light)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? 'var(--glow-shadow)' : 'none'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span className={`eval-badge ${badgeColor}`}>
                        {obj.categoria}
                      </span>
                      {isSelected && (
                        <span style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--primary)',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          fontWeight: '700'
                        }}>✓</span>
                      )}
                    </div>
                    <h5 style={{ fontSize: '13px', fontWeight: '750', color: 'var(--text-primary)', margin: '4px 0' }}>
                      {obj.nombre_comun}
                    </h5>
                    {obj.nombre_cientifico && (
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                        {obj.nombre_cientifico}
                      </p>
                    )}
                    <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '8px 0', lineHeight: '1.4' }}>
                      {obj.descripcion || 'Sin descripción configurada.'}
                    </p>
                  </div>

                  {/* Protocolo */}
                  {protocol ? (
                    <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: 'var(--text-primary)' }}>
                        <span>📋 Protocolo v{protocol.version}</span>
                        <span>Muestra: {protocol.tamanio_muestra} pts</span>
                      </div>
                      {protocol.metodologia && (
                        <span style={{ color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {protocol.metodologia}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{ background: 'var(--accent-red-light)', border: '1px solid var(--primary-border)', borderRadius: '8px', padding: '8px', fontSize: '10px', color: 'var(--accent-red)' }}>
                      ⚠️ Sin protocolo configurado en Supabase.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Resumen de Metodología del Objeto Seleccionado ── */}
      {selectedObjetoData?.protocolo && (
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', background: 'rgba(0,0,0,0.015)' }}>
          <h4 style={{ fontSize: '12px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BookOpen size={14} style={{ color: 'var(--primary)' }} /> Metodología de Muestreo Recomendada
          </h4>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
            {selectedObjetoData.protocolo.metodologia || 'Siga el protocolo estándar de inspección de puntos visuales en forma de zigzag o W a través del lote.'}
          </p>
          <div style={{ display: 'flex', gap: '16px', fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '8px', fontWeight: '500' }}>
            <span>Frecuencia: <strong>Cada {selectedObjetoData.protocolo.frecuencia_dias || 14} días</strong></span>
            <span>Muestra mínima: <strong>{selectedObjetoData.protocolo.tamanio_muestra || 100} puntos</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
