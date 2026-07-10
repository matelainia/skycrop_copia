import React from 'react';
import { LotsProvider, useLotsContext } from './context/LotsContext';
import { ApplicationsProvider, useApplicationsContext } from './context/ApplicationsContext';
import { MonitoringProvider, useMonitoringContext } from './context/MonitoringContext';

// Views
import DashboardView from './components/views/DashboardView';
import ApplicationsView from './components/views/ApplicationsView';
import MonitoringView from './components/views/MonitoringView';
import HarvestView from './components/views/HarvestView';
import CostsView from './components/views/CostsView';
import HistoryView from './components/views/HistoryView';
import ReportsView from './components/views/ReportsView';

// Form Drawers
import LotForm from './components/forms/LotForm';
import ApplicationForm from './components/forms/ApplicationForm';
import MonitoringForm from './components/forms/MonitoringForm';
import CosechaForm from './components/forms/CosechaForm';
import CostoForm from './components/forms/CostoForm';
import WorkerForm from './components/forms/WorkerForm';

// Lucide
import { Compass, BookOpen, Activity, Calendar, DollarSign, FileSpreadsheet, MapPin, X, FileText, Download, UploadCloud, Plus } from 'lucide-react';

function ManejoSanitarioContent({ subTab, setSubTab }) {
  const activeSubView = subTab && [
    'lotes', 'aplicaciones', 'monitoreos', 'cosecha_plan',
    'costos_san', 'historial_traz', 'reportes_san'
  ].includes(subTab) ? subTab : 'lotes';

  const {
    selectedLote,
    isLoteDrawerOpen,
    setIsLoteDrawerOpen,
    isFichaModalOpen,
    setIsFichaModalOpen,
    modalActiveTab,
    setModalActiveTab,
    isMonDrawerOpen,
    isAppDrawerOpen,
    isCosechaDrawerOpen,
    isCostoDrawerOpen,
    isTrabajadorDrawerOpen,
    handleAttachmentUpload,
    logAudit,
    auditorias
  } = useLotsContext();

  const { aplicaciones } = useApplicationsContext();
  const { monitoreos } = useMonitoringContext();

  const handleAttachmentChange = (e) => {
    handleAttachmentUpload(e, selectedLote.id, logAudit);
  };

  return (
    <>
      {/* Submenu Layout Header */}
      <div className="section-header" style={{ borderBottom: 'none', paddingBottom: '0px' }}>
        <div className="section-title-box">
          <h2 style={{ fontSize: '22px', fontWeight: '700' }}>Manejo Sanitario</h2>
          <p className="section-desc">Gestión integrada de lotes, aplicaciones, monitoreos y evaluaciones</p>
        </div>

        <div className="section-actions" style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" onClick={() => setIsLoteDrawerOpen(true)} style={{ backgroundColor: 'var(--primary)' }}>
            <Plus size={16} />
            <span>Nuevo Lote</span>
          </button>
        </div>
      </div>

      {/* Render active subview */}
      {activeSubView === 'lotes' && <DashboardView />}
      {activeSubView === 'aplicaciones' && <ApplicationsView setSubTab={setSubTab} />}
      {activeSubView === 'monitoreos' && <MonitoringView />}
      {activeSubView === 'cosecha_plan' && <HarvestView />}
      {activeSubView === 'costos_san' && <CostsView />}
      {activeSubView === 'historial_traz' && <HistoryView />}
      {activeSubView === 'reportes_san' && <ReportsView />}

      {/* Forms Drawers */}
      {isLoteDrawerOpen && <LotForm />}
      {isAppDrawerOpen && <ApplicationForm />}
      {isMonDrawerOpen && <MonitoringForm />}
      {isCosechaDrawerOpen && <CosechaForm />}
      {isCostoDrawerOpen && <CostoForm />}
      {isTrabajadorDrawerOpen && <WorkerForm />}

      {/* Technical File Modal (Ficha Completa) */}
      {isFichaModalOpen && selectedLote && (
        <div className="drawer-backdrop" style={{ justifyContent: 'center', alignItems: 'center', zIndex: '9999' }} onClick={() => setIsFichaModalOpen(false)}>
          <div className="glass-card" style={{ width: '700px', maxWidth: '95%', height: '80%', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)', animation: 'fadeIn 0.2s ease-out', padding: '0px' }} onClick={e => e.stopPropagation()}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={20} style={{ color: 'var(--primary)' }} />
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Expediente Técnico Completo</h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Lote {selectedLote.codigo_interno} - {selectedLote.nombre}</span>
                </div>
              </div>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setIsFichaModalOpen(false)}><X size={18} /></button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '12px', padding: '0 20px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
              <button className={`notion-tab-btn ${modalActiveTab === 'trazabilidad' ? 'active' : ''}`} onClick={() => setModalActiveTab('trazabilidad')}>Trazabilidad Histórica</button>
              <button className={`notion-tab-btn ${modalActiveTab === 'documentos' ? 'active' : ''}`} onClick={() => setModalActiveTab('documentos')}>Documentos y Adjuntos ({selectedLote.adjuntos?.length || 0})</button>
              <button className={`notion-tab-btn ${modalActiveTab === 'auditoria' ? 'active' : ''}`} onClick={() => setModalActiveTab('auditoria')}>Logs de Auditoría</button>
            </div>

            {/* Content */}
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '20px' }}>
              {modalActiveTab === 'trazabilidad' && (
                <div className="activity-timeline" style={{ borderLeftColor: 'var(--primary-border)' }}>
                  <div className="timeline-item siembra">
                    <div className="timeline-header">
                      <span className="timeline-title">Siembra Inicial</span>
                      <span className="timeline-date">{new Date(selectedLote.fecha_siembra).toLocaleDateString('es-ES', { dateStyle: 'long' })}</span>
                    </div>
                    <div className="timeline-body">
                      Registro de germinación iniciado para la variedad <strong>{selectedLote.variedad}</strong> de {selectedLote.cultivo}.
                    </div>
                  </div>

                  {aplicaciones.filter(a => a.lote_id === selectedLote.id).map(a => (
                    <div key={a.id} className="timeline-item aplicacion">
                      <div className="timeline-header">
                        <span className="timeline-title">Aplicación: {a.producto_comercial} ({a.tipo_producto})</span>
                        <span className="timeline-date">{new Date(a.fecha_aplicacion).toLocaleDateString('es-ES', { dateStyle: 'medium' })}</span>
                      </div>
                      <div className="timeline-body">
                        Tratamiento fitosanitario/nutricional aplicado. Producto: {a.producto_comercial}. Dosis: {a.dosis}.
                      </div>
                    </div>
                  ))}

                  {monitoreos.filter(m => m.lote_id === selectedLote.id).map(m => (
                    <div key={m.id} className="timeline-item monitoreo">
                      <div className="timeline-header">
                        <span className="timeline-title">Monitoreo Fitosanitario</span>
                        <span className="timeline-date">{new Date(m.fecha_monitoreo).toLocaleDateString('es-ES', { dateStyle: 'medium' })}</span>
                      </div>
                      <div className="timeline-body">
                        Incidencia: {m.incidencia_pct}% | Severidad: {m.severidad_pct}%. Plagas: {m.plagas_detectadas || 'Ninguna'}. Enfermedades: {m.enfermedades_detectadas || 'Ninguna'}.
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {modalActiveTab === 'documentos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ border: '2px dashed var(--border-color)', borderRadius: '8px', padding: '16px', textAlign: 'center', background: 'rgba(255,255,255,0.005)' }}>
                    <UploadCloud size={24} style={{ color: 'var(--primary)', margin: '0 auto 6px auto' }} />
                    <span style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>Adjuntar Recetas ICA, PDFs o Informes del Lote</span>
                    <input type="file" onChange={handleAttachmentChange} style={{ fontSize: '11px', margin: '0 auto' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedLote.adjuntos && selectedLote.adjuntos.length > 0 ? (
                      selectedLote.adjuntos.map((file, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-card)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={16} style={{ color: 'var(--primary)' }} />
                            <div>
                              <span style={{ fontWeight: '600', display: 'block' }}>{file.name}</span>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{file.size} | Subido: {file.date}</span>
                            </div>
                          </div>
                          <button className="btn btn-secondary" style={{ padding: '4px' }} onClick={() => alert('Simulación: Descargando archivo ' + file.name)}><Download size={12} /></button>
                        </div>
                      ))
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>Sin documentos o adjuntos.</span>
                    )}
                  </div>
                </div>
              )}

              {modalActiveTab === 'auditoria' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {auditorias.filter(a => a.lote_codigo === selectedLote.codigo_interno).length > 0 ? (
                    auditorias.filter(a => a.lote_codigo === selectedLote.codigo_interno).map(aud => (
                      <div key={aud.id} style={{ fontSize: '11.5px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          <span>{aud.usuario}</span>
                          <span>{new Date(aud.fecha).toLocaleString()}</span>
                        </div>
                        <div><strong>Acción:</strong> {aud.accion}</div>
                      </div>
                    ))
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>Sin logs de auditoría para este lote.</span>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', padding: '16px 20px' }}>
              <button className="btn btn-secondary" onClick={() => setIsFichaModalOpen(false)}>Cerrar Expediente</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ManejoSanitarioModule({ subTab, setSubTab }) {
  return (
    <LotsProvider>
      <MonitoringProvider>
        <ApplicationsProvider>
          <ManejoSanitarioContent subTab={subTab} setSubTab={setSubTab} />
        </ApplicationsProvider>
      </MonitoringProvider>
    </LotsProvider>
  );
}
