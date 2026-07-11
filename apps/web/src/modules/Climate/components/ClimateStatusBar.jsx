import { useClimateContext } from '../context/ClimateContext';
import WeatherIcon from './WeatherIcon';
import { getWeatherRule } from '../utils/rules/weatherRules';

export default function ClimateStatusBar() {
  const { weatherData, loading, selectedLote } = useClimateContext();

  if (loading && !weatherData) {
    return <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Cargando clima...</div>;
  }

  const current = weatherData?.current;
  const wRule = current ? getWeatherRule(current.weatherCode) : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
      {current ? (
        <>
          <WeatherIcon name={wRule?.icon} size={16} />
          <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{Math.round(current.temperature)}°C</span>
          <span style={{ color: 'var(--text-muted)' }}>|</span>
          <span>{selectedLote?.nombre || 'Granada, Meta'}</span>
          <span style={{ color: 'var(--text-muted)' }}>|</span>
          <span style={{ textTransform: 'capitalize' }}>{wRule?.label}</span>
        </>
      ) : (
        <span>Sin datos climáticos</span>
      )}
    </div>
  );
}
