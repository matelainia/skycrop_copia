import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

export default function ContextualTooltip({ alerta, ingrediente }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, position: 'right' });
  const triggerRef = useRef(null);

  if (!alerta) return null;

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 350; // ancho de max-w-sm
    const tooltipHeight = 250; // altura aproximada máxima
    
    let left = rect.right + 12; // por defecto a la derecha
    let top = rect.top + window.scrollY + (rect.height / 2);
    let position = 'right';

    // Validar si se desborda por el lado derecho de la pantalla
    if (left + tooltipWidth > window.innerWidth) {
      // Intentar posicionar a la izquierda
      left = rect.left - tooltipWidth - 12;
      position = 'left';
    }

    // Validar si se desborda por el lado izquierdo
    if (left < 0) {
      // Intentar posicionar arriba
      left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
      top = rect.top + window.scrollY - 12;
      position = 'top';
    }

    // Asegurar que no se salga de los márgenes laterales mínimos
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));

    setCoords({ top, left, position });
  };

  useEffect(() => {
    if (visible) {
      updatePosition();
      // Escuchar cambios de tamaño y scroll para reposicionar
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [visible]);

  // Determinar colores y estilos según la categoría toxicológica
  const isCatIA = ['IA', '1A'].includes((alerta.categoria || '').toUpperCase().trim());
  const alertColorClass = isCatIA ? '#b91c1c' : '#ef4444'; // Red-700 vs Red-500
  const bgColorStyle = isCatIA ? 'rgba(185, 28, 28, 0.08)' : 'rgba(239, 68, 68, 0.08)';
  const borderColorStyle = isCatIA ? 'rgba(185, 28, 28, 0.18)' : 'rgba(239, 68, 68, 0.18)';

  // Definir transformación y animación de entrada según la posición
  const transformStyle = coords.position === 'top'
    ? 'translateY(-100%) scale(0.96)'
    : 'translateY(-50%) scale(0.96)';

  const animationStyle = coords.position === 'top'
    ? 'tooltipFadeInTop 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards'
    : 'tooltipFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards';

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          marginLeft: '8px',
          cursor: 'pointer',
          verticalAlign: 'middle'
        }}
      >
        <AlertTriangle
          size={16}
          style={{
            color: alertColorClass,
            animation: 'tooltipPulse 2s infinite ease-in-out'
          }}
        />
      </span>

      {visible &&
        createPortal(
          <div
            style={{
              position: 'absolute',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 99999,
              transform: transformStyle,
              opacity: 0,
              width: '350px',
              maxWidth: 'calc(100vw - 24px)',
              background: '#ffffff',
              border: `1px solid var(--border-color, #e5e7eb)`,
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              animation: animationStyle,
              fontFamily: 'Inter, system-ui, sans-serif',
              pointerEvents: 'none'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Encabezado de Alerta */}
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    background: alertColorClass,
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: '700',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {alerta.titulo}
                </span>
              </div>

              {/* Nombre de Ingrediente Activo */}
              <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#111827' }}>
                {ingrediente}
              </div>

              {/* Mensaje de Advertencia */}
              <p
                style={{
                  fontSize: '12px',
                  color: '#4b5563',
                  lineHeight: '1.55',
                  margin: 0
                }}
              >
                {alerta.mensaje}
              </p>

              {/* Caja de Recomendaciones */}
              {Array.isArray(alerta.recomendaciones) && alerta.recomendaciones.length > 0 && (
                <div
                  style={{
                    background: bgColorStyle,
                    border: `1px solid ${borderColorStyle}`,
                    borderRadius: '8px',
                    padding: '12px'
                  }}
                >
                  <div style={{ fontWeight: '700', fontSize: '11.5px', color: alertColorClass, marginBottom: '6px' }}>
                    Recomendaciones de Seguridad
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '16px',
                      fontSize: '11px',
                      color: '#374151',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      lineHeight: '1.4'
                    }}
                  >
                    {alerta.recomendaciones.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Animaciones CSS personalizadas */}
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes tooltipFadeIn {
                to {
                  transform: translateY(-50%) scale(1);
                  opacity: 1;
                }
              }
              @keyframes tooltipFadeInTop {
                to {
                  transform: translateY(-100%) scale(1);
                  opacity: 1;
                }
              }
              @keyframes tooltipPulse {
                0%, 100% {
                  transform: scale(1);
                  opacity: 1;
                }
                50% {
                  transform: scale(1.15);
                  opacity: 0.85;
                }
              }
            `}} />
          </div>,
          document.body
        )}
    </>
  );
}
