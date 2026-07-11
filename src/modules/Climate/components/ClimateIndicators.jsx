import { useClimateContext } from '../context/ClimateContext';
import WeatherIcon from './WeatherIcon';
import { getWeatherRule } from '../utils/rules/weatherRules';
import { getWindDirection } from '../utils/climateUtils';
import { Thermometer, Droplets, Wind, Gauge, CloudRain, Sun, Eye, Droplet } from 'lucide-react';

export default function ClimateIndicators() {
  const { weatherData, loading } = useClimateContext();

  if (loading && !weatherData) {
    return (
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '360px' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="spin-anim" style={{ fontSize: '24px', marginBottom: '8px' }}>🔄</div>
          <div>Cargando condiciones actuales...</div>
        </div>
      </div>
    );
  }

  const current = weatherData?.current;
  if (!current) {
    return (
      <div className="glass-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        No hay datos climáticos disponibles en este momento.
      </div>
    );
  }

  const wRule = getWeatherRule(current.weatherCode);
  const windDirText = getWindDirection(current.windDirection);

  // Formato y color para el índice UV
  const getUvLevel = (uv) => {
    if (uv <= 2) return { text: 'Bajo', color: 'var(--primary)', bg: 'var(--primary-light)' };
    if (uv <= 5) return { text: 'Moderado', color: 'var(--accent-gold)', bg: 'var(--accent-gold-light)' };
    if (uv <= 7) return { text: 'Alto', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.1)' }; // Orange
    if (uv <= 10) return { text: 'Muy Alto', color: 'var(--accent-red)', bg: 'var(--accent-red-light)' };
    return { text: 'Extremo', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' }; // Purple
  };

  const uvLevel = getUvLevel(current.uvIndex);

  // Lista de sub-indicadores estructurados
  const details = [
    {
      label: 'Sensación térmica',
      value: `${Math.round(current.apparentTemperature)}°C`,
      icon: <Thermometer size={16} />
    },
    {
      label: 'Humedad relativa',
      value: `${current.relativeHumidity}%`,
      icon: <Droplets size={16} />
    },
    {
      label: 'Viento',
      value: `${current.windSpeed.toFixed(0)} km/h ${windDirText}`,
      icon: <Wind size={16} />
    },
    {
      label: 'Presión atmosférica',
      value: `${Math.round(current.pressure)} hPa`,
      icon: <Gauge size={16} />
    },
    {
      label: 'Prob. de precipitación',
      value: `${current.precipitationProbability}%`,
      icon: <CloudRain size={16} />
    },
    {
      label: 'Índice UV',
      value: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          {current.uvIndex.toFixed(0)}
          <span 
            style={{ 
              fontSize: '10px', 
              padding: '2px 6px', 
              borderRadius: '4px', 
              color: uvLevel.color, 
              backgroundColor: uvLevel.bg,
              fontWeight: '700',
              textTransform: 'uppercase'
            }}
          >
            {uvLevel.text}
          </span>
        </span>
      ),
      icon: <Sun size={16} />
    },
    {
      label: 'Visibilidad',
      value: `${current.visibility.toFixed(0)} km`,
      icon: <Eye size={16} />
    },
    {
      label: 'Punto de rocío',
      value: `${Math.round(current.dewPoint)}°C`,
      icon: <Droplet size={16} />
    }
  ];

  return (
    <div className="glass-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card-title-section" style={{ margin: 0 }}>
        <span className="card-label">Condiciones Actuales</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '10px 0' }}>
        <div className="large-weather-icon-container" style={{ position: 'relative' }}>
          <WeatherIcon name={wRule.icon} size={82} className="floating-anim" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '56px', fontWeight: '800', fontFamily: 'var(--font-display)', lineHeight: '1' }}>
              {Math.round(current.temperature)}
            </span>
            <span style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-secondary)', marginTop: '4px' }}>°C</span>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600', margin: '4px 0 0 0' }}>
            {wRule.label}
          </p>
        </div>
      </div>

      <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
        {details.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '10px' }}>
            <div style={{ 
              color: 'var(--text-muted)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)'
            }}>
              {item.icon}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>{item.label}</span>
              <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', marginTop: '2px' }}>
                {item.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
