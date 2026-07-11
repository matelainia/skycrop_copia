import React, { useState } from 'react';
import { Eye, ShieldCheck, Clock, Download, Plus, Trash2, X, AlertTriangle, Info, MapPin, Activity, FileText, UploadCloud, ChevronRight, Thermometer, Droplets, Wind, CloudRain, RefreshCw } from 'lucide-react';
import { useLotsContext } from '../../context/LotsContext';
import { useApplicationsContext } from '../../context/ApplicationsContext';
import { useGoogleEarthEngine } from '../../hooks/useGoogleEarthEngine';
import { calculateAgeInDays, formatDuration } from '../../utils/date.utils';
import { generateMockHistogramAndStats, getHistoricalIndexPoints } from '../../utils/mock.utils';
import LedgerPanel from '../LedgerPanel';
import LeafletMap from '../LeafletMap';


export default function DashboardView() {
  const {
    lotes,
    setLotes,
    selectedLote,
    setSelectedLote,
    setIsFichaModalOpen,
    setIsMonDrawerOpen,
    setIsAppDrawerOpen,
    setIsCosechaDrawerOpen,
    setIsCostoDrawerOpen,
    setIsTrabajadorDrawerOpen,
    weatherStation,
    activeOperations,
    operationTime,
    handleDeleteLote,
    handleAttachmentUpload,
    logAudit,
    auditorias
  } = useLotsContext();

  const {
    finishActiveOperation,
    setNewCosecha,
    getLoteCarenciaStatus
  } = useApplicationsContext();

  // Local dashboard views states
  const [mapLayer, setMapLayer] = useState('satelite');
  const [showMapFilters, setShowMapFilters] = useState(false);
  const [loteFilterCultivo, setLoteFilterCultivo] = useState('Todos');
  const [loteFilterEstado, setLoteFilterEstado] = useState('Todos');

  // GEE Telemetry hook
  const {
    geeLoading,
    geeWarning,
    geeData,
    histogramIndex,
    isEvolutionModalOpen,
    hoveredBar,
    setHistogramIndex,
    setIsEvolutionModalOpen,
    setHoveredBar,
    setGeeWarning
  } = useGoogleEarthEngine(selectedLote);

  const isDriftHigh = weatherStation.wind > 15;
  const isWashHigh = weatherStation.rain > 70;

  const handleFinishCurrentOperation = () => {
    finishActiveOperation(selectedLote.id);
  };

  const handleAttachmentChange = (e) => {
    handleAttachmentUpload(e, selectedLote.id, logAudit);
  };

  const handleDelete = () => {
    handleDeleteLote(selectedLote.id, logAudit);
  };

  return (
    <>
      <div className="sanitary-master-grid">
        {/* Left Column Layout */}
        <div className="sanitary-left-column">
          {/* Map details grid */}
          <div className="map-details-grid">
            {/* GIS Map Container Card */}
            <div className="glass-card" style={{ padding: '0px', height: '550px', position: 'relative' }}>
              {/* Advanced GIS layer selector */}
              <div className="map-layer-selector" style={{ top: '12px', right: '12px', display: 'flex', gap: '4px', alignItems: 'center', background: 'rgba(255,255,255,0.95)', padding: '4px', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 1000 }}>
                {['callejero', 'satelite', 'ndvi'].map(layer => (
                  <button
                    key={layer}
                    className={`map-layer-btn ${mapLayer === layer ? 'active' : ''}`}
                    onClick={() => setMapLayer(layer)}
                    style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px' }}
                  >
                    {layer === 'callejero' ? 'Mapa' : layer === 'satelite' ? 'Satélite' : 'NDVI'}
                  </button>
                ))}
                <select
                  className="input-glass select-glass"
                  style={{ padding: '3px 20px 3px 6px', fontSize: '11px', height: '24px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
                  value={['callejero', 'satelite', 'ndvi'].includes(mapLayer) ? 'otros' : mapLayer}
                  onChange={e => {
                    if (e.target.value !== 'otros') {
                      setMapLayer(e.target.value);
                    }
                  }}
                >
                  <option value="otros">Otros...</option>
                  <option value="ndre">NDRE</option>
                  <option value="savi">SAVI</option>
                  <option value="humedad">Humedad</option>
                  <option value="prod_layer">Productividad</option>
                </select>
              </div>

              {/* Floating filters overlay */}
              {showMapFilters && (
                <div className="map-overlay-filters" style={{ top: '12px', left: '12px', padding: '10px', minWidth: '150px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Filtros GIS</span>
                    <button
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                      onClick={() => setShowMapFilters(false)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>Cultivo</label>
                    <select
                      className="input-glass select-glass"
                      style={{ padding: '3px 18px 3px 6px', fontSize: '11px', background: 'var(--bg-card)' }}
                      value={loteFilterCultivo}
                      onChange={e => setLoteFilterCultivo(e.target.value)}
                    >
                      <option value="Todos">Todos</option>
                      <option value="Maíz">Maíz</option>
                      <option value="Soya">Soya</option>
                      <option value="Girasol">Girasol</option>
                    </select>

                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>Estado Sanitario</label>
                    <select
                      className="input-glass select-glass"
                      style={{ padding: '3px 18px 3px 6px', fontSize: '11px', background: 'var(--bg-card)' }}
                      value={loteFilterEstado}
                      onChange={e => setLoteFilterEstado(e.target.value)}
                    >
                      <option value="Todos">Todos</option>
                      <option value="excelente">Excelente</option>
                      <option value="bueno">Bueno</option>
                      <option value="regular">Regular</option>
                      <option value="bajo">Bajo</option>
                    </select>

                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px', fontSize: '10px', justifyContent: 'center', marginTop: '4px' }}
                      onClick={() => { setLoteFilterCultivo('Todos'); setLoteFilterEstado('Todos'); }}
                    >
                      Limpiar filtros
                    </button>
                  </div>
                </div>
              )}

              <LeafletMap
                lotes={lotes}
                selectedLote={selectedLote}
                setSelectedLote={setSelectedLote}
                mapLayer={mapLayer}
                loteFilterCultivo={loteFilterCultivo}
                loteFilterEstado={loteFilterEstado}
                geeTileUrl={geeData?.tileUrl}
              />

              {geeLoading && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(15, 23, 42, 0.7)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  zIndex: 2000, borderRadius: '8px', color: 'white', gap: '12px'
                }}>
                  <RefreshCw size={32} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'center', padding: '0 20px' }}>Consultando Google Earth Engine en tiempo real...</span>
                </div>
              )}

              {geeWarning && (
                <div style={{
                  position: 'absolute', bottom: '50px', left: '10px', right: '10px',
                  background: 'rgba(251, 191, 36, 0.95)', color: '#78350f',
                  padding: '8px 12px', borderRadius: '6px', zIndex: 2000, fontSize: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderLeft: '4px solid #d97706'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={14} />
                    <span>{geeWarning}</span>
                  </div>
                  <button
                    onClick={() => setGeeWarning(null)}
                    style={{ background: 'transparent', border: 'none', color: '#78350f', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Dynamic Legend */}
              <div className="map-legend-gradient-card" style={{
                position: 'absolute', bottom: '12px', left: '12px',
                background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-color)',
                padding: '10px 14px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                zIndex: 1000, minWidth: '200px', backdropFilter: 'blur(8px)'
              }}>
                <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>
                  Leyenda: {mapLayer.toUpperCase()}
                </span>
                {['ndvi', 'ndre', 'savi'].includes(mapLayer) ? (
                  <div>
                    <div style={{ height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, #ef4444, #f97316, #eab308, #84cc16, #22c55e)', width: '100%' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: 'var(--text-secondary)', marginTop: '5px', fontWeight: '600' }}>
                      <span>0.0 (Crítico)</span>
                      <span>0.5</span>
                      <span>1.0 (Óptimo)</span>
                    </div>
                  </div>
                ) : mapLayer === 'humedad' ? (
                  <div>
                    <div style={{ height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, #ece7f2, #74a9cf, #0570b0)', width: '100%' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: 'var(--text-secondary)', marginTop: '5px', fontWeight: '600' }}>
                      <span>-0.2 (Baja)</span>
                      <span>0.1</span>
                      <span>0.4 (Alta)</span>
                    </div>
                  </div>
                ) : mapLayer === 'prod_layer' ? (
                  <div>
                    <div style={{ height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, #c084fc, #6d28d9)', width: '100%' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: 'var(--text-secondary)', marginTop: '5px', fontWeight: '600' }}>
                      <span>Baja</span>
                      <span>Media</span>
                      <span>Alta</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, #dc2626, #f59e0b, #22c55e, #16a34a)', width: '100%' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: 'var(--text-secondary)', marginTop: '5px', fontWeight: '600' }}>
                      <span>Bajo</span>
                      <span>Regular</span>
                      <span>Bueno</span>
                      <span>Excelente</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Lote Technical Details Card */}
            <div className="glass-card primary-edge" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              {selectedLote ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700' }}>CÓDIGO: {selectedLote.codigo_interno}</span>
                        <h3 style={{ fontSize: '16px', fontWeight: '800' }}>{selectedLote.nombre}</h3>
                      </div>
                      <span className={`badge ${
                        selectedLote.estado_sanitario === 'excelente' ? 'badge-green' :
                        selectedLote.estado_sanitario === 'bueno' ? 'badge-green' :
                        selectedLote.estado_sanitario === 'regular' ? 'badge-yellow' : 'badge-red'
                      }`} style={{ fontSize: '9px', padding: '1px 6px' }}>{selectedLote.estado_sanitario}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: '11px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>Cultivo:</span>
                        <p style={{ fontWeight: '600', margin: '1px 0' }}>{selectedLote.cultivo} ({selectedLote.variedad || '—'})</p>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>Área Total:</span>
                        <p style={{ fontWeight: '600', margin: '1px 0' }}>{selectedLote.area_ha} ha</p>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>Fecha de Siembra:</span>
                        <p style={{ fontWeight: '600', margin: '1px 0' }}>{new Date(selectedLote.fecha_siembra).toLocaleDateString('es-ES', { dateStyle: 'short' })}</p>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>Índice {histogramIndex}:</span>
                        <p style={{ fontWeight: '700', margin: '1px 0', color: selectedLote.ndvi_actual > 0.6 ? 'var(--primary)' : 'var(--accent-gold)' }}>
                          {histogramIndex === 'NDVI' ? selectedLote.ndvi_actual
                            : histogramIndex === 'NDRE' ? (selectedLote.ndre_actual || '0.48')
                            : histogramIndex === 'SAVI' ? (selectedLote.savi_actual || '0.58')
                            : (selectedLote.humedad_actual || '0.15')}
                        </p>
                      </div>
                    </div>

                    {(() => {
                      const charSum = selectedLote.codigo_interno.charCodeAt(0) + (selectedLote.codigo_interno.charCodeAt(1) || 0);
                      const activeIndexValue = histogramIndex === 'NDVI' ? selectedLote.ndvi_actual
                        : histogramIndex === 'NDRE' ? (selectedLote.ndre_actual || 0.48)
                        : histogramIndex === 'SAVI' ? (selectedLote.savi_actual || 0.58)
                        : (selectedLote.humedad_actual || 0.15);

                      const activeGeeData = geeData.index === histogramIndex && geeData.histogram
                        ? geeData
                        : generateMockHistogramAndStats(histogramIndex, charSum, activeIndexValue);

                      const { stats, distribution, histogram } = activeGeeData;
                      const maxCount = Math.max(...histogram.map(b => b.count), 1);

                      return (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                                HISTOGRAMA {histogramIndex}
                              </span>
                              <Info size={11} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} title="Distribución de frecuencia de píxeles espectrales" />
                            </div>

                            <select
                              className="input-glass select-glass"
                              style={{ padding: '1px 18px 1px 4px', fontSize: '10.5px', height: '22px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
                              value={histogramIndex}
                              onChange={e => setHistogramIndex(e.target.value)}
                            >
                              <option value="NDVI">NDVI</option>
                              <option value="NDRE">NDRE</option>
                              <option value="SAVI">SAVI</option>
                              <option value="HUMEDAD">Humedad</option>
                            </select>
                          </div>

                          <div style={{ position: 'relative', marginTop: '6px' }}>
                            <svg viewBox="0 0 400 155" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                              {[0.25, 0.5, 0.75, 1.0].map((ratio, idx) => {
                                const y = 130 - ratio * 120;
                                const label = maxCount >= 1000 ? `${Math.round((ratio * maxCount) / 1000)}k` : Math.round(ratio * maxCount);
                                return (
                                  <g key={idx}>
                                    <line x1="30" y1={y} x2="390" y2={y} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                                    <text x="25" y={y + 3} textAnchor="end" style={{ fontSize: '8px', fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>{label}</text>
                                  </g>
                                );
                              })}

                              {[0.0, 0.2, 0.4, 0.6, 0.8, 1.0].map((val, idx) => {
                                const startVal = histogramIndex === 'HUMEDAD' ? -0.2 : 0.0;
                                const endVal = 1.0;
                                const ratio = (val - startVal) / (endVal - startVal);
                                const x = 30 + ratio * 360;
                                if (x < 30 || x > 390) return null;

                                return (
                                  <g key={idx}>
                                    <line x1={x} y1="130" x2={x} y2="134" stroke="var(--border-color)" strokeWidth="0.5" />
                                    <text x={x} y="145" textAnchor="middle" style={{ fontSize: '8px', fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>{val}</text>
                                  </g>
                                );
                              })}

                              <line x1="30" y1="130" x2="390" y2="130" stroke="var(--border-color)" strokeWidth="1" />
                              <line x1="30" y1="10" x2="30" y2="130" stroke="var(--border-color)" strokeWidth="1" />

                              {histogram.map((bar, bIdx) => {
                                const barWidth = 360 / histogram.length - 1;
                                const x = 30 + bIdx * (360 / histogram.length);
                                const barHeight = (bar.count / maxCount) * 120;
                                const y = 130 - barHeight;

                                let barColor = 'var(--primary)';
                                const val = bar.value;
                                if (histogramIndex === 'HUMEDAD') {
                                  if (val < 0.0) barColor = '#a6bddb';
                                  else if (val < 0.3) barColor = '#3690c0';
                                  else barColor = '#0570b0';
                                } else {
                                  if (val < 0.3) barColor = '#ef4444';
                                  else if (val < 0.5) barColor = '#f97316';
                                  else if (val < 0.7) barColor = '#eab308';
                                  else if (val < 0.85) barColor = '#84cc16';
                                  else barColor = '#22c55e';
                                }

                                return (
                                  <rect
                                    key={bIdx}
                                    x={x}
                                    y={y}
                                    width={Math.max(1, barWidth)}
                                    height={Math.max(1, barHeight)}
                                    fill={barColor}
                                    opacity={hoveredBar && hoveredBar.value === bar.value ? 1 : 0.8}
                                    rx="0.5"
                                    style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                                    onMouseEnter={() => setHoveredBar({ ...bar, x, y, color: barColor })}
                                    onMouseLeave={() => setHoveredBar(null)}
                                  />
                                );
                              })}

                              {(() => {
                                const meanVal = stats.mean;
                                const startVal = histogramIndex === 'HUMEDAD' ? -0.2 : 0.0;
                                const endVal = 1.0;
                                const ratio = (meanVal - startVal) / (endVal - startVal);
                                const x = 30 + ratio * 360;

                                if (x >= 30 && x <= 390) {
                                  return (
                                    <g>
                                      <line x1={x} y1="10" x2={x} y2="130" stroke="#16a34a" strokeWidth="1.5" strokeDasharray="3 3" />
                                      <rect x={x - 35} y="3" width="70" height="14" rx="3" fill="#16a34a" />
                                      <text x={x} y="13" textAnchor="middle" style={{ fontSize: '7.5px', fill: 'white', fontWeight: 'bold', fontFamily: 'var(--font-sans)' }}>
                                        Promedio: {meanVal}
                                      </text>
                                    </g>
                                  );
                                }
                                return null;
                              })()}
                            </svg>

                            {hoveredBar && (
                              <div style={{
                                position: 'absolute',
                                left: `${(hoveredBar.x / 400) * 100}%`,
                                top: `${(hoveredBar.y / 155) * 100 - 35}%`,
                                transform: 'translateX(-50%)',
                                background: 'var(--bg-app)',
                                border: `1px solid ${hoveredBar.color}`,
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '9px',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                                pointerEvents: 'none',
                                zIndex: 10,
                                whiteSpace: 'nowrap'
                              }}>
                                <strong>{histogramIndex}: {hoveredBar.value}</strong><br />
                                Píxeles: {hoveredBar.count.toLocaleString()}
                              </div>
                            )}
                          </div>

                          {/* Stats Grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', marginTop: '10px' }}>
                            <div style={{ padding: '5px 2px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                              <span style={{ fontSize: '7.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>PROMEDIO</span>
                              <strong style={{ fontSize: '10.5px', display: 'block', margin: '1px 0' }}>{stats.mean}</strong>
                              <span style={{ fontSize: '7.5px', color: stats.mean >= 0.7 ? 'var(--primary)' : 'var(--accent-gold)', fontWeight: 'bold' }}>
                                {stats.mean >= 0.75 ? 'Excelente' : stats.mean >= 0.5 ? 'Bueno' : 'Regular'}
                              </span>
                            </div>
                            <div style={{ padding: '5px 2px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                              <span style={{ fontSize: '7.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>MEDIANA</span>
                              <strong style={{ fontSize: '10.5px', display: 'block', margin: '1px 0' }}>{stats.median}</strong>
                              <span style={{ fontSize: '7px', color: 'var(--text-muted)' }}>Punto medio</span>
                            </div>
                            <div style={{ padding: '5px 2px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                              <span style={{ fontSize: '7.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>DESV. EST.</span>
                              <strong style={{ fontSize: '10.5px', display: 'block', margin: '1px 0' }}>{stats.stdDev}</strong>
                              <span style={{ fontSize: '7px', color: 'var(--text-muted)' }}>Dispersión</span>
                            </div>
                            <div style={{ padding: '5px 2px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                              <span style={{ fontSize: '7.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>MÍNIMO</span>
                              <strong style={{ fontSize: '10.5px', display: 'block', margin: '1px 0', color: 'var(--accent-gold)' }}>{stats.min}</strong>
                              <span style={{ fontSize: '7px', color: 'var(--text-muted)' }}>Mínimo</span>
                            </div>
                            <div style={{ padding: '5px 2px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                              <span style={{ fontSize: '7.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>MÁXIMO</span>
                              <strong style={{ fontSize: '10.5px', display: 'block', margin: '1px 0', color: 'var(--primary)' }}>{stats.max}</strong>
                              <span style={{ fontSize: '7px', color: 'var(--text-muted)' }}>Máximo</span>
                            </div>
                            <div style={{ padding: '5px 2px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                              <span style={{ fontSize: '7.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>CV%</span>
                              <strong style={{ fontSize: '10.5px', display: 'block', margin: '1px 0' }}>{stats.cv}%</strong>
                              <span style={{ fontSize: '7.5px', color: stats.cv < 15 ? 'var(--primary)' : 'var(--accent-gold)', fontWeight: 'bold' }}>
                                {stats.cv < 12 ? 'Excelente' : stats.cv < 20 ? 'Moderado' : 'Elevado'}
                              </span>
                            </div>
                          </div>

                          {/* Surface Distribution */}
                          <div style={{ marginTop: '12px' }}>
                            <span style={{ fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
                              DISTRIBUCIÓN DE SUPERFICIE
                            </span>
                            <div style={{ display: 'flex', height: '16px', borderRadius: '4px', overflow: 'hidden', width: '100%' }}>
                              {histogramIndex === 'HUMEDAD' ? (
                                <>
                                  <div style={{ width: `${distribution.baja}%`, background: '#a6bddb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e3a8a', fontSize: '9px', fontWeight: 'bold' }} title={`Baja: ${distribution.baja}%`}>{distribution.baja > 5 && `${distribution.baja}%`}</div>
                                  <div style={{ width: `${distribution.media}%`, background: '#3690c0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '9px', fontWeight: 'bold' }} title={`Media: ${distribution.media}%`}>{distribution.media > 5 && `${distribution.media}%`}</div>
                                  <div style={{ width: `${distribution.alta}%`, background: '#0570b0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '9px', fontWeight: 'bold' }} title={`Alta: ${distribution.alta}%`}>{distribution.alta > 5 && `${distribution.alta}%`}</div>
                                </>
                              ) : (
                                <>
                                  <div style={{ width: `${distribution.critico}%`, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '9px', fontWeight: 'bold' }} title={`Crítico (<0.3): ${distribution.critico}%`}>{distribution.critico > 5 && `${distribution.critico}%`}</div>
                                  <div style={{ width: `${distribution.bajo}%`, background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '9px', fontWeight: 'bold' }} title={`Bajo (0.3 - 0.5): ${distribution.bajo}%`}>{distribution.bajo > 5 && `${distribution.bajo}%`}</div>
                                  <div style={{ width: `${distribution.medio}%`, background: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e293b', fontSize: '9px', fontWeight: 'bold' }} title={`Medio (0.5 - 0.7): ${distribution.medio}%`}>{distribution.medio > 5 && `${distribution.medio}%`}</div>
                                  <div style={{ width: `${distribution.alto}%`, background: '#84cc16', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e293b', fontSize: '9px', fontWeight: 'bold' }} title={`Alto (0.7 - 0.85): ${distribution.alto}%`}>{distribution.alto > 5 && `${distribution.alto}%`}</div>
                                  <div style={{ width: `${distribution.excelente}%`, background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '9px', fontWeight: 'bold' }} title={`Excelente (>0.85): ${distribution.excelente}%`}>{distribution.excelente > 5 && `${distribution.excelente}%`}</div>
                                </>
                              )}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', marginTop: '5px', fontSize: '8.5px', color: 'var(--text-secondary)' }}>
                              {histogramIndex === 'HUMEDAD' ? (
                                <>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a6bddb' }}></span><span>Baja (&lt;0.0)</span></div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3690c0' }}></span><span>Media (0.0 - 0.3)</span></div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0570b0' }}></span><span>Alta (&gt;0.3)</span></div>
                                </>
                              ) : (
                                <>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }}></span><span>Crítico (&lt;0.3)</span></div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f97316' }}></span><span>Bajo (0.3-0.5)</span></div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#eab308' }}></span><span>Medio (0.5-0.7)</span></div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#84cc16' }}></span><span>Alto (0.7-0.85)</span></div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }}></span><span>Excelente (&gt;0.85)</span></div>
                                </>
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Observations & Actions */}
                  <div>
                    <div style={{ fontSize: '11px', marginTop: '10px' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Observaciones:</span>
                      <p style={{ fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', margin: 0 }}>
                        "{selectedLote.observaciones || 'Sin observaciones.'}"
                      </p>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <button className="btn btn-secondary" style={{ padding: '5px', fontSize: '10.5px', justifyContent: 'center' }} onClick={() => setIsAppDrawerOpen(true)}>
                          Reg. Aplicación
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '5px', fontSize: '10.5px', justifyContent: 'center' }} onClick={() => setIsMonDrawerOpen(true)}>
                          Reg. Monitoreo
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ flex: 1, justifyContent: 'center', fontSize: '10.5px', padding: '5px' }}
                          onClick={() => setIsFichaModalOpen(true)}
                        >
                          Ver ficha completa del lote
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={handleDelete}
                          title="Eliminar Lote"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '20px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  <MapPin size={24} style={{ marginBottom: '8px', color: 'var(--text-muted)' }} />
                  <span>Seleccione un lote en el mapa o la tabla para ver su información técnica.</span>
                </div>
              )}
            </div>
          </div>

          {/* Rediseño de sección inferior: Evolución e Historial Temporal */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
            {/* Panel Izquierdo: Evolución del Índice (Últimos 6 meses) */}
            <div
              className="glass-card"
              style={{ padding: '16px', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative' }}
              onClick={() => setIsEvolutionModalOpen(true)}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '12.5px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-primary)', margin: 0 }}>
                  Evolución {histogramIndex} (Últimos 6 Meses)
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--primary)', fontWeight: 'bold' }}>
                  <Eye size={12} />
                  <span>Maximizar gráfico</span>
                </div>
              </div>

              {selectedLote ? (
                (() => {
                  const { points, labels } = getHistoricalIndexPoints(selectedLote, histogramIndex);
                  const minVal = histogramIndex === 'HUMEDAD' ? -0.2 : 0.0;
                  const maxVal = 1.0;
                  const range = maxVal - minVal;

                  const svgW = 400;
                  const svgH = 120;
                  const padL = 35;
                  const padR = 15;
                  const padT = 15;
                  const padB = 25;

                  const chartW = svgW - padL - padR;
                  const chartH = svgH - padT - padB;

                  const coords = points.map((val, idx) => {
                    const x = padL + (idx / (points.length - 1)) * chartW;
                    const ratio = (val - minVal) / range;
                    const y = padT + (1 - ratio) * chartH;
                    return { x, y, val };
                  });

                  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
                  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${svgH - padB} L ${coords[0].x} ${svgH - padB} Z`;

                  return (
                    <div style={{ position: 'relative' }}>
                      <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                        <defs>
                          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Grid Lines */}
                        {[0.0, 0.25, 0.5, 0.75, 1.0].map((ratio, idx) => {
                          const val = minVal + ratio * range;
                          const y = padT + (1 - ratio) * chartH;
                          return (
                            <g key={idx}>
                              <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                              <text x={padL - 6} y={y + 3} textAnchor="end" style={{ fontSize: '8px', fill: 'var(--text-muted)' }}>
                                {val.toFixed(2)}
                              </text>
                            </g>
                          );
                        })}

                        {/* X-Axis labels */}
                        {labels.map((lbl, idx) => {
                          const x = padL + (idx / (labels.length - 1)) * chartW;
                          return (
                            <g key={idx}>
                              <line x1={x} y1={svgH - padB} x2={x} y2={svgH - padB + 4} stroke="var(--border-color)" strokeWidth="0.5" />
                              <text x={x} y={svgH - padB + 14} textAnchor="middle" style={{ fontSize: '8.5px', fill: 'var(--text-muted)' }}>
                                {lbl}
                              </text>
                            </g>
                          );
                        })}

                        <line x1={padL} y1={svgH - padB} x2={svgW - padR} y2={svgH - padB} stroke="var(--border-color)" strokeWidth="1" />
                        <line x1={padL} y1={padT} x2={padL} y2={svgH - padB} stroke="var(--border-color)" strokeWidth="1" />

                        <path d={areaPath} fill="url(#areaGradient)" />
                        <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />

                        {coords.map((c, idx) => (
                          <g key={idx}>
                            <circle cx={c.x} cy={c.y} r="4.5" fill="var(--bg-card)" stroke="var(--primary)" strokeWidth="2" />
                            <text x={c.x} y={c.y - 8} textAnchor="middle" style={{ fontSize: '8px', fill: 'var(--text-primary)', fontWeight: 'bold' }}>
                              {c.val.toFixed(2)}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  );
                })()
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '110px', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                  Seleccione un lote para ver el gráfico.
                </div>
              )}
            </div>

            {/* Panel Derecho: Comparación Temporal y Diagnóstico */}
            <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ fontSize: '12.5px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '12px' }}>
                  Comparación Temporal ({histogramIndex})
                </h4>

                {selectedLote ? (
                  (() => {
                    const { points } = getHistoricalIndexPoints(selectedLote, histogramIndex);
                    const currentVal = points[5];
                    const prev15DaysVal = points[4];
                    const prev30DaysVal = points[3];

                    const diff15 = currentVal - prev15DaysVal;
                    const pctChange15 = prev15DaysVal !== 0 ? ((diff15 / prev15DaysVal) * 100).toFixed(1) : '0.0';
                    const isUp15 = diff15 >= 0;

                    const diff30 = currentVal - prev30DaysVal;
                    const pctChange30 = prev30DaysVal !== 0 ? ((diff30 / prev30DaysVal) * 100).toFixed(1) : '0.0';
                    const isUp30 = diff30 >= 0;

                    let recommendation = "";
                    const minVal = histogramIndex === 'HUMEDAD' ? -0.2 : 0.0;
                    const range = 1.0 - minVal;

                    if (histogramIndex === 'NDVI' || histogramIndex === 'NDRE' || histogramIndex === 'SAVI') {
                      if (isUp15 && currentVal >= 0.7) {
                        recommendation = "El vigor vegetativo muestra un incremento saludable de " + pctChange15 + "% en los últimos 15 días. Las prácticas agrícolas actuales son efectivas.";
                      } else if (!isUp15 && pctChange15 <= -5) {
                        recommendation = "Atención: Pérdida de vigor detectada (-" + Math.abs(pctChange15) + "%). Se recomienda programar un monitoreo en campo para descartar plagas o deficiencias nutricionales.";
                      } else {
                        recommendation = "Índice de vigor estable. Se mantiene dentro del rango promedio esperado para esta etapa de desarrollo del cultivo.";
                      }
                    } else { // Humedad
                      if (currentVal < 0.15) {
                        recommendation = "Alerta de humedad baja (" + currentVal + "). Estrés hídrico potencial. Se aconseja revisar los tiempos de riego o programar una irrigación inmediata.";
                      } else if (currentVal > 0.35) {
                        recommendation = "Niveles de humedad elevados (" + currentVal + "). Riesgo de encharcamiento o desarrollo de hongos fitopatógenos. Monitorear drenajes.";
                      } else {
                        recommendation = "Humedad del suelo óptima (" + currentVal + "). Proporciona un balance adecuado para la transpiración de la planta.";
                      }
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px' }}>
                            <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>vs hace 15 días</span>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                              <strong style={{ fontSize: '18px', color: 'var(--text-primary)' }}>{currentVal.toFixed(2)}</strong>
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>antes: {prev15DaysVal.toFixed(2)}</span>
                            </div>
                            <span style={{ fontSize: '10.5px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '3px', color: isUp15 ? '#22c55e' : '#ef4444', marginTop: '4px' }}>
                              {isUp15 ? '▲' : '▼'} {isUp15 ? '+' : ''}{pctChange15}%
                            </span>
                          </div>

                          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px' }}>
                            <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>vs hace 30 días</span>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                              <strong style={{ fontSize: '18px', color: 'var(--text-primary)' }}>{currentVal.toFixed(2)}</strong>
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>antes: {prev30DaysVal.toFixed(2)}</span>
                            </div>
                            <span style={{ fontSize: '10.5px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '3px', color: isUp30 ? '#22c55e' : '#ef4444', marginTop: '4px' }}>
                              {isUp30 ? '▲' : '▼'} {isUp30 ? '+' : ''}{pctChange30}%
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 12px' }}>
                          <span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Tendencia 30d:</span>
                          <svg viewBox="0 0 80 15" style={{ width: '60px', height: '15px' }}>
                            <polyline
                              fill="none"
                              stroke={isUp15 ? '#22c55e' : '#ef4444'}
                              strokeWidth="1.5"
                              points={`5,${15 - (prev30DaysVal - minVal) / range * 13} 40,${15 - (prev15DaysVal - minVal) / range * 13} 75,${15 - (currentVal - minVal) / range * 13}`}
                            />
                            <circle cx="5" cy={15 - (prev30DaysVal - minVal) / range * 13} r="1.5" fill={isUp15 ? '#22c55e' : '#ef4444'} />
                            <circle cx="40" cy={15 - (prev15DaysVal - minVal) / range * 13} r="1.5" fill={isUp15 ? '#22c55e' : '#ef4444'} />
                            <circle cx="75" cy={15 - (currentVal - minVal) / range * 13} r="2" fill={isUp15 ? '#22c55e' : '#ef4444'} />
                          </svg>
                          <span style={{ fontSize: '10px', fontWeight: '600', color: isUp15 ? '#22c55e' : '#ef4444' }}>
                            {isUp15 ? 'En crecimiento' : 'En alerta / descenso'}
                          </span>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.02)', borderLeft: `3px solid ${isUp15 ? 'var(--primary)' : 'var(--accent-gold)'}`, padding: '6px 10px', borderRadius: '0 6px 6px 0', fontSize: '10px', lineHeight: '1.35', color: 'var(--text-secondary)' }}>
                          <strong>Diagnóstico:</strong> {recommendation}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '110px', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                    Seleccione un lote para ver la comparación temporal.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dynamic Ledger panel subcomponent */}
          <div style={{ marginTop: '16px' }}>
            <LedgerPanel />
          </div>
        </div>

        {/* Right Column Layout */}
        <div className="sanitary-right-column">
          {/* Active Operations panel stopwatch banner */}
          {selectedLote && activeOperations[selectedLote.id] && (() => {
            const activeOp = activeOperations[selectedLote.id];
            return (
              <div className="glass-card primary-edge" style={{ padding: '16px', marginBottom: '16px' }}>
                <div className="operation-card-header">
                  <h3 style={{ fontSize: '14px', fontWeight: '700' }}>Operación Actual</h3>
                  <span className="badge badge-green" style={{ fontSize: '10px', padding: '1px 6px' }}>En curso</span>
                </div>

                <div style={{ margin: '8px 0' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', display: 'block' }}>{activeOp.actividad}</span>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Lote {selectedLote.codigo_interno} — {selectedLote.cultivo}</span>
                </div>

                {/* Progress timer bar */}
                <div style={{ margin: '12px 0 16px 0' }}>
                  <div className="progress-bar-container" style={{ height: '6px', background: 'var(--border-color)', overflow: 'hidden' }}>
                    <div className="progress-bar-fill" style={{ width: `${Math.min(100, (operationTime / 14400) * 100)}%`, background: 'var(--primary)' }}></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '4px', fontWeight: '600' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Tiempo transcurrido:</span>
                    <span style={{ color: 'var(--text-primary)' }}>{formatDuration(operationTime)}</span>
                  </div>
                </div>

                <div className="operation-details-grid" style={{ marginBottom: '10px' }}>
                  <span className="operation-label">Producto:</span><span className="operation-value">{activeOp.producto || 'N/A'}</span>
                  <span className="operation-label">Dosis:</span><span className="operation-value">{activeOp.dosis || 'N/A'}</span>
                  <span className="operation-label">Fecha inicio:</span>
                  <span className="operation-value">{new Date(activeOp.startTime).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="operation-label">Equipo:</span><span className="operation-value">{activeOp.machinery || 'N/A'}</span>
                  <span className="operation-label">Operador:</span><span className="operation-value">{activeOp.operator || 'N/A'}</span>
                </div>

                {/* Telemetría climática */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Variables Climáticas (Telemetría)</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Thermometer size={12} style={{ color: 'var(--primary)' }} /><span>Temp: {weatherStation.temp}°C</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Droplets size={12} style={{ color: 'var(--accent-blue)' }} /><span>Humedad: {weatherStation.humidity}%</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Wind size={12} style={{ color: isDriftHigh ? 'var(--accent-red)' : 'var(--text-secondary)' }} /><span>Viento: <strong style={{ color: isDriftHigh ? 'var(--accent-red)' : 'inherit' }}>{weatherStation.wind} km/h</strong></span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CloudRain size={12} style={{ color: isWashHigh ? 'var(--accent-red)' : 'var(--text-secondary)' }} /><span>Lluvia: {weatherStation.rain}%</span></div>
                  </div>
                  {isDriftHigh && (
                    <div style={{ marginTop: '8px', padding: '6px', background: 'var(--accent-gold-light)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '6px', fontSize: '10px', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={12} />
                      <span>Viento &gt; 15 km/h: Riesgo de deriva de gota.</span>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '12px' }}>
                  <button
                    className="btn btn-danger"
                    style={{ width: '100%', justifyContent: 'center', fontSize: '11px', padding: '6px', border: '1px solid var(--accent-red)' }}
                    onClick={handleFinishCurrentOperation}
                  >
                    Finalizar aplicación
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Lote diagnostic/care information alerts card */}
          {selectedLote && (
            <div className="glass-card" style={{ padding: '16px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '12px' }}>Alertas de Inocuidad y Sanidad</h4>
              {(() => {
                const carencia = getLoteCarenciaStatus(selectedLote.id);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {carencia.isRestricted ? (
                      <div style={{ background: 'rgba(239, 68, 68, 0.08)', borderLeft: '4px solid #ef4444', padding: '10px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: '700', color: '#ef4444', display: 'block', marginBottom: '2px' }}>Lote Bajo Periodo de Carencia</span>
                        Quedan <strong>{carencia.daysRemaining} días</strong> para levantar la restricción de cosecha tras la aplicación de <strong>{carencia.activeProduct}</strong>.
                      </div>
                    ) : (
                      <div style={{ background: 'rgba(34, 197, 94, 0.08)', borderLeft: '4px solid #22c55e', padding: '10px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: '700', color: '#22c55e', display: 'block', marginBottom: '2px' }}>Habilitado para Cosecha</span>
                        Este lote no presenta restricciones fitosanitarias activas de carencia.
                      </div>
                    )}

                    {selectedLote.disease_detected && selectedLote.disease_detected !== 'Ninguna' && selectedLote.disease_detected !== 'Ninguna (preventivo)' ? (
                      <div style={{ background: 'rgba(245, 158, 11, 0.08)', borderLeft: '4px solid #f59e0b', padding: '10px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: '700', color: '#f59e0b', display: 'block', marginBottom: '2px' }}>Foco Infeccioso: {selectedLote.disease_detected}</span>
                        Incidencia: <strong>{selectedLote.incidence_pct}%</strong> | Severidad: <strong>{selectedLote.severity_pct}%</strong>. Se sugiere control fitosanitario inmediato.
                      </div>
                    ) : (
                      <div style={{ background: 'rgba(34, 197, 94, 0.08)', borderLeft: '4px solid #22c55e', padding: '10px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: '700', color: '#22c55e', display: 'block', marginBottom: '2px' }}>Sanidad Vegetal Óptima</span>
                        No se registran focos activos de plagas o enfermedades en los monitoreos.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* DETAILED EVOLUTION TRENDS MODAL */}
      {isEvolutionModalOpen && selectedLote && (
        <div className="drawer-backdrop" style={{ justifyContent: 'center', alignItems: 'center', zIndex: '9999' }} onClick={() => setIsEvolutionModalOpen(false)}>
          <div className="glass-card" style={{ width: '800px', maxWidth: '95%', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)', animation: 'fadeIn 0.2s ease-out', padding: '0px' }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={20} style={{ color: 'var(--primary)' }} />
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Evolución Temporal Detallada</h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Lote {selectedLote.codigo_interno} - {selectedLote.nombre}
                  </span>
                </div>
              </div>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setIsEvolutionModalOpen(false)}><X size={18} /></button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '10px 15px', borderRadius: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                  Seleccione el índice para graficar:
                </span>
                <select
                  className="input-glass select-glass"
                  style={{ padding: '4px 24px 4px 10px', fontSize: '12px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer' }}
                  value={histogramIndex}
                  onChange={e => setHistogramIndex(e.target.value)}
                >
                  <option value="NDVI">NDVI (Índice de Vegetación de Diferencia Normalizada)</option>
                  <option value="NDRE">NDRE (Borde Rojo de Diferencia Normalizada)</option>
                  <option value="SAVI">SAVI (Índice de Vegetación Ajustado al Suelo)</option>
                  <option value="HUMEDAD">Humedad de Superficie NDWI</option>
                </select>
              </div>

              {(() => {
                const { points, labels } = getHistoricalIndexPoints(selectedLote, histogramIndex);
                const minVal = histogramIndex === 'HUMEDAD' ? -0.2 : 0.0;
                const maxVal = 1.0;
                const range = maxVal - minVal;

                const svgW = 700;
                const svgH = 220;
                const padL = 40;
                const padR = 20;
                const padT = 20;
                const padB = 30;

                const chartW = svgW - padL - padR;
                const chartH = svgH - padT - padB;

                const coords = points.map((val, idx) => {
                  const x = padL + (idx / (points.length - 1)) * chartW;
                  const ratio = (val - minVal) / range;
                  const y = padT + (1 - ratio) * chartH;
                  return { x, y, val };
                });

                const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
                const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${svgH - padB} L ${coords[0].x} ${svgH - padB} Z`;

                return (
                  <>
                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '15px' }}>
                      <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                        <defs>
                          <linearGradient id="modalAreaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {[0.0, 0.2, 0.4, 0.6, 0.8, 1.0].map((ratio, idx) => {
                          const val = minVal + ratio * range;
                          const y = padT + (1 - ratio) * chartH;
                          return (
                            <g key={idx}>
                              <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="4 4" />
                              <text x={padL - 8} y={y + 3} textAnchor="end" style={{ fontSize: '9px', fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                                {val.toFixed(1)}
                              </text>
                            </g>
                          );
                        })}

                        {labels.map((lbl, idx) => {
                          const x = padL + (idx / (labels.length - 1)) * chartW;
                          return (
                            <g key={idx}>
                              <line x1={x} y1={svgH - padB} x2={x} y2={svgH - padB + 5} stroke="var(--border-color)" strokeWidth="1" />
                              <text x={x} y={svgH - padB + 16} textAnchor="middle" style={{ fontSize: '10px', fill: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                                {lbl}
                              </text>
                            </g>
                          );
                        })}

                        <line x1={padL} y1={svgH - padB} x2={svgW - padR} y2={svgH - padB} stroke="var(--border-color)" strokeWidth="1.5" />
                        <line x1={padL} y1={padT} x2={padL} y2={svgH - padB} stroke="var(--border-color)" strokeWidth="1.5" />

                        <path d={areaPath} fill="url(#modalAreaGradient)" />
                        <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />

                        {coords.map((c, idx) => (
                          <g key={idx}>
                            <circle cx={c.x} cy={c.y} r="6" fill="var(--bg-app)" stroke="var(--primary)" strokeWidth="3" style={{ cursor: 'pointer' }} />
                            <text x={c.x} y={c.y - 10} textAnchor="middle" style={{ fontSize: '10px', fill: 'var(--text-primary)', fontWeight: '800', fontFamily: 'var(--font-sans)' }}>
                              {c.val.toFixed(2)}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>

                    <div style={{ marginTop: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', marginBottom: '8px' }}>
                        Tabla de Datos del Gráfico
                      </span>
                      <div className="table-responsive" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                        <table className="sanitary-table compact" style={{ width: '100%', fontSize: '11.5px' }}>
                          <thead>
                            <tr>
                              <th>Mes</th>
                              <th>Valor del Índice ({histogramIndex})</th>
                              <th>Variación Absoluta</th>
                              <th>Variación Porcentual</th>
                              <th>Estado Sanitario Estimado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {points.map((val, idx) => {
                              const prevVal = idx > 0 ? points[idx - 1] : val;
                              const diff = val - prevVal;
                              const pct = prevVal !== 0 ? ((diff / prevVal) * 100).toFixed(1) : '0.0';

                              let statusLabel = "Excelente";
                              let statusColor = "#22c55e";
                              if (histogramIndex === 'HUMEDAD') {
                                if (val < 0.0) { statusLabel = "Bajo (Seco)"; statusColor = "#ef4444"; }
                                else if (val < 0.3) { statusLabel = "Medio"; statusColor = "#3690c0"; }
                                else { statusLabel = "Alto"; statusColor = "#0570b0"; }
                              } else {
                                if (val < 0.3) { statusLabel = "Crítico"; statusColor = "#ef4444"; }
                                else if (val < 0.5) { statusLabel = "Bajo"; statusColor = "#f97316"; }
                                else if (val < 0.7) { statusLabel = "Regular"; statusColor = "#eab308"; }
                                else if (val < 0.85) { statusLabel = "Bueno"; statusColor = "#84cc16"; }
                              }

                              return (
                                <tr key={idx}>
                                  <td><strong>{labels[idx]}</strong></td>
                                  <td style={{ fontWeight: '700' }}>{val.toFixed(2)}</td>
                                  <td style={{ color: diff > 0 ? '#22c55e' : diff < 0 ? '#ef4444' : 'var(--text-muted)' }}>
                                    {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                                  </td>
                                  <td style={{ fontWeight: '600', color: diff > 0 ? '#22c55e' : diff < 0 ? '#ef4444' : 'var(--text-muted)' }}>
                                    {diff > 0 ? '▲' : diff < 0 ? '▼' : ''} {diff > 0 ? '+' : ''}{pct}%
                                  </td>
                                  <td>
                                    <span style={{ color: statusColor, fontWeight: 'bold' }}>● {statusLabel}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                );
              })()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '15px', marginTop: '10px' }}>
                <button className="btn btn-secondary" onClick={() => setIsEvolutionModalOpen(false)}>Cerrar Gráfico</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
