import React, { useState } from 'react';
import { Download, FileSpreadsheet, Plus, ShieldCheck, Loader2, CheckCircle, AlertTriangle, Trash2 } from 'lucide-react';
import PlanificadorAplicaciones from '../PlanificadorAplicaciones';
import EstadoChipDropdown from '../ui/EstadoChipDropdown';
import { useLotsContext } from '../../context/LotsContext';
import { useApplicationsContext } from '../../context/ApplicationsContext';
import { exportAplicaciones } from '../../utils/export.utils';
import { ESTADOS_APLICACION, ESTADOS_UI_CONFIG, TRANSICIONES_VALIDAS, TABS_APLICACIONES, normalizarEstado } from '../../../../constants/aplicaciones';

export default function ApplicationsView({ setSubTab }) {
  const { lotes } = useLotsContext();
  const {
    aplicaciones,
    setAplicaciones,
    aplicacionesLoading,
    aplicacionesMode,
    activeAplicacionesTab,
    confirmEjecutadaModal,
    setConfirmEjecutadaModal,
    setAplicacionesMode,
    setActiveAplicacionesTab,
    savePlanificador,
    changeEstadoAplicacion,
    aplicarCambioEstado,
    reintentarSync,
    getLoteCarenciaStatus
  } = useApplicationsContext();

  const [planificadorPreLoteId, setPlanificadorPreLoteId] = useState('');

  if (aplicacionesMode === 'new') {
    return (
      <PlanificadorAplicaciones
        lotes={lotes}
        preselectedLoteId={planificadorPreLoteId}
        onSave={(appData) => savePlanificador(appData, setSubTab)}
        onCancel={() => setAplicacionesMode('list')}
      />
    );
  }

  const tabDef = TABS_APLICACIONES.find(t => t.key === activeAplicacionesTab);
  const listaFiltrada = tabDef?.estados
    ? aplicaciones.filter(a => tabDef.estados.includes(normalizarEstado(a.estado_programacion)))
    : aplicaciones;

  const handleConfirmClose = () => {
    setConfirmEjecutadaModal({ open: false, app: null });
  };

  const handleConfirmEjecucion = (app) => {
    setConfirmEjecutadaModal({ open: false, app: null });
    aplicarCambioEstado(app, ESTADOS_APLICACION.EJECUTADA);
  };

  const handleDelete = (id) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar esta aplicación?")) {
      setAplicaciones(prev => prev.filter(p => p.id !== id));
    }
  };

  return (
    <>
      <div className="sanitary-layout-grid">
        <div className="glass-card">
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 3px' }}>Registro de Aplicaciones</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                {aplicaciones.length} aplicaciones registradas
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                onClick={() => exportAplicaciones('csv', listaFiltrada, lotes)}
                className="btn btn-secondary" 
                style={{ padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Download size={13} /><span>CSV</span>
              </button>
              <button 
                onClick={() => exportAplicaciones('excel', listaFiltrada, lotes)}
                className="btn btn-secondary" 
                style={{ padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <FileSpreadsheet size={13} /><span>Excel</span>
              </button>
              <button
                onClick={() => { setPlanificadorPreLoteId(''); setAplicacionesMode('new'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  background: '#16a34a', color: 'white', border: 'none',
                  borderRadius: '8px', padding: '9px 18px', fontSize: '13px',
                  fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 2px 10px rgba(22,163,74,0.35)', transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#15803d'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#16a34a'; e.currentTarget.style.transform = 'none'; }}
              >
                <Plus size={15} /> + Nuevo Registro
              </button>
            </div>
          </div>

          {/* Pestañas */}
          <div style={{ display: 'flex', gap: '0px', borderBottom: '2px solid var(--border-color)', marginBottom: '20px', marginTop: '16px' }}>
            {TABS_APLICACIONES.map(tab => {
              const count = tab.estados
                ? aplicaciones.filter(a => tab.estados.includes(normalizarEstado(a.estado_programacion))).length
                : aplicaciones.length;
              const isActive = activeAplicacionesTab === tab.key;
              return (
                <button 
                  key={tab.key}
                  onClick={() => setActiveAplicacionesTab(tab.key)}
                  style={{
                    padding: '10px 18px', border: 'none', background: 'transparent',
                    borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                    marginBottom: '-2px',
                    color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                    fontWeight: isActive ? '700' : '400',
                    cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: '7px',
                    transition: 'all 0.15s'
                  }}
                >
                  {tab.label}
                  <span style={{
                    background: isActive ? 'var(--primary)' : 'rgba(107,114,128,0.15)',
                    color: isActive ? 'white' : 'var(--text-muted)',
                    borderRadius: '50px', padding: '1px 8px', fontSize: '11px', fontWeight: '700'
                  }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Contenido de la pestaña */}
          {aplicacionesLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '48px', color: 'var(--text-muted)' }}>
              <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
              <span style={{ fontSize: '14px' }}>Cargando aplicaciones...</span>
            </div>
          ) : listaFiltrada.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', color: 'var(--text-muted)', gap: '12px', textAlign: 'center' }}>
              <ShieldCheck size={32} style={{ opacity: 0.25 }} />
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>Sin aplicaciones en esta sección</p>
              {activeAplicacionesTab === 'activas' && (
                <>
                  <p style={{ margin: 0, fontSize: '12.5px' }}>Usa el botón <strong>+ Nuevo Registro</strong> para planificar tu primera aplicación fitosanitaria.</p>
                  <button
                    onClick={() => { setPlanificadorPreLoteId(''); setAplicacionesMode('new'); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '8px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 10px rgba(22,163,74,0.35)' }}
                  >
                    <Plus size={15} /> Planificar primera aplicación
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th>Código</th>
                    <th>Lote</th>
                    <th>Tipo Aplicación</th>
                    <th>Producto</th>
                    <th>Dosis</th>
                    <th>Método / Operario</th>
                    <th>Fecha</th>
                    {activeAplicacionesTab !== 'activas' && <th>F. Ejecución</th>}
                    <th>Carencia</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {listaFiltrada.map(a => {
                    const estadoKey = normalizarEstado(a.estado_programacion);
                    const estadoCfg = ESTADOS_UI_CONFIG[estadoKey] || { bg: '#9ca3af', color: '#ffffff', label: estadoKey, emoji: 'ℹ️', border: '#78716c' };
                    const esFinal = (TRANSICIONES_VALIDAS[estadoKey] || []).length === 0;
                    const targetL = lotes.find(l => l.id === a.lote_id);
                    const carencia = getLoteCarenciaStatus(a.lote_id);
                    const permitidos = TRANSICIONES_VALIDAS[estadoKey] || [];
                    const codigoApl = a.codigo_apl || ('APL-' + String(a.id || '').slice(-6).toUpperCase());

                    return (
                      <tr key={a.id}>
                        <td style={{ minWidth: '155px' }}>
                          {a._syncing ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)', padding: '3px 8px', background: 'rgba(107,114,128,0.08)', borderRadius: '50px', border: '1px solid var(--border-color)' }}>
                              <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Sincronizando...
                            </span>
                          ) : a._sync_error ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                              <span style={{ padding: '3px 8px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderRadius: '50px', border: '1px solid rgba(245,158,11,0.3)', fontWeight: '600' }}>⚠ Pendiente</span>
                              <button onClick={() => reintentarSync(a)} title="Reintentar sincronización"
                                style={{ fontSize: '10px', padding: '2px 7px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', cursor: 'pointer', color: '#f59e0b', fontFamily: 'inherit' }}>
                                Reintentar
                              </button>
                            </span>
                          ) : esFinal ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              fontSize: '11.5px', fontWeight: '600', padding: '4px 11px', borderRadius: '50px',
                              background: estadoCfg.bg, color: estadoCfg.color, border: `1px solid ${estadoCfg.border}`
                            }}>
                              {estadoCfg.emoji} {estadoCfg.label}
                            </span>
                          ) : (
                            <EstadoChipDropdown
                              estadoKey={estadoKey}
                              estadoCfg={estadoCfg}
                              permitidos={permitidos}
                              onSelect={(nuevoEstado) => changeEstadoAplicacion(a, nuevoEstado)}
                            />
                          )}
                        </td>
                        <td>
                          <code style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)', background: 'rgba(34,197,94,0.07)', padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(34,197,94,0.15)' }}>
                            {codigoApl}
                          </code>
                        </td>
                        <td>
                          <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '13px' }}>
                            {targetL?.codigo_interno || 'N/A'}
                          </span>
                          {targetL?.cultivo && <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-muted)' }}>{targetL.cultivo}</span>}
                        </td>
                        <td style={{ fontSize: '12px' }}>{a.tipo_aplicacion}<br /><span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{a.tipo_producto}</span></td>
                        <td><strong style={{ fontSize: '12.5px' }}>{a.producto_comercial}</strong>{a.ingrediente_activo && <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-muted)' }}>{a.ingrediente_activo}</span>}</td>
                        <td style={{ fontSize: '12.5px' }}>{a.dosis}</td>
                        <td style={{ fontSize: '12px' }}>
                          {a.metodo_aplicacion}
                          {a.operario_responsable && <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>{a.operario_responsable}</span>}
                        </td>
                        <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {a.fecha_aplicacion ? new Date(a.fecha_aplicacion).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        {activeAplicacionesTab !== 'activas' && (
                          <td style={{ fontSize: '12px', whiteSpace: 'nowrap', color: estadoKey === 'ejecutada' ? '#22c55e' : 'var(--text-muted)' }}>
                            {a.fecha_ejecucion ? new Date(a.fecha_ejecucion).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                        )}
                        <td>
                          {carencia.isRestricted ? (
                            <span className="badge badge-red" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                              Bajo Carencia ({carencia.daysRemaining}d)
                            </span>
                          ) : (
                            <span className="badge badge-green" style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.25)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                              Habilitado
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {!esFinal && (
                            <button className="btn btn-danger" style={{ padding: '6px' }}
                              onClick={() => handleDelete(a.id)}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Confirmar Ejecución */}
      {confirmEjecutadaModal.open && confirmEjecutadaModal.app && (() => {
        const app = confirmEjecutadaModal.app;
        const loteObj = lotes.find(l => l.id === app.lote_id);
        const codigoApl = app.codigo_apl || ('APL-' + String(app.id || '').slice(-6).toUpperCase());
        return (
          <div 
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
            }}
            onClick={handleConfirmClose}
          >
            <div 
              style={{
                background: 'var(--bg-card)', borderRadius: '16px',
                border: '1px solid var(--border-color)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                width: '100%', maxWidth: '520px', overflow: 'hidden'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CheckCircle size={18} style={{ color: '#22c55e' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Confirmar Ejecución de Aplicación</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Este es un estado final. No podrá modificarse.</p>
                </div>
              </div>

              <div style={{ padding: '20px 24px' }}>
                <div style={{ background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                    {[
                      ['Código', codigoApl],
                      ['Lote', loteObj?.codigo_interno || 'N/A'],
                      ['Cultivo', loteObj?.cultivo || '—'],
                      ['Producto', app.producto_comercial || '—'],
                      ['Operario', app.operario_responsable || '—'],
                      ['Área (ha)', loteObj?.area_ha ? `${loteObj.area_ha} ha` : '—'],
                      ['Fecha programada', app.fecha_aplicacion ? new Date(app.fecha_aplicacion).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'],
                      ['Dosis', app.dosis || '—'],
                      ['Volumen', app.volumen_aplicado ? `${app.volumen_aplicado} L/ha` : '—'],
                      ['Método', app.metodo_aplicacion || '—'],
                      ['Carencia', app.periodo_carencia_dias ? `${app.periodo_carencia_dias} días` : '—'],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <span style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</span>
                        <div style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-primary)', marginTop: '2px' }}>{val}</div>
                      </div>
                    ))}
                    {app.observaciones && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Observaciones</span>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{app.observaciones}</div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <AlertTriangle size={14} style={{ color: '#22c55e', marginTop: '1px', flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    El registro pasará al <strong>Historial y Trazabilidad</strong> de forma permanente y se registrará la fecha real de ejecución.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleConfirmClose}
                    style={{ flex: 1, padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleConfirmEjecucion(app)}
                    style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', background: '#16a34a', color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', boxShadow: '0 2px 12px rgba(22,163,74,0.4)', transition: 'all 0.15s' }}
                  >
                    <CheckCircle size={14} /> Confirmar Ejecución
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
