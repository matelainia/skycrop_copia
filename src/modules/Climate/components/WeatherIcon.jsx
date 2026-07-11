import { Sun, Cloud, CloudSun, CloudRain, CloudLightning, CloudDrizzle, CloudSnow } from 'lucide-react';

export default function WeatherIcon({ name, size = 24, className = '', ...props }) {
  // Retorna el icono de Lucide correspondiente según el nombre mapeado
  const getIconComponent = () => {
    switch (name?.toLowerCase()) {
      case 'sun':
        return <Sun size={size} className={`weather-icon-sun ${className}`} style={{ color: 'var(--accent-gold)' }} {...props} />;
      case 'cloud-sun':
        return <CloudSun size={size} className={`weather-icon-cloud-sun ${className}`} style={{ color: 'var(--text-secondary)' }} {...props} />;
      case 'cloud':
        return <Cloud size={size} className={`weather-icon-cloud ${className}`} style={{ color: 'var(--text-muted)' }} {...props} />;
      case 'cloud-rain':
        return <CloudRain size={size} className={`weather-icon-rain ${className}`} style={{ color: 'var(--accent-blue)' }} {...props} />;
      case 'cloud-lightning':
        return <CloudLightning size={size} className={`weather-icon-lightning ${className}`} style={{ color: 'var(--accent-gold)' }} {...props} />;
      case 'cloud-drizzle':
        return <CloudDrizzle size={size} className={`weather-icon-drizzle ${className}`} style={{ color: 'var(--accent-blue)' }} {...props} />;
      case 'cloud-snow':
        return <CloudSnow size={size} className={`weather-icon-snow ${className}`} style={{ color: 'var(--accent-cyan)' }} {...props} />;
      default:
        return <CloudSun size={size} className={className} {...props} />;
    }
  };

  return <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{getIconComponent()}</div>;
}
