import React from 'react';

/**
 * LeafLoader — Animación de carga oficial SkyCrop (4 hojas, bordes delgados).
 * Reemplaza todos los spinners / skeletons / textos "Cargando..." del sistema.
 *
 * @param {number} size - tamaño en px (ancho/alto del SVG). Default 96.
 * @param {string} text - texto bajo la animación. Default "Cargando...". Pasar null/"" para ocultar.
 * @param {object} style - estilos extra para el contenedor.
 */
export default function LeafLoader({ size = 96, text = 'Cargando...', style = {} }) {
  return (
    <div
      role="status"
      aria-label={text || 'Cargando'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        ...style,
      }}
    >
      <div style={{ width: size, height: size }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
          <defs>
            <style>{`
              .skycrop-leaf {
                stroke: #000;
                stroke-width: 3;
                stroke-linejoin: round;
                animation: skycrop-leaf-colorCycle 2s infinite linear;
              }
              @keyframes skycrop-leaf-colorCycle {
                0%, 100% { fill: #7CD354; }
                25% { fill: #4A4A4A; }
                50% { fill: #8F8F8F; }
                75% { fill: #C4C4C4; }
              }
              .skycrop-leaf-top { animation-delay: 0s; }
              .skycrop-leaf-right { animation-delay: -1.5s; }
              .skycrop-leaf-bottom { animation-delay: -1.0s; }
              .skycrop-leaf-left { animation-delay: -0.5s; }
            `}</style>
          </defs>

          <g id="spinner">
            {/* Hoja Superior */}
            <g>
              <path className="skycrop-leaf skycrop-leaf-top" d="M 100 85 C 80 85, 60 50, 100 10 C 140 50, 120 85, 100 85 Z" />
            </g>

            {/* Hoja Derecha */}
            <g transform="rotate(90 100 100)">
              <path className="skycrop-leaf skycrop-leaf-right" d="M 100 85 C 80 85, 60 50, 100 10 C 140 50, 120 85, 100 85 Z" />
            </g>

            {/* Hoja Inferior */}
            <g transform="rotate(180 100 100)">
              <path className="skycrop-leaf skycrop-leaf-bottom" d="M 100 85 C 80 85, 60 50, 100 10 C 140 50, 120 85, 100 85 Z" />
            </g>

            {/* Hoja Izquierda */}
            <g transform="rotate(270 100 100)">
              <path className="skycrop-leaf skycrop-leaf-left" d="M 100 85 C 80 85, 60 50, 100 10 C 140 50, 120 85, 100 85 Z" />
            </g>
          </g>
        </svg>
      </div>
      {text ? (
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-muted, #6B7280)',
            fontFamily: 'var(--font-sans, Inter, sans-serif)',
          }}
        >
          {text}
        </span>
      ) : null}
    </div>
  );
}
