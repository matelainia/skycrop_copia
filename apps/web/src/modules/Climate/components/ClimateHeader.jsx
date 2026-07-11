import { useClimateContext } from '../context/ClimateContext';
import { RefreshCw, MapPin, Database } from 'lucide-react';

export default function ClimateHeader() {
  const { selectedLote, weatherData, loading, refreshWeather } = useClimateContext();

  const isCached = weatherData?.metadata?.cached || false;
  const lastUpdated = weatherData?.metadata?.generatedAt 
    ? new Date(weatherData.metadata.generatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) 
    : '—';

  return (
    <div className="climate-header-card glass-card primary-edge" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', padding: '18px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="card-icon-box green" style={{ width: '42px', height: '42px', borderRadius: '10px' }}>
          <MapPin size={22} />
        </div>
        <div>
          <h3 style={{ fontSize: '18px', margin: 0, fontWeight: '700' }}>
            {selectedLote ? selectedLote.nombre : 'Cargando predio...'}
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
            Cultivo: <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{selectedLote?.cultivo || '—'}</span> 
            {selectedLote?.area_ha && ` | Área: ${selectedLote.area_ha} ha`}
            {selectedLote?.altitud && ` | Altitud: ${selectedLote.altitud}`}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ textAlign: 'right', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end', color: 'var(--text-secondary)' }}>
            {isCached && <Database size={13} style={{ color: 'var(--primary)' }} title="Leído de caché" />}
            <span>Actualizado: <strong>{lastUpdated}</strong></span>
          </div>
          <p style={{ color: 'var(--text-muted)', margin: '2px 0 0 0', fontSize: '11px' }}>
            Lat: {selectedLote?.centroide_lat.toFixed(4)} | Lng: {selectedLote?.centroide_lng.toFixed(4)}
          </p>
        </div>

        <button 
          className="btn btn-secondary" 
          onClick={refreshWeather}
          disabled={loading}
          style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '12px' }}
          title="Forzar actualización omitiendo caché"
        >
          <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
          <span>{loading ? 'Cargando...' : 'Actualizar'}</span>
        </button>
      </div>
    </div>
  );
}
