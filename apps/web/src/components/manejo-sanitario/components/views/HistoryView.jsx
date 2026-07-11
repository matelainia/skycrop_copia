import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Search, XCircle, Loader2, History } from 'lucide-react';
import { useLotsContext } from '../../context/LotsContext';
import { useApplicationsContext } from '../../context/ApplicationsContext';
import { exportAplicaciones } from '../../utils/export.utils';
import { ESTADOS_APLICACION, ESTADOS_UI_CONFIG, normalizarEstado } from '../../../../constants/aplicaciones';

export default function HistoryView() {
  const { lotes } = useLotsContext();
  const { aplicaciones, aplicacionesLoading } = useApplicationsContext();

  const [historialSearch, setHistorialSearch] = useState('');
  const [historialFiltros, setHistorialFiltros] = useState({
    lote: '', producto: '', operario: '', ingrediente: '', fechaDesde: '', fechaHasta: '', estado: ''
  });

  const historial = aplicaciones.filter(a => {
    const st = normalizarEstado(a.estado_programacion);
    return st === ESTADOS_APLICACION.EJECUTADA || st === ESTADOS_APLICACION.CANCELADA;
  });

  const filtrado = historial.filter(a => {
    const s = historialSearch.toLowerCase();
    const prod = (a.producto_comercial || '').toLowerCase();
    const ing = (a.ingrediente_activo || '').toLowerCase();
    const oper = (a.operario_responsable || '').toLowerCase();
    const code = (a.codigo_apl || '').toLowerCase();
    
    if (s && !prod.includes(s) && !ing.includes(s) && !oper.includes(s) && !code.includes(s)) {
      return false;
    }
    
    if (historialFiltros.lote && a.lote_id !== historialFiltros.lote) return false;
    if (historialFiltros.estado && normalizarEstado(a.estado_programacion) !== historialFiltros.estado) return false;
    if (historialFiltros.fechaDesde && a.fecha_aplicacion) {
      if (new Date(a.fecha_aplicacion) < new Date(historialFiltros.fechaDesde)) return false;
    }
    if (historialFiltros.fechaHasta && a.fecha_aplicacion) {
      if (new Date(a.fecha_aplicacion) > new Date(historialFiltros.fechaHasta + 'T23:59:59')) return false;
    }
    return true;
  });

  return (
    <div className="sanitary-layout-grid">
      <div className="glass-card">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 3px' }}>Historial y Trazabilidad</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              {filtrado.length} de {historial.length} registros
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => exportAplicaciones('csv', filtrado, lotes)}
              className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Download size={13} /><span>CSV</span>
            </button>
            <button onClick={() => exportAplicaciones('excel', filtrado, lotes)}
              className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <FileSpreadsheet size={13} /><span>Excel</span>
            </button>
            <button onClick={() => exportAplicaciones('pdf', filtrado, lotes)}
              className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <FileText size={13} /><span>PDF</span>
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', padding: '14px', background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '160px' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="text" placeholder="Buscar producto, lote, operario..."
              value={historialSearch}
              onChange={e => setHistorialSearch(e.target.value)}
              style={{ width: '100%', paddingLeft: '30px', padding: '7px 10px 7px 30px', fontSize: '12.5px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '7px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
          <select value={historialFiltros.lote} onChange={e => setHistorialFiltros(p => ({ ...p, lote: e.target.value }))}
            style={{ padding: '7px 10px', fontSize: '12.5px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '7px', color: 'var(--text-primary)', fontFamily: 'inherit', flex: '0 1 160px' }}>
            <option value="">Todos los lotes</option>
            {lotes.map(l => <option key={l.id} value={l.id}>{l.codigo_interno} — {l.cultivo}</option>)}
          </select>
          <select value={historialFiltros.estado} onChange={e => setHistorialFiltros(p => ({ ...p, estado: e.target.value }))}
            style={{ padding: '7px 10px', fontSize: '12.5px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '7px', color: 'var(--text-primary)', fontFamily: 'inherit', flex: '0 1 160px' }}>
            <option value="">Todos los estados</option>
            <option value={ESTADOS_APLICACION.EJECUTADA}>✅ Ejecutadas</option>
            <option value={ESTADOS_APLICACION.CANCELADA}>❌ Canceladas</option>
          </select>
          <input type="date" value={historialFiltros.fechaDesde} onChange={e => setHistorialFiltros(p => ({ ...p, fechaDesde: e.target.value }))}
            placeholder="Desde"
            style={{ padding: '7px 10px', fontSize: '12.5px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '7px', color: 'var(--text-primary)', fontFamily: 'inherit', flex: '0 1 140px' }}
          />
          <input type="date" value={historialFiltros.fechaHasta} onChange={e => setHistorialFiltros(p => ({ ...p, fechaHasta: e.target.value }))}
            placeholder="Hasta"
            style={{ padding: '7px 10px', fontSize: '12.5px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '7px', color: 'var(--text-primary)', fontFamily: 'inherit', flex: '0 1 140px' }}
          />
          {(historialSearch || historialFiltros.lote || historialFiltros.estado || historialFiltros.fechaDesde || historialFiltros.fechaHasta) && (
            <button onClick={() => { setHistorialSearch(''); setHistorialFiltros({ lote: '', producto: '', operario: '', ingrediente: '', fechaDesde: '', fechaHasta: '', estado: '' }); }}
              style={{ padding: '7px 12px', fontSize: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '7px', color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <XCircle size={12} /> Limpiar
            </button>
          )}
        </div>

        {/* Tabla de historial */}
        {aplicacionesLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '48px', color: 'var(--text-muted)' }}>
            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
            <span style={{ fontSize: '14px' }}>Cargando historial...</span>
          </div>
        ) : filtrado.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px', color: 'var(--text-muted)', gap: '10px', textAlign: 'center' }}>
            <History size={32} style={{ opacity: 0.25 }} />
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>Sin registros en el historial</p>
            <p style={{ margin: 0, fontSize: '12.5px' }}>Las aplicaciones ejecutadas y canceladas aparecerán aquí.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Código</th>
                  <th>Lote / Cultivo</th>
                  <th>F. Programada</th>
                  <th>F. Ejecución</th>
                  <th>Producto</th>
                  <th>Ingrediente Activo</th>
                  <th>Dosis</th>
                  <th>Vol. (L/ha)</th>
                  <th>Método</th>
                  <th>Operario</th>
                  <th>Maquinaria</th>
                  <th>Carencia (d)</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrado.map(a => {
                  const estadoKey = normalizarEstado(a.estado_programacion);
                  const estadoCfg = ESTADOS_UI_CONFIG[estadoKey] || { bg: '#9ca3af', color: '#ffffff', label: estadoKey, emoji: 'ℹ️', border: '#78716c' };
                  const loteObj = lotes.find(l => l.id === a.lote_id);
                  const codigoApl = a.codigo_apl || ('APL-' + String(a.id || '').slice(-6).toUpperCase());
                  return (
                    <tr key={a.id}>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          fontSize: '11.5px', fontWeight: '600', padding: '4px 11px', borderRadius: '50px',
                          background: estadoCfg.bg, color: estadoCfg.color, border: `1px solid ${estadoCfg.border}`
                        }}>
                          {estadoCfg.emoji} {estadoCfg.label}
                        </span>
                      </td>
                      <td><code style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)', background: 'rgba(34,197,94,0.07)', padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(34,197,94,0.15)' }}>{codigoApl}</code></td>
                      <td>
                        <span style={{ fontWeight: '700', color: 'var(--primary)' }}>{loteObj?.codigo_interno || 'N/A'}</span>
                        {loteObj?.cultivo && <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>{loteObj.cultivo}</span>}
                      </td>
                      <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{a.fecha_aplicacion ? new Date(a.fecha_aplicacion).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                      <td style={{ fontSize: '12px', whiteSpace: 'nowrap', color: estadoKey === 'ejecutada' ? '#22c55e' : 'var(--text-muted)' }}>
                        {a.fecha_ejecucion ? new Date(a.fecha_ejecucion).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td><strong style={{ fontSize: '12.5px' }}>{a.producto_comercial}</strong></td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{a.ingrediente_activo || '—'}</td>
                      <td style={{ fontSize: '12.5px' }}>{a.dosis || '—'}</td>
                      <td style={{ fontSize: '12px' }}>{a.volumen_aplicado || '—'}</td>
                      <td style={{ fontSize: '12px' }}>{a.metodo_aplicacion || '—'}</td>
                      <td style={{ fontSize: '12px' }}>{a.operario_responsable || '—'}</td>
                      <td style={{ fontSize: '12px' }}>{a.maquinaria_utilizada || '—'}</td>
                      <td style={{ fontSize: '12px' }}>{a.periodo_carencia_dias != null ? `${a.periodo_carencia_dias}d` : '—'}</td>
                      <td style={{ fontSize: '11.5px', color: 'var(--text-muted)', maxWidth: '180px' }}>{a.observaciones || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
