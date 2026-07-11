import { useState, useMemo, useRef } from 'react';
import { useClimateContext } from '../context/ClimateContext';
import { formatHour12 } from '../utils/climateUtils';

export default function ClimateHourlyChart() {
  const { weatherData, activeTab, loading } = useClimateContext();
  const containerRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const hourly = useMemo(() => weatherData?.hourly || [], [weatherData?.hourly]);

  // Configuración de la variable activa
  const config = useMemo(() => {
    switch (activeTab) {
      case 'precipitación':
        return {
          key: 'precipitationProbability',
          unit: '%',
          color: '#3b82f6', // Blue
          gradientId: 'grad-precip',
          yMin: 0,
          yMax: 100,
          label: 'Probabilidad de Lluvia'
        };
      case 'humedad':
        return {
          key: 'relativeHumidity',
          unit: '%',
          color: '#14b8a6', // Teal
          gradientId: 'grad-humidity',
          yMin: 0,
          yMax: 100,
          label: 'Humedad Relativa'
        };
      case 'viento':
        return {
          key: 'windSpeed',
          unit: ' km/h',
          color: '#a855f7', // Purple
          gradientId: 'grad-wind',
          yMin: 0,
          yMax: null, // Dinámico
          label: 'Velocidad del Viento'
        };
      case 'temperatura':
      default:
        return {
          key: 'temperature',
          unit: '°C',
          color: '#f59e0b', // Gold / Amber
          gradientId: 'grad-temp',
          yMin: null, // Dinámico
          yMax: null, // Dinámico
          label: 'Temperatura'
        };
    }
  }, [activeTab]);

  // Filtrar o muestrear 9 puntos (cada 3 horas aprox) para calzar con el mockup
  const chartPoints = useMemo(() => {
    if (hourly.length === 0) return [];
    
    // Muestreo de 9 puntos de la lista de 24h
    const indices = [0, 3, 6, 9, 12, 15, 18, 21, 23];
    return indices.map(idx => {
      const item = hourly[idx] || hourly[hourly.length - 1];
      return {
        time: item.time,
        label: formatHour12(item.time),
        val: item[config.key]
      };
    });
  }, [hourly, config.key]);

  // Dimensiones del SVG
  const width = 800;
  const height = 240;
  const paddingLeft = 40;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 40;

  // Límites dinámicos de Y
  const yLimits = useMemo(() => {
    if (chartPoints.length === 0) return { min: 0, max: 100 };
    
    let min = config.yMin;
    let max = config.yMax;

    if (min === null) {
      min = Math.min(...chartPoints.map(p => p.val)) - 2;
      if (min < 0) min = 0;
    }
    if (max === null) {
      max = Math.max(...chartPoints.map(p => p.val)) + 2;
    }

    // Evitar que max sea igual a min
    if (max === min) max += 10;

    return { min, max };
  }, [chartPoints, config.yMin, config.yMax]);

  // Coordenadas calculadas en base a las dimensiones del SVG
  const coords = useMemo(() => {
    if (chartPoints.length === 0) return [];
    
    const xRange = width - paddingLeft - paddingRight;
    const yRange = height - paddingTop - paddingBottom;
    const xStep = xRange / (chartPoints.length - 1);

    return chartPoints.map((p, idx) => {
      const x = paddingLeft + idx * xStep;
      // Invertir Y (el origen 0,0 del SVG está arriba a la izquierda)
      const ratio = (p.val - yLimits.min) / (yLimits.max - yLimits.min);
      const y = height - paddingBottom - ratio * yRange;
      return { x, y, val: p.val, label: p.label };
    });
  }, [chartPoints, yLimits]);

  // Generar path Bézier cúbico suavizado
  const bezierPath = useMemo(() => {
    if (coords.length === 0) return '';
    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i];
      const p1 = coords[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 3;
      const cpY1 = p0.y;
      const cpX2 = p0.x + 2 * (p1.x - p0.x) / 3;
      const cpY2 = p1.y;
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return d;
  }, [coords]);

  // Path cerrado para el degradado de fondo
  const areaPath = useMemo(() => {
    if (coords.length === 0) return '';
    const bottomY = height - paddingBottom;
    return `${bezierPath} L ${coords[coords.length - 1].x} ${bottomY} L ${coords[0].x} ${bottomY} Z`;
  }, [coords, bezierPath]);

  // Evento mouse hover
  const handleMouseMove = (e) => {
    if (!containerRef.current || coords.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPos = ((e.clientX - rect.left) / rect.width) * width;

    // Encontrar la coordenada más cercana en X
    let closestIdx = 0;
    let minDiff = Math.abs(coords[0].x - xPos);

    for (let i = 1; i < coords.length; i++) {
      const diff = Math.abs(coords[i].x - xPos);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    setHoverIndex(closestIdx);
    setTooltipPos({
      x: coords[closestIdx].x,
      y: coords[closestIdx].y
    });
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  // Ejes horizontales de referencia
  const gridLines = useMemo(() => {
    const lines = [];
    const steps = 3;
    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps;
      const val = yLimits.min + ratio * (yLimits.max - yLimits.min);
      const y = height - paddingBottom - ratio * (height - paddingTop - paddingBottom);
      lines.push({ y, label: `${Math.round(val)}${config.unit}` });
    }
    return lines;
  }, [yLimits, config.unit]);

  if (loading && hourly.length === 0) {
    return (
      <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Cargando pronóstico gráfico...
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
      <div 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ width: '100%', cursor: 'crosshair' }}
      >
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          width="100%" 
          height="100%" 
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* Degradado para Temperatura */}
            <linearGradient id="grad-temp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.00" />
            </linearGradient>
            {/* Degradado para Precipitación */}
            <linearGradient id="grad-precip" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.00" />
            </linearGradient>
            {/* Degradado para Humedad */}
            <linearGradient id="grad-humidity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.00" />
            </linearGradient>
            {/* Degradado para Viento */}
            <linearGradient id="grad-wind" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Rejilla de Fondo */}
          {gridLines.map((line, idx) => (
            <g key={idx}>
              <line 
                x1={paddingLeft} 
                y1={line.y} 
                x2={width - paddingRight} 
                y2={line.y} 
                stroke="var(--border-color)" 
                strokeWidth="1" 
                strokeDasharray="4 6"
              />
              <text 
                x={paddingLeft - 8} 
                y={line.y + 4} 
                fill="var(--text-muted)" 
                fontSize="10" 
                textAnchor="end"
                fontWeight="500"
              >
                {line.label}
              </text>
            </g>
          ))}

          {/* Gráfico de Área Degradada */}
          {coords.length > 0 && (
            <path 
              d={areaPath} 
              fill={`url(#${config.gradientId})`} 
            />
          )}

          {/* Gráfico de Línea Curva */}
          {coords.length > 0 && (
            <path 
              d={bezierPath} 
              fill="none" 
              stroke={config.color} 
              strokeWidth="3.5" 
              strokeLinecap="round"
            />
          )}

          {/* Puntos de Referencia y Valores de Datos */}
          {coords.map((c, idx) => {
            const isHovered = hoverIndex === idx;
            return (
              <g key={idx}>
                {/* Punto */}
                <circle 
                  cx={c.x} 
                  cy={c.y} 
                  r={isHovered ? 6 : 4} 
                  fill="var(--bg-app)" 
                  stroke={config.color} 
                  strokeWidth={isHovered ? 3.5 : 2.5}
                  style={{ transition: 'r 0.15s, stroke-width 0.15s' }}
                />
                
                {/* Etiqueta de valor sobre el punto */}
                {!isHovered && (
                  <text
                    x={c.x}
                    y={c.y - 10}
                    fill="var(--text-primary)"
                    fontSize="11"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {Math.round(c.val)}{config.unit.trim()}
                  </text>
                )}
                
                {/* Etiqueta horaria del eje X */}
                <text
                  x={c.x}
                  y={height - 12}
                  fill={isHovered ? 'var(--text-primary)' : 'var(--text-muted)'}
                  fontSize="11"
                  fontWeight={isHovered ? '700' : '500'}
                  textAnchor="middle"
                >
                  {c.label}
                </text>
              </g>
            );
          })}

          {/* Elementos Interactivos del Hover */}
          {hoverIndex !== null && (
            <g>
              {/* Línea vertical de guía */}
              <line 
                x1={tooltipPos.x} 
                y1={paddingTop} 
                x2={tooltipPos.x} 
                y2={height - paddingBottom} 
                stroke={config.color} 
                strokeWidth="1.5" 
                strokeDasharray="3 3"
              />
              
              {/* Punto indicador de zoom */}
              <circle 
                cx={tooltipPos.x} 
                cy={tooltipPos.y} 
                r="10" 
                fill={config.color} 
                fillOpacity="0.2"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Tooltip flotante en HTML para mejor look visual */}
      {hoverIndex !== null && coords[hoverIndex] && (
        <div 
          style={{
            position: 'absolute',
            left: `${(tooltipPos.x / width) * 100}%`,
            top: `${(tooltipPos.y / height) * 100 - 38}%`,
            transform: 'translate(-50%, -100%)',
            backgroundColor: 'var(--bg-sidebar)',
            border: `1px solid ${config.color}`,
            borderRadius: '6px',
            padding: '6px 10px',
            boxShadow: 'var(--card-shadow)',
            pointerEvents: 'none',
            zIndex: 10,
            whiteSpace: 'nowrap',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>
            {coords[hoverIndex].label.toUpperCase()}
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '800' }}>
            {coords[hoverIndex].val.toFixed(1)}{config.unit}
          </span>
        </div>
      )}
    </div>
  );
}
