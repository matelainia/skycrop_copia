import React, { useState, useMemo } from 'react';
import { Eye, ShieldCheck, Clock, Download, Plus, Trash2 } from 'lucide-react';
import { useLotsContext } from '../context/LotsContext';
import { useApplicationsContext } from '../context/ApplicationsContext';
import { useMonitoringContext } from '../context/MonitoringContext';
import { calculateAgeInDays } from '../utils/date.utils';
import { exportCSV } from '../utils/export.utils';

export default function LedgerPanel() {
  const {
    lotes,
    selectedLote,
    setSelectedLote,
    setIsFichaModalOpen,
    setIsMonDrawerOpen,
    setIsAppDrawerOpen,
    setIsCostoDrawerOpen,
    setIsTrabajadorDrawerOpen,
    auditorias
  } = useLotsContext();

  const { aplicaciones, setAplicaciones, cosechas, setCosechas } = useApplicationsContext();
  const { monitoreos, setMonitoreos, costos, setCostos, trabajadores, setTrabajadores } = useMonitoringContext();

  const [activeTableTab, setActiveTableTab] = useState('Lotes');
  const [tableSearch, setTableSearch] = useState('');

  const filteredLotesTable = useMemo(() => {
    const term = tableSearch.toLowerCase().trim();
    if (!term) return lotes;
    return lotes.filter(l =>
      l.nombre.toLowerCase().includes(term) ||
      l.codigo_interno.toLowerCase().includes(term) ||
      l.cultivo.toLowerCase().includes(term)
    );
  }, [lotes, tableSearch]);

  const handleExport = () => {
    exportCSV({
      type: activeTableTab.toLowerCase(),
      lotes,
      aplicaciones,
      monitoreos,
      cosechas,
      costos,
      trabajadores,
      auditorias
    });
  };

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['Lotes', 'Aplicaciones', 'Monitoreos', 'Cosechas', 'Costos', 'Trabajadores'].map(tab => (
            <button
              key={tab}
              className={`notion-tab-btn ${activeTableTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTableTab(tab)}
              style={{ fontSize: '13px', padding: '6px 4px' }}
            >
              {tab}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            type="text"
            className="input-glass"
            placeholder="Buscar..."
            style={{ padding: '4px 10px', fontSize: '12px', width: '130px' }}
            value={tableSearch}
            onChange={e => setTableSearch(e.target.value)}
          />

          {activeTableTab === 'Costos' && (
            <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setIsCostoDrawerOpen(true)}>
              <Plus size={12} /><span>Agregar Costo</span>
            </button>
          )}
          {activeTableTab === 'Trabajadores' && (
            <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setIsTrabajadorDrawerOpen(true)}>
              <Plus size={12} /><span>Ingresar Operario</span>
            </button>
          )}
          <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={handleExport}>
            <Download size={12} /><span>Exportar</span>
          </button>
        </div>
      </div>

      <div className="table-container" style={{ maxHeight: '280px', overflowY: 'auto' }}>
        {activeTableTab === 'Lotes' && (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Cultivo</th>
                <th>Área (ha)</th>
                <th>Fecha Siembra</th>
                <th>Edad (Días)</th>
                <th>Estado Sanitario</th>
                <th>NDVI</th>
                <th>Sparkline</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredLotesTable.map(l => (
                <tr key={l.id} style={{ cursor: 'pointer', background: selectedLote?.id === l.id ? 'var(--primary-light)' : 'transparent' }} onClick={() => setSelectedLote(l)}>
                  <td>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      fontSize: '11px',
                      fontWeight: '700'
                    }}>
                      {l.codigo_interno}
                    </span>
                  </td>
                  <td style={{ fontWeight: '600' }}>{l.cultivo} Híbrido</td>
                  <td>{l.area_ha}</td>
                  <td>{new Date(l.fecha_siembra).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>{calculateAgeInDays(l.fecha_siembra)}d</td>
                  <td>
                    <span className={`badge ${
                      l.estado_sanitario === 'excelente' ? 'badge-green' :
                      l.estado_sanitario === 'bueno' ? 'badge-green' :
                      l.estado_sanitario === 'regular' ? 'badge-yellow' : 'badge-red'
                    }`}>{l.estado_sanitario}</span>
                  </td>
                  <td style={{ fontWeight: '700' }}>{l.ndvi_actual}</td>
                  <td>
                    <div className="sparkline-container">
                      <svg className="sparkline-svg">
                        <polyline
                          fill="none"
                          stroke={l.estado_sanitario === 'bajo' ? 'var(--accent-red)' : 'var(--primary)'}
                          strokeWidth="1.5"
                          points={
                            l.estado_sanitario === 'bajo'
                              ? "0,20 15,22 30,23 45,24 60,25 70,26"
                              : l.estado_sanitario === 'regular'
                                ? "0,15 15,14 30,17 45,18 60,16 70,17"
                                : "0,22 15,18 30,14 45,11 60,8 70,4"
                          }
                        />
                      </svg>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary" style={{ padding: '4px' }} onClick={() => { setSelectedLote(l); setIsFichaModalOpen(true); }}><Eye size={12} /></button>
                      <button className="btn btn-secondary" style={{ padding: '4px' }} onClick={() => { setSelectedLote(l); setIsMonDrawerOpen(true); }}><ShieldCheck size={12} /></button>
                      <button className="btn btn-secondary" style={{ padding: '4px' }} onClick={() => { setSelectedLote(l); setIsAppDrawerOpen(true); }}><Clock size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTableTab === 'Aplicaciones' && (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Producto / Ingrediente</th>
                <th>Dosis / Vol</th>
                <th>Operario / Equipo</th>
                <th>Fecha</th>
                <th>Costo</th>
                <th>PC</th>
                <th style={{ textAlign: 'right' }}>Eliminar</th>
              </tr>
            </thead>
            <tbody>
              {aplicaciones.map(a => {
                const targetL = lotes.find(l => l.id === a.lote_id);
                return (
                  <tr key={a.id}>
                    <td><strong>{targetL?.codigo_interno || 'N/A'}</strong></td>
                    <td>{a.producto_comercial} ({a.ingrediente_activo || '—'})</td>
                    <td>{a.dosis} / {a.volumen_aplicado || '—'} {a.unidad_medida || 'L'}</td>
                    <td>{a.operario_responsable} / {a.maquinaria_utilizada || 'Manual'}</td>
                    <td>{new Date(a.fecha_aplicacion).toLocaleDateString()}</td>
                    <td style={{ fontWeight: '700' }}>${a.costo_aplicacion.toLocaleString()}</td>
                    <td><span className={`badge ${a.periodo_carencia_dias > 0 ? 'badge-red' : 'badge-green'}`}>{a.periodo_carencia_dias}d</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-danger" style={{ padding: '4px' }} onClick={() => {
                        if (window.confirm('¿Eliminar aplicación?')) setAplicaciones(prev => prev.filter(p => p.id !== a.id));
                      }}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {activeTableTab === 'Monitoreos' && (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Responsable</th>
                <th>Fecha</th>
                <th>Incidencia</th>
                <th>Severidad</th>
                <th>Humedad / Temp</th>
                <th>Enfermedades / Plagas</th>
                <th style={{ textAlign: 'right' }}>Eliminar</th>
              </tr>
            </thead>
            <tbody>
              {monitoreos.map(m => {
                const targetL = lotes.find(l => l.id === m.lote_id);
                return (
                  <tr key={m.id}>
                    <td><strong>{targetL?.codigo_interno || 'N/A'}</strong></td>
                    <td>{m.responsable}</td>
                    <td>{new Date(m.fecha_monitoreo).toLocaleDateString()}</td>
                    <td style={{ color: 'var(--accent-red)', fontWeight: '700' }}>{m.incidencia_pct}%</td>
                    <td style={{ color: 'var(--accent-gold)', fontWeight: '700' }}>{m.severidad_pct}%</td>
                    <td>{m.humedad_pct}% / {m.temperatura_c}°C</td>
                    <td>{m.enfermedades_detectadas || '—'} / {m.plagas_detectadas || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-danger" style={{ padding: '4px' }} onClick={() => setMonitoreos(prev => prev.filter(p => p.id !== m.id))}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {activeTableTab === 'Cosechas' && (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Fecha Programada</th>
                <th>Área (ha)</th>
                <th>Producción Est (kg)</th>
                <th>Estado Carencia</th>
                <th style={{ textAlign: 'right' }}>Eliminar</th>
              </tr>
            </thead>
            <tbody>
              {cosechas.map(c => {
                const targetL = lotes.find(l => l.id === c.lote_id);
                return (
                  <tr key={c.id}>
                    <td><strong>{targetL?.codigo_interno || 'N/A'}</strong></td>
                    <td>{c.fecha_programada}</td>
                    <td>{c.area_programada_ha} ha</td>
                    <td style={{ fontWeight: '700' }}>{c.produccion_estimada_kg.toLocaleString()} kg</td>
                    <td>
                      <span className={`badge ${c.estado_carencia?.toLowerCase().includes('carencia') ? 'badge-red' : 'badge-green'}`}>
                        {c.estado_carencia || 'Sin restricciones'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-danger" style={{ padding: '4px' }} onClick={() => setCosechas(prev => prev.filter(p => p.id !== c.id))}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {activeTableTab === 'Costos' && (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Categoría</th>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Costo (COP)</th>
                <th>Responsable</th>
                <th style={{ textAlign: 'right' }}>Eliminar</th>
              </tr>
            </thead>
            <tbody>
              {costos.map(cost => {
                const targetL = lotes.find(l => l.id === cost.lote_id);
                return (
                  <tr key={cost.id}>
                    <td><strong>{targetL?.codigo_interno || 'N/A'}</strong></td>
                    <td>{cost.categoria}</td>
                    <td>{cost.fecha}</td>
                    <td>{cost.descripcion}</td>
                    <td style={{ fontWeight: '700' }}>${cost.costo.toLocaleString()}</td>
                    <td>{cost.responsable}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-danger" style={{ padding: '4px' }} onClick={() => setCostos(prev => prev.filter(p => p.id !== cost.id))}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {activeTableTab === 'Trabajadores' && (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Nombre</th>
                <th>Fecha Ingreso</th>
                <th>Labor Realizada</th>
                <th>Permanencia (h)</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Eliminar</th>
              </tr>
            </thead>
            <tbody>
              {trabajadores.map(t => {
                const targetL = lotes.find(l => l.id === t.lote_id);
                return (
                  <tr key={t.id}>
                    <td><strong>{targetL?.codigo_interno || 'N/A'}</strong></td>
                    <td>{t.nombre}</td>
                    <td>{new Date(t.fecha_ingreso).toLocaleString()}</td>
                    <td>{t.actividad_realizada}</td>
                    <td style={{ fontWeight: '600' }}>{t.tiempo_permanencia_horas} hrs</td>
                    <td><span className={`badge ${t.estado === 'activo' ? 'badge-yellow' : 'badge-green'}`}>{t.estado}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-danger" style={{ padding: '4px' }} onClick={() => setTrabajadores(prev => prev.filter(p => p.id !== t.id))}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
