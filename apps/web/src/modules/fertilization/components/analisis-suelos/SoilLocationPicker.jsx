import { memo, useState, useCallback } from 'react';
import { MapPin, Navigation, Trash2, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { geolocationService } from '../../services/geolocation.service.js';

const SoilLocationPicker = memo(function SoilLocationPicker({
  latitude,
  longitude,
  accuracyM,
  altitude,
  capturedAt,
  ubicacionNombre,
  ubicacionDescripcion,
  onChange,
  onRemove,
  disabled = false,
}) {
  const [status, setStatus] = useState('idle'); // idle | requesting | success | error
  const [error, setError] = useState(null);

  const hasCoords = latitude != null && longitude != null;

  const handleGetLocation = useCallback(async () => {
    if (disabled) return;
    setStatus('requesting');
    setError(null);
    try {
      const pos = await geolocationService.getCurrentPosition();
      setStatus('success');
      onChange?.({
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy_m: pos.accuracy,
        altitude: pos.altitude,
        captured_at: pos.capturedAt,
      });
    } catch (e) {
      setStatus('error');
      setError(e.message);
    }
  }, [disabled, onChange]);

  const handleManualChange = useCallback((field, value) => {
    const num = value === '' ? null : Number(value);
    if (field === 'latitude' && num != null && (num < -90 || num > 90)) return;
    if (field === 'longitude' && num != null && (num < -180 || num > 180)) return;
    onChange?.({ [field]: num });
  }, [onChange]);

  return (
    <div className="soil-gps-card" style={hasCoords ? { background: '#ECFDF5', borderColor: '#A7F3D0' } : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: hasCoords ? '#065F46' : '#374151' }}>
        <MapPin size={14} /> Ubicación del muestreo
        {hasCoords && <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, color: '#059669', fontSize: 11 }}><CheckCircle2 size={12} /> Ubicación registrada</span>}
      </div>

      {!hasCoords ? (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="fert-btn fert-btn--primary"
              onClick={handleGetLocation}
              disabled={disabled || status === 'requesting'}
              style={{ fontSize: 12 }}
            >
              {status === 'requesting' ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
              {status === 'requesting' ? 'Obteniendo ubicación...' : 'Obtener ubicación actual'}
            </button>
            <span style={{ fontSize: 11, color: '#6B7280', alignSelf: 'center' }}>o introduce coordenadas manualmente</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="soil-form__field">
              <label className="soil-form__label">Latitud</label>
              <input
                type="number"
                step="0.000001"
                placeholder="4.123456"
                value={latitude ?? ''}
                onChange={(e) => handleManualChange('latitude', e.target.value)}
                className="soil-form__input"
                disabled={disabled}
              />
            </div>
            <div className="soil-form__field">
              <label className="soil-form__label">Longitud</label>
              <input
                type="number"
                step="0.000001"
                placeholder="-73.456789"
                value={longitude ?? ''}
                onChange={(e) => handleManualChange('longitude', e.target.value)}
                className="soil-form__input"
                disabled={disabled}
              />
            </div>
          </div>

          <div className="soil-form__field">
            <label className="soil-form__label">Nombre ubicación</label>
            <input
              type="text"
              placeholder="Bloque Norte"
              value={ubicacionNombre || ''}
              onChange={(e) => onChange?.({ ubicacion_nombre: e.target.value })}
              className="soil-form__input"
              disabled={disabled}
            />
          </div>

          {status === 'error' && error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#DC2626' }}>
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ background: 'white', borderRadius: 10, padding: 12, border: '1px solid #A7F3D0' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#065F46' }}>{ubicacionNombre || 'Ubicación registrada'}</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{Number(latitude).toFixed(6)}° N · {Number(longitude).toFixed(6)}° W</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>
              {accuracyM != null && `Precisión aproximada: ${Number(accuracyM).toFixed(0)} m`}
              {altitude != null && ` · Altitud ${Number(altitude).toFixed(0)} m`}
            </div>
            {capturedAt && <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>{new Date(capturedAt).toLocaleString('es-ES')}</div>}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="fert-btn fert-btn--outline" style={{ fontSize: 12 }} onClick={handleGetLocation} disabled={disabled}>
              <Navigation size={12} /> Actualizar ubicación
            </button>
            <button type="button" className="fert-btn fert-btn--ghost" style={{ fontSize: 12, color: '#DC2626' }} onClick={onRemove} disabled={disabled}>
              <Trash2 size={12} /> Eliminar ubicación
            </button>
          </div>

          <div className="soil-form__field">
            <label className="soil-form__label">Nombre ubicación</label>
            <input
              type="text"
              placeholder="Bloque Norte"
              value={ubicacionNombre || ''}
              onChange={(e) => onChange?.({ ubicacion_nombre: e.target.value })}
              className="soil-form__input"
              disabled={disabled}
            />
          </div>
          <div className="soil-form__field">
            <label className="soil-form__label">Descripción</label>
            <input
              type="text"
              placeholder="Área productiva"
              value={ubicacionDescripcion || ''}
              onChange={(e) => onChange?.({ ubicacion_descripcion: e.target.value })}
              className="soil-form__input"
              disabled={disabled}
            />
          </div>
        </>
      )}
    </div>
  );
});

export default SoilLocationPicker;
