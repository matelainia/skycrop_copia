import React, { useEffect, useRef, useState } from 'react';

export default function LeafletMap({
  lotes,
  selectedLote,
  setSelectedLote,
  mapLayer,
  loteFilterCultivo,
  loteFilterEstado,
  geeTileUrl
}) {
  const mapRef = useRef(null);
  const polygonsRef = useRef([]);
  const geeLayerRef = useRef(null);
  const [map, setMap] = useState(null);

  // 1. Initialise Map and Base Layers
  useEffect(() => {
    if (typeof window === 'undefined' || !window.L) return;
    const L = window.L;

    // Destroy existing instance if any
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const mapInst = L.map('sanitary-gis-map').setView([3.518, -76.305], 14);
    mapRef.current = mapInst;
    setMap(mapInst);

    // Satellite Tile Layer
    const satelliteTile = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Esri, USDA, USGS'
    });

    // Street Tile Layer
    const streetTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    });

    if (mapLayer === 'callejero') {
      streetTile.addTo(mapInst);
    } else {
      satelliteTile.addTo(mapInst);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMap(null);
    };
  }, []);

  // 2. Sync Base Layer changes (Street vs Satellite)
  useEffect(() => {
    if (!map || typeof window === 'undefined' || !window.L) return;
    const L = window.L;

    // Remove any existing standard layers to toggle
    map.eachLayer(layer => {
      if (layer instanceof L.TileLayer && !layer.options.maxZoom && !layer._url.includes('gee')) {
        map.removeLayer(layer);
      }
    });

    const satelliteTile = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Esri, USDA, USGS'
    });

    const streetTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    });

    if (mapLayer === 'callejero') {
      streetTile.addTo(map);
    } else {
      satelliteTile.addTo(map);
    }
  }, [map, mapLayer]);

  // 3. Auto center map when map or lotes geometry change
  useEffect(() => {
    if (!map || typeof window === 'undefined' || !window.L) return;
    const L = window.L;

    const validPolys = lotes
      .filter(l => Array.isArray(l.coordinates) && l.coordinates.length > 0);

    if (validPolys.length > 0) {
      const bounds = L.latLngBounds(validPolys.map(l => l.coordinates).flat());
      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [40, 40],
          maxZoom: 18,
          animate: true
        });
      }
    } else {
      // Default view if no lotes exist
      map.setView([3.518, -76.305], 14);
    }
  }, [map, JSON.stringify(lotes.map(l => ({ id: l.id, coords: l.coordinates })))]);

  // 4. Render Lotes Polygons
  useEffect(() => {
    if (!map || typeof window === 'undefined' || !window.L) return;
    const L = window.L;

    // Clear old polygons
    polygonsRef.current.forEach(p => map.removeLayer(p));
    polygonsRef.current = [];

    lotes.forEach(lote => {
      if (!lote.coordinates || lote.coordinates.length === 0) return;

      const matchesCultivo = loteFilterCultivo === 'Todos' || lote.cultivo === loteFilterCultivo;
      const matchesEstado = loteFilterEstado === 'Todos' || lote.estado_sanitario === loteFilterEstado;
      const isMatched = matchesCultivo && matchesEstado;

      let fillColor = '#16a34a';
      let fillOpacity = 0.45;
      let weight = 2;
      let borderColor = null;

      if (!isMatched) {
        fillColor = '#9ca3af';
        fillOpacity = 0.08;
        weight = 1;
        borderColor = '#d1d5db';
      } else {
        if (['ndvi', 'ndre', 'savi', 'humedad'].includes(mapLayer)) {
          fillColor = 'transparent';
          fillOpacity = 0.1;
          borderColor = '#22c55e';
        } else if (mapLayer === 'prod_layer') {
          fillOpacity = 0.5;
          if (lote.area_ha > 12) fillColor = '#6d28d9';
          else if (lote.area_ha > 8) fillColor = '#8b5cf6';
          else fillColor = '#c084fc';
          borderColor = fillColor;
        } else {
          if (lote.estado_sanitario === 'excelente') fillColor = '#16a34a';
          else if (lote.estado_sanitario === 'bueno') fillColor = '#22c55e';
          else if (lote.estado_sanitario === 'regular') fillColor = '#f59e0b';
          else if (lote.estado_sanitario === 'bajo') fillColor = '#dc2626';
          borderColor = fillColor;
        }
      }

      const polygon = L.polygon(lote.coordinates, {
        color: borderColor,
        fillColor: fillColor,
        fillOpacity: fillOpacity,
        weight: weight
      }).addTo(map);

      polygon.bindTooltip(`
        <strong>Lote ${lote.codigo_interno}</strong> - ${lote.cultivo}<br/>
        NDVI Vigor: ${lote.ndvi_actual}<br/>
        Área: ${lote.area_ha} ha<br/>
        Fenología: ${lote.estado_fenológico || 'N/A'}
      `, { sticky: true, direction: 'top' });

      polygon.on('click', () => {
        setSelectedLote(lote);
        map.panTo([lote.centroide_lat, lote.centroide_lng]);
      });

      polygonsRef.current.push(polygon);
    });
  }, [map, lotes, mapLayer, loteFilterCultivo, loteFilterEstado, selectedLote?.id]);

  // 5. Sync GEE Tile Layers
  useEffect(() => {
    if (!map || typeof window === 'undefined' || !window.L) return;
    const L = window.L;

    // Clear old GEE Layer
    if (geeLayerRef.current) {
      try {
        map.removeLayer(geeLayerRef.current);
      } catch (e) {}
      geeLayerRef.current = null;
    }

    const validIndices = ['ndvi', 'ndre', 'savi', 'humedad'];
    if (validIndices.includes(mapLayer) && selectedLote && selectedLote.coordinates && geeTileUrl) {
      const bounds = L.polygon(selectedLote.coordinates).getBounds();
      const layer = L.tileLayer(geeTileUrl, {
        bounds: bounds,
        maxZoom: 19,
        attribution: 'Google Earth Engine &copy; Sentinel-2'
      });
      layer.addTo(map);
      geeLayerRef.current = layer;
      map.fitBounds(bounds, { padding: [25, 25], maxZoom: 17 });
    }
  }, [map, geeTileUrl, mapLayer, selectedLote?.id]);

  return (
    <div id="sanitary-gis-map" className="gis-map-element" style={{ height: '100%', width: '100%' }}></div>
  );
}
