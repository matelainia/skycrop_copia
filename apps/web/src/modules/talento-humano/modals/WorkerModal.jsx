import React from 'react';
import { X, FileText } from 'lucide-react';
import Avatar from '../components/common/Avatar';
import { getStatusBadge, getInitials } from '../utils/workerHelpers';

export default function WorkerModal({ worker, cuadrillas = [], onClose }) {
  if (!worker) return null;

  const myCuadrillas = cuadrillas.filter(c => c.miembros.includes(worker.id));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Ficha del Trabajador</h3>
          <button className="btn btn-secondary" style={{ padding: 6 }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Photo */}
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              {worker.foto ? (
                <img 
                  src={worker.foto} 
                  alt="" 
                  style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--border-color)' }} 
                />
              ) : (
                <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800, color: 'var(--primary)', border: '3px solid var(--border-color)' }}>
                  {getInitials(worker)}
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <span className={`badge ${getStatusBadge(worker.estado)}`}>{worker.estado}</span>
              </div>
            </div>

            {/* Details */}
            <div style={{ flexGrow: 1 }}>
              <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{worker.nombres} {worker.apellidos}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>{worker.rol}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                {[
                  ['Identificación', worker.identificacion],
                  ['Edad', worker.edad ? `${worker.edad} años` : 'N/A'],
                  ['Fecha de Nacimiento', worker.fechaNacimiento || 'N/A'],
                  ['Fecha de Contratación', worker.fechaContratacion || 'N/A'],
                  ['Tipo de Contrato', worker.tipoContrato],
                  ['RH Sanguíneo', worker.rhSanguineo],
                  ['EPS', worker.tipoEps],
                  ['ARL', worker.tipoArl],
                  ['Teléfono', worker.contactoTelefonico || 'N/A'],
                  ['Contacto Emergencia', worker.contactoEmergencia || 'N/A'],
                ].map(([label, value], i) => (
                  <div key={i}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>{label}</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{value}</strong>
                  </div>
                ))}
              </div>

              {/* Cuadrillas */}
              {myCuadrillas.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Cuadrillas asignadas</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {myCuadrillas.map(c => (
                      <span key={c.id} className="worker-chip">{c.nombre}</span>
                    ))}
                  </div>
                </div>
              )}

              {worker.copiaContratoName && (
                <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <FileText size={16} style={{ color: 'var(--primary)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Contrato:</span>
                  <strong style={{ color: 'var(--primary)' }}>{worker.copiaContratoName}</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
