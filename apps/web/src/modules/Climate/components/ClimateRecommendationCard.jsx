import { useState } from 'react';
import useClimate from '../hooks/useClimate';
import { Droplets, HeartPulse, Sprout, Calendar } from 'lucide-react';

export default function ClimateRecommendationCard() {
  const { interpretations, current, loading } = useClimate();
  const [activeCategory, setActiveCategory] = useState('spraying'); // 'spraying', 'irrigation', 'disease', 'harvest'

  if (loading && !interpretations) {
    return (
      <div className="glass-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Cargando interpretaciones agronómicas...
      </div>
    );
  }

  if (!interpretations || !current) {
    return (
      <div className="glass-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Pendiente de datos del clima para analizar riesgos.
      </div>
    );
  }

  // Mapear los datos según la categoría seleccionada
  const getCategoryData = () => {
    switch (activeCategory) {
      case 'irrigation':
        return {
          title: 'RECOMENDACIÓN DE RIEGO',
          label: interpretations.irrigation.recommendation,
          score: interpretations.irrigation.score,
          badgeClass: interpretations.irrigation.badgeClass,
          message: interpretations.irrigation.message,
          details: interpretations.irrigation.details,
          icon: <Droplets size={18} />
        };
      case 'disease':
        return {
          title: 'RIESGO DE ENFERMEDADES',
          label: `Riesgo ${interpretations.disease.status}`,
          score: interpretations.disease.score,
          badgeClass: interpretations.disease.badgeClass,
          message: interpretations.disease.message,
          details: interpretations.disease.details,
          icon: <Sprout size={18} />
        };
      case 'harvest':
        return {
          title: 'VIABILIDAD DE COSECHA',
          label: interpretations.harvest.status,
          score: interpretations.harvest.score,
          badgeClass: interpretations.harvest.badgeClass,
          message: interpretations.harvest.message,
          details: interpretations.harvest.details,
          icon: <Calendar size={18} />
        };
      case 'spraying':
      default:
        return {
          title: 'RIESGO DE APLICACIÓN',
          label: interpretations.spraying.status,
          score: interpretations.spraying.score,
          badgeClass: interpretations.spraying.badgeClass,
          message: interpretations.spraying.message,
          details: interpretations.spraying.details,
          icon: <HeartPulse size={18} />
        };
    }
  };

  const activeData = getCategoryData();

  const categories = [
    { id: 'spraying', label: 'Aplicaciones', icon: <HeartPulse size={16} /> },
    { id: 'irrigation', label: 'Riego', icon: <Droplets size={16} /> },
    { id: 'disease', label: 'Enfermedades', icon: <Sprout size={16} /> },
    { id: 'harvest', label: 'Cosecha', icon: <Calendar size={16} /> }
  ];

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Selector de Categoría Agronómica */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="card-label">Interpretación Agronómica</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {categories.map(cat => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: isActive ? 'var(--primary-light)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: isActive ? '700' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'var(--font-sans)'
              }}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />

      {/* Tarjeta de Estatus de Riesgo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.05em' }}>
          {activeData.title}
        </span>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: activeData.score > 75 
              ? 'var(--accent-red-light)' 
              : activeData.score > 50 
                ? 'rgba(234, 88, 12, 0.1)' 
                : activeData.score > 25 
                  ? 'var(--accent-gold-light)' 
                  : 'var(--primary-light)',
            color: activeData.score > 75 
              ? 'var(--accent-red)' 
              : activeData.score > 50 
                ? '#ea580c' 
                : activeData.score > 25 
                  ? 'var(--accent-gold)' 
                  : 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: '800'
          }}>
            {activeData.icon}
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, textTransform: 'uppercase', color: activeData.score > 75 ? 'var(--accent-red)' : activeData.score > 50 ? '#ea580c' : 'var(--text-primary)' }}>
              {activeData.label}
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Índice de severidad: <strong>{activeData.score}/100</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Valores del Clima Actual para Confirmación */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '8px 12px',
        backgroundColor: 'rgba(255,255,255,0.015)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Viento:</span>
          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{current.windSpeed.toFixed(0)} km/h</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Prob. lluvia:</span>
          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{current.precipitationProbability}%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Humedad:</span>
          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{current.relativeHumidity}%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Índice UV:</span>
          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{current.uvIndex.toFixed(0)}</span>
        </div>
      </div>

      {/* Caja de Recomendación Contextual */}
      <div style={{
        backgroundColor: activeData.score > 75 
          ? 'rgba(220, 38, 38, 0.08)' 
          : activeData.score > 50 
            ? 'rgba(234, 88, 12, 0.08)' 
            : activeData.score > 25 
              ? 'rgba(217, 119, 6, 0.08)' 
              : 'rgba(16, 185, 129, 0.08)',
        borderLeft: `3px solid ${activeData.score > 75 ? 'var(--accent-red)' : activeData.score > 50 ? '#ea580c' : activeData.score > 25 ? 'var(--accent-gold)' : 'var(--primary)'}`,
        borderRadius: '0 8px 8px 0',
        padding: '12px',
        fontSize: '12px',
        lineHeight: '1.4',
        color: 'var(--text-secondary)'
      }}>
        {activeData.message}
      </div>

      {/* Lista detallada de justificaciones de riesgo */}
      {activeData.details && activeData.details.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>FACTORES DE ANALISIS:</span>
          <ul style={{ paddingLeft: '16px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {activeData.details.map((detail, idx) => (
              <li key={idx} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                {detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
