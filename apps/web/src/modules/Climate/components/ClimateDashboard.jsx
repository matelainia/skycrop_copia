import { useClimateContext } from '../context/ClimateContext';
import ClimateHeader from './ClimateHeader';
import ClimateIndicators from './ClimateIndicators';
import ClimateTabs from './ClimateTabs';
import ClimateHourlyChart from './ClimateHourlyChart';
import ClimateForecast from './ClimateForecast';
import ClimateRecommendationCard from './ClimateRecommendationCard';
import { ShieldAlert, Compass, Map } from 'lucide-react';

export default function ClimateDashboard() {
  const { lotes, selectedLote, setSelectedLote, weatherData, error } = useClimateContext();

  const handleLoteChange = (e) => {
    const lotId = e.target.value;
    const lot = lotes.find(l => l.id === lotId);
    if (lot) {
      setSelectedLote(lot);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Encabezado del Módulo */}
      <ClimateHeader />

      {error && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: 'var(--accent-red)',
          padding: '16px 20px',
          borderRadius: '12px',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Grid Principal de 3 Columnas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.1fr 1.9fr 1fr',
        gap: '24px'
      }} className="climate-grid-main">
        {/* Columna Izquierda: Condiciones Actuales */}
        <div style={{ gridColumn: 'span 1' }}>
          <ClimateIndicators />
        </div>

        {/* Columna Central: Gráfico Horario */}
        <div style={{ gridColumn: 'span 1', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-card" style={{ flexGrow: 1, padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <div className="card-title-section" style={{ margin: '0 0 10px 0' }}>
              <span className="card-label">Pronóstico Horario</span>
            </div>
            
            <ClimateTabs />
            
            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
              <ClimateHourlyChart />
            </div>
          </div>
        </div>

        {/* Columna Derecha: Recomendación Agronómica */}
        <div style={{ gridColumn: 'span 1', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <ClimateRecommendationCard />
        </div>
      </div>

      {/* Fila Inferior: Pronóstico Semanal y Lote + Alertas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '3fr 1.05fr',
        gap: '24px'
      }} className="climate-grid-bottom">
        {/* Pronóstico de 7 Días */}
        <div style={{ gridColumn: 'span 1' }}>
          <ClimateForecast />
        </div>

        {/* Información de Predio / Lote */}
        <div style={{ gridColumn: 'span 1' }}>
          <div className="glass-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card-title-section" style={{ margin: 0 }}>
              <span className="card-label">Información del Predio</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1 }}>
              {/* Selector de Lotes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>Seleccionar Lote / Predio:</label>
                <select 
                  className="input-glass select-glass"
                  value={selectedLote?.id || ''}
                  onChange={handleLoteChange}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                >
                  {lotes.map(l => (
                    <option key={l.id} value={l.id}>{l.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Detalles del Predio Activo */}
              {selectedLote && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Cultivo:</span>
                    <span style={{ fontWeight: '600' }}>{selectedLote.cultivo}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Área total:</span>
                    <span style={{ fontWeight: '600' }}>{selectedLote.area_ha || 12.4} ha</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Altitud:</span>
                    <span style={{ fontWeight: '600' }}>{selectedLote.altitud || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Coordenadas:</span>
                    <span style={{ fontWeight: '600', fontFamily: 'monospace', fontSize: '12px' }}>
                      {selectedLote.centroide_lat.toFixed(4)}, {selectedLote.centroide_lng.toFixed(4)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <button 
              className="btn btn-secondary" 
              style={{ width: '100%', justifyContent: 'center', padding: '8px', fontSize: '12px' }}
              onClick={() => alert(`Coordenadas del lote: ${selectedLote?.centroide_lat}, ${selectedLote?.centroide_lng}`)}
            >
              <Map size={14} />
              <span>Ver en mapa</span>
            </button>
          </div>
        </div>
      </div>

      {/* Alertas y Condiciones Especiales */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="card-title-section" style={{ margin: 0 }}>
          <span className="card-label">Alertas y Condiciones Especiales</span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px'
        }}>
          {/* Renderizar alertas dinámicas desde el backend */}
          {weatherData?.alerts && weatherData.alerts.length > 0 ? (
            weatherData.alerts.map((alert, idx) => (
              <div 
                key={idx}
                style={{
                  display: 'flex',
                  gap: '12px',
                  backgroundColor: alert.severity === 'danger' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(217, 119, 6, 0.08)',
                  border: alert.severity === 'danger' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(217, 119, 6, 0.2)',
                  borderRadius: '10px',
                  padding: '14px'
                }}
              >
                <div style={{ color: alert.severity === 'danger' ? 'var(--accent-red)' : 'var(--accent-gold)' }}>
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', margin: '0 0 4px 0', color: alert.severity === 'danger' ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                    {alert.title}
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                    {alert.message}
                  </p>
                </div>
              </div>
            ))
          ) : null}

          {/* Alerta de Ventana de Aplicación Fitosanitaria (calculada) */}
          {weatherData?.interpretations?.spraying && (
            <div 
              style={{
                display: 'flex',
                gap: '12px',
                backgroundColor: weatherData.interpretations.spraying.score <= 35 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                border: weatherData.interpretations.spraying.score <= 35 ? '1px solid var(--primary-border)' : '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '14px'
              }}
            >
              <div style={{ color: weatherData.interpretations.spraying.score <= 35 ? 'var(--primary)' : 'var(--text-muted)' }}>
                <Compass size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: '700', margin: '0 0 4px 0', color: weatherData.interpretations.spraying.score <= 35 ? 'var(--primary)' : 'var(--text-primary)' }}>
                  Ventana de Aplicación
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  {weatherData.interpretations.spraying.score <= 35 
                    ? 'Condiciones climáticas idóneas en curso. Ventana de aplicación abierta hoy.' 
                    : 'Ventana de aplicación desfavorable o restringida temporalmente.'}
                </p>
              </div>
            </div>
          )}

          {/* Alerta de Evaporación / Riego (calculada) */}
          {weatherData?.interpretations?.irrigation && (
            <div 
              style={{
                display: 'flex',
                gap: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '14px'
              }}
            >
              <div style={{ color: 'var(--accent-blue)' }}>
                <Compass size={20} style={{ color: 'var(--accent-blue)' }} />
              </div>
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: '700', margin: '0 0 4px 0' }}>
                  Planificación de Riego
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  {weatherData.interpretations.irrigation.recommendation === 'Suspender Riego' 
                    ? 'Suspender riego recomendado por alta probabilidad de lluvia.' 
                    : 'Esquema de riego normal habilitado en base al balance hídrico.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
