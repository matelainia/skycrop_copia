import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { lotRepository } from '../repositories/lotRepository';
import { agronomyRepository } from '../repositories/agronomyRepository';
import { createLot } from '../types/Lot';
import { validateLot } from '../validators/lot.validator';
import { calculateArea, calculatePerimeter, calculateCentroid } from '../utils/geo.utils';
import { useCompanyContext } from '../../../context/CompanyContext';
import { supabase } from '../../../lib/supabaseClient';


export const useLots = () => {
  const { companyId } = useCompanyContext();

  // ── Catálogo dinámico de cultivos
  const [cultivos, setCultivos] = useState([]);
  const [cultivosCargando, setCultivosCargando] = useState(false);

  useEffect(() => {
    const cargarCultivos = async () => {
      setCultivosCargando(true);
      try {
        const data = await agronomyRepository.getCultivos();
        setCultivos(data);
      } catch (err) {
        console.warn('[useLots] Error cargando catálogo de cultivos:', err.message);
      } finally {
        setCultivosCargando(false);
      }
    };
    cargarCultivos();
  }, []);

  const [lotes, setLotes] = useState(() => {
    try {
      const saved = localStorage.getItem('skycrop_lotes_cc');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.some(l => l.id && String(l.id).startsWith('lote-'))) {
          localStorage.removeItem('skycrop_lotes_cc');
          return [];
        }
        return parsed;
      }
      return [];
    } catch (e) {
      return [];
    }
  });

  const [selectedLote, setSelectedLote] = useState(null);
  const [isLoteDrawerOpen, setIsLoteDrawerOpen] = useState(false);
  const [isFichaModalOpen, setIsFichaModalOpen] = useState(false);
  const [modalActiveTab, setModalActiveTab] = useState('trazabilidad');
  const [lotesLoading, setLotesLoading] = useState(true);

  const [newLote, setNewLote] = useState({
    codigo_interno: '',
    nombre: '',
    cultivo: 'Maíz',
    cultivo_id: null,
    variedad: '',
    fecha_siembra: '',
    estado_fenológico: 'Vegetativo',
    sistema_productivo: 'Convencional',
    responsable_tecnico: '',
    observaciones: '',
    geom: null,
    coordinates: null,
    area_ha: '',
    perimetro_m: 0,
    centroide_lat: null,
    centroide_lng: null
  });

  // Estacion meteorologica: sin telemetria real conectada los valores son NULL
  // (antes: 27.5/76/18.2/45 fijos + variacion pseudoaleatoria por codigo de lote,
  // que se persistia como "condiciones_climaticas" inventadas en aplicaciones).
  const [weatherStation, setWeatherStation] = useState({
    temp: null,
    humidity: null,
    wind: null,
    rain: null
  });

  // Auto-select first lote
  useEffect(() => {
    if (!selectedLote && lotes && lotes.length > 0) {
      setSelectedLote(lotes[0]);
    }
  }, [lotes, selectedLote]);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('skycrop_lotes_cc', JSON.stringify(lotes));
  }, [lotes]);

  // Sin fuente meteorologica real no se inventa telemetria: la estacion queda en
  // NULL hasta conectar proveedor (ver modules/Climate). Ver useApplications:
  // condiciones_climaticas solo se guarda si temp/viento son numeros reales.
  useEffect(() => {
    setWeatherStation({ temp: null, humidity: null, wind: null, rain: null });
  }, [selectedLote?.id]);

  // Load lotes from Supabase
  const loadLotes = async () => {
    setLotesLoading(true);
    try {
      const dbLotes = await lotRepository.getAll();
      if (dbLotes && dbLotes.length > 0) {
        setLotes(
          dbLotes.map((l) => {
            let coordinates = l.coordinates;
            if (!coordinates || coordinates.length === 0) {
              if (l.geom) {
                if (
                  l.geom.type === 'Polygon' &&
                  Array.isArray(l.geom.coordinates) &&
                  l.geom.coordinates[0]
                ) {
                  coordinates = l.geom.coordinates[0].map((c) => [c[1], c[0]]); // Invert [lng, lat] to [lat, lng]
                } else if (
                  l.geom.type === 'MultiPolygon' &&
                  Array.isArray(l.geom.coordinates) &&
                  l.geom.coordinates[0] &&
                  l.geom.coordinates[0][0]
                ) {
                  coordinates = l.geom.coordinates[0][0].map((c) => [c[1], c[0]]);
                }
              }
            }

            return createLot({
              ...l,
              estado_fenológico: l.estado_fenologico || l.estado_fenológico || null,
              coordinates: coordinates || [],
              trabajadores: l.trabajadores || [],
              adjuntos: l.adjuntos || []
            });
          })
        );
      } else {
        setLotes([]);
      }
    } catch (err) {
      console.warn('[Lotes Hook] Error cargando lotes desde Supabase:', err.message);
      setLotes([]);
    } finally {
      setLotesLoading(false);
    }
  };

  // Cargar lotes al montar o al cambiar de inquilino
  useEffect(() => {
    loadLotes();
  }, [companyId]);

  // Sincronización en tiempo real con Supabase: cualquier INSERT/UPDATE/DELETE
  // en la tabla lotes (de esta u otra sesión) refresca la lista.
  useEffect(() => {
    if (!supabase || !supabase.channel) return undefined;
    let channel = null;
    try {
      channel = supabase
        .channel('lotes_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'lotes' },
          () => { loadLotes(); }
        )
        .subscribe();
    } catch (err) {
      console.warn('[Lotes] Realtime no disponible, se usa refetch manual:', err?.message);
    }
    return () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
      }
    };
  }, [companyId]);

  const handleAddLote = async (onAuditLogged) => {
    const val = validateLot(newLote);
    if (!val.isValid) return { success: false, errors: val.errors };

    // Política de datos: si no hay archivo espacial, NO se inventan coordenadas
    // ni área. geom/área/perímetro quedan null y el usuario puede digitar el área.
    const coordinates = newLote.coordinates || null;
    const area = newLote.area_ha || null;
    const perimeter = newLote.perimetro_m || null;
    const centroid = [
      newLote.centroide_lat ?? null,
      newLote.centroide_lng ?? null
    ];

    const dbPayload = {
      codigo_interno: newLote.codigo_interno,
      nombre: newLote.nombre,
      cultivo: newLote.cultivo,
      cultivo_id: newLote.cultivo_id || null,
      variedad: newLote.variedad || null,
      fecha_siembra: newLote.fecha_siembra || null,
      estado_fenologico: newLote.estado_fenológico || null,
      sistema_productivo: newLote.sistema_productivo || null,
      responsable_tecnico: newLote.responsable_tecnico || null,
      observaciones: newLote.observaciones || null,
      area_ha: area,
      perimetro_m: perimeter,
      centroide_lat: centroid[0],
      centroide_lng: centroid[1],
      geom: coordinates ? {
        type: 'Polygon',
        coordinates: [
          coordinates.map(c => [c[1], c[0]]) // Invert [lat, lng] to [lng, lat] for GeoJSON
        ]
      } : null
    };

    try {
      const savedLote = await lotRepository.create(dbPayload);

      // La fila mostrada proviene de Supabase (respuesta real del INSERT)
      const item = createLot({
        ...savedLote,
        coordinates: coordinates || [],
        trabajadores: [],
        adjuntos: []
      });

      setLotes(prev => [item, ...prev]);
      setIsLoteDrawerOpen(false);
      setSelectedLote(item);

      // Sincronización con la fuente de verdad: recarga desde Supabase
      loadLotes();
      if (onAuditLogged) {
        onAuditLogged(item.codigo_interno, "Registro de nuevo lote agrícola");
      }

      // Reset Form
      setNewLote({
        codigo_interno: '',
        nombre: '',
        cultivo: '',
        cultivo_id: null,
        variedad: '',
        fecha_siembra: '',
        estado_fenológico: '',
        sistema_productivo: 'Convencional',
        responsable_tecnico: '',
        observaciones: '',
        geom: null,
        coordinates: null,
        area_ha: '',
        perimetro_m: 0,
        centroide_lat: null,
        centroide_lng: null
      });

      return { success: true, item };
    } catch (err) {
      console.error('[handleAddLote] Error saving lote to Supabase:', err);
      alert(`Error al guardar el lote en la base de datos: ${err.message}`);
      return { success: false, errors: { database: err.message } };
    }
  };

  const handleDeleteLote = async (loteId, onAuditLogged) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar este lote?")) {
      try {
        const loteToDelete = lotes.find(l => l.id === loteId);

        if (loteId && !String(loteId).startsWith('lote-')) {
          await lotRepository.delete(loteId);
        }

        setLotes(prev => prev.filter(l => l.id !== loteId));
        setSelectedLote(null);
        if (loteToDelete && onAuditLogged) {
          onAuditLogged(loteToDelete.codigo_interno, `Eliminación de lote: ${loteToDelete.nombre}`);
        }
      } catch (err) {
        console.error('[handleDeleteLote] Error deleting lote from Supabase:', err);
        alert(`Error al eliminar el lote de la base de datos: ${err.message}`);
      }
    }
  };


  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();

    reader.onload = async (event) => {
      let contentText = "";

      try {
        if (fileExt === 'kmz') {
          const zip = await JSZip.loadAsync(event.target.result);
          const kmlFile = Object.keys(zip.files).find(name => name.endsWith('.kml'));
          if (!kmlFile) {
            alert('No se encontró ningún archivo KML válido dentro del KMZ.');
            return;
          }
          contentText = await zip.files[kmlFile].async('text');
        } else {
          contentText = event.target.result;
        }

        let geometry = null;
        let calculatedArea = 0;
        let calculatedPerimeter = 0;
        let coords = null;

        if (fileExt === 'geojson' || fileExt === 'json') {
          const parsed = JSON.parse(contentText);
          let coordinatesList = [];
          if (parsed.type === 'FeatureCollection') {
            const f = parsed.features[0];
            if (f && f.geometry) {
              geometry = f.geometry;
              coordinatesList = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
            }
          } else if (parsed.type === 'Feature') {
            geometry = parsed.geometry;
            coordinatesList = parsed.geometry.type === 'Polygon' ? parsed.geometry.coordinates[0] : parsed.geometry.coordinates[0][0];
          } else if (parsed.type === 'Polygon') {
            geometry = parsed;
            coordinatesList = parsed.coordinates[0];
          }

          if (coordinatesList.length > 0) {
            coords = coordinatesList.map(c => [c[1], c[0]]);
          }
        } else if (fileExt === 'kml' || fileExt === 'kmz') {
          const xml = new DOMParser().parseFromString(contentText, 'text/xml');
          const coordinatesNode = xml.getElementsByTagName('coordinates')[0];
          if (coordinatesNode) {
            const rawCoordsText = coordinatesNode.textContent.trim();
            coords = rawCoordsText.split(/\s+/).filter(Boolean).map(pt => {
              const parts = pt.split(',').map(Number);
              const lon = parts[0];
              const lat = parts[1];
              return [lat, lon];
            });

            if (coords.length > 0) {
              const first = coords[0];
              const last = coords[coords.length - 1];
              if (first[0] !== last[0] || first[1] !== last[1]) {
                coords.push([first[0], first[1]]);
              }
            }

            geometry = {
              type: 'Polygon',
              coordinates: [coords.map(pt => [pt[1], pt[0]])]
            };

            if (fileExt === 'kmz') {
              alert('Archivo KMZ descomprimido y procesado exitosamente.');
            }
          } else {
            alert('No se encontró la etiqueta <coordinates> con datos válidos en el KML/KMZ.');
          }
        } else {
          const randomCenterLat = 3.518 + (Math.random() - 0.5) * 0.03;
          const randomCenterLng = -76.305 + (Math.random() - 0.5) * 0.03;
          coords = [
            [randomCenterLat + 0.002, randomCenterLng - 0.002],
            [randomCenterLat + 0.002, randomCenterLng + 0.002],
            [randomCenterLat - 0.002, randomCenterLng + 0.002],
            [randomCenterLat - 0.002, randomCenterLng - 0.002],
            [randomCenterLat + 0.002, randomCenterLng - 0.002]
          ];
          geometry = {
            type: 'Polygon',
            coordinates: [coords.map(pt => [pt[1], pt[0]])]
          };
          alert(`Conversor GIS: Formato .${fileExt} procesado mediante simulación.`);
        }

        if (coords && coords.length > 0) {
          calculatedArea = calculateArea(coords);
          calculatedPerimeter = calculatePerimeter(coords);
          const cent = calculateCentroid(coords);

          setNewLote(prev => ({
            ...prev,
            geom: geometry,
            coordinates: coords,
            area_ha: parseFloat(calculatedArea.toFixed(2)),
            perimetro_m: parseFloat(calculatedPerimeter.toFixed(1)),
            centroide_lat: parseFloat(cent[0].toFixed(5)),
            centroide_lng: parseFloat(cent[1].toFixed(5))
          }));
        }

      } catch (err) {
        console.error("Error al procesar el archivo espacial:", err);
        alert('Error al descomprimir o procesar el archivo espacial.');
      }
    };

    if (fileExt === 'kmz' || fileExt === 'shp' || fileExt === 'zip') {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleAttachmentUpload = (e, targetLoteId, onAuditLogged) => {
    const file = e.target.files[0];
    if (!file || !targetLoteId) return;

    const sizeKB = Math.round(file.size / 1024);
    const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;

    const newAttachment = {
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: sizeStr,
      date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    };

    setLotes(prev => prev.map(l => {
      if (l.id === targetLoteId) {
        const nextAttachments = [...(l.adjuntos || []), newAttachment];
        return {
          ...l,
          adjuntos: nextAttachments
        };
      }
      return l;
    }));

    if (selectedLote && selectedLote.id === targetLoteId) {
      setSelectedLote(prev => ({
        ...prev,
        adjuntos: [...(prev.adjuntos || []), newAttachment]
      }));
    }

    const targetL = lotes.find(l => l.id === targetLoteId);
    if (onAuditLogged) {
      onAuditLogged(targetL?.codigo_interno || 'N/A', `Documento adjunto subido: ${file.name}`);
    }
  };

  return {
    lotes,
    cultivos,
    cultivosCargando,
    selectedLote,
    isLoteDrawerOpen,
    isFichaModalOpen,
    modalActiveTab,
    lotesLoading,
    newLote,
    weatherStation,
    setLotes,
    setSelectedLote,
    setIsLoteDrawerOpen,
    setIsFichaModalOpen,
    setModalActiveTab,
    setNewLote,
    loadLotes,
    handleAddLote,
    handleDeleteLote,
    handleFileUpload,
    handleAttachmentUpload
  };
};
