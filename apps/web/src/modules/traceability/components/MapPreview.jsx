import React from 'react';

/**
 * MapPreview — vista previa de ubicación sin dependencias externas.
 * Usa OpenStreetMap embed solo si hay coordenadas; si no, empty-state.
 */
export function MapPreview({ latitud, longitud, ubicacionTexto }) {
  if (latitud == null || longitud == null) {
    return (
      <div className="trz-map-empty">
        <span>📍</span>
        <p>{ubicacionTexto || 'Sin coordenadas registradas para este evento.'}</p>
      </div>
    );
  }
  const delta = 0.01;
  const bbox = `${longitud - delta},${latitud - delta},${longitud + delta},${latitud + delta}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitud},${longitud}`;
  return (
    <div className="trz-map">
      <iframe title="Ubicación del evento" src={src} loading="lazy" />
      <div className="trz-map-coords">
        📍 {Number(latitud).toFixed(6)}, {Number(longitud).toFixed(6)}
        {ubicacionTexto ? ` · ${ubicacionTexto}` : ''}
      </div>
    </div>
  );
}

export default MapPreview;
