import { useRef } from 'react';
import useForecast from '../hooks/useForecast';
import WeatherIcon from './WeatherIcon';
import { getWeatherRule } from '../utils/rules/weatherRules';
import { ChevronLeft, ChevronRight, Droplets } from 'lucide-react';

export default function ClimateForecast() {
  const { daily } = useForecast();
  const scrollRef = useRef(null);

  // Formatear el nombre del día abreviado
  const getDayLabel = (dateString, idx) => {
    if (idx === 0) return { day: 'Vie', desc: 'Hoy' }; // Fallback inicial estático o dinámico
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return { day: 'Día', desc: '' };

    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Obtenemos el nombre localizado
    const dayName = days[date.getDay()];
    const dayNum = date.getDate();
    const monthName = months[date.getMonth()];

    // Traducción rápida de meses a español
    const monthsEs = {
      'Jan': 'Ene', 'Feb': 'Feb', 'Mar': 'Mar', 'Apr': 'Abr', 'May': 'May', 'Jun': 'Jun',
      'Jul': 'Jul', 'Aug': 'Ago', 'Sep': 'Sep', 'Oct': 'Oct', 'Nov': 'Nov', 'Dec': 'Dic'
    };

    return {
      day: dayName,
      desc: `${dayNum} ${monthsEs[monthName] || monthName}`
    };
  };

  const handleScroll = (dir) => {
    if (!scrollRef.current) return;
    const scrollAmount = 200;
    scrollRef.current.scrollBy({
      left: dir === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  if (daily.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Cargando pronóstico extendido...
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
      <div className="card-title-section" style={{ margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="card-label">Pronóstico 7 Días</span>
        
        <div style={{ display: 'flex', gap: '6px' }}>
          <button 
            onClick={() => handleScroll('left')} 
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid var(--border-color)', 
              color: 'var(--text-primary)', 
              borderRadius: '50%', 
              width: '28px', 
              height: '28px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            onClick={() => handleScroll('right')} 
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid var(--border-color)', 
              color: 'var(--text-primary)', 
              borderRadius: '50%', 
              width: '28px', 
              height: '28px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Lista Deslizable */}
      <div 
        ref={scrollRef}
        style={{
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          paddingBottom: '6px',
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none' // IE/Edge
        }}
        className="no-scrollbar"
      >
        {daily.map((day, idx) => {
          const { day: dayName, desc } = getDayLabel(day.date, idx);
          const wRule = getWeatherRule(day.weatherCode);
          const isToday = idx === 0;

          return (
            <div
              key={idx}
              style={{
                flex: '0 0 calc(14.28% - 11px)',
                minWidth: '100px',
                scrollSnapAlign: 'start',
                borderRadius: '12px',
                border: isToday ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                backgroundColor: isToday ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255,255,255,0.02)',
                padding: '16px 12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                boxShadow: isToday ? 'var(--glow-shadow)' : 'none'
              }}
            >
              <div>
                <span style={{ fontSize: '14px', fontWeight: '700', color: isToday ? 'var(--primary)' : 'var(--text-primary)' }}>
                  {dayName}
                </span>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  {desc}
                </p>
              </div>

              <div style={{ padding: '4px 0' }}>
                <WeatherIcon name={wRule.icon} size={36} className="floating-anim" />
              </div>

              <div style={{ display: 'flex', gap: '8px', fontSize: '13px', fontWeight: '700' }}>
                <span style={{ color: 'var(--text-primary)' }}>{Math.round(day.temperatureMax)}°</span>
                <span style={{ color: 'var(--text-muted)' }}>{Math.round(day.temperatureMin)}°</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                <Droplets size={12} style={{ color: 'var(--accent-blue)' }} />
                <span>{day.precipitationProbability}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
