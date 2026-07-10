import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { lotRepository } from '../repositories/lotRepository';
import { createLot } from '../types/Lot';
import { validateLot } from '../validators/lot.validator';
import { calculateArea, calculatePerimeter, calculateCentroid } from '../utils/geo.utils';

const INITIAL_LOTES_MOCK = [
  {
    id: "d9b7f5d0-9d3b-4889-b88d-e4fb38f6d601",
    codigo_interno: "A1",
    nombre: "Lote A1 - Maíz Híbrido",
    cultivo: "Maíz",
    variedad: "DK-7088",
    fecha_siembra: "2026-02-15",
    estado_fenológico: "Vegetativo",
    sistema_productivo: "Convencional",
    responsable_tecnico: "Pedro Gómez",
    observaciones: "Vigor óptimo, aplicación de fungicida en curso para prevención de roya.",
    area_ha: 12.45,
    perimetro_m: 1842.6,
    centroide_lat: 3.5182,
    centroide_lng: -76.3054,
    estado_sanitario: "excelente",
    ndvi_actual: 0.78,
    ndvi_trend: "+0.03",
    disease_detected: "Ninguna (preventivo)",
    incidence_pct: 0,
    severity_pct: 0,
    trabajadores: [
      { id: "w1", nombre: "Pedro Gómez", actividad: "Aplicación de Fungicida", ingreso: "26 May 2026", duracion: "02:45:18" }
    ],
    adjuntos: [
      { name: "Receta_Agronomica_Roya.pdf", type: "application/pdf", size: "340 KB", date: "25 May 2026" }
    ],
    coordinates: [
      [3.521, -76.308],
      [3.522, -76.304],
      [3.516, -76.302],
      [3.515, -76.306],
      [3.521, -76.308]
    ]
  },
  {
    id: "d9b7f5d0-9d3b-4889-b88d-e4fb38f6d602",
    codigo_interno: "A2",
    nombre: "Lote A2 - Maíz Híbrido",
    cultivo: "Maíz",
    variedad: "DK-7088",
    fecha_siembra: "2026-02-18",
    estado_fenológico: "Floración",
    sistema_productivo: "Convencional",
    responsable_tecnico: "Pedro Gómez",
    observaciones: "Gusano cogollero detectado en nivel umbral bajo.",
    area_ha: 8.32,
    perimetro_m: 1120.4,
    centroide_lat: 3.5225,
    centroide_lng: -76.3012,
    estado_sanitario: "bueno",
    ndvi_actual: 0.69,
    ndvi_trend: "+0.01",
    disease_detected: "Gusano Cogollero",
    incidence_pct: 2.5,
    severity_pct: 0.5,
    trabajadores: [],
    adjuntos: [],
    coordinates: [
      [3.525, -76.303],
      [3.526, -76.299],
      [3.521, -76.297],
      [3.520, -76.301],
      [3.525, -76.303]
    ]
  },
  {
    id: "d9b7f5d0-9d3b-4889-b88d-e4fb38f6d603",
    codigo_interno: "B1",
    nombre: "Lote B1 - Soya Orgánica",
    cultivo: "Soya",
    variedad: "Soya-Org-1",
    fecha_siembra: "2026-03-10",
    estado_fenológico: "Vaina Llena",
    sistema_productivo: "Orgánico Certificado",
    responsable_tecnico: "Juan Pérez",
    observaciones: "Monitoreo de trips indica incremento leve de poblaciones.",
    area_ha: 15.60,
    perimetro_m: 1720.5,
    centroide_lat: 3.5135,
    centroide_lng: -76.3085,
    estado_sanitario: "regular",
    ndvi_actual: 0.56,
    ndvi_trend: "-0.02",
    disease_detected: "Trips del Frijol",
    incidence_pct: 8.4,
    severity_pct: 2.8,
    trabajadores: [],
    adjuntos: [],
    coordinates: [
      [3.515, -76.312],
      [3.516, -76.307],
      [3.511, -76.305],
      [3.510, -76.310],
      [3.515, -76.312]
    ]
  },
  {
    id: "d9b7f5d0-9d3b-4889-b88d-e4fb38f6d604",
    codigo_interno: "C1",
    nombre: "Lote C1 - Girasol",
    cultivo: "Girasol",
    variedad: "Helios-22",
    fecha_siembra: "2026-04-05",
    estado_fenológico: "Desarrollo Vegetativo",
    sistema_productivo: "Convencional",
    responsable_tecnico: "Laura Gómez",
    observaciones: "Mildiu foliar detectado en sector norte con estrés hídrico activo.",
    area_ha: 9.75,
    perimetro_m: 980.1,
    centroide_lat: 3.5115,
    centroide_lng: -76.3155,
    estado_sanitario: "bajo",
    ndvi_actual: 0.41,
    ndvi_trend: "-0.05",
    disease_detected: "Mildiu del Girasol",
    incidence_pct: 18.5,
    severity_pct: 12.0,
    trabajadores: [
      { id: "w2", nombre: "Laura Gómez", actividad: "Monitoreo fitosanitario", ingreso: "25 May 2026", duracion: "01:30:00" }
    ],
    adjuntos: [],
    coordinates: [
      [3.513, -76.318],
      [3.514, -76.314],
      [3.509, -76.313],
      [3.508, -76.317],
      [3.513, -76.318]
    ]
  },
  {
    id: "d9b7f5d0-9d3b-4889-b88d-e4fb38f6d605",
    codigo_interno: "D1",
    nombre: "Lote D1 - Cacao CCN51",
    cultivo: "Cacao",
    variedad: "CCN51",
    fecha_siembra: "2024-05-12",
    estado_fenológico: "Fructificación",
    sistema_productivo: "Agroforestal",
    responsable_tecnico: "Carlos Ruiz",
    observaciones: "Alta tasa de fotosíntesis. Sin plagas.",
    area_ha: 6.25,
    perimetro_m: 790.3,
    centroide_lat: 3.5165,
    centroide_lng: -76.3125,
    estado_sanitario: "excelente",
    ndvi_actual: 0.82,
    ndvi_trend: "+0.04",
    disease_detected: "Ninguna",
    incidence_pct: 0,
    severity_pct: 0,
    trabajadores: [],
    adjuntos: [],
    coordinates: [
      [3.518, -76.315],
      [3.519, -76.311],
      [3.514, -76.309],
      [3.513, -76.313],
      [3.518, -76.315]
    ]
  }
];

export const useLots = () => {
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
    variedad: '',
    fecha_siembra: '',
    estado_fenológico: 'Vegetativo',
    sistema_productivo: 'Convencional',
    responsable_tecnico: '',
    observaciones: '',
    geom: null,
    coordinates: null,
    area_ha: 0,
    perimetro_m: 0,
    centroide_lat: 3.518,
    centroide_lng: -76.305
  });

  // Weather station values
  const [weatherStation, setWeatherStation] = useState({
    temp: 27.5,
    humidity: 76,
    wind: 18.2,
    rain: 45
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

  // Dynamic Weather Telemetry variation per lot
  useEffect(() => {
    if (!selectedLote) return;
    const charSum = selectedLote.codigo_interno.charCodeAt(0) + (selectedLote.codigo_interno.charCodeAt(1) || 0);
    const tempVar = (charSum % 5) - 2;
    const humVar = (charSum % 15) - 7;
    const windVar = (charSum % 12) - 6;
    const rainVar = (charSum % 30) - 15;

    setWeatherStation({
      temp: parseFloat((27.5 + tempVar).toFixed(1)),
      humidity: Math.max(30, Math.min(95, 75 + humVar)),
      wind: parseFloat(Math.max(2.0, 14.5 + windVar).toFixed(1)),
      rain: Math.max(5, Math.min(90, 40 + rainVar))
    });
  }, [selectedLote?.id]);

  // Load lotes from Supabase
  const loadLotes = async () => {
    setLotesLoading(true);
    try {
      const dbLotes = await lotRepository.getAll();
      if (dbLotes && dbLotes.length > 0) {
        setLotes(dbLotes.map(l => {
          const localLote = INITIAL_LOTES_MOCK.find(il => il.codigo_interno === l.codigo_interno || il.nombre === l.nombre);
          return createLot({
            ...localLote,
            ...l,
            estado_fenológico: l.estado_fenologico || l.estado_fenológico || localLote?.estado_fenologico,
            coordinates: l.coordinates || localLote?.coordinates || [],
            trabajadores: l.trabajadores || localLote?.trabajadores || [],
            adjuntos: l.adjuntos || localLote?.adjuntos || []
          });
        }));
      } else {
        console.log('[Lotes Hook] No lotes returned from DB. Setting empty list.');
        setLotes([]);
      }
    } catch (err) {
      console.warn('[Lotes Hook] Error loading lotes from Supabase:', err.message);
    } finally {
      setLotesLoading(false);
    }
  };

  const handleAddLote = (onAuditLogged) => {
    const val = validateLot(newLote);
    if (!val.isValid) return { success: false, errors: val.errors };

    let defaultCoords = newLote.coordinates;
    let area = newLote.area_ha;
    let perimeter = newLote.perimetro_m;
    let centroid = [newLote.centroide_lat, newLote.centroide_lng];

    if (!defaultCoords) {
      const lat = 3.518;
      const lng = -76.305;
      defaultCoords = [
        [lat + 0.001, lng - 0.001],
        [lat + 0.001, lng + 0.001],
        [lat - 0.001, lng + 0.001],
        [lat - 0.001, lng - 0.001],
        [lat + 0.001, lng - 0.001]
      ];
      area = 4.0;
      perimeter = 800;
      centroid = [lat, lng];
    }

    const item = createLot({
      id: `lote-${Date.now()}`,
      codigo_interno: newLote.codigo_interno,
      nombre: newLote.nombre,
      cultivo: newLote.cultivo,
      variedad: newLote.variedad,
      fecha_siembra: newLote.fecha_siembra,
      estado_fenologico: newLote.estado_fenológico,
      sistema_productivo: newLote.sistema_productivo,
      responsable_tecnico: newLote.responsable_tecnico,
      observaciones: newLote.observaciones,
      area_ha: area,
      perimetro_m: perimeter,
      centroide_lat: centroid[0],
      centroide_lng: centroid[1],
      coordinates: defaultCoords
    });

    setLotes(prev => [item, ...prev]);
    setIsLoteDrawerOpen(false);
    setSelectedLote(item);
    if (onAuditLogged) {
      onAuditLogged(item.codigo_interno, "Registro de nuevo lote agrícola");
    }

    // Reset Form
    setNewLote({
      codigo_interno: '',
      nombre: '',
      cultivo: 'Maíz',
      variedad: '',
      fecha_siembra: '',
      estado_fenológico: 'Vegetativo',
      sistema_productivo: 'Convencional',
      responsable_tecnico: '',
      observaciones: '',
      geom: null,
      coordinates: null,
      area_ha: 0,
      perimetro_m: 0,
      centroide_lat: 3.518,
      centroide_lng: -76.305
    });

    return { success: true, item };
  };

  const handleDeleteLote = (loteId, onAuditLogged) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar este lote?")) {
      const loteToDelete = lotes.find(l => l.id === loteId);
      setLotes(prev => prev.filter(l => l.id !== loteId));
      setSelectedLote(null);
      if (loteToDelete && onAuditLogged) {
        onAuditLogged(loteToDelete.codigo_interno, `Eliminación de lote: ${loteToDelete.nombre}`);
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
export { INITIAL_LOTES_MOCK };
