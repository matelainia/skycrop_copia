import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ShieldAlert, ShieldCheck, HeartPulse, Plus, Eye, Trash2, X, AlertTriangle,
  Clock, Calendar, MapPin, Layers, Satellite, FileText, Download, TrendingUp,
  DollarSign, Activity, FileSpreadsheet, RefreshCw, Filter, ChevronRight,
  User, PlusCircle, CheckCircle, Info, FileDown, UploadCloud, Map, MoreVertical,
  Wind, CloudRain, Thermometer, Droplets
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import JSZip from 'jszip';

// --- TIME FORMATTING HELPER ---
const formatDuration = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// --- MATH GEOPROCESSING HELPERS (Shoelace & Haversine formulas) ---
const haversineDistance = (coord1, coord2) => {
  const R = 6371000; // Earth radius in meters
  const dLat = (coord2[0] - coord1[0]) * Math.PI / 180;
  const dLon = (coord2[1] - coord1[1]) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    CustomCos(coord1[0]) * CustomCos(coord2[0]) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const CustomCos = (latDegrees) => Math.cos(latDegrees * Math.PI / 180);

const calculateCentroid = (coords) => {
  if (!coords || coords.length === 0) return [3.518, -76.305];
  let sumLat = 0;
  let sumLng = 0;
  coords.forEach(c => {
    sumLat += c[0];
    sumLng += c[1];
  });
  return [sumLat / coords.length, sumLng / coords.length];
};

const calculatePerimeter = (coords) => {
  if (!coords || coords.length < 3) return 0;
  let perimeter = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    perimeter += haversineDistance(coords[i], coords[i + 1]);
  }
  if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
    perimeter += haversineDistance(coords[coords.length - 1], coords[0]);
  }
  return perimeter;
};

const calculateArea = (coords) => {
  if (!coords || coords.length < 3) return 0;
  const centroid = calculateCentroid(coords);
  const latR = centroid[0] * Math.PI / 180;

  const R_lat = 111132.954 - 559.822 * Math.cos(2 * latR) + 1.175 * Math.cos(4 * latR);
  const R_lon = 111412.84 * Math.cos(latR) - 93.5 * Math.cos(3 * latR);

  const xy = coords.map(c => [
    (c[1] - centroid[1]) * R_lon,
    (c[0] - centroid[0]) * R_lat
  ]);

  let area = 0;
  const n = xy.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += xy[i][0] * xy[j][1];
    area -= xy[j][0] * xy[i][1];
  }
  area = Math.abs(area) / 2;
  return area / 10000; // Hectares
};

const calculateAgeInDays = (sowingDate) => {
  if (!sowingDate) return 0;
  const sowing = new Date(sowingDate);
  const today = new Date();
  const diffTime = today - sowing;
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
};

const generateMockHistogramAndStats = (indexType, sumCoordinates, actualValue) => {
  let mean = 0.74;
  if (typeof actualValue === 'number') {
    mean = actualValue;
  } else if (actualValue !== undefined && actualValue !== null && !isNaN(parseFloat(actualValue))) {
    mean = parseFloat(actualValue);
  } else {
    if (indexType === 'NDVI') {
      mean = parseFloat((0.65 + (Math.abs(sumCoordinates) % 0.15)).toFixed(2));
    } else if (indexType === 'NDRE') {
      mean = parseFloat((0.45 + (Math.abs(sumCoordinates) % 0.15)).toFixed(2));
    } else if (indexType === 'SAVI') {
      mean = parseFloat((0.55 + (Math.abs(sumCoordinates) % 0.15)).toFixed(2));
    } else if (indexType === 'HUMEDAD') {
      mean = parseFloat((0.15 + (Math.abs(sumCoordinates) % 0.2)).toFixed(2));
    }
  }

  let stdDev = 0.10;
  if (indexType === 'HUMEDAD') {
    stdDev = 0.12;
  } else {
    if (mean > 0.8) stdDev = 0.05;
    else if (mean > 0.7) stdDev = 0.07;
    else stdDev = 0.09;
  }

  const min = parseFloat(Math.max(indexType === 'HUMEDAD' ? -0.5 : 0.0, mean - 2.5 * stdDev).toFixed(2));
  const max = parseFloat(Math.min(1.0, mean + 2.0 * stdDev).toFixed(2));
  const median = parseFloat(Math.max(min, Math.min(max, mean + 0.01)).toFixed(2));
  const cv = parseFloat(((stdDev / Math.max(0.01, mean)) * 100).toFixed(1));

  const stats = { mean, median, stdDev, min, max, cv };

  const histogram = [];
  const numBuckets = 30; // 30 bars looks clean
  const startVal = indexType === 'HUMEDAD' ? -0.2 : 0.0;
  const endVal = 1.0;
  const step = (endVal - startVal) / numBuckets;

  let criticoPixels = 0;
  let bajoPixels = 0;
  let medioPixels = 0;
  let altoPixels = 0;
  let excelentePixels = 0;
  let totalPixels = 0;

  for (let i = 0; i < numBuckets; i++) {
    const val = startVal + i * step;
    const exponent = -0.5 * Math.pow((val - mean) / stdDev, 2);
    let count = Math.round(18000 * Math.exp(exponent));
    
    count = Math.max(10, count + Math.round((Math.random() - 0.5) * 400));
    totalPixels += count;

    if (indexType === 'HUMEDAD') {
      if (val < 0.0) criticoPixels += count;
      else if (val < 0.3) medioPixels += count;
      else excelentePixels += count;
    } else {
      if (val < 0.3) criticoPixels += count;
      else if (val < 0.5) bajoPixels += count;
      else if (val < 0.7) medioPixels += count;
      else if (val < 0.85) altoPixels += count;
      else excelentePixels += count;
    }

    histogram.push({
      value: parseFloat(val.toFixed(3)),
      count: count
    });
  }

  let distribution = {};
  if (indexType === 'HUMEDAD') {
    distribution = {
      baja: Math.round((criticoPixels / totalPixels) * 100) || 15,
      media: Math.round((medioPixels / totalPixels) * 100) || 50,
      alta: Math.round((excelentePixels / totalPixels) * 100) || 35
    };
  } else {
    distribution = {
      critico: Math.round((criticoPixels / totalPixels) * 100) || 5,
      bajo: Math.round((bajoPixels / totalPixels) * 100) || 15,
      medio: Math.round((medioPixels / totalPixels) * 100) || 40,
      alto: Math.round((altoPixels / totalPixels) * 100) || 30,
      excelente: Math.round((excelentePixels / totalPixels) * 100) || 10
    };
    
    const sum = distribution.critico + distribution.bajo + distribution.medio + distribution.alto + distribution.excelente;
    if (sum !== 100 && sum > 0) {
      const diff = 100 - sum;
      distribution.medio += diff;
    }
  }

  return { stats, distribution, histogram };
};

// --- INITIAL DATA SEEDING (Valle del Cauca Farm) ---
const INITIAL_LOTES = [
  {
    id: "lote-a1",
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
    id: "lote-a2",
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
    id: "lote-b1",
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
    id: "lote-c1",
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
    id: "lote-d1",
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

const INITIAL_APLICACIONES = [
  {
    id: "app-1",
    lote_id: "lote-a1",
    tipo_aplicacion: "Fitosanitaria",
    tipo_producto: "Fungicida",
    producto_comercial: "Azoxistrobin 250 SC",
    ingrediente_activo: "Azoxistrobin",
    dosis: "0.5 L/ha",
    unidad_medida: "L",
    volumen_aplicado: 200,
    metodo_aplicacion: "Foliar con tractor",
    operario_responsable: "Pedro Gómez",
    maquinaria_utilizada: "Pulverizadora PU-003",
    condiciones_climaticas: "Soleado, 27°C, Viento 18 km/h",
    fecha_aplicacion: "2026-05-26T07:30:00Z",
    costo_aplicacion: 1245000,
    registro_ica: "ICA-3456-A",
    periodo_carencia_dias: 7,
    periodo_reingreso_horas: 24,
    clasificacion_toxicologica: "Categoría III",
    residualidad_nivel: "Medio"
  },
  {
    id: "app-2",
    lote_id: "lote-c1",
    tipo_aplicacion: "Fitosanitaria",
    tipo_producto: "Insecticida",
    producto_comercial: "Clorantraniliprol 20 SC",
    ingrediente_activo: "Clorantraniliprol",
    dosis: "0.2 L/ha",
    unidad_medida: "L",
    volumen_aplicado: 150,
    metodo_aplicacion: "Foliar con dron",
    operario_responsable: "Carlos Ruiz",
    maquinaria_utilizada: "Dron DJI Agras T40",
    condiciones_climaticas: "Nublado, 24°C, Viento 8 km/h",
    fecha_aplicacion: "2026-05-24T09:00:00Z",
    costo_aplicacion: 1850000,
    registro_ica: "ICA-8790-F",
    periodo_carencia_dias: 14,
    periodo_reingreso_horas: 12,
    clasificacion_toxicologica: "Categoría IV",
    residualidad_nivel: "Alto"
  }
];

const INITIAL_MONITOREOS = [
  {
    id: "mon-1",
    lote_id: "lote-c1",
    tipo_monitoreo: "Sanitario",
    fecha_monitoreo: "2026-05-25T14:30:00Z",
    responsable: "Laura Gómez",
    incidencia_pct: 18.5,
    severidad_pct: 12.0,
    humedad_pct: 82,
    temperatura_c: 24.5,
    plagas_detectadas: "Mosca blanca",
    enfermedades_detectadas: "Roya del Girasol (Mildiu)",
    deficiencias_nutricionales: "Nitrógeno leve",
    observaciones: "Mildiu foliar detectado en sector norte con estrés hídrico activo.",
    evidencia_foto_url: "mildiu_c1.jpg"
  }
];

const INITIAL_COSECHAS = [
  {
    id: "cos-1",
    lote_id: "lote-a1",
    fecha_programada: "2026-05-30",
    produccion_estimada_kg: 118000,
    area_programada_ha: 12.45,
    estado_carencia: "Carencia activa"
  },
  {
    id: "cos-2",
    lote_id: "lote-d1",
    fecha_programada: "2026-06-05",
    produccion_estimada_kg: 24000,
    area_programada_ha: 6.25,
    estado_carencia: "Sin restricciones"
  }
];

const INITIAL_COSTOS = [
  { id: "cos-c1", lote_id: "lote-a1", categoria: "Aplicaciones", fecha: "2026-05-26", descripcion: "Fungicida Azoxistrobin", costo: 1245000, responsable: "Pedro Gómez" },
  { id: "cos-c2", lote_id: "lote-c1", categoria: "Aplicaciones", fecha: "2026-05-24", descripcion: "Insecticida Clorantraniliprol", costo: 1850000, responsable: "Carlos Ruiz" },
  { id: "cos-c3", lote_id: "lote-b1", categoria: "Fertilización", fecha: "2026-05-20", descripcion: "Fertilizante NPK", costo: 1023500, responsable: "Juan Pérez" },
  { id: "cos-c4", lote_id: "lote-d1", categoria: "Mano de Obra", fecha: "2026-05-18", descripcion: "Poda sanitaria de cacao", costo: 652300, responsable: "Carlos Ruiz" },
  { id: "cos-c5", lote_id: "lote-a2", categoria: "Combustible", fecha: "2026-05-22", descripcion: "Petróleo tractor labor", costo: 120000, responsable: "Pedro Gómez" },
  { id: "cos-c6", lote_id: "lote-a1", categoria: "Mano de Obra", fecha: "2026-05-26", descripcion: "Jornada operario aplicación", costo: 450000, responsable: "Pedro Gómez" }
];

const INITIAL_TRABAJADORES = [
  { id: "t-1", lote_id: "lote-a1", nombre: "Juan Pérez", fecha_ingreso: "2026-05-24T08:00:00Z", actividad_realizada: "Deshierbe manual", tiempo_permanencia_horas: 4.5, estado: "completado" },
  { id: "t-2", lote_id: "lote-a1", nombre: "Carlos Ruiz", fecha_ingreso: "2026-05-23T07:00:00Z", actividad_realizada: "Canalización de riego", tiempo_permanencia_horas: 6.0, estado: "completado" },
  { id: "t-3", lote_id: "lote-a1", nombre: "Laura Gómez", fecha_ingreso: "2026-05-23T10:00:00Z", actividad_realizada: "Muestreo foliar", tiempo_permanencia_horas: 2.0, estado: "completado" },
  { id: "t-4", lote_id: "lote-c1", nombre: "Laura Gómez", fecha_ingreso: "2026-05-25T14:30:00Z", actividad_realizada: "Monitoreo fitosanitario", tiempo_permanencia_horas: 1.5, estado: "completado" }
];

const INITIAL_AUDITORIAS = [
  { id: "aud-1", fecha: "2026-05-26T07:45:00Z", usuario: "Pedro Gómez", lote_codigo: "A1", accion: "Registro de aplicación fungicida" },
  { id: "aud-2", fecha: "2026-05-25T14:35:00Z", usuario: "Laura Gómez", lote_codigo: "C1", accion: "Cambio de estado sanitario a Bajo (Mildiu)" }
];

export default function ManejoSanitario({ subTab, setSubTab }) {
  const activeSubView = subTab && [
    'lotes', 'mapa', 'aplicaciones', 'monitoreos', 'cosecha_plan',
    'costos_san', 'historial_traz', 'reportes_san'
  ].includes(subTab) ? subTab : 'lotes';

  // --- COMPONENT CENTRALIZED STATES ---
  const [lotes, setLotes] = useState(() => {
    try {
      const saved = localStorage.getItem('skycrop_lotes_cc');
      return saved ? JSON.parse(saved) : INITIAL_LOTES;
    } catch (e) {
      return INITIAL_LOTES;
    }
  });

  const [aplicaciones, setAplicaciones] = useState(() => {
    try {
      const saved = localStorage.getItem('skycrop_aplicaciones_cc');
      return saved ? JSON.parse(saved) : INITIAL_APLICACIONES;
    } catch (e) {
      return INITIAL_APLICACIONES;
    }
  });

  const [monitoreos, setMonitoreos] = useState(() => {
    try {
      const saved = localStorage.getItem('skycrop_monitoreos_cc');
      return saved ? JSON.parse(saved) : INITIAL_MONITOREOS;
    } catch (e) {
      return INITIAL_MONITOREOS;
    }
  });

  const [cosechas, setCosechas] = useState(() => {
    try {
      const saved = localStorage.getItem('skycrop_cosechas_cc');
      return saved ? JSON.parse(saved) : INITIAL_COSECHAS;
    } catch (e) {
      return INITIAL_COSECHAS;
    }
  });

  const [costos, setCostos] = useState(() => {
    try {
      const saved = localStorage.getItem('skycrop_costos_cc');
      return saved ? JSON.parse(saved) : INITIAL_COSTOS;
    } catch (e) {
      return INITIAL_COSTOS;
    }
  });

  const [trabajadores, setTrabajadores] = useState(() => {
    try {
      const saved = localStorage.getItem('skycrop_trabajadores_cc');
      return saved ? JSON.parse(saved) : INITIAL_TRABAJADORES;
    } catch (e) {
      return INITIAL_TRABAJADORES;
    }
  });

  const [auditorias, setAuditorias] = useState(() => {
    try {
      const saved = localStorage.getItem('skycrop_auditorias_cc');
      return saved ? JSON.parse(saved) : INITIAL_AUDITORIAS;
    } catch (e) {
      return INITIAL_AUDITORIAS;
    }
  });

  // UI Interactive States
  const [selectedLote, setSelectedLote] = useState(() => {
    return (lotes && lotes.length > 0) ? lotes[0] : null;
  });
  const [activeTableTab, setActiveTableTab] = useState('Lotes');
  const [tableSearch, setTableSearch] = useState('');
  const [showMapFilters, setShowMapFilters] = useState(true);
  const [mapLayer, setMapLayer] = useState('satelite'); // satelite, callejero, ndvi, ndre, savi, humedad, prod_layer
  const [geeLoading, setGeeLoading] = useState(false);
  const [geeWarning, setGeeWarning] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const geeTileLayerRef = useRef(null);

  // GEE Advanced Stats and Histograms
  const [geeData, setGeeData] = useState({
    stats: null,
    distribution: null,
    histogram: null,
    index: 'NDVI'
  });
  const [histogramIndex, setHistogramIndex] = useState('NDVI');
  const [isEvolutionModalOpen, setIsEvolutionModalOpen] = useState(false);
  const [hoveredBar, setHoveredBar] = useState(null);

  // Estado de carga del dashboard dinámico
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Multi-lot active operations & stopwatch state
  const [activeOperations, setActiveOperations] = useState(() => ({
    'lote-a1': {
      tipo_operacion: 'Aplicación',
      actividad: 'Aplicación de Fungicida',
      producto: 'Azoxistrobin 250 SC',
      dosis: '0.5 L/ha',
      startTime: Date.now() - 9918 * 1000, // 02:45:18 ago
      operator: 'Pedro Gómez',
      machinery: 'Pulverizadora PU-003'
    }
  }));
  const [operationTime, setOperationTime] = useState(9918); // 02:45:18
  const [isOperationActive, setIsOperationActive] = useState(true);

  // Weather station values
  const [weatherStation, setWeatherStation] = useState({
    temp: 27.5,
    humidity: 76,
    wind: 18.2, // km/h (triggers drift warning!)
    rain: 45 // %
  });

  // Dynamic Stopwatch Synchronization per lot
  useEffect(() => {
    const activeOp = activeOperations[selectedLote?.id];
    if (activeOp) {
      const elapsed = Math.floor((Date.now() - activeOp.startTime) / 1000);
      setOperationTime(elapsed);
      setIsOperationActive(true);
    } else {
      setIsOperationActive(false);
      setOperationTime(0);
    }
  }, [selectedLote?.id, activeOperations]);

  // Dynamic Weather Telemetry variation per lot
  useEffect(() => {
    if (!selectedLote) return;
    const charSum = selectedLote.codigo_interno.charCodeAt(0) + (selectedLote.codigo_interno.charCodeAt(1) || 0);
    const tempVar = (charSum % 5) - 2; // -2 to 2 °C
    const humVar = (charSum % 15) - 7; // -7 to 7 %
    const windVar = (charSum % 12) - 6; // -6 to 6 km/h
    const rainVar = (charSum % 30) - 15; // -15 to 15 %

    setWeatherStation({
      temp: parseFloat((27.5 + tempVar).toFixed(1)),
      humidity: Math.max(30, Math.min(95, 75 + humVar)),
      wind: parseFloat(Math.max(2.0, 14.5 + windVar).toFixed(1)),
      rain: Math.max(5, Math.min(90, 40 + rainVar))
    });
  }, [selectedLote?.id]);

  // Auto-select first lote if selectedLote is not set but lotes has items
  useEffect(() => {
    if (!selectedLote && lotes && lotes.length > 0) {
      setSelectedLote(lotes[0]);
    }
  }, [lotes, selectedLote]);

  // Detailed Modal
  const [isFichaModalOpen, setIsFichaModalOpen] = useState(false);
  const [modalActiveTab, setModalActiveTab] = useState('trazabilidad');

  // Drawers triggers
  const [isLoteDrawerOpen, setIsLoteDrawerOpen] = useState(false);
  const [isAppDrawerOpen, setIsAppDrawerOpen] = useState(false);
  const [isMonDrawerOpen, setIsMonDrawerOpen] = useState(false);
  const [isCosechaDrawerOpen, setIsCosechaDrawerOpen] = useState(false);
  const [isCostoDrawerOpen, setIsCostoDrawerOpen] = useState(false);
  const [isTrabajadorDrawerOpen, setIsTrabajadorDrawerOpen] = useState(false);

  // Filters
  const [loteFilterCultivo, setLoteFilterCultivo] = useState('Todos');
  const [loteFilterEstado, setLoteFilterEstado] = useState('Todos');
  const [loteFilterResponsable, setLoteFilterResponsable] = useState('Todos');
  const [loteFilterMonitoreoPendiente, setLoteFilterMonitoreoPendiente] = useState('Todos');
  const [loteFilterAplicacionActiva, setLoteFilterAplicacionActiva] = useState('Todos');
  const [loteFilterCarencia, setLoteFilterCarencia] = useState('Todos');
  const [mapFilterMonitoreo, setMapFilterMonitoreo] = useState('Todos'); // Todos, Pendientes

  const mapRef = useRef(null);

  // Forms state
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

  const [newAplicacion, setNewAplicacion] = useState({
    lote_id: lotes[0]?.id || '',
    tipo_aplicacion: 'Fitosanitaria',
    tipo_producto: 'Fungicida',
    producto_comercial: '',
    ingrediente_activo: '',
    dosis: '',
    unidad_medida: 'L',
    volumen_aplicado: '',
    metodo_aplicacion: 'Foliar con tractor',
    operario_responsable: '',
    maquinaria_utilizada: '',
    condiciones_climaticas: '',
    costo_aplicacion: '',
    registro_ica: '',
    periodo_carencia_dias: 7,
    periodo_reingreso_horas: 24,
    clasificacion_toxicologica: 'Categoría III',
    residualidad_nivel: 'Medio'
  });

  const [newMonitoreo, setNewMonitoreo] = useState({
    lote_id: lotes[0]?.id || '',
    tipo_monitoreo: 'Sanitario',
    responsable: '',
    incidencia_pct: 0,
    severidad_pct: 0,
    humedad_pct: '',
    temperatura_c: '',
    plagas_detectadas: '',
    enfermedades_detectadas: '',
    deficiencias_nutricionales: '',
    observaciones: ''
  });

  const [newCosecha, setNewCosecha] = useState({
    lote_id: lotes[0]?.id || '',
    fecha_programada: '',
    produccion_estimada_kg: '',
    area_programada_ha: ''
  });

  const [newCosto, setNewCosto] = useState({
    lote_id: lotes[0]?.id || '',
    categoria: 'Aplicaciones',
    costo: '',
    descripcion: '',
    responsable: ''
  });

  const [newTrabajador, setNewTrabajador] = useState({
    lote_id: lotes[0]?.id || '',
    nombre: '',
    actividad_realizada: '',
    tiempo_permanencia_hours: ''
  });

  // --- LOCAL STORAGE EFFECTS ---
  useEffect(() => {
    localStorage.setItem('skycrop_lotes_cc', JSON.stringify(lotes));
  }, [lotes]);

  useEffect(() => {
    localStorage.setItem('skycrop_aplicaciones_cc', JSON.stringify(aplicaciones));
  }, [aplicaciones]);

  useEffect(() => {
    localStorage.setItem('skycrop_monitoreos_cc', JSON.stringify(monitoreos));
  }, [monitoreos]);

  useEffect(() => {
    localStorage.setItem('skycrop_cosechas_cc', JSON.stringify(cosechas));
  }, [cosechas]);

  useEffect(() => {
    localStorage.setItem('skycrop_costos_cc', JSON.stringify(costos));
  }, [costos]);

  useEffect(() => {
    localStorage.setItem('skycrop_trabajadores_cc', JSON.stringify(trabajadores));
  }, [trabajadores]);

  useEffect(() => {
    localStorage.setItem('skycrop_auditorias_cc', JSON.stringify(auditorias));
  }, [auditorias]);


  const handleHistogramIndexChange = (val) => {
    setHistogramIndex(val);
    const lowerVal = val.toLowerCase();
    const validMapLayers = ['ndvi', 'ndre', 'savi', 'humedad'];
    if (validMapLayers.includes(lowerVal)) {
      setMapLayer(lowerVal);
    }
  };

  const getHistoricalIndexPoints = (lote, indexType) => {
    if (!lote) return {
      points: [0.60, 0.62, 0.65, 0.68, 0.70, 0.72],
      labels: ['Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May']
    };
    
    const charSum = lote.codigo_interno.charCodeAt(0) + (lote.codigo_interno.charCodeAt(1) || 0);
    let baseValue = 0.72;
    if (indexType === 'NDRE') baseValue = 0.48;
    else if (indexType === 'SAVI') baseValue = 0.58;
    else if (indexType === 'HUMEDAD') baseValue = 0.22;
    
    const points = [];
    const count = 6;
    
    let currentVal = baseValue;
    if (indexType === 'NDVI') currentVal = lote.ndvi_actual;
    else if (indexType === 'NDRE') currentVal = parseFloat(lote.ndre_actual) || 0.48;
    else if (indexType === 'SAVI') currentVal = parseFloat(lote.savi_actual) || 0.58;
    else if (indexType === 'HUMEDAD') currentVal = parseFloat(lote.humedad_actual) || 0.22;
    
    for (let i = 0; i < count; i++) {
      const wave = Math.sin((charSum + i) * 0.8) * 0.08;
      const step = (currentVal - (baseValue + wave)) * (i / (count - 1));
      const val = baseValue + wave + step;
      points.push(parseFloat(Math.max(indexType === 'HUMEDAD' ? -0.15 : 0.05, Math.min(1.0, val)).toFixed(2)));
    }
    
    points[count - 1] = currentVal;
    
    const labels = [];
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const today = new Date();
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      labels.push(monthNames[d.getMonth()]);
    }
    
    return { points, labels };
  };

  // --- RUNNING STOPWATCH TIMER ---
  useEffect(() => {
    let timer;
    if (isOperationActive) {
      timer = setInterval(() => {
        setOperationTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOperationActive]);

  // --- SINCRONIZACIÓN SUPABASE: Dashboard dinámico por lote seleccionado ---
  useEffect(() => {
    if (!selectedLote?.id) return;
    const loteId = selectedLote.id;
    setLoadingDashboard(true);

    const syncFromSupabase = async () => {
      try {
        const [appsRes, monsRes, cosechasRes, costosRes, trabajRes] = await Promise.all([
          supabase.from('aplicaciones').select('*').eq('lote_id', loteId).order('fecha_aplicacion', { ascending: false }).limit(50),
          supabase.from('monitoreos').select('*').eq('lote_id', loteId).order('fecha_monitoreo', { ascending: false }).limit(50),
          supabase.from('cosechas').select('*').eq('lote_id', loteId).order('fecha_programada', { ascending: false }).limit(20),
          supabase.from('costos').select('*').eq('lote_id', loteId).order('fecha', { ascending: false }).limit(20),
          supabase.from('trabajadores').select('*').eq('lote_id', loteId).order('fecha_ingreso', { ascending: false }).limit(20),
        ]);

        if (appsRes.data?.length > 0) {
          setAplicaciones(prev => {
            const ids = new Set(prev.map(a => String(a.id)));
            const nuevos = appsRes.data.filter(a => !ids.has(String(a.id)));
            return nuevos.length ? [...nuevos, ...prev] : prev;
          });
        }
        if (monsRes.data?.length > 0) {
          setMonitoreos(prev => {
            const ids = new Set(prev.map(m => String(m.id)));
            const nuevos = monsRes.data.filter(m => !ids.has(String(m.id)));
            return nuevos.length ? [...nuevos, ...prev] : prev;
          });
        }
        if (cosechasRes.data?.length > 0) {
          setCosechas(prev => {
            const ids = new Set(prev.map(c => String(c.id)));
            const nuevos = cosechasRes.data.filter(c => !ids.has(String(c.id)));
            return nuevos.length ? [...nuevos, ...prev] : prev;
          });
        }
        if (costosRes.data?.length > 0) {
          setCostos(prev => {
            const ids = new Set(prev.map(c => String(c.id)));
            const nuevos = costosRes.data.filter(c => !ids.has(String(c.id)));
            return nuevos.length ? [...nuevos, ...prev] : prev;
          });
        }
        if (trabajRes.data?.length > 0) {
          setTrabajadores(prev => {
            const ids = new Set(prev.map(t => String(t.id)));
            const nuevos = trabajRes.data.filter(t => !ids.has(String(t.id)));
            return nuevos.length ? [...nuevos, ...prev] : prev;
          });
        }
      } catch (err) {
        console.warn('[Dashboard] Supabase sync fallback a estado local:', err?.message || err);
      } finally {
        setLoadingDashboard(false);
      }
    };

    syncFromSupabase();

    // Realtime: insertar nuevos registros del lote directamente en el estado local
    const realtimeChannel = supabase
      .channel(`lote-realtime-${loteId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'aplicaciones', filter: `lote_id=eq.${loteId}` },
        payload => setAplicaciones(prev =>
          prev.some(a => String(a.id) === String(payload.new.id)) ? prev : [payload.new, ...prev]
        )
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'monitoreos', filter: `lote_id=eq.${loteId}` },
        payload => setMonitoreos(prev =>
          prev.some(m => String(m.id) === String(payload.new.id)) ? prev : [payload.new, ...prev]
        )
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cosechas', filter: `lote_id=eq.${loteId}` },
        payload => setCosechas(prev =>
          prev.some(c => String(c.id) === String(payload.new.id)) ? prev : [payload.new, ...prev]
        )
      )
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [selectedLote?.id]);

  // --- INTERACTION HELPER: ADD AUDIT LOG ---
  const logAudit = (loteCode, actionText) => {
    const log = {
      id: `aud-${Date.now()}`,
      fecha: new Date().toISOString(),
      usuario: "Andrés Castro",
      lote_codigo: loteCode,
      accion: actionText
    };
    setAuditorias(prev => [log, ...prev]);
  };

  // --- INOCUIDAD & CARENCIA VALIDATOR ---
  const getLoteCarenciaStatus = (loteId, targetDate = new Date()) => {
    const apps = aplicaciones.filter(a => a.lote_id === loteId && a.periodo_carencia_dias > 0);
    let isRestricted = false;
    let daysRemaining = 0;
    let activeProduct = '';

    apps.forEach(app => {
      const appDate = new Date(app.fecha_aplicacion);
      const expiryDate = new Date(appDate.getTime() + app.periodo_carencia_dias * 24 * 60 * 60 * 1000);
      const compareDate = new Date(targetDate);

      if (expiryDate > compareDate) {
        isRestricted = true;
        const diffTime = expiryDate - compareDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > daysRemaining) {
          daysRemaining = diffDays;
          activeProduct = app.producto_comercial;
        }
      }
    });

    return { isRestricted, daysRemaining, activeProduct };
  };

  // --- DYNAMIC CALCULATIONS FOR TOTALS AND KPIS ---
  const totalHa = lotes.reduce((acc, curr) => acc + curr.area_ha, 0);
  const totalCost = costos.reduce((acc, curr) => acc + curr.costo, 0);
  const avgIncidence = monitoreos.length > 0
    ? (monitoreos.reduce((acc, curr) => acc + curr.incidencia_pct, 0) / monitoreos.length).toFixed(1)
    : 0;
  const avgNdvi = lotes.length > 0
    ? (lotes.reduce((acc, curr) => acc + curr.ndvi_actual, 0) / lotes.length).toFixed(2)
    : 0;

  const countAlerts = lotes.filter(l => ['regular', 'bajo'].includes(l.estado_sanitario)).length +
    aplicaciones.filter(a => {
      const c = getLoteCarenciaStatus(a.lote_id);
      return c.isRestricted;
    }).length;

  const activeCarenciaCount = aplicaciones.filter(a => {
    const status = getLoteCarenciaStatus(a.lote_id);
    return status.isRestricted;
  }).length;

  const activeAlertsCount = lotes.filter(l => l.estado_sanitario === 'bajo' || l.incidence_pct > 15).length;

  // --- EXPORT TO CSV HANDLER ---
  const handleExportCSV = (type) => {
    let headers = [];
    let rows = [];
    let filename = '';

    if (type === 'lotes') {
      headers = ['Codigo Interno', 'Nombre', 'Cultivo', 'Variedad', 'Area (ha)', 'Siembra', 'Estado Sanitario', 'NDVI Actual'];
      rows = lotes.map(l => [l.codigo_interno, l.nombre, l.cultivo, l.variedad, l.area_ha, l.fecha_siembra, l.estado_sanitario, l.ndvi_actual]);
      filename = 'lotes_sectores.csv';
    } else if (type === 'aplicaciones') {
      headers = ['Lote', 'Tipo Aplicacion', 'Producto Comercial', 'Dosis', 'Operario', 'Fecha', 'Costo (COP)', 'Carencia (Dias)'];
      rows = aplicaciones.map(a => {
        const targetL = lotes.find(l => l.id === a.lote_id);
        return [
          targetL?.codigo_interno || 'N/A',
          a.tipo_aplicacion,
          a.producto_comercial,
          a.dosis,
          a.operario_responsable,
          new Date(a.fecha_aplicacion).toLocaleDateString(),
          a.costo_aplicacion,
          a.periodo_carencia_dias
        ];
      });
      filename = 'aplicaciones_registro.csv';
    } else if (type === 'monitoreos') {
      headers = ['Lote', 'Responsable', 'Fecha', 'Incidencia (%)', 'Severidad (%)', 'Plagas', 'Enfermedades'];
      rows = monitoreos.map(m => {
        const targetL = lotes.find(l => l.id === m.lote_id);
        return [
          targetL?.codigo_interno || 'N/A',
          m.responsable,
          new Date(m.fecha_monitoreo).toLocaleDateString(),
          m.incidencia_pct,
          m.severidad_pct,
          m.plagas_detectadas,
          m.enfermedades_detectadas
        ];
      });
      filename = 'monitoreos_evaluaciones.csv';
    } else if (type === 'cosechas' || type === 'Cosechas') {
      headers = ['Lote', 'Fecha Programada', 'Area (ha)', 'Produccion Est. (kg)', 'Estado Carencia'];
      rows = cosechas.map(c => {
        const targetL = lotes.find(l => l.id === c.lote_id);
        return [
          targetL?.codigo_interno || 'N/A',
          c.fecha_programada,
          c.area_programada_ha,
          c.produccion_estimada_kg,
          c.estado_carencia
        ];
      });
      filename = 'planificacion_cosechas.csv';
    } else if (type === 'costos' || type === 'Costos') {
      headers = ['Lote', 'Categoria', 'Fecha', 'Descripcion', 'Costo (COP)', 'Responsable'];
      rows = costos.map(cost => {
        const targetL = lotes.find(l => l.id === cost.lote_id);
        return [
          targetL?.codigo_interno || 'N/A',
          cost.categoria,
          cost.fecha,
          cost.descripcion,
          cost.costo,
          cost.responsable
        ];
      });
      filename = 'costos_operacionales.csv';
    } else if (type === 'trabajadores' || type === 'Trabajadores') {
      headers = ['Lote', 'Nombre', 'Fecha Ingreso', 'Labor Realizada', 'Permanencia (hrs)', 'Estado'];
      rows = trabajadores.map(t => {
        const targetL = lotes.find(l => l.id === t.lote_id);
        return [
          targetL?.codigo_interno || 'N/A',
          t.nombre,
          new Date(t.fecha_ingreso).toLocaleDateString(),
          t.actividad_realizada,
          t.tiempo_permanencia_horas,
          t.estado
        ];
      });
      filename = 'registro_trabajadores.csv';
    } else {
      headers = ['Lote', 'Acción', 'Fecha'];
      rows = auditorias.map(aud => [aud.lote_codigo, aud.accion, new Date(aud.fecha).toLocaleDateString()]);
      filename = 'bitacora_auditoria.csv';
    }

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- FINISH OPERATION TIMER ---
  const handleFinishCurrentOperation = async () => {
    if (!selectedLote) return;
    setIsOperationActive(false);
    const activeOp = activeOperations[selectedLote.id];

    // Add the completed operation to applications
    const finishedApp = {
      id: `app-${Date.now()}`,
      lote_id: selectedLote.id,
      tipo_aplicacion: activeOp?.tipo_operacion === 'Aplicación' ? 'Fitosanitaria' : (activeOp?.tipo_operacion || 'Fitosanitaria'),
      tipo_producto: 'Fungicida',
      producto_comercial: activeOp?.producto || 'Insumo Fitosanitario',
      ingrediente_activo: 'Azoxistrobin',
      dosis: activeOp?.dosis || '0.5 L/ha',
      unidad_medida: 'L',
      volumen_aplicado: 200,
      metodo_aplicacion: 'Pulverizadora foliar',
      operario_responsable: activeOp?.operator || 'Pedro Gómez',
      maquinaria_utilizada: activeOp?.machinery || 'Pulverizadora PU-003',
      condiciones_climaticas: `Temp: ${weatherStation.temp}°C, Viento: ${weatherStation.wind} km/h`,
      fecha_aplicacion: new Date().toISOString(),
      costo_aplicacion: 1245000,
      registro_ica: 'ICA-3456-A',
      periodo_carencia_dias: 7,
      periodo_reingreso_horas: 24,
      clasificacion_toxicologica: 'Categoría III',
      residualidad_nivel: 'Medio'
    };

    // 1. Actualizar estado local (UI se actualiza inmediatamente)
    setAplicaciones(prev => [finishedApp, ...prev]);

    // 2. Persistir en Supabase
    try {
      await supabase.from('aplicaciones').insert([{
        lote_id: finishedApp.lote_id,
        tipo_aplicacion: finishedApp.tipo_aplicacion,
        tipo_producto: finishedApp.tipo_producto,
        producto_comercial: finishedApp.producto_comercial,
        ingrediente_activo: finishedApp.ingrediente_activo,
        dosis: finishedApp.dosis,
        unidad_medida: finishedApp.unidad_medida,
        volumen_aplicado: finishedApp.volumen_aplicado,
        metodo_aplicacion: finishedApp.metodo_aplicacion,
        operario_responsable: finishedApp.operario_responsable,
        maquinaria_utilizada: finishedApp.maquinaria_utilizada,
        condiciones_climaticas: finishedApp.condiciones_climaticas,
        fecha_aplicacion: finishedApp.fecha_aplicacion,
        costo_aplicacion: finishedApp.costo_aplicacion,
        registro_ica: finishedApp.registro_ica,
        periodo_carencia_dias: finishedApp.periodo_carencia_dias,
        periodo_reingreso_horas: finishedApp.periodo_reingreso_horas,
        clasificacion_toxicologica: finishedApp.clasificacion_toxicologica,
        residualidad_nivel: finishedApp.residualidad_nivel
      }]);
    } catch (sbErr) {
      console.warn('[Supabase] No se pudo persistir la aplicación finalizada:', sbErr?.message || sbErr);
    }

    // 3. Registrar costo en ledger local
    const costEntry = {
      id: `cos-${Date.now()}`,
      lote_id: selectedLote.id,
      categoria: 'Aplicaciones',
      fecha: new Date().toISOString().split('T')[0],
      descripcion: `Aplicación de ${finishedApp.producto_comercial} (finalizada)`,
      costo: finishedApp.costo_aplicacion,
      responsable: finishedApp.operario_responsable
    };
    setCostos(prev => [costEntry, ...prev]);

    // 4. Audit log
    logAudit(selectedLote.codigo_interno, `Finalización de aplicación: ${finishedApp.producto_comercial} (Duración: ${formatDuration(operationTime)})`);

    // 5. Eliminar de operaciones activas → la tarjeta desaparece automáticamente
    setActiveOperations(prev => {
      const copy = { ...prev };
      delete copy[selectedLote.id];
      return copy;
    });
  };

  // --- START OPERATION HANDLER ---
  const handleStartOperation = (type) => {
    if (!selectedLote) return;
    setActiveOperations(prev => ({
      ...prev,
      [selectedLote.id]: {
        tipo_operacion: type,
        actividad: type === 'Aplicación' ? 'Aplicación Fitosanitaria' : type,
        producto: type === 'Aplicación' ? 'Azoxistrobin 250 SC' : 'N/A',
        dosis: type === 'Aplicación' ? '0.5 L/ha' : 'N/A',
        startTime: Date.now(),
        operator: 'Pedro Gómez',
        machinery: type === 'Aplicación' ? 'Pulverizadora PU-003' : 'Manual'
      }
    }));
    logAudit(selectedLote.codigo_interno, `Inicio de operación: ${type}`);
  };

  // --- LEAFLET MAP EFFECT ---
  useEffect(() => {
    if (activeSubView === 'lotes' || activeSubView === 'mapa') {
      const container = document.getElementById('sanitary-gis-map');
      if (!container) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      if (typeof window !== 'undefined' && window.L) {
        const L = window.L;
        const map = L.map('sanitary-gis-map').setView([3.518, -76.305], 14);
        mapRef.current = map;
        setMapInstance(map);

        // Satellite Tile Layer
        const satelliteTile = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Esri, USDA, USGS'
        });

        // Topographic / Vector Layer
        const streetTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        });

        if (mapLayer === 'callejero') {
          streetTile.addTo(map);
        } else {
          satelliteTile.addTo(map);
        }

        // Render lotes polygons with specific layer coloration styles
        lotes.forEach(lote => {
          if (!lote.coordinates || lote.coordinates.length === 0) return;

          const matchesCultivo = loteFilterCultivo === 'Todos' || lote.cultivo === loteFilterCultivo;
          const matchesEstado = loteFilterEstado === 'Todos' || lote.estado_sanitario === loteFilterEstado;
          const isMatched = matchesCultivo && matchesEstado;

          // Color classification based on active layer
          let fillColor = '#16a34a'; // default excelente
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
              borderColor = '#22c55e'; // Highlight active GEE lot borders in primary green
            } else if (mapLayer === 'prod_layer') {
              fillOpacity = 0.5;
              if (lote.area_ha > 12) fillColor = '#6d28d9'; // high yield purple
              else if (lote.area_ha > 8) fillColor = '#8b5cf6';
              else fillColor = '#c084fc';
              borderColor = fillColor;
            } else {
              // Default sanitary status color
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

          // Tooltip details
          polygon.bindTooltip(`
            <strong>Lote ${lote.codigo_interno}</strong> - ${lote.cultivo}<br/>
            NDVI Vigor: ${lote.ndvi_actual}<br/>
            Área: ${lote.area_ha} ha<br/>
            Fenología: ${lote.estado_fenológico}
          `, { sticky: true, direction: 'top' });

          // Click handler
          polygon.on('click', () => {
            setSelectedLote(lote);
            map.panTo([lote.centroide_lat, lote.centroide_lng]);
          });
        });

        // Auto center map boundary
        if (lotes.length > 0) {
          const allPolys = lotes.map(l => l.coordinates);
          const bounds = L.latLngBounds(allPolys.flat());
          map.fitBounds(bounds, { padding: [15, 15] });
        }
      }
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapInstance(null);
    };
  }, [activeSubView, lotes, mapLayer, loteFilterCultivo, loteFilterEstado]);

  // Sincronizar histogramIndex cuando cambia la capa del mapa (si es un índice válido de GEE)
  useEffect(() => {
    const validIndices = ['ndvi', 'ndre', 'savi', 'humedad'];
    if (validIndices.includes(mapLayer)) {
      setHistogramIndex(mapLayer.toUpperCase());
    }
  }, [mapLayer]);

  // --- GOOGLE EARTH ENGINE TILE LAYER & STATS EFFECT ---
  useEffect(() => {
    const map = mapInstance;
    if (!map) return;
    if (typeof window === 'undefined' || !window.L) return;
    const L = window.L;

    // Remover capa anterior si existe
    if (geeTileLayerRef.current) {
      try {
        map.removeLayer(geeTileLayerRef.current);
      } catch (e) {
        console.warn("Error al remover capa GEE anterior", e);
      }
      geeTileLayerRef.current = null;
    }

    const geeIndices = ['ndvi', 'ndre', 'savi', 'humedad'];
    const activeIndex = histogramIndex.toLowerCase();

    if (geeIndices.includes(activeIndex) && selectedLote && selectedLote.coordinates) {
      setGeeLoading(true);
      setGeeWarning(null);

      const isDev = import.meta.env.DEV;
      const backendUrl = isDev
        ? 'http://localhost:3000/api'
        : 'https://backend.skycrop.app/api';

      const indexType = histogramIndex.toUpperCase(); // NDVI, NDRE, SAVI, HUMEDAD

      fetch(`${backendUrl}/gee/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coordinates: selectedLote.coordinates,
          indexType: indexType,
          loteId: selectedLote.id
        })
      })
      .then(res => res.json())
      .then(data => {
        setGeeLoading(false);
        if (data.success) {
          // Si el índice coincide con la capa del mapa actual, agregamos la capa tile
          if (data.tileUrl && mapLayer === activeIndex) {
            const bounds = L.polygon(selectedLote.coordinates).getBounds();
            const layer = L.tileLayer(data.tileUrl, {
              bounds: bounds,
              maxZoom: 19,
              attribution: 'Google Earth Engine &copy; Sentinel-2'
            });
            layer.addTo(map);
            geeTileLayerRef.current = layer;
            map.fitBounds(bounds, { padding: [25, 25], maxZoom: 17 });
          }

          if (data.warning) {
            setGeeWarning(data.warning);
          }

          // Guardar datos detallados en el estado local de GEE
          setGeeData({
            stats: data.stats || null,
            distribution: data.distribution || null,
            histogram: data.histogram || null,
            index: indexType
          });

          // Actualizar el valor del índice correspondiente en el lote si avgValue está disponible
          if (data.avgValue) {
            const currentVal = indexType === 'NDVI' ? selectedLote.ndvi_actual
                             : indexType === 'NDRE' ? selectedLote.ndre_actual
                             : indexType === 'SAVI' ? selectedLote.savi_actual
                             : selectedLote.humedad_actual;

            if (currentVal !== data.avgValue) {
              setLotes(prev => prev.map(l => {
                if (l.id === selectedLote.id) {
                  const updatedL = { ...l };
                  if (indexType === 'NDVI') updatedL.ndvi_actual = data.avgValue;
                  else if (indexType === 'NDRE') updatedL.ndre_actual = data.avgValue;
                  else if (indexType === 'SAVI') updatedL.savi_actual = data.avgValue;
                  else if (indexType === 'HUMEDAD') updatedL.humedad_actual = data.avgValue;
                  return updatedL;
                }
                return l;
              }));
              
              setSelectedLote(prev => {
                const updatedL = { ...prev };
                if (indexType === 'NDVI') updatedL.ndvi_actual = data.avgValue;
                else if (indexType === 'NDRE') updatedL.ndre_actual = data.avgValue;
                else if (indexType === 'SAVI') updatedL.savi_actual = data.avgValue;
                else if (indexType === 'HUMEDAD') updatedL.humedad_actual = data.avgValue;
                return updatedL;
              });
            }
          }
        } else {
          console.error("Error devuelto por la API de GEE:", data.error);
        }
      })
      .catch(err => {
        setGeeLoading(false);
        console.error("Error de red conectando con el backend para GEE:", err);
      });
    }

    return () => {
      if (geeTileLayerRef.current && mapRef.current) {
        try {
          mapRef.current.removeLayer(geeTileLayerRef.current);
        } catch (e) { }
        geeTileLayerRef.current = null;
      }
    };
  }, [selectedLote?.id, histogramIndex, mapLayer, mapInstance]);

  // --- ACTIONS HANDLERS ---
  const handleClearAllData = () => {
    if (window.confirm("¿Estás seguro de que deseas eliminar todos los lotes y datos de prueba? Esto reiniciará la base de datos local y te permitirá empezar desde cero.")) {
      localStorage.removeItem('skycrop_lotes_cc');
      localStorage.removeItem('skycrop_aplicaciones_cc');
      localStorage.removeItem('skycrop_monitoreos_cc');
      localStorage.removeItem('skycrop_cosechas_cc');
      localStorage.removeItem('skycrop_costos_cc');
      localStorage.removeItem('skycrop_trabajadores_cc');
      localStorage.removeItem('skycrop_auditorias_cc');
      setLotes([]);
      setAplicaciones([]);
      setMonitoreos([]);
      setCosechas([]);
      setCostos([]);
      setTrabajadores([]);
      setAuditorias([]);
      setSelectedLote(null);
      alert("Todos los datos de prueba han sido eliminados. Ya puedes crear tus propios lotes.");
    }
  };

  const handleDeleteLote = (loteId) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar este lote?")) {
      const loteToDelete = lotes.find(l => l.id === loteId);
      setLotes(prev => prev.filter(l => l.id !== loteId));
      setSelectedLote(null);
      if (loteToDelete) {
        logAudit(loteToDelete.codigo_interno, `Eliminación de lote: ${loteToDelete.nombre}`);
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
          // Descomprimir KMZ usando JSZip para extraer el KML interno
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
              // KML es [longitud, latitud, altitud] -> mapear a [latitud, longitud] para Leaflet
              const lon = parts[0];
              const lat = parts[1];
              return [lat, lon];
            });

            // Cerrar el polígono si no lo está (importante para GEE y PostGIS)
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
          // SHP ZIP / Otros: simulación del cliente
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

  const handleAddLote = (e) => {
    e.preventDefault();
    if (!newLote.nombre || !newLote.codigo_interno) return;

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

    const item = {
      id: `lote-${Date.now()}`,
      codigo_interno: newLote.codigo_interno.trim().toUpperCase(),
      nombre: newLote.nombre.trim(),
      cultivo: newLote.cultivo,
      variedad: newLote.variedad.trim() || 'N/A',
      fecha_siembra: newLote.fecha_siembra || new Date().toISOString().split('T')[0],
      estado_fenológico: newLote.estado_fenológico,
      sistema_productivo: newLote.sistema_productivo,
      responsable_tecnico: newLote.responsable_tecnico.trim() || 'Andrés Castro',
      observaciones: newLote.observaciones.trim() || 'Sin observaciones.',
      area_ha: area,
      perimetro_m: perimeter,
      centroide_lat: centroid[0],
      centroide_lng: centroid[1],
      estado_sanitario: 'excelente',
      ndvi_actual: 0.75,
      ndvi_trend: '+0.01',
      disease_detected: 'Ninguna',
      incidence_pct: 0,
      severity_pct: 0,
      trabajadores: [],
      adjuntos: [],
      coordinates: defaultCoords
    };

    setLotes(prev => [item, ...prev]);
    setIsLoteDrawerOpen(false);
    setSelectedLote(item);
    logAudit(item.codigo_interno, "Registro de nuevo lote agrícola");

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
  };

  const handleAddAplicacion = (e) => {
    e.preventDefault();
    if (!newAplicacion.producto_comercial) return;

    // Check residual harvest dates
    const targetL = lotes.find(l => l.id === newAplicacion.lote_id);
    const plannedHarvests = cosechas.filter(c => c.lote_id === newAplicacion.lote_id);
    const carenciaDays = Number(newAplicacion.periodo_carencia_dias);
    const appDate = new Date();
    const expiry = new Date(appDate.getTime() + carenciaDays * 24 * 60 * 60 * 1000);

    let conflict = false;
    plannedHarvests.forEach(h => {
      if (new Date(h.fecha_programada) < expiry) conflict = true;
    });

    if (conflict && carenciaDays > 0) {
      const proceed = window.confirm(
        `¡ALERTA REGULATORIA DE CARENCIA!\nExiste una cosecha programada antes del vencimiento del periodo de carencia (${carenciaDays} días) de este producto.\n¿Registrar la aplicación?`
      );
      if (!proceed) return;
    }

    const item = {
      id: `app-${Date.now()}`,
      lote_id: newAplicacion.lote_id,
      tipo_aplicacion: newAplicacion.tipo_aplicacion,
      tipo_producto: newAplicacion.tipo_producto,
      producto_comercial: newAplicacion.producto_comercial.trim(),
      ingrediente_activo: newAplicacion.ingrediente_activo.trim() || 'N/A',
      dosis: newAplicacion.dosis || 'N/A',
      unidad_medida: newAplicacion.unidad_medida,
      volumen_aplicado: parseFloat(newAplicacion.volumen_aplicado) || 0,
      metodo_aplicacion: newAplicacion.metodo_aplicacion,
      operario_responsable: newAplicacion.operario_responsable || 'Andrés Castro',
      maquinaria_utilizada: newAplicacion.maquinaria_utilizada || 'Manual',
      condiciones_climaticas: `Temp: ${weatherStation.temp}°C, Viento: ${weatherStation.wind} km/h`,
      fecha_aplicacion: new Date().toISOString(),
      costo_aplicacion: parseFloat(newAplicacion.costo_aplicacion) || 0,
      registro_ica: newAplicacion.registro_ica,
      periodo_carencia_dias: carenciaDays,
      periodo_reingreso_horas: Number(newAplicacion.periodo_reingreso_horas),
      clasificacion_toxicologica: newAplicacion.clasificacion_toxicologica,
      residualidad_nivel: newAplicacion.residualidad_nivel
    };

    setAplicaciones(prev => [item, ...prev]);

    // Add cost ledger
    const appCost = {
      id: `cos-${Date.now()}`,
      lote_id: item.lote_id,
      categoria: "Aplicaciones",
      fecha: new Date().toISOString().split('T')[0],
      descripcion: `Aplicación de ${item.producto_comercial}`,
      costo: item.costo_aplicacion,
      responsable: item.operario_responsable
    };
    setCostos(prev => [appCost, ...prev]);

    // Update Lote observations
    setLotes(prev => prev.map(l => {
      if (l.id === item.lote_id) {
        return {
          ...l,
          observaciones: `Aplicación realizada: ${item.producto_comercial} (Carencia: ${item.periodo_carencia_dias}d).`
        };
      }
      return l;
    }));

    setIsAppDrawerOpen(false);
    logAudit(targetL?.codigo_interno || "N/A", `Registro de aplicación: ${item.producto_comercial}`);
  };

  const handleAddMonitoreo = (e) => {
    e.preventDefault();
    if (!newMonitoreo.responsable) return;

    const item = {
      id: `mon-${Date.now()}`,
      lote_id: newMonitoreo.lote_id,
      tipo_monitoreo: newMonitoreo.tipo_monitoreo,
      fecha_monitoreo: new Date().toISOString(),
      responsable: newMonitoreo.responsable.trim(),
      incidencia_pct: parseFloat(newMonitoreo.incidencia_pct) || 0,
      severidad_pct: parseFloat(newMonitoreo.severidad_pct) || 0,
      humedad_pct: parseFloat(newMonitoreo.humedad_pct) || 75,
      temperatura_c: parseFloat(newMonitoreo.temperatura_c) || 28,
      plagas_detectadas: newMonitoreo.plagas_detectadas || 'Ninguna',
      enfermedades_detectadas: newMonitoreo.enfermedades_detectadas || 'Ninguna',
      deficiencias_nutricionales: newMonitoreo.deficiencias_nutricionales || 'Ninguna',
      observaciones: newMonitoreo.observaciones || 'Sin novedades.'
    };

    setMonitoreos(prev => [item, ...prev]);

    // Update Lote Health state and NDVI values
    let health = 'excelente';
    if (item.incidencia_pct > 15) health = 'bajo';
    else if (item.incidencia_pct > 5) health = 'regular';
    else if (item.incidencia_pct > 1) health = 'bueno';

    setLotes(prev => prev.map(l => {
      if (l.id === item.lote_id) {
        const rawNdvi = l.ndvi_actual - (item.severidad_pct / 100);
        const nextNdvi = parseFloat(Math.max(0.15, rawNdvi).toFixed(2));
        return {
          ...l,
          estado_sanitario: health,
          ndvi_actual: nextNdvi,
          disease_detected: item.enfermedades_detectadas,
          incidence_pct: item.incidencia_pct,
          severity_pct: item.severidad_pct,
          observaciones: `Última eval: Incidencia ${item.incidencia_pct}%, Severidad ${item.severidad_pct}%.`
        };
      }
      return l;
    }));

    const targetL = lotes.find(l => l.id === item.lote_id);
    if (selectedLote && selectedLote.id === item.lote_id) {
      setSelectedLote(prev => ({
        ...prev,
        estado_sanitario: health,
        ndvi_actual: parseFloat(Math.max(0.15, prev.ndvi_actual - (item.severidad_pct / 100)).toFixed(2)),
        disease_detected: item.enfermedades_detectadas,
        incidence_pct: item.incidencia_pct,
        severity_pct: item.severidad_pct
      }));
    }

    setIsMonDrawerOpen(false);
    logAudit(targetL?.codigo_interno || "N/A", `Monitoreo fitosanitario registrado (Incidencia: ${item.incidencia_pct}%)`);
  };

  const handleAddCosecha = (e) => {
    e.preventDefault();
    if (!newCosecha.fecha_programada) return;

    // residual check
    const restrict = getLoteCarenciaStatus(newCosecha.lote_id, new Date(newCosecha.fecha_programada));
    if (restrict.isRestricted) {
      alert(`BLOQUEO OPERACIONAL:\nNo se puede planificar la cosecha. Lote bajo carencia del producto ${restrict.activeProduct} (Faltan ${restrict.daysRemaining} días).`);
      return;
    }

    const item = {
      id: `cos-${Date.now()}`,
      lote_id: newCosecha.lote_id,
      fecha_programada: newCosecha.fecha_programada,
      produccion_estimada_kg: parseFloat(newCosecha.produccion_estimada_kg) || 0,
      area_programada_ha: parseFloat(newCosecha.area_programada_ha) || 0,
      estado_carencia: "Sin restricciones"
    };

    setCosechas(prev => [item, ...prev]);
    setIsCosechaDrawerOpen(false);

    const targetL = lotes.find(l => l.id === item.lote_id);
    logAudit(targetL?.codigo_interno || "N/A", "Cosecha planificada");
  };

  const handleAddCosto = (e) => {
    e.preventDefault();
    if (!newCosto.costo) return;

    const item = {
      id: `cos-${Date.now()}`,
      lote_id: newCosto.lote_id,
      categoria: newCosto.categoria,
      fecha: new Date().toISOString().split('T')[0],
      descripcion: newCosto.descripcion.trim() || 'Costo operacional registrado',
      costo: parseFloat(newCosto.costo),
      responsable: newCosto.responsable.trim() || 'Andrés Castro'
    };

    setCostos(prev => [item, ...prev]);
    setIsCostoDrawerOpen(false);

    const targetL = lotes.find(l => l.id === item.lote_id);
    logAudit(targetL?.codigo_interno || "N/A", `Costo registrado: $${item.costo.toLocaleString()} (${item.categoria})`);
  };

  const handleAddTrabajadorLog = (e) => {
    e.preventDefault();
    if (!newTrabajador.nombre) return;

    const item = {
      id: `t-${Date.now()}`,
      lote_id: newTrabajador.lote_id,
      nombre: newTrabajador.nombre.trim(),
      fecha_ingreso: new Date().toISOString(),
      actividad_realizada: newTrabajador.actividad_realizada.trim() || 'Labores generales',
      tiempo_permanencia_horas: parseFloat(newTrabajador.tiempo_permanencia_hours) || 8.0,
      estado: "activo"
    };

    setTrabajadores(prev => [item, ...prev]);

    // Update lote trabajadores bitacora
    setLotes(prev => prev.map(l => {
      if (l.id === item.lote_id) {
        const mapped = {
          id: item.id,
          nombre: item.nombre,
          actividad: item.actividad_realizada,
          ingreso: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
          duracion: `${item.tiempo_permanencia_horas}h`
        };
        return {
          ...l,
          trabajadores: [mapped, ...(l.trabajadores || [])]
        };
      }
      return l;
    }));

    if (selectedLote && selectedLote.id === item.lote_id) {
      setSelectedLote(prev => ({
        ...prev,
        trabajadores: [
          {
            id: item.id,
            nombre: item.nombre,
            actividad: item.actividad_realizada,
            ingreso: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
            duracion: `${item.tiempo_permanencia_horas}h`
          },
          ...(prev.trabajadores || [])
        ]
      }));
    }

    setIsTrabajadorDrawerOpen(false);
    const targetL = lotes.find(l => l.id === item.lote_id);
    logAudit(targetL?.codigo_interno || "N/A", `Ingreso de operario registrado: ${item.nombre}`);
  };

  // Handle Attachment Uploads linked to selected Lote
  const handleAttachmentUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !selectedLote) return;

    const newAttach = {
      name: file.name,
      type: file.type || 'application/pdf',
      size: `${(file.size / 1024).toFixed(1)} KB`,
      date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    };

    setLotes(prev => prev.map(l => {
      if (l.id === selectedLote.id) {
        const updated = l.adjuntos ? [newAttach, ...l.adjuntos] : [newAttach];
        return { ...l, adjuntos: updated };
      }
      return l;
    }));

    setSelectedLote(prev => ({
      ...prev,
      adjuntos: prev.adjuntos ? [newAttach, ...prev.adjuntos] : [newAttach]
    }));

    logAudit(selectedLote.codigo_interno, `Documento adjuntado: ${file.name}`);
    alert('Documento subido con éxito y asociado a la bitácora del lote.');
  };

  // --- INTERACTION HELPER: WEATHER DRIFT CHECKER ---
  const isDriftHigh = weatherStation.wind > 15; // km/h limit for pesticide spray
  const isWashHigh = weatherStation.rain > 70; // % limit for pesticide wash

  // Filtered lists for rendering
  const filteredLotesTable = lotes.filter(l => {
    const term = tableSearch.toLowerCase();
    const matchesSearch = l.nombre.toLowerCase().includes(term) ||
      l.codigo_interno.toLowerCase().includes(term) ||
      l.cultivo.toLowerCase().includes(term);
    return matchesSearch;
  });

  // --- INTERCONNECTED TELEMETRY COMPUTATIONS ---
  const activeLotsHa = lotes.filter(l => l.estado_sanitario !== 'bajo').reduce((acc, l) => acc + l.area_ha, 0);
  const activeLotsPct = lotes.length > 0 ? Math.round((lotes.filter(l => l.estado_sanitario !== 'bajo').length / lotes.length) * 100) : 0;

  const appsExecuted = aplicaciones.filter(a => new Date(a.fecha_aplicacion) <= new Date()).length;
  const appsScheduled = aplicaciones.filter(a => new Date(a.fecha_aplicacion) > new Date()).length;
  const intervenedLoteIds = new Set(aplicaciones.map(a => a.lote_id));
  const intervenedArea = lotes.filter(l => intervenedLoteIds.has(l.id)).reduce((acc, l) => acc + l.area_ha, 0);

  const fitosanitariasCount = aplicaciones.filter(a => ['Fungicida', 'Insecticida', 'Herbicida'].includes(a.tipo_producto)).length;
  const nutricionalesCount = aplicaciones.filter(a => a.tipo_producto === 'Fertilizante').length;
  const biologicasCount = aplicaciones.filter(a => a.tipo_producto === 'Biológico' || a.tipo_aplicacion === 'Biológica').length;

  const upcomingMonit = lotes
    .filter(l => ['regular', 'bajo'].includes(l.estado_sanitario))
    .map((l, idx) => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + idx + 1);
      return {
        id: `upmon-${l.id}-${idx}`,
        title: `Lote ${l.codigo_interno} - ${l.cultivo}`,
        time: `${targetDate.toLocaleDateString()} - 08:00 a. m.`,
        priority: l.estado_sanitario === 'bajo' ? 'Alta' : 'Media'
      };
    });

  const displayUpcomingMonit = upcomingMonit.length > 0 ? upcomingMonit : [
    { id: 'upmon-mock1', title: 'Lote B1 - Soya Orgánica', time: '28 May 2026 - 08:00 a. m.', priority: 'Media' },
    { id: 'upmon-mock2', title: 'Lote C1 - Girasol', time: '29 May 2026 - 07:00 a. m.', priority: 'Alta' }
  ];

  const monCompleted = monitoreos.length;
  const monPending = displayUpcomingMonit.length;
  const lotsWithoutMon = lotes.filter(l => !monitoreos.some(m => m.lote_id === l.id)).length;

  const outbreaksCount = lotes.filter(l => l.estado_sanitario === 'bajo' || l.incidence_pct > 15).length;
  const overdueMonCount = lotes.filter(l => {
    const lotMons = monitoreos.filter(m => m.lote_id === l.id);
    if (lotMons.length === 0) return true;
    const lastMon = lotMons.sort((a, b) => new Date(b.fecha_monitoreo) - new Date(a.fecha_monitoreo))[0];
    const diffDays = (new Date() - new Date(lastMon.fecha_monitoreo)) / (1000 * 60 * 60 * 24);
    return diffDays > 15;
  }).length;

  const lotsInStress = lotes.filter(l => l.ndvi_actual < 0.5).length;
  const stressPct = lotes.length > 0 ? Math.round((lotsInStress / lotes.length) * 100) : 0;

  // Actividad reciente del lote seleccionado — dinámica, reactiva, filtrada por lote
  const recentFeed = useMemo(() => {
    if (!selectedLote) return [];
    const loteId = selectedLote.id;
    const now = new Date();
    return [
      ...aplicaciones.filter(a => a.lote_id === loteId).map(a => ({
        icon: <CheckCircle size={12} />,
        title: `Aplicación: ${a.producto_comercial || a.tipo_producto || 'Producto'}`,
        desc: `${a.tipo_producto || 'Fitosanitaria'} — Dosis: ${a.dosis || 'N/A'}`,
        time: new Date(a.fecha_aplicacion),
        timeStr: new Date(a.fecha_aplicacion).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        color: 'green'
      })),
      ...monitoreos.filter(m => m.lote_id === loteId && new Date(m.fecha_monitoreo) <= now).map(m => ({
        icon: <ShieldCheck size={12} />,
        title: 'Monitoreo registrado',
        desc: `Incidencia: ${m.incidencia_pct || 0}% | Responsable: ${m.responsable || 'N/A'}`,
        time: new Date(m.fecha_monitoreo),
        timeStr: new Date(m.fecha_monitoreo).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        color: 'info'
      })),
      ...cosechas.filter(c => c.lote_id === loteId).map(c => ({
        icon: <Calendar size={12} />,
        title: 'Cosecha programada',
        desc: `${c.produccion_estimada_kg ? c.produccion_estimada_kg.toLocaleString() : 'N/A'} kg estimados`,
        time: new Date(c.fecha_programada),
        timeStr: new Date(c.fecha_programada).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
        color: 'warning'
      })),
      ...costos.filter(c => c.lote_id === loteId).map(c => ({
        icon: <DollarSign size={12} />,
        title: `${c.categoria || 'Costo'} registrado`,
        desc: `$${c.costo ? c.costo.toLocaleString() : '0'} — ${c.descripcion || ''}`,
        time: new Date(c.fecha || Date.now()),
        timeStr: new Date(c.fecha || Date.now()).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
        color: 'warning'
      })),
      ...trabajadores.filter(t => t.lote_id === loteId).map(t => ({
        icon: <User size={12} />,
        title: `Operario: ${t.nombre || 'N/A'}`,
        desc: `${t.actividad_realizada || 'Labor general'} (${t.tiempo_permanencia_horas || 0}h)`,
        time: new Date(t.fecha_ingreso),
        timeStr: new Date(t.fecha_ingreso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        color: 'info'
      }))
    ]
    .filter(item => !isNaN(item.time.getTime()))
    .sort((a, b) => b.time - a.time)
    .slice(0, 8);
  }, [selectedLote?.id, aplicaciones, monitoreos, cosechas, costos, trabajadores]);

  // Próximos monitoreos del lote seleccionado (solo fechas futuras)
  const proximosMonitoreosFuturos = useMemo(() => {
    if (!selectedLote) return [];
    return monitoreos
      .filter(m => m.lote_id === selectedLote.id && new Date(m.fecha_monitoreo) > new Date())
      .sort((a, b) => new Date(a.fecha_monitoreo) - new Date(b.fecha_monitoreo));
  }, [selectedLote?.id, monitoreos]);

  // Dynamic NDVI line points mapping for selected Lote
  const getHistoricalNdvi = (lote) => {
    if (!lote) return [0.60, 0.62, 0.65, 0.68, 0.70, 0.72];
    const current = lote.ndvi_actual;
    const isTrendUp = lote.ndvi_trend?.startsWith('+') ?? true;
    const diff = parseFloat(lote.ndvi_trend) || 0.02;

    const p5 = current;
    const p4 = current - (isTrendUp ? diff * 0.5 : diff * -0.5);
    const p3 = p4 - 0.03;
    const p2 = p3 + 0.01;
    const p1 = p2 - 0.02;
    const p0 = p1 - 0.01;

    return [p0, p1, p2, p3, p4, p5].map(v => Math.max(0.15, Math.min(0.95, v)));
  };

  const historyPoints = getHistoricalNdvi(selectedLote);
  const svgPointsStr = historyPoints.map((val, idx) => `${idx * 20},${(50 - val * 40).toFixed(1)}`).join(' ');

  // Dynamic Crop Area distribution pie
  const cropTotals = {};
  lotes.forEach(l => {
    cropTotals[l.cultivo] = (cropTotals[l.cultivo] || 0) + l.area_ha;
  });
  const totalCropHa = Object.values(cropTotals).reduce((a, b) => a + b, 0);
  const cropDistribution = Object.entries(cropTotals).map(([name, area]) => ({
    name,
    area: parseFloat(area.toFixed(1)),
    pct: totalCropHa > 0 ? Math.round((area / totalCropHa) * 100) : 0
  }));

  // Dynamic Application Type count pie
  const appTotals = { Fungicida: 0, Insecticida: 0, Herbicida: 0, Fertilizante: 0, Biológico: 0 };
  aplicaciones.forEach(a => {
    const type = a.tipo_producto || 'Fungicida';
    if (appTotals[type] !== undefined) appTotals[type] += 1;
  });
  const totalAppsCount = Object.values(appTotals).reduce((a, b) => a + b, 0);
  const appDistribution = Object.entries(appTotals)
    .filter(([_, count]) => count > 0)
    .map(([name, count]) => ({
      name,
      count,
      pct: totalAppsCount > 0 ? Math.round((count / totalAppsCount) * 100) : 0
    }));

  // Dynamic cost bar chart data
  const lotCostsMap = {};
  costos.forEach(c => {
    const lote = lotes.find(l => l.id === c.lote_id);
    const code = lote ? lote.codigo_interno : 'N/A';
    lotCostsMap[code] = (lotCostsMap[code] || 0) + c.costo;
  });
  const costBarItems = Object.entries(lotCostsMap)
    .map(([name, cost]) => ({ name, cost }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5);
  const maxCostVal = costBarItems.length > 0 ? Math.max(...costBarItems.map(c => c.cost)) : 1;

  // Selected Lote Activities for details panel
  const selectedLoteActivities = [
    ...aplicaciones.filter(a => a.lote_id === selectedLote?.id).map(a => ({
      tipo: 'aplicacion',
      titulo: `Aplicación: ${a.producto_comercial}`,
      fecha: new Date(a.fecha_aplicacion),
      desc: `${a.tipo_producto} - ${a.dosis}`,
      icon: <Clock size={12} />
    })),
    ...monitoreos.filter(m => m.lote_id === selectedLote?.id).map(m => ({
      tipo: 'monitoreo',
      titulo: 'Monitoreo Sanitario',
      fecha: new Date(m.fecha_monitoreo),
      desc: `Incidencia: ${m.incidencia_pct}% | Sev: ${m.severidad_pct}%`,
      icon: <ShieldCheck size={12} />
    })),
    ...cosechas.filter(c => c.lote_id === selectedLote?.id).map(c => ({
      tipo: 'cosecha',
      titulo: 'Cosecha Planificada',
      fecha: new Date(c.fecha_programada),
      desc: `${c.produccion_estimada_kg.toLocaleString()} kg estimados`,
      icon: <Calendar size={12} />
    }))
  ].sort((a, b) => b.fecha - a.fecha);

  return (
    <>
      {/* Submenu Layout Header */}
      <div className="section-header" style={{ borderBottom: 'none', paddingBottom: '0px' }}>
        <div className="section-title-box">
          <h2 style={{ fontSize: '22px', fontWeight: '700' }}>Manejo Sanitario</h2>
          <p className="section-desc">Gestión integrada de lotes, aplicaciones, monitoreos y evaluaciones</p>
        </div>

        {/* Replicated Actions header */}
        <div className="section-actions" style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" onClick={() => setIsLoteDrawerOpen(true)} style={{ backgroundColor: 'var(--primary)' }}>
            <Plus size={16} />
            <span>Nuevo Lote</span>
          </button>
        </div>
      </div>


      {/* --- MASTER LAYOUT COMMAND CENTER GRID --- */}
      {activeSubView === 'lotes' ? (
        <div className="sanitary-master-grid">

          {/* Left Layout Column */}
          <div className="sanitary-left-column">

            {/* GIS Map & Selected details card row */}
            <div className="map-details-grid">

              {/* GIS Map Container Card */}
              <div className="glass-card" style={{ padding: '0px', height: '550px', position: 'relative' }}>
                {/* Advanced GIS layer selector */}
                <div className="map-layer-selector" style={{ top: '12px', right: '12px', display: 'flex', gap: '4px', alignItems: 'center', background: 'rgba(255,255,255,0.95)', padding: '4px', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 1000 }}>
                  <button
                    className={`map-layer-btn ${mapLayer === 'callejero' ? 'active' : ''}`}
                    onClick={() => setMapLayer('callejero')}
                    style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px' }}
                  >
                    Mapa
                  </button>
                  <button
                    className={`map-layer-btn ${mapLayer === 'satelite' ? 'active' : ''}`}
                    onClick={() => setMapLayer('satelite')}
                    style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px' }}
                  >
                    Satélite
                  </button>
                  <button
                    className={`map-layer-btn ${mapLayer === 'ndvi' ? 'active' : ''}`}
                    onClick={() => setMapLayer('ndvi')}
                    style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px' }}
                  >
                    NDVI
                  </button>

                  <select
                    className="input-glass select-glass"
                    style={{ padding: '3px 20px 3px 6px', fontSize: '11px', height: '24px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
                    value={['callejero', 'satelite', 'ndvi'].includes(mapLayer) ? 'otros' : mapLayer}
                    onChange={e => {
                      if (e.target.value !== 'otros') {
                        setMapLayer(e.target.value);
                      }
                    }}
                  >
                    <option value="otros">Otros...</option>
                    <option value="ndre">NDRE</option>
                    <option value="savi">SAVI</option>
                    <option value="humedad">Humedad</option>
                    <option value="prod_layer">Productividad</option>
                  </select>
                </div>

                {/* Floating filters overlay */}
                {showMapFilters && (
                  <div className="map-overlay-filters" style={{ top: '12px', left: '12px', padding: '10px', minWidth: '150px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Filtros GIS</span>
                      <button
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                        onClick={() => setShowMapFilters(false)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>Cultivo</label>
                      <select
                        className="input-glass select-glass"
                        style={{ padding: '3px 18px 3px 6px', fontSize: '11px', background: 'var(--bg-card)' }}
                        value={loteFilterCultivo}
                        onChange={e => setLoteFilterCultivo(e.target.value)}
                      >
                        <option value="Todos">Todos</option>
                        <option value="Maíz">Maíz</option>
                        <option value="Soya">Soya</option>
                        <option value="Girasol">Girasol</option>
                      </select>

                      <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>Estado Sanitario</label>
                      <select
                        className="input-glass select-glass"
                        style={{ padding: '3px 18px 3px 6px', fontSize: '11px', background: 'var(--bg-card)' }}
                        value={loteFilterEstado}
                        onChange={e => setLoteFilterEstado(e.target.value)}
                      >
                        <option value="Todos">Todos</option>
                        <option value="excelente">Excelente</option>
                        <option value="bueno">Bueno</option>
                        <option value="regular">Regular</option>
                        <option value="bajo">Bajo</option>
                      </select>

                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px', fontSize: '10px', justifyContent: 'center', marginTop: '4px' }}
                        onClick={() => { setLoteFilterCultivo('Todos'); setLoteFilterEstado('Todos'); }}
                      >
                        Limpiar filtros
                      </button>
                    </div>
                  </div>
                )}

                {/* Leaflet Map element */}
                <div id="sanitary-gis-map" className="gis-map-element" style={{ height: '100%', width: '100%' }}></div>

                {geeLoading && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(15, 23, 42, 0.7)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    borderRadius: '8px',
                    color: 'white',
                    gap: '12px'
                  }}>
                    <RefreshCw size={32} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'center', padding: '0 20px' }}>Consultando Google Earth Engine en tiempo real...</span>
                  </div>
                )}

                {geeWarning && (
                  <div style={{
                    position: 'absolute',
                    bottom: '50px',
                    left: '10px',
                    right: '10px',
                    background: 'rgba(251, 191, 36, 0.95)',
                    color: '#78350f',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    zIndex: 2000,
                    fontSize: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    borderLeft: '4px solid #d97706'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={14} />
                      <span>{geeWarning}</span>
                    </div>
                    <button 
                      onClick={() => setGeeWarning(null)} 
                      style={{ background: 'transparent', border: 'none', color: '#78350f', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* Dynamic legend based on layer */}
                <div className="map-legend-gradient-card" style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid var(--border-color)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                  zIndex: 1000,
                  minWidth: '200px',
                  backdropFilter: 'blur(8px)'
                }}>
                  <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>
                    Leyenda: {mapLayer.toUpperCase()}
                  </span>
                  {['ndvi', 'ndre', 'savi'].includes(mapLayer) ? (
                    <div>
                      <div style={{ height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, #ef4444, #f97316, #eab308, #84cc16, #22c55e)', width: '100%' }}></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: 'var(--text-secondary)', marginTop: '5px', fontWeight: '600' }}>
                        <span>0.0 (Crítico)</span>
                        <span>0.5</span>
                        <span>1.0 (Óptimo)</span>
                      </div>
                    </div>
                  ) : mapLayer === 'humedad' ? (
                    <div>
                      <div style={{ height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, #ece7f2, #74a9cf, #0570b0)', width: '100%' }}></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: 'var(--text-secondary)', marginTop: '5px', fontWeight: '600' }}>
                        <span>-0.2 (Baja)</span>
                        <span>0.1</span>
                        <span>0.4 (Alta)</span>
                      </div>
                    </div>
                  ) : mapLayer === 'prod_layer' ? (
                    <div>
                      <div style={{ height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, #c084fc, #6d28d9)', width: '100%' }}></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: 'var(--text-secondary)', marginTop: '5px', fontWeight: '600' }}>
                        <span>Baja</span>
                        <span>Media</span>
                        <span>Alta</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, #dc2626, #f59e0b, #22c55e, #16a34a)', width: '100%' }}></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: 'var(--text-secondary)', marginTop: '5px', fontWeight: '600' }}>
                        <span>Bajo</span>
                        <span>Regular</span>
                        <span>Bueno</span>
                        <span>Excelente</span>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Lote Technical Details Card */}
              <div className="glass-card primary-edge" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                {selectedLote ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700' }}>CÓDIGO: {selectedLote.codigo_interno}</span>
                          <h3 style={{ fontSize: '16px', fontWeight: '800' }}>{selectedLote.nombre}</h3>
                        </div>
                        <span className={`badge ${selectedLote.estado_sanitario === 'excelente' ? 'badge-green' :
                          selectedLote.estado_sanitario === 'bueno' ? 'badge-green' :
                            selectedLote.estado_sanitario === 'regular' ? 'badge-yellow' : 'badge-red'
                          }`} style={{ fontSize: '9px', padding: '1px 6px' }}>{selectedLote.estado_sanitario}</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: '11px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>Cultivo:</span>
                          <p style={{ fontWeight: '600', margin: '1px 0' }}>{selectedLote.cultivo} ({selectedLote.variedad})</p>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>Área Total:</span>
                          <p style={{ fontWeight: '600', margin: '1px 0' }}>{selectedLote.area_ha} ha</p>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>Fecha de Siembra:</span>
                          <p style={{ fontWeight: '600', margin: '1px 0' }}>{new Date(selectedLote.fecha_siembra).toLocaleDateString('es-ES', { dateStyle: 'short' })}</p>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>Índice {histogramIndex}:</span>
                          <p style={{ fontWeight: '700', margin: '1px 0', color: selectedLote.ndvi_actual > 0.6 ? 'var(--primary)' : 'var(--accent-gold)' }}>
                            {histogramIndex === 'NDVI' ? selectedLote.ndvi_actual
                             : histogramIndex === 'NDRE' ? (selectedLote.ndre_actual || '0.48')
                             : histogramIndex === 'SAVI' ? (selectedLote.savi_actual || '0.58')
                             : (selectedLote.humedad_actual || '0.15')}
                          </p>
                        </div>
                      </div>

                      {(() => {
                        const sumCoords = selectedLote.centroide_lat + selectedLote.centroide_lng;
                        const charSum = selectedLote.codigo_interno.charCodeAt(0) + (selectedLote.codigo_interno.charCodeAt(1) || 0);
                        const activeIndexValue = histogramIndex === 'NDVI' ? selectedLote.ndvi_actual
                                               : histogramIndex === 'NDRE' ? (selectedLote.ndre_actual || 0.48)
                                               : histogramIndex === 'SAVI' ? (selectedLote.savi_actual || 0.58)
                                               : (selectedLote.humedad_actual || 0.15);
                        const activeGeeData = geeData.index === histogramIndex && geeData.histogram 
                          ? geeData 
                          : generateMockHistogramAndStats(histogramIndex, charSum, activeIndexValue);

                        const { stats, distribution, histogram } = activeGeeData;
                        const maxCount = Math.max(...histogram.map(b => b.count), 1);

                        return (
                          <>
                            {/* HISTOGRAM SECTION HEADER */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                                  HISTOGRAMA {histogramIndex}
                                </span>
                                <Info size={11} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} title="Muestra la distribución de frecuencia de píxeles en el lote del índice espectral seleccionado" />
                              </div>

                              <select
                                className="input-glass select-glass"
                                style={{ padding: '1px 18px 1px 4px', fontSize: '10.5px', height: '22px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
                                value={histogramIndex}
                                onChange={e => handleHistogramIndexChange(e.target.value)}
                              >
                                <option value="NDVI">NDVI</option>
                                <option value="NDRE">NDRE</option>
                                <option value="SAVI">SAVI</option>
                                <option value="HUMEDAD">Humedad</option>
                              </select>
                            </div>

                            {/* HISTOGRAM CHART SVG */}
                            <div style={{ position: 'relative', marginTop: '6px' }}>
                              <svg viewBox="0 0 400 155" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                                {/* Grid Lines and Labels */}
                                {[0.25, 0.5, 0.75, 1.0].map((ratio, idx) => {
                                  const y = 130 - ratio * 120;
                                  const label = maxCount >= 1000 ? `${Math.round((ratio * maxCount) / 1000)}k` : Math.round(ratio * maxCount);
                                  return (
                                    <g key={idx}>
                                      <line x1="30" y1={y} x2="390" y2={y} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                                      <text x="25" y={y + 3} textAnchor="end" style={{ fontSize: '8px', fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>{label}</text>
                                    </g>
                                  );
                                })}

                                {/* X-Axis labels */}
                                {[0.0, 0.2, 0.4, 0.6, 0.8, 1.0].map((val, idx) => {
                                  const startVal = histogramIndex === 'HUMEDAD' ? -0.2 : 0.0;
                                  const endVal = 1.0;
                                  const ratio = (val - startVal) / (endVal - startVal);
                                  const x = 30 + ratio * 360;
                                  if (x < 30 || x > 390) return null;

                                  return (
                                    <g key={idx}>
                                      <line x1={x} y1="130" x2={x} y2="134" stroke="var(--border-color)" strokeWidth="0.5" />
                                      <text x={x} y="145" textAnchor="middle" style={{ fontSize: '8px', fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>{val}</text>
                                    </g>
                                  );
                                })}
                                
                                <line x1="30" y1="130" x2="390" y2="130" stroke="var(--border-color)" strokeWidth="1" />
                                <line x1="30" y1="10" x2="30" y2="130" stroke="var(--border-color)" strokeWidth="1" />

                                {/* Histogram Bars */}
                                {histogram.map((bar, bIdx) => {
                                  const barWidth = 360 / histogram.length - 1;
                                  const x = 30 + bIdx * (360 / histogram.length);
                                  const barHeight = (bar.count / maxCount) * 120;
                                  const y = 130 - barHeight;

                                  let barColor = 'var(--primary)';
                                  const val = bar.value;
                                  if (histogramIndex === 'HUMEDAD') {
                                    if (val < 0.0) barColor = '#a6bddb';
                                    else if (val < 0.3) barColor = '#3690c0';
                                    else barColor = '#0570b0';
                                  } else {
                                    if (val < 0.3) barColor = '#ef4444';
                                    else if (val < 0.5) barColor = '#f97316';
                                    else if (val < 0.7) barColor = '#eab308';
                                    else if (val < 0.85) barColor = '#84cc16';
                                    else barColor = '#22c55e';
                                  }

                                  return (
                                    <rect
                                      key={bIdx}
                                      x={x}
                                      y={y}
                                      width={Math.max(1, barWidth)}
                                      height={Math.max(1, barHeight)}
                                      fill={barColor}
                                      opacity={hoveredBar && hoveredBar.value === bar.value ? 1 : 0.8}
                                      rx="0.5"
                                      style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                                      onMouseEnter={() => setHoveredBar({ ...bar, x, y, color: barColor })}
                                      onMouseLeave={() => setHoveredBar(null)}
                                    />
                                  );
                                })}

                                {/* Promedio line indicator */}
                                {(() => {
                                  const meanVal = stats.mean;
                                  const startVal = histogramIndex === 'HUMEDAD' ? -0.2 : 0.0;
                                  const endVal = 1.0;
                                  const ratio = (meanVal - startVal) / (endVal - startVal);
                                  const x = 30 + ratio * 360;

                                  if (x >= 30 && x <= 390) {
                                    return (
                                      <g>
                                        <line x1={x} y1="10" x2={x} y2="130" stroke="#16a34a" strokeWidth="1.5" strokeDasharray="3 3" />
                                        <rect x={x - 35} y="3" width="70" height="14" rx="3" fill="#16a34a" />
                                        <text x={x} y="13" textAnchor="middle" style={{ fontSize: '7.5px', fill: 'white', fontWeight: 'bold', fontFamily: 'var(--font-sans)' }}>
                                          Promedio: {meanVal}
                                        </text>
                                      </g>
                                    );
                                  }
                                  return null;
                                })()}
                              </svg>

                              {/* Hover Tooltip */}
                              {hoveredBar && (
                                <div style={{
                                  position: 'absolute',
                                  left: `${(hoveredBar.x / 400) * 100}%`,
                                  top: `${(hoveredBar.y / 155) * 100 - 35}%`,
                                  transform: 'translateX(-50%)',
                                  background: 'var(--bg-app)',
                                  border: `1px solid ${hoveredBar.color}`,
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '9px',
                                  boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                                  pointerEvents: 'none',
                                  zIndex: 10,
                                  whiteSpace: 'nowrap'
                                }}>
                                  <strong>{histogramIndex}: {hoveredBar.value}</strong><br/>
                                  Píxeles: {hoveredBar.count.toLocaleString()}
                                </div>
                              )}
                            </div>

                            {/* STATS DETAILS GRID */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', marginTop: '10px' }}>
                              <div style={{ padding: '5px 2px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                                <span style={{ fontSize: '7.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>PROMEDIO</span>
                                <strong style={{ fontSize: '10.5px', display: 'block', margin: '1px 0' }}>{stats.mean}</strong>
                                <span style={{ fontSize: '7.5px', color: stats.mean >= 0.7 ? 'var(--primary)' : 'var(--accent-gold)', fontWeight: 'bold' }}>
                                  {stats.mean >= 0.75 ? 'Excelente' : stats.mean >= 0.5 ? 'Bueno' : 'Regular'}
                                </span>
                              </div>
                              <div style={{ padding: '5px 2px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                                <span style={{ fontSize: '7.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>MEDIANA</span>
                                <strong style={{ fontSize: '10.5px', display: 'block', margin: '1px 0' }}>{stats.median}</strong>
                                <span style={{ fontSize: '7px', color: 'var(--text-muted)' }}>Punto medio</span>
                              </div>
                              <div style={{ padding: '5px 2px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                                <span style={{ fontSize: '7.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>DESV. EST.</span>
                                <strong style={{ fontSize: '10.5px', display: 'block', margin: '1px 0' }}>{stats.stdDev}</strong>
                                <span style={{ fontSize: '7px', color: 'var(--text-muted)' }}>Dispersión</span>
                              </div>
                              <div style={{ padding: '5px 2px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                                <span style={{ fontSize: '7.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>MÍNIMO</span>
                                <strong style={{ fontSize: '10.5px', display: 'block', margin: '1px 0', color: 'var(--accent-gold)' }}>{stats.min}</strong>
                                <span style={{ fontSize: '7px', color: 'var(--text-muted)' }}>Mínimo</span>
                              </div>
                              <div style={{ padding: '5px 2px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                                <span style={{ fontSize: '7.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>MÁXIMO</span>
                                <strong style={{ fontSize: '10.5px', display: 'block', margin: '1px 0', color: 'var(--primary)' }}>{stats.max}</strong>
                                <span style={{ fontSize: '7px', color: 'var(--text-muted)' }}>Máximo</span>
                              </div>
                              <div style={{ padding: '5px 2px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                                <span style={{ fontSize: '7.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>CV%</span>
                                <strong style={{ fontSize: '10.5px', display: 'block', margin: '1px 0' }}>{stats.cv}%</strong>
                                <span style={{ fontSize: '7.5px', color: stats.cv < 15 ? 'var(--primary)' : 'var(--accent-gold)', fontWeight: 'bold' }}>
                                  {stats.cv < 12 ? 'Excelente' : stats.cv < 20 ? 'Moderado' : 'Elevado'}
                                </span>
                              </div>
                            </div>

                            {/* SURFACE DISTRIBUTION BAR */}
                            <div style={{ marginTop: '12px' }}>
                              <span style={{ fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
                                DISTRIBUCIÓN DE SUPERFICIE
                              </span>
                              <div style={{ display: 'flex', height: '16px', borderRadius: '4px', overflow: 'hidden', width: '100%' }}>
                                {histogramIndex === 'HUMEDAD' ? (
                                  <>
                                    <div style={{ width: `${distribution.baja}%`, background: '#a6bddb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e3a8a', fontSize: '9px', fontWeight: 'bold' }} title={`Baja: ${distribution.baja}%`}>{distribution.baja > 5 && `${distribution.baja}%`}</div>
                                    <div style={{ width: `${distribution.media}%`, background: '#3690c0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '9px', fontWeight: 'bold' }} title={`Media: ${distribution.media}%`}>{distribution.media > 5 && `${distribution.media}%`}</div>
                                    <div style={{ width: `${distribution.alta}%`, background: '#0570b0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '9px', fontWeight: 'bold' }} title={`Alta: ${distribution.alta}%`}>{distribution.alta > 5 && `${distribution.alta}%`}</div>
                                  </>
                                ) : (
                                  <>
                                    <div style={{ width: `${distribution.critico}%`, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '9px', fontWeight: 'bold' }} title={`Crítico (<0.3): ${distribution.critico}%`}>{distribution.critico > 5 && `${distribution.critico}%`}</div>
                                    <div style={{ width: `${distribution.bajo}%`, background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '9px', fontWeight: 'bold' }} title={`Bajo (0.3 - 0.5): ${distribution.bajo}%`}>{distribution.bajo > 5 && `${distribution.bajo}%`}</div>
                                    <div style={{ width: `${distribution.medio}%`, background: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e293b', fontSize: '9px', fontWeight: 'bold' }} title={`Medio (0.5 - 0.7): ${distribution.medio}%`}>{distribution.medio > 5 && `${distribution.medio}%`}</div>
                                    <div style={{ width: `${distribution.alto}%`, background: '#84cc16', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e293b', fontSize: '9px', fontWeight: 'bold' }} title={`Alto (0.7 - 0.85): ${distribution.alto}%`}>{distribution.alto > 5 && `${distribution.alto}%`}</div>
                                    <div style={{ width: `${distribution.excelente}%`, background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '9px', fontWeight: 'bold' }} title={`Excelente (>0.85): ${distribution.excelente}%`}>{distribution.excelente > 5 && `${distribution.excelente}%`}</div>
                                  </>
                                )}
                              </div>
                              {/* Legends */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', marginTop: '5px', fontSize: '8.5px', color: 'var(--text-secondary)' }}>
                                {histogramIndex === 'HUMEDAD' ? (
                                  <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a6bddb' }}></span><span>Baja (&lt;0.0)</span></div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3690c0' }}></span><span>Media (0.0 - 0.3)</span></div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0570b0' }}></span><span>Alta (&gt;0.3)</span></div>
                                  </>
                                ) : (
                                  <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }}></span><span>Crítico (&lt;0.3)</span></div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f97316' }}></span><span>Bajo (0.3-0.5)</span></div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#eab308' }}></span><span>Medio (0.5-0.7)</span></div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#84cc16' }}></span><span>Alto (0.7-0.85)</span></div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }}></span><span>Excelente (&gt;0.85)</span></div>
                                  </>
                                )}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* OBSERVATIONS & QUICK ACTIONS */}
                    <div>
                      <div style={{ fontSize: '11px', marginTop: '10px' }}>
                        <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Observaciones:</span>
                        <p style={{ fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', margin: 0 }}>
                          "{selectedLote.observaciones || 'Sin observaciones.'}"
                        </p>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                          <button className="btn btn-secondary" style={{ padding: '5px', fontSize: '10.5px', justifyContent: 'center' }} onClick={() => { setNewAplicacion(p => ({ ...p, lote_id: selectedLote.id })); setIsAppDrawerOpen(true); }}>
                            Reg. Aplicación
                          </button>
                          <button className="btn btn-secondary" style={{ padding: '5px', fontSize: '10.5px', justifyContent: 'center' }} onClick={() => { setNewMonitoreo(p => ({ ...p, lote_id: selectedLote.id })); setIsMonDrawerOpen(true); }}>
                            Reg. Monitoreo
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ flex: 1, justifyContent: 'center', fontSize: '10.5px', padding: '5px' }}
                            onClick={() => setIsFichaModalOpen(true)}
                          >
                            Ver ficha completa del lote
                          </button>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => handleDeleteLote(selectedLote.id)}
                            title="Eliminar Lote"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '20px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    <MapPin size={24} style={{ marginBottom: '8px', color: 'var(--text-muted)' }} />
                    <span>Seleccione un lote en el mapa o la tabla para ver su información técnica.</span>
                  </div>
                )}
              </div>

            </div>

            {/* Dynamic Multi-Tab Table Ledger */}
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['Lotes', 'Aplicaciones', 'Monitoreos', 'Cosechas', 'Costos', 'Trabajadores'].map(tab => (
                    <button
                      key={tab}
                      className={`notion-tab-btn ${activeTableTab === tab ? 'active' : ''}`}
                      onClick={() => setActiveTableTab(tab)}
                      style={{ fontSize: '13px', padding: '6px 4px' }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input type="text" className="input-glass" placeholder="Buscar..." style={{ padding: '4px 10px', fontSize: '12px', width: '130px' }} value={tableSearch} onChange={e => setTableSearch(e.target.value)} />

                  {activeTableTab === 'Costos' && (
                    <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setIsCostoDrawerOpen(true)}><Plus size={12} /><span>Agregar Costo</span></button>
                  )}
                  {activeTableTab === 'Trabajadores' && (
                    <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setIsTrabajadorDrawerOpen(true)}><Plus size={12} /><span>Ingresar Operario</span></button>
                  )}
                  <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => handleExportCSV(activeTableTab === 'Aplicaciones' ? 'aplicaciones' : 'lotes')}><Download size={12} /><span>Exportar</span></button>
                </div>
              </div>

              <div className="table-container" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {activeTableTab === 'Lotes' && (
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Lote</th>
                        <th>Cultivo</th>
                        <th>Área (ha)</th>
                        <th>Fecha Siembra</th>
                        <th>Edad (Días)</th>
                        <th>Estado Sanitario</th>
                        <th>NDVI</th>
                        <th>Sparkline</th>
                        <th style={{ textAlign: 'right' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLotesTable.map(l => (
                        <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedLote(l)}>
                          <td>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '24px',
                              height: '24px',
                              borderRadius: '4px',
                              background: 'var(--primary-light)',
                              color: 'var(--primary)',
                              fontSize: '11px',
                              fontWeight: '700'
                            }}>
                              {l.codigo_interno}
                            </span>
                          </td>
                          <td style={{ fontWeight: '600' }}>{l.cultivo} Híbrido</td>
                          <td>{l.area_ha}</td>
                          <td>{new Date(l.fecha_siembra).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                          <td>{calculateAgeInDays(l.fecha_siembra)}d</td>
                          <td>
                            <span className={`badge ${l.estado_sanitario === 'excelente' ? 'badge-green' :
                              l.estado_sanitario === 'bueno' ? 'badge-green' :
                                l.estado_sanitario === 'regular' ? 'badge-yellow' : 'badge-red'
                              }`}>{l.estado_sanitario}</span>
                          </td>
                          <td style={{ fontWeight: '700' }}>{l.ndvi_actual}</td>
                          <td>
                            <div className="sparkline-container">
                              <svg className="sparkline-svg">
                                <polyline
                                  fill="none"
                                  stroke={l.estado_sanitario === 'bajo' ? 'var(--accent-red)' : 'var(--primary)'}
                                  strokeWidth="1.5"
                                  points={
                                    l.estado_sanitario === 'bajo'
                                      ? "0,20 15,22 30,23 45,24 60,25 70,26"
                                      : l.estado_sanitario === 'regular'
                                        ? "0,15 15,14 30,17 45,18 60,16 70,17"
                                        : "0,22 15,18 30,14 45,11 60,8 70,4"
                                  }
                                />
                              </svg>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                              <button className="btn btn-secondary" style={{ padding: '4px' }} onClick={() => { setSelectedLote(l); setIsFichaModalOpen(true); }}><Eye size={12} /></button>
                              <button className="btn btn-secondary" style={{ padding: '4px' }} onClick={() => { setSelectedLote(l); setIsMonDrawerOpen(true); }}><ShieldCheck size={12} /></button>
                              <button className="btn btn-secondary" style={{ padding: '4px' }} onClick={() => { setSelectedLote(l); setIsAppDrawerOpen(true); }}><Clock size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeTableTab === 'Aplicaciones' && (
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Lote</th>
                        <th>Producto / Ingrediente</th>
                        <th>Dosis / Vol</th>
                        <th>Operario / Equipo</th>
                        <th>Fecha</th>
                        <th>Costo</th>
                        <th>PC</th>
                        <th style={{ textAlign: 'right' }}>Eliminar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aplicaciones.map(a => {
                        const targetL = lotes.find(l => l.id === a.lote_id);
                        return (
                          <tr key={a.id}>
                            <td><strong>{targetL?.codigo_interno || 'N/A'}</strong></td>
                            <td>{a.producto_comercial} ({a.ingrediente_activo})</td>
                            <td>{a.dosis} / {a.volumen_applied || a.volumen_aplicado} {a.unidad_medida}</td>
                            <td>{a.operario_responsable} / {a.maquinaria_utilizada}</td>
                            <td>{new Date(a.fecha_aplicacion).toLocaleDateString()}</td>
                            <td style={{ fontWeight: '700' }}>${a.costo_aplicacion.toLocaleString()}</td>
                            <td><span className={`badge ${a.periodo_carencia_dias > 0 ? 'badge-red' : 'badge-green'}`}>{a.periodo_carencia_dias}d</span></td>
                            <td style={{ textAlign: 'right' }}>
                              <button className="btn btn-danger" style={{ padding: '4px' }} onClick={() => {
                                if (window.confirm('¿Eliminar aplicación?')) setAplicaciones(prev => prev.filter(p => p.id !== a.id));
                              }}><Trash2 size={12} /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {activeTableTab === 'Monitoreos' && (
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Lote</th>
                        <th>Responsable</th>
                        <th>Fecha</th>
                        <th>Incidencia</th>
                        <th>Severidad</th>
                        <th>Humedad / Temp</th>
                        <th>Enfermedades / Plagas</th>
                        <th style={{ textAlign: 'right' }}>Eliminar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitoreos.map(m => {
                        const targetL = lotes.find(l => l.id === m.lote_id);
                        return (
                          <tr key={m.id}>
                            <td><strong>{targetL?.codigo_interno || 'N/A'}</strong></td>
                            <td>{m.responsable}</td>
                            <td>{new Date(m.fecha_monitoreo).toLocaleDateString()}</td>
                            <td style={{ color: 'var(--accent-red)', fontWeight: '700' }}>{m.incidencia_pct}%</td>
                            <td style={{ color: 'var(--accent-gold)', fontWeight: '700' }}>{m.severidad_pct}%</td>
                            <td>{m.humedad_pct}% / {m.temperatura_c}°C</td>
                            <td>{m.enfermedades_detectadas} / {m.plagas_detectadas}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button className="btn btn-danger" style={{ padding: '4px' }} onClick={() => setMonitoreos(prev => prev.filter(p => p.id !== m.id))}><Trash2 size={12} /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {activeTableTab === 'Cosechas' && (
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Lote</th>
                        <th>Fecha Programada</th>
                        <th>Área (ha)</th>
                        <th>Producción Est (kg)</th>
                        <th>Estado Carencia</th>
                        <th style={{ textAlign: 'right' }}>Eliminar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cosechas.map(c => {
                        const targetL = lotes.find(l => l.id === c.lote_id);
                        return (
                          <tr key={c.id}>
                            <td><strong>{targetL?.codigo_interno || 'N/A'}</strong></td>
                            <td>{c.fecha_programada}</td>
                            <td>{c.area_programada_ha} ha</td>
                            <td style={{ fontWeight: '700' }}>{c.produccion_estimada_kg.toLocaleString()} kg</td>
                            <td><span className={`badge ${c.estado_carencia === 'Carencia activa' ? 'badge-red' : 'badge-green'}`}>{c.estado_carencia}</span></td>
                            <td style={{ textAlign: 'right' }}>
                              <button className="btn btn-danger" style={{ padding: '4px' }} onClick={() => setCosechas(prev => prev.filter(p => p.id !== c.id))}><Trash2 size={12} /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {activeTableTab === 'Costos' && (
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Lote</th>
                        <th>Categoría</th>
                        <th>Fecha</th>
                        <th>Descripción</th>
                        <th>Costo (COP)</th>
                        <th>Responsable</th>
                        <th style={{ textAlign: 'right' }}>Eliminar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {costos.map(cost => {
                        const targetL = lotes.find(l => l.id === cost.lote_id);
                        return (
                          <tr key={cost.id}>
                            <td><strong>{targetL?.codigo_interno || 'N/A'}</strong></td>
                            <td>{cost.categoria}</td>
                            <td>{cost.fecha}</td>
                            <td>{cost.descripcion}</td>
                            <td style={{ fontWeight: '700' }}>${cost.costo.toLocaleString()}</td>
                            <td>{cost.responsable}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button className="btn btn-danger" style={{ padding: '4px' }} onClick={() => setCostos(prev => prev.filter(p => p.id !== cost.id))}><Trash2 size={12} /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {activeTableTab === 'Trabajadores' && (
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Lote</th>
                        <th>Nombre</th>
                        <th>Fecha Ingreso</th>
                        <th>Labor Realizada</th>
                        <th>Permanencia (h)</th>
                        <th>Estado</th>
                        <th style={{ textAlign: 'right' }}>Eliminar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trabajadores.map(t => {
                        const targetL = lotes.find(l => l.id === t.lote_id);
                        return (
                          <tr key={t.id}>
                            <td><strong>{targetL?.codigo_interno || 'N/A'}</strong></td>
                            <td>{t.nombre}</td>
                            <td>{new Date(t.fecha_ingreso).toLocaleString()}</td>
                            <td>{t.actividad_realizada}</td>
                            <td style={{ fontWeight: '600' }}>{t.tiempo_permanencia_horas} hrs</td>
                            <td><span className={`badge ${t.estado === 'activo' ? 'badge-yellow' : 'badge-green'}`}>{t.estado}</span></td>
                            <td style={{ textAlign: 'right' }}>
                              <button className="btn btn-danger" style={{ padding: '4px' }} onClick={() => setTrabajadores(prev => prev.filter(p => p.id !== t.id))}><Trash2 size={12} /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Rediseño de sección inferior: Evolución e Historial Temporal */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>

              {/* Panel Izquierdo: Evolución del Índice (Últimos 6 meses) */}
              <div 
                className="glass-card" 
                style={{ 
                  padding: '16px', 
                  cursor: 'pointer', 
                  transition: 'transform 0.2s, box-shadow 0.2s', 
                  position: 'relative' 
                }}
                onClick={() => setIsEvolutionModalOpen(true)}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '12.5px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-primary)', margin: 0 }}>
                    Evolución {histogramIndex} (Últimos 6 Meses)
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--primary)', fontWeight: 'bold' }}>
                    <Eye size={12} />
                    <span>Maximizar gráfico</span>
                  </div>
                </div>

                {selectedLote ? (
                  (() => {
                    const { points, labels } = getHistoricalIndexPoints(selectedLote, histogramIndex);
                    const minVal = histogramIndex === 'HUMEDAD' ? -0.2 : 0.0;
                    const maxVal = 1.0;
                    const range = maxVal - minVal;
                    
                    const svgW = 400;
                    const svgH = 120;
                    const padL = 35;
                    const padR = 15;
                    const padT = 15;
                    const padB = 25;
                    
                    const chartW = svgW - padL - padR;
                    const chartH = svgH - padT - padB;
                    
                    const coords = points.map((val, idx) => {
                      const x = padL + (idx / (points.length - 1)) * chartW;
                      const ratio = (val - minVal) / range;
                      const y = padT + (1 - ratio) * chartH;
                      return { x, y, val };
                    });
                    
                    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
                    const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${svgH - padB} L ${coords[0].x} ${svgH - padB} Z`;
                    
                    return (
                      <div style={{ position: 'relative' }}>
                        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                          <defs>
                            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          
                          {/* Grid Lines */}
                          {[0.0, 0.25, 0.5, 0.75, 1.0].map((ratio, idx) => {
                            const val = minVal + ratio * range;
                            const y = padT + (1 - ratio) * chartH;
                            return (
                              <g key={idx}>
                                <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                                <text x={padL - 6} y={y + 3} textAnchor="end" style={{ fontSize: '8px', fill: 'var(--text-muted)' }}>
                                  {val.toFixed(2)}
                                </text>
                              </g>
                            );
                          })}
                          
                          {/* X-Axis labels */}
                          {labels.map((lbl, idx) => {
                            const x = padL + (idx / (labels.length - 1)) * chartW;
                            return (
                              <g key={idx}>
                                <line x1={x} y1={svgH - padB} x2={x} y2={svgH - padB + 4} stroke="var(--border-color)" strokeWidth="0.5" />
                                <text x={x} y={svgH - padB + 14} textAnchor="middle" style={{ fontSize: '8.5px', fill: 'var(--text-muted)' }}>
                                  {lbl}
                                </text>
                              </g>
                            );
                          })}
                          
                          <line x1={padL} y1={svgH - padB} x2={svgW - padR} y2={svgH - padB} stroke="var(--border-color)" strokeWidth="1" />
                          <line x1={padL} y1={padT} x2={padL} y2={svgH - padB} stroke="var(--border-color)" strokeWidth="1" />
                          
                          {/* Filled Area */}
                          <path d={areaPath} fill="url(#areaGradient)" />
                          
                          {/* Line */}
                          <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
                          
                          {/* Circle dots */}
                          {coords.map((c, idx) => (
                            <g key={idx}>
                              <circle 
                                cx={c.x} 
                                cy={c.y} 
                                r="4.5" 
                                fill="var(--bg-card)" 
                                stroke="var(--primary)" 
                                strokeWidth="2" 
                              />
                              <text x={c.x} y={c.y - 8} textAnchor="middle" style={{ fontSize: '8px', fill: 'var(--text-primary)', fontWeight: 'bold' }}>
                                {c.val.toFixed(2)}
                              </text>
                            </g>
                          ))}
                        </svg>
                      </div>
                    );
                  })()
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '110px', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                    Seleccione un lote para ver el gráfico.
                  </div>
                )}
              </div>

              {/* Panel Derecho: Comparación Temporal y Diagnóstico */}
              <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: '12.5px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '12px' }}>
                    Comparación Temporal ({histogramIndex})
                  </h4>
                  
                  {selectedLote ? (
                    (() => {
                      const { points } = getHistoricalIndexPoints(selectedLote, histogramIndex);
                      const currentVal = points[5];
                      const prev15DaysVal = points[4];
                      const prev30DaysVal = points[3];
                      
                      const diff15 = currentVal - prev15DaysVal;
                      const pctChange15 = prev15DaysVal !== 0 ? ((diff15 / prev15DaysVal) * 100).toFixed(1) : '0.0';
                      const isUp15 = diff15 >= 0;
                      
                      const diff30 = currentVal - prev30DaysVal;
                      const pctChange30 = prev30DaysVal !== 0 ? ((diff30 / prev30DaysVal) * 100).toFixed(1) : '0.0';
                      const isUp30 = diff30 >= 0;
                      
                      let recommendation = "";
                      const minVal = histogramIndex === 'HUMEDAD' ? -0.2 : 0.0;
                      const range = 1.0 - minVal;
                      
                      if (histogramIndex === 'NDVI' || histogramIndex === 'NDRE' || histogramIndex === 'SAVI') {
                        if (isUp15 && currentVal >= 0.7) {
                          recommendation = "El vigor vegetativo muestra un incremento saludable de " + pctChange15 + "% en los últimos 15 días. Las prácticas agrícolas actuales son efectivas.";
                        } else if (!isUp15 && pctChange15 <= -5) {
                          recommendation = "Atención: Pérdida de vigor detectada (-" + Math.abs(pctChange15) + "%). Se recomienda programar un monitoreo en campo para descartar plagas o deficiencias nutricionales.";
                        } else {
                          recommendation = "Índice de vigor estable. Se mantiene dentro del rango promedio esperado para esta etapa de desarrollo del cultivo.";
                        }
                      } else { // Humedad
                        if (currentVal < 0.15) {
                          recommendation = "Alerta de humedad baja (" + currentVal + "). Estrés hídrico potencial. Se aconseja revisar los tiempos de riego o programar una irrigación inmediata.";
                        } else if (currentVal > 0.35) {
                          recommendation = "Niveles de humedad elevados (" + currentVal + "). Riesgo de encharcamiento o desarrollo de hongos fitopatógenos. Monitorear drenajes.";
                        } else {
                          recommendation = "Humedad del suelo óptima (" + currentVal + "). Proporciona un balance adecuado para la transpiración de la planta.";
                        }
                      }
                      
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            {/* Card 15 Days */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px' }}>
                              <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>vs hace 15 días</span>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                                <strong style={{ fontSize: '18px', color: 'var(--text-primary)' }}>{currentVal.toFixed(2)}</strong>
                                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>antes: {prev15DaysVal.toFixed(2)}</span>
                              </div>
                              <span style={{ 
                                fontSize: '10.5px', 
                                fontWeight: 'bold', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '3px',
                                color: isUp15 ? '#22c55e' : '#ef4444',
                                marginTop: '4px'
                              }}>
                                {isUp15 ? '▲' : '▼'} {isUp15 ? '+' : ''}{pctChange15}%
                              </span>
                            </div>
                            
                            {/* Card 30 Days */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px' }}>
                              <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>vs hace 30 días</span>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                                <strong style={{ fontSize: '18px', color: 'var(--text-primary)' }}>{currentVal.toFixed(2)}</strong>
                                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>antes: {prev30DaysVal.toFixed(2)}</span>
                              </div>
                              <span style={{ 
                                fontSize: '10.5px', 
                                fontWeight: 'bold', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '3px',
                                color: isUp30 ? '#22c55e' : '#ef4444',
                                marginTop: '4px'
                              }}>
                                {isUp30 ? '▲' : '▼'} {isUp30 ? '+' : ''}{pctChange30}%
                              </span>
                            </div>
                          </div>
                          
                          {/* Sparkline for visual reference */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 12px' }}>
                            <span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Tendencia 30d:</span>
                            <svg viewBox="0 0 80 15" style={{ width: '60px', height: '15px' }}>
                              <polyline 
                                fill="none" 
                                stroke={isUp15 ? '#22c55e' : '#ef4444'} 
                                strokeWidth="1.5" 
                                points={`5,${15 - (prev30DaysVal - minVal) / range * 13} 40,${15 - (prev15DaysVal - minVal) / range * 13} 75,${15 - (currentVal - minVal) / range * 13}`} 
                              />
                              <circle cx="5" cy={15 - (prev30DaysVal - minVal) / range * 13} r="1.5" fill={isUp15 ? '#22c55e' : '#ef4444'} />
                              <circle cx="40" cy={15 - (prev15DaysVal - minVal) / range * 13} r="1.5" fill={isUp15 ? '#22c55e' : '#ef4444'} />
                              <circle cx="75" cy={15 - (currentVal - minVal) / range * 13} r="2" fill={isUp15 ? '#22c55e' : '#ef4444'} />
                            </svg>
                            <span style={{ fontSize: '10px', fontWeight: '600', color: isUp15 ? '#22c55e' : '#ef4444' }}>
                              {isUp15 ? 'En crecimiento' : 'En alerta / descenso'}
                            </span>
                          </div>
                          
                          {/* Recommendation diagnostic widget */}
                          <div style={{ 
                            background: 'rgba(255,255,255,0.02)', 
                            borderLeft: `3px solid ${isUp15 ? 'var(--primary)' : 'var(--accent-gold)'}`, 
                            padding: '6px 10px', 
                            borderRadius: '0 6px 6px 0',
                            fontSize: '10px',
                            lineHeight: '1.35',
                            color: 'var(--text-secondary)'
                          }}>
                            <strong>Diagnóstico:</strong> {recommendation}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '110px', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                      Seleccione un lote para ver la comparación temporal.
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>

          {/* Right Stacked Column Panels */}
          <div className="sanitary-right-column">

            {/* 1. Operación Actual — solo visible cuando existe una operación activa para el lote */}
            {activeOperations[selectedLote?.id] && (() => {
              const activeOp = activeOperations[selectedLote.id];
              return (
                <div className="glass-card primary-edge" style={{ padding: '16px' }}>
                  <div className="operation-card-header">
                    <h3 style={{ fontSize: '14px', fontWeight: '700' }}>Operación Actual</h3>
                    <span className="badge badge-green" style={{ fontSize: '10px', padding: '1px 6px' }}>En curso</span>
                  </div>

                  <div style={{ margin: '8px 0' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', display: 'block' }}>{activeOp.actividad}</span>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Lote {selectedLote.codigo_interno} — {selectedLote.cultivo}</span>
                  </div>

                  {/* Progress timer bar */}
                  <div style={{ margin: '12px 0 16px 0' }}>
                    <div className="progress-bar-container" style={{ height: '6px', background: 'var(--border-color)', overflow: 'hidden' }}>
                      <div className="progress-bar-fill" style={{ width: `${Math.min(100, (operationTime / 14400) * 100)}%`, background: 'var(--primary)' }}></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '4px', fontWeight: '600' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Tiempo transcurrido:</span>
                      <span style={{ color: 'var(--text-primary)' }}>{formatDuration(operationTime)}</span>
                    </div>
                  </div>

                  <div className="operation-details-grid" style={{ marginBottom: '10px' }}>
                    <span className="operation-label">Producto:</span><span className="operation-value">{activeOp.producto || 'N/A'}</span>
                    <span className="operation-label">Dosis:</span><span className="operation-value">{activeOp.dosis || 'N/A'}</span>
                    <span className="operation-label">Fecha inicio:</span>
                    <span className="operation-value">{new Date(activeOp.startTime).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="operation-label">Equipo:</span><span className="operation-value">{activeOp.machinery || 'N/A'}</span>
                    <span className="operation-label">Operador:</span><span className="operation-value">{activeOp.operator || 'N/A'}</span>
                  </div>

                  {/* Telemetría climática en tiempo real */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Variables Climáticas (Telemetría)</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Thermometer size={12} style={{ color: 'var(--primary)' }} /><span>Temp: {weatherStation.temp}°C</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Droplets size={12} style={{ color: 'var(--accent-blue)' }} /><span>Humedad: {weatherStation.humidity}%</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Wind size={12} style={{ color: isDriftHigh ? 'var(--accent-red)' : 'var(--text-secondary)' }} /><span>Viento: <strong style={{ color: isDriftHigh ? 'var(--accent-red)' : 'inherit' }}>{weatherStation.wind} km/h</strong></span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CloudRain size={12} style={{ color: isWashHigh ? 'var(--accent-red)' : 'var(--text-secondary)' }} /><span>Lluvia: {weatherStation.rain}%</span></div>
                    </div>
                    {isDriftHigh && (
                      <div style={{ marginTop: '8px', padding: '6px', background: 'var(--accent-gold-light)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '6px', fontSize: '10px', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={12} />
                        <span>Viento &gt; 15 km/h: Riesgo de deriva de gota.</span>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: '12px' }}>
                    <button
                      className="btn btn-danger"
                      style={{ width: '100%', justifyContent: 'center', fontSize: '11px', padding: '6px', border: '1px solid var(--accent-red)' }}
                      onClick={handleFinishCurrentOperation}
                    >
                      Finalizar aplicación
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 2. Actividad Reciente — dinámica, filtrada por lote seleccionado */}
            <div className="glass-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700' }}>Actividad Reciente</h3>
                <span
                  style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer' }}
                  onClick={() => setSubTab('historial_traz')}
                >
                  Ver todo
                </span>
              </div>

              <div className="recent-activity-list">
                {loadingDashboard ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px', gap: '8px' }}>
                    <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Cargando actividad...</span>
                  </div>
                ) : recentFeed.length > 0 ? (
                  recentFeed.map((act, idx) => (
                    <div key={idx} className="activity-list-item">
                      <div className={`activity-item-icon ${act.color === 'warning' ? 'warning' : act.color === 'green' ? 'green' : 'info'}`}>
                        {act.icon}
                      </div>
                      <div className="activity-item-details">
                        <span className="activity-item-title">{act.title}</span>
                        <span className="activity-item-desc">{act.desc}</span>
                        <span className="activity-item-time">{act.timeStr}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    <Activity size={20} style={{ marginBottom: '6px', opacity: 0.5, display: 'block', margin: '0 auto 6px' }} />
                    <p style={{ margin: 0 }}>No hay actividad registrada para este lote.</p>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Próximos Monitoreos — dinámico, filtrado por lote seleccionado, solo fechas futuras */}
            <div className="glass-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700' }}>Próximos Monitoreos</h3>
                <span
                  style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer' }}
                  onClick={() => setSubTab('monitoreos')}
                >
                  Ver todos
                </span>
              </div>

              <div className="next-monitoring-list">
                {proximosMonitoreosFuturos.length > 0 ? (
                  proximosMonitoreosFuturos.map((mon, idx) => {
                    const monLote = lotes.find(l => l.id === mon.lote_id);
                    return (
                      <div key={idx} className="monitoring-list-item">
                        <div className="monitoring-item-icon">
                          <Calendar size={12} />
                        </div>
                        <div className="monitoring-item-details">
                          <span className="monitoring-item-title">
                            {monLote ? `${monLote.cultivo} — ${monLote.variedad}` : 'Monitoreo programado'}
                          </span>
                          <span className="monitoring-item-time">
                            {new Date(mon.fecha_monitoreo).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {mon.responsable && (
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>
                              Resp: {mon.responsable}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    <Calendar size={18} style={{ marginBottom: '6px', opacity: 0.5, display: 'block', margin: '0 auto 6px' }} />
                    <p style={{ margin: 0 }}>No existen monitoreos programados para este lote.</p>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      ) : null}

      {/* 2. VIEW: MAPA DE LOTES (GIS INTEGRATION) */}
      {activeSubView === 'mapa' && (
        <div className="sanitary-layout-grid split">

          <div className="glass-card" style={{ padding: '0px', height: '550px', position: 'relative' }}>
            <div className="map-layer-selector" style={{ top: '12px', right: '12px', display: 'flex', gap: '4px', alignItems: 'center', background: 'rgba(255,255,255,0.95)', padding: '4px', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 1000 }}>
              <button
                className={`map-layer-btn ${mapLayer === 'callejero' ? 'active' : ''}`}
                onClick={() => setMapLayer('callejero')}
                style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px' }}
              >
                Mapa
              </button>
              <button
                className={`map-layer-btn ${mapLayer === 'satelite' ? 'active' : ''}`}
                onClick={() => setMapLayer('satelite')}
                style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px' }}
              >
                Satélite
              </button>
              <button
                className={`map-layer-btn ${mapLayer === 'ndvi' ? 'active' : ''}`}
                onClick={() => setMapLayer('ndvi')}
                style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px' }}
              >
                NDVI
              </button>

              <select
                className="input-glass select-glass"
                style={{ padding: '3px 20px 3px 6px', fontSize: '11px', height: '24px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
                value={['callejero', 'satelite', 'ndvi'].includes(mapLayer) ? 'otros' : mapLayer}
                onChange={e => {
                  if (e.target.value !== 'otros') {
                    setMapLayer(e.target.value);
                  }
                }}
              >
                <option value="otros">Otros...</option>
                <option value="ndre">NDRE</option>
                <option value="savi">SAVI</option>
                <option value="humedad">Humedad</option>
                <option value="prod_layer">Productividad</option>
              </select>
            </div>

            <div id="sanitary-gis-map" className="gis-map-element"></div>

            {geeLoading && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(15, 23, 42, 0.7)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2000,
                borderRadius: '8px',
                color: 'white',
                gap: '12px'
              }}>
                <RefreshCw size={32} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'center', padding: '0 20px' }}>Consultando Google Earth Engine en tiempo real...</span>
              </div>
            )}

            {geeWarning && (
              <div style={{
                position: 'absolute',
                bottom: '50px',
                left: '10px',
                right: '10px',
                background: 'rgba(251, 191, 36, 0.95)',
                color: '#78350f',
                padding: '8px 12px',
                borderRadius: '6px',
                zIndex: 2000,
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                borderLeft: '4px solid #d97706'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={14} />
                  <span>{geeWarning}</span>
                </div>
                <button 
                  onClick={() => setGeeWarning(null)} 
                  style={{ background: 'transparent', border: 'none', color: '#78350f', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="map-legend-gradient-card" style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid var(--border-color)',
              padding: '10px 14px',
              borderRadius: '8px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              zIndex: 1000,
              minWidth: '200px',
              backdropFilter: 'blur(8px)'
            }}>
              <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>
                Leyenda: {mapLayer.toUpperCase()}
              </span>
              {['ndvi', 'ndre', 'savi'].includes(mapLayer) ? (
                <div>
                  <div style={{ height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, #ef4444, #f97316, #eab308, #84cc16, #22c55e)', width: '100%' }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: 'var(--text-secondary)', marginTop: '5px', fontWeight: '600' }}>
                    <span>0.0 (Crítico)</span>
                    <span>0.5</span>
                    <span>1.0 (Óptimo)</span>
                  </div>
                </div>
              ) : mapLayer === 'humedad' ? (
                <div>
                  <div style={{ height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, #ece7f2, #74a9cf, #0570b0)', width: '100%' }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: 'var(--text-secondary)', marginTop: '5px', fontWeight: '600' }}>
                    <span>-0.2 (Baja)</span>
                    <span>0.1</span>
                    <span>0.4 (Alta)</span>
                  </div>
                </div>
              ) : mapLayer === 'prod_layer' ? (
                <div>
                  <div style={{ height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, #c084fc, #6d28d9)', width: '100%' }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: 'var(--text-secondary)', marginTop: '5px', fontWeight: '600' }}>
                    <span>Baja</span>
                    <span>Media</span>
                    <span>Alta</span>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, #dc2626, #f59e0b, #22c55e, #16a34a)', width: '100%' }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: 'var(--text-secondary)', marginTop: '5px', fontWeight: '600' }}>
                    <span>Bajo</span>
                    <span>Regular</span>
                    <span>Bueno</span>
                    <span>Excelente</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="glass-card primary-edge" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            {selectedLote ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700' }}>CÓDIGO: {selectedLote.codigo_interno}</span>
                      <h3 style={{ fontSize: '16px', fontWeight: '800' }}>{selectedLote.nombre}</h3>
                    </div>
                    <span className={`badge ${selectedLote.estado_sanitario === 'excelente' ? 'badge-green' :
                      selectedLote.estado_sanitario === 'bueno' ? 'badge-green' :
                        selectedLote.estado_sanitario === 'regular' ? 'badge-yellow' : 'badge-red'
                      }`} style={{ fontSize: '9px', padding: '1px 6px' }}>{selectedLote.estado_sanitario}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: '11px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>Cultivo:</span>
                      <p style={{ fontWeight: '600', margin: '1px 0' }}>{selectedLote.cultivo} ({selectedLote.variedad})</p>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>Área Total:</span>
                      <p style={{ fontWeight: '600', margin: '1px 0' }}>{selectedLote.area_ha} ha</p>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>Fecha de Siembra:</span>
                      <p style={{ fontWeight: '600', margin: '1px 0' }}>{new Date(selectedLote.fecha_siembra).toLocaleDateString('es-ES', { dateStyle: 'short' })}</p>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>Índice {histogramIndex}:</span>
                      <p style={{ fontWeight: '700', margin: '1px 0', color: selectedLote.ndvi_actual > 0.6 ? 'var(--primary)' : 'var(--accent-gold)' }}>
                        {histogramIndex === 'NDVI' ? selectedLote.ndvi_actual
                         : histogramIndex === 'NDRE' ? (selectedLote.ndre_actual || '0.48')
                         : histogramIndex === 'SAVI' ? (selectedLote.savi_actual || '0.58')
                         : (selectedLote.humedad_actual || '0.15')}
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const sumCoords = selectedLote.centroide_lat + selectedLote.centroide_lng;
                    const charSum = selectedLote.codigo_interno.charCodeAt(0) + (selectedLote.codigo_interno.charCodeAt(1) || 0);
                    const activeIndexValue = histogramIndex === 'NDVI' ? selectedLote.ndvi_actual
                                           : histogramIndex === 'NDRE' ? (selectedLote.ndre_actual || 0.48)
                                           : histogramIndex === 'SAVI' ? (selectedLote.savi_actual || 0.58)
                                           : (selectedLote.humedad_actual || 0.15);
                    const activeGeeData = geeData.index === histogramIndex && geeData.histogram 
                      ? geeData 
                      : generateMockHistogramAndStats(histogramIndex, charSum, activeIndexValue);

                    const { stats, distribution, histogram } = activeGeeData;
                    const maxCount = Math.max(...histogram.map(b => b.count), 1);

                    return (
                      <>
                        {/* HISTOGRAM SECTION HEADER */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                              HISTOGRAMA {histogramIndex}
                            </span>
                            <Info size={11} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} title="Muestra la distribución de frecuencia de píxeles en el lote del índice espectral seleccionado" />
                          </div>

                          <select
                            className="input-glass select-glass"
                            style={{ padding: '1px 18px 1px 4px', fontSize: '10.5px', height: '22px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
                            value={histogramIndex}
                            onChange={e => handleHistogramIndexChange(e.target.value)}
                          >
                            <option value="NDVI">NDVI</option>
                            <option value="NDRE">NDRE</option>
                            <option value="SAVI">SAVI</option>
                            <option value="HUMEDAD">Humedad</option>
                          </select>
                        </div>

                        {/* HISTOGRAM CHART SVG */}
                        <div style={{ position: 'relative', marginTop: '6px' }}>
                          <svg viewBox="0 0 400 155" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                            {/* Grid Lines and Labels */}
                            {[0.25, 0.5, 0.75, 1.0].map((ratio, idx) => {
                              const y = 130 - ratio * 120;
                              const label = maxCount >= 1000 ? `${Math.round((ratio * maxCount) / 1000)}k` : Math.round(ratio * maxCount);
                              return (
                                <g key={idx}>
                                  <line x1="30" y1={y} x2="390" y2={y} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                                  <text x="25" y={y + 3} textAnchor="end" style={{ fontSize: '8px', fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>{label}</text>
                                </g>
                              );
                            })}

                            {/* X-Axis labels */}
                            {[0.0, 0.2, 0.4, 0.6, 0.8, 1.0].map((val, idx) => {
                              const startVal = histogramIndex === 'HUMEDAD' ? -0.2 : 0.0;
                              const endVal = 1.0;
                              const ratio = (val - startVal) / (endVal - startVal);
                              const x = 30 + ratio * 360;
                              if (x < 30 || x > 390) return null;

                              return (
                                <g key={idx}>
                                  <line x1={x} y1="130" x2={x} y2="134" stroke="var(--border-color)" strokeWidth="0.5" />
                                  <text x={x} y="145" textAnchor="middle" style={{ fontSize: '8px', fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>{val}</text>
                                </g>
                              );
                            })}
                            
                            <line x1="30" y1="130" x2="390" y2="130" stroke="var(--border-color)" strokeWidth="1" />
                            <line x1="30" y1="10" x2="30" y2="130" stroke="var(--border-color)" strokeWidth="1" />

                            {/* Histogram Bars */}
                            {histogram.map((bar, bIdx) => {
                              const barWidth = 360 / histogram.length - 1;
                              const x = 30 + bIdx * (360 / histogram.length);
                              const barHeight = (bar.count / maxCount) * 120;
                              const y = 130 - barHeight;

                              let barColor = 'var(--primary)';
                              const val = bar.value;
                              if (histogramIndex === 'HUMEDAD') {
                                if (val < 0.0) barColor = '#a6bddb';
                                else if (val < 0.3) barColor = '#3690c0';
                                else barColor = '#0570b0';
                              } else {
                                if (val < 0.3) barColor = '#ef4444';
                                else if (val < 0.5) barColor = '#f97316';
                                else if (val < 0.7) barColor = '#eab308';
                                else if (val < 0.85) barColor = '#84cc16';
                                else barColor = '#22c55e';
                              }

                              return (
                                <g key={bIdx}>
                                  <rect
                                    x={x}
                                    y={y}
                                    width={Math.max(1, barWidth)}
                                    height={Math.max(1, barHeight)}
                                    fill={barColor}
                                    opacity={hoveredBar && hoveredBar.value === bar.value ? 1 : 0.8}
                                    rx="0.5"
                                    style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                                    onMouseEnter={() => setHoveredBar({ ...bar, x, y, color: barColor })}
                                    onMouseLeave={() => setHoveredBar(null)}
                                  />
                                </g>
                              );
                            })}

                            {/* Promedio line indicator */}
                            {(() => {
                              const meanVal = stats.mean;
                              const startVal = histogramIndex === 'HUMEDAD' ? -0.2 : 0.0;
                              const endVal = 1.0;
                              const ratio = (meanVal - startVal) / (endVal - startVal);
                              const x = 30 + ratio * 360;

                              if (x >= 30 && x <= 390) {
                                return (
                                  <g>
                                    <line x1={x} y1="10" x2={x} y2="130" stroke="#16a34a" strokeWidth="1.5" strokeDasharray="3 3" />
                                    <rect x={x - 35} y="3" width="70" height="14" rx="3" fill="#16a34a" />
                                    <text x={x} y="13" textAnchor="middle" style={{ fontSize: '7.5px', fill: 'white', fontWeight: 'bold', fontFamily: 'var(--font-sans)' }}>
                                      Promedio: {meanVal}
                                    </text>
                                  </g>
                                );
                              }
                              return null;
                            })()}
                          </svg>

                          {/* Hover Tooltip */}
                          {hoveredBar && (
                            <div style={{
                              position: 'absolute',
                              left: `${(hoveredBar.x / 400) * 100}%`,
                              top: `${(hoveredBar.y / 155) * 100 - 35}%`,
                              transform: 'translateX(-50%)',
                              background: 'var(--bg-app)',
                              border: `1px solid ${hoveredBar.color}`,
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '9px',
                              boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                              pointerEvents: 'none',
                              zIndex: 10,
                              whiteSpace: 'nowrap'
                            }}>
                              <strong>{histogramIndex}: {hoveredBar.value}</strong><br/>
                              Píxeles: {hoveredBar.count.toLocaleString()}
                            </div>
                          )}
                        </div>

                        {/* STATS DETAILS GRID */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', marginTop: '10px' }}>
                          <div style={{ padding: '5px 2px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                            <span style={{ fontSize: '7.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>PROMEDIO</span>
                            <strong style={{ fontSize: '10.5px', display: 'block', margin: '1px 0' }}>{stats.mean}</strong>
                            <span style={{ fontSize: '7.5px', color: stats.mean >= 0.7 ? 'var(--primary)' : 'var(--accent-gold)', fontWeight: 'bold' }}>
                              {stats.mean >= 0.75 ? 'Excelente' : stats.mean >= 0.5 ? 'Bueno' : 'Regular'}
                            </span>
                          </div>
                          <div style={{ padding: '5px 2px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                            <span style={{ fontSize: '7.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>MEDIANA</span>
                            <strong style={{ fontSize: '10.5px', display: 'block', margin: '1px 0' }}>{stats.median}</strong>
                            <span style={{ fontSize: '7px', color: 'var(--text-muted)' }}>Punto medio</span>
                          </div>
                          <div style={{ padding: '5px 2px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                            <span style={{ fontSize: '7.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>DESV. EST.</span>
                            <strong style={{ fontSize: '10.5px', display: 'block', margin: '1px 0' }}>{stats.stdDev}</strong>
                            <span style={{ fontSize: '7px', color: 'var(--text-muted)' }}>Dispersión</span>
                          </div>
                          <div style={{ padding: '5px 2px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                            <span style={{ fontSize: '7.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>MÍNIMO</span>
                            <strong style={{ fontSize: '10.5px', display: 'block', margin: '1px 0', color: 'var(--accent-gold)' }}>{stats.min}</strong>
                            <span style={{ fontSize: '7px', color: 'var(--text-muted)' }}>Mínimo</span>
                          </div>
                          <div style={{ padding: '5px 2px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                            <span style={{ fontSize: '7.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>MÁXIMO</span>
                            <strong style={{ fontSize: '10.5px', display: 'block', margin: '1px 0', color: 'var(--primary)' }}>{stats.max}</strong>
                            <span style={{ fontSize: '7px', color: 'var(--text-muted)' }}>Máximo</span>
                          </div>
                          <div style={{ padding: '5px 2px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                            <span style={{ fontSize: '7.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>CV%</span>
                            <strong style={{ fontSize: '10.5px', display: 'block', margin: '1px 0' }}>{stats.cv}%</strong>
                            <span style={{ fontSize: '7.5px', color: stats.cv < 15 ? 'var(--primary)' : 'var(--accent-gold)', fontWeight: 'bold' }}>
                              {stats.cv < 12 ? 'Excelente' : stats.cv < 20 ? 'Moderado' : 'Elevado'}
                            </span>
                          </div>
                        </div>

                        {/* SURFACE DISTRIBUTION BAR */}
                        <div style={{ marginTop: '12px' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
                            DISTRIBUCIÓN DE SUPERFICIE
                          </span>
                          <div style={{ display: 'flex', height: '16px', borderRadius: '4px', overflow: 'hidden', width: '100%' }}>
                            {histogramIndex === 'HUMEDAD' ? (
                              <>
                                <div style={{ width: `${distribution.baja}%`, background: '#a6bddb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e3a8a', fontSize: '9px', fontWeight: 'bold' }} title={`Baja: ${distribution.baja}%`}>{distribution.baja > 5 && `${distribution.baja}%`}</div>
                                <div style={{ width: `${distribution.media}%`, background: '#3690c0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '9px', fontWeight: 'bold' }} title={`Media: ${distribution.media}%`}>{distribution.media > 5 && `${distribution.media}%`}</div>
                                <div style={{ width: `${distribution.alta}%`, background: '#0570b0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '9px', fontWeight: 'bold' }} title={`Alta: ${distribution.alta}%`}>{distribution.alta > 5 && `${distribution.alta}%`}</div>
                              </>
                            ) : (
                              <>
                                <div style={{ width: `${distribution.critico}%`, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '9px', fontWeight: 'bold' }} title={`Crítico (<0.3): ${distribution.critico}%`}>{distribution.critico > 5 && `${distribution.critico}%`}</div>
                                <div style={{ width: `${distribution.bajo}%`, background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '9px', fontWeight: 'bold' }} title={`Bajo (0.3 - 0.5): ${distribution.bajo}%`}>{distribution.bajo > 5 && `${distribution.bajo}%`}</div>
                                <div style={{ width: `${distribution.medio}%`, background: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e293b', fontSize: '9px', fontWeight: 'bold' }} title={`Medio (0.5 - 0.7): ${distribution.medio}%`}>{distribution.medio > 5 && `${distribution.medio}%`}</div>
                                <div style={{ width: `${distribution.alto}%`, background: '#84cc16', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e293b', fontSize: '9px', fontWeight: 'bold' }} title={`Alto (0.7 - 0.85): ${distribution.alto}%`}>{distribution.alto > 5 && `${distribution.alto}%`}</div>
                                <div style={{ width: `${distribution.excelente}%`, background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '9px', fontWeight: 'bold' }} title={`Excelente (>0.85): ${distribution.excelente}%`}>{distribution.excelente > 5 && `${distribution.excelente}%`}</div>
                              </>
                            )}
                          </div>
                          {/* Legends */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', marginTop: '5px', fontSize: '8.5px', color: 'var(--text-secondary)' }}>
                            {histogramIndex === 'HUMEDAD' ? (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a6bddb' }}></span><span>Baja (&lt;0.0)</span></div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3690c0' }}></span><span>Media (0.0 - 0.3)</span></div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0570b0' }}></span><span>Alta (&gt;0.3)</span></div>
                              </>
                            ) : (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }}></span><span>Crítico (&lt;0.3)</span></div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f97316' }}></span><span>Bajo (0.3-0.5)</span></div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#eab308' }}></span><span>Medio (0.5-0.7)</span></div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#84cc16' }}></span><span>Alto (0.7-0.85)</span></div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }}></span><span>Excelente (&gt;0.85)</span></div>
                              </>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* OBSERVATIONS & QUICK ACTIONS */}
                <div>
                  <div style={{ fontSize: '11px', marginTop: '10px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Observaciones:</span>
                    <p style={{ fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', margin: 0 }}>
                      "{selectedLote.observaciones || 'Sin observaciones.'}"
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <button className="btn btn-secondary" style={{ padding: '5px', fontSize: '10.5px', justifyContent: 'center' }} onClick={() => { setNewAplicacion(p => ({ ...p, lote_id: selectedLote.id })); setIsAppDrawerOpen(true); }}>
                        Reg. Aplicación
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '5px', fontSize: '10.5px', justifyContent: 'center' }} onClick={() => { setNewMonitoreo(p => ({ ...p, lote_id: selectedLote.id })); setIsMonDrawerOpen(true); }}>
                        Reg. Monitoreo
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ flex: 1, justifyContent: 'center', fontSize: '10.5px', padding: '5px' }}
                        onClick={() => setIsFichaModalOpen(true)}
                      >
                        Ver ficha completa del lote
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={() => handleDeleteLote(selectedLote.id)}
                        title="Eliminar Lote"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '20px', color: 'var(--text-muted)', textAlign: 'center' }}>
                <MapPin size={24} style={{ marginBottom: '8px', color: 'var(--text-muted)' }} />
                <span>Seleccione un lote en el mapa o la tabla para ver su información técnica.</span>
              </div>
            )}
          </div>
        </div>
      )}



      {/* 3. VIEW: APLICACIONES */}
      {activeSubView === 'aplicaciones' && (
        <div className="sanitary-layout-grid">
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Registro de Aplicaciones</h3>
              <button className="btn btn-secondary" onClick={() => handleExportCSV('aplicaciones')} style={{ padding: '8px 14px', fontSize: '13px' }}>
                <Download size={14} />
                <span>Exportar Historial</span>
              </button>
            </div>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Tipo Aplicación</th>
                    <th>Producto</th>
                    <th>Dosis</th>
                    <th>Método / Operario</th>
                    <th>Costo</th>
                    <th>Carencia Restante</th>
                    <th style={{ textAlign: 'right' }}>Eliminar</th>
                  </tr>
                </thead>
                <tbody>
                  {aplicaciones.map(a => {
                    const targetL = lotes.find(l => l.id === a.lote_id);
                    const carencia = getLoteCarenciaStatus(a.lote_id);
                    return (
                      <tr key={a.id}>
                        <td><span style={{ fontWeight: '700', color: 'var(--primary)' }}>{targetL?.codigo_interno || 'N/A'}</span></td>
                        <td>{a.tipo_aplicacion} ({a.tipo_producto})</td>
                        <td><strong>{a.producto_comercial}</strong></td>
                        <td>{a.dosis}</td>
                        <td>{a.metodo_aplicacion} ({a.operario_responsable})</td>
                        <td>${a.costo_aplicacion.toLocaleString()}</td>
                        <td>
                          {carencia.isRestricted ? (
                            <span className="badge badge-red">Bajo Carencia ({carencia.daysRemaining}d)</span>
                          ) : (
                            <span className="badge badge-green">Habilitado</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-danger" style={{ padding: '6px' }} onClick={() => setAplicaciones(prev => prev.filter(p => p.id !== a.id))}><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. VIEW: MONITOREOS */}
      {activeSubView === 'monitoreos' && (
        <div className="sanitary-layout-grid">
          <div className="glass-card">
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>Historial de Evaluaciones de Campo</h3>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Fecha / Responsable</th>
                    <th>Tipo</th>
                    <th>Incidencia / Severidad</th>
                    <th>Plagas Detectadas</th>
                    <th>Enfermedades</th>
                    <th style={{ textAlign: 'right' }}>Eliminar</th>
                  </tr>
                </thead>
                <tbody>
                  {monitoreos.map(m => {
                    const targetL = lotes.find(l => l.id === m.lote_id);
                    return (
                      <tr key={m.id}>
                        <td><span style={{ fontWeight: '700', color: 'var(--primary)' }}>{targetL?.codigo_interno || 'N/A'}</span></td>
                        <td>{new Date(m.fecha_monitoreo).toLocaleDateString()} ({m.responsable})</td>
                        <td>{m.tipo_monitoreo}</td>
                        <td>Inc: {m.incidencia_pct}% | Sev: {m.severidad_pct}%</td>
                        <td>{m.plagas_detectadas}</td>
                        <td>{m.enfermedades_detectadas}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-danger" style={{ padding: '6px' }} onClick={() => setMonitoreos(prev => prev.filter(p => p.id !== m.id))}><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. VIEW: PLANIFICACION COSECHA */}
      {activeSubView === 'cosecha_plan' && (
        <div className="sanitary-layout-grid">
          <div className="glass-card">
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Planificación de Cosecha & Control de Inocuidad</h3>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Cultivo</th>
                    <th>Fecha Cosecha</th>
                    <th>Área Programada</th>
                    <th>Producción Estimada</th>
                    <th>Estado de Inocuidad</th>
                    <th style={{ textAlign: 'right' }}>Eliminar</th>
                  </tr>
                </thead>
                <tbody>
                  {cosechas.map(c => {
                    const targetL = lotes.find(l => l.id === c.lote_id);
                    const carencia = getLoteCarenciaStatus(c.lote_id, new Date(c.fecha_programada));
                    return (
                      <tr key={c.id}>
                        <td><span style={{ fontWeight: '700', color: 'var(--primary)' }}>{targetL?.codigo_interno || 'N/A'}</span></td>
                        <td>{targetL?.cultivo} Híbrido</td>
                        <td>{c.fecha_programada}</td>
                        <td>{c.area_programada_ha} ha</td>
                        <td>{c.produccion_estimada_kg.toLocaleString()} kg</td>
                        <td>
                          {carencia.isRestricted ? (
                            <span className="badge badge-red">Carencia Activa ({carencia.daysRemaining}d)</span>
                          ) : (
                            <span className="badge badge-green">Sin restricciones</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-danger" style={{ padding: '6px' }} onClick={() => setCosechas(prev => prev.filter(p => p.id !== c.id))}><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      {/* 7. VIEW: COSTOS Y RENTABILIDAD */}
      {activeSubView === 'costos_san' && (
        <div className="sanitary-layout-grid">
          <div className="glass-card">
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Consolidado Financiero Fitosanitario</h3>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="glass-card" style={{ flexGrow: 1, padding: '16px' }}>
                <span className="card-label">Costo Total Campaña</span>
                <div className="card-value">${totalCost.toLocaleString()} COP</div>
              </div>
              <div className="glass-card" style={{ flexGrow: 1, padding: '16px' }}>
                <span className="card-label">Costo por ha Promedio</span>
                <div className="card-value">$86,400 COP</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. VIEW: HISTORIAL Y TRAZABILIDAD */}
      {activeSubView === 'historial_traz' && (
        <div className="sanitary-layout-grid split">
          <div className="glass-card">
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Bitácora de Campo</h3>
            <div className="activity-timeline">
              <div className="timeline-item aplicacion">
                <div className="timeline-header">
                  <span className="timeline-title">Aplicación de Fungicida</span>
                  <span className="timeline-date">26 May 2026, 07:30 a.m.</span>
                </div>
                <div className="timeline-body">
                  Aplicación de Azoxistrobin 250 SC en Lote A1 finalizada.
                </div>
              </div>
              <div className="timeline-item monitoreo">
                <div className="timeline-header">
                  <span className="timeline-title">Monitoreo Fitosanitario</span>
                  <span className="timeline-date">25 May 2026, 02:30 p.m.</span>
                </div>
                <div className="timeline-body">
                  Detección de Mosca blanca y Mildiu en Lote C1.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. VIEW: REPORTES */}
      {activeSubView === 'reportes_san' && (
        <div className="sanitary-layout-grid">
          <div className="glass-card">
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Consola de Reportes ICA y Trazabilidad</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-primary" onClick={() => handleExportCSV('aplicaciones')} style={{ background: 'var(--primary)' }}><FileSpreadsheet size={16} /><span>Exportar Registro ICA (CSV)</span></button>
              <button className="btn btn-secondary" onClick={() => window.print()}><FileText size={16} /><span>Imprimir Reporte PDF</span></button>
            </div>
          </div>
        </div>
      )}

      {/* --- DRAWERS / MODALS FOR FORMS --- */}

      {/* 1. Drawer Nuevo Lote */}
      {isLoteDrawerOpen && (
        <div className="drawer-backdrop" onClick={() => setIsLoteDrawerOpen(false)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={20} /> Registrar Nuevo Lote (GIS)</h3>
              <button className="btn btn-secondary" onClick={() => setIsLoteDrawerOpen(false)} style={{ padding: '6px' }}><X size={18} /></button>
            </div>

            <form className="drawer-form" onSubmit={handleAddLote}>
              <div>
                <label className="form-label">Cargar Archivo Espacial</label>
                <div className="upload-dropzone-container">
                  <UploadCloud size={24} />
                  <span style={{ fontSize: '12px', fontWeight: '600' }}>GeoJSON, KML, SHP, KMZ</span>
                  <input type="file" onChange={handleFileUpload} style={{ fontSize: '11px' }} />
                </div>
              </div>

              {newLote.area_ha > 0 && (
                <div style={{ background: 'var(--primary-light)', padding: '8px', borderRadius: '8px', border: '1px solid var(--primary-border)', fontSize: '11.5px' }}>
                  <span>Área: <strong>{newLote.area_ha} ha</strong> | Perímetro: <strong>{newLote.perimetro_m} m</strong></span>
                </div>
              )}

              <div className="form-group-container">
                <div>
                  <label className="form-label">Código Interno</label>
                  <input type="text" className="input-glass" style={{ width: '100%' }} placeholder="Ej. A3" required value={newLote.codigo_interno} onChange={e => setNewLote(p => ({ ...p, codigo_interno: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Nombre</label>
                  <input type="text" className="input-glass" style={{ width: '100%' }} placeholder="Ej. Lote A3" required value={newLote.nombre} onChange={e => setNewLote(p => ({ ...p, nombre: e.target.value }))} />
                </div>
              </div>

              <div className="form-group-container">
                <div>
                  <label className="form-label">Cultivo</label>
                  <select className="input-glass select-glass" style={{ width: '100%' }} value={newLote.cultivo} onChange={e => setNewLote(p => ({ ...p, cultivo: e.target.value }))}>
                    <option value="Maíz">Maíz</option>
                    <option value="Soya">Soya</option>
                    <option value="Girasol">Girasol</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Variedad</label>
                  <input type="text" className="input-glass" style={{ width: '100%' }} required value={newLote.variedad} onChange={e => setNewLote(p => ({ ...p, variedad: e.target.value }))} />
                </div>
              </div>

              <div className="form-group-container">
                <div>
                  <label className="form-label">Fecha Siembra</label>
                  <input type="date" className="input-glass" style={{ width: '100%' }} required value={newLote.fecha_siembra} onChange={e => setNewLote(p => ({ ...p, fecha_siembra: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Responsable Técnico</label>
                  <input type="text" className="input-glass" style={{ width: '100%' }} required value={newLote.responsable_tecnico} onChange={e => setNewLote(p => ({ ...p, responsable_tecnico: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsLoteDrawerOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }} style={{ background: 'var(--primary)' }}>Guardar Lote</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Drawer Plan Aplicacion */}
      {isAppDrawerOpen && (
        <div className="drawer-backdrop" onClick={() => setIsAppDrawerOpen(false)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Planificar Aplicación</h3>
              <button className="btn btn-secondary" onClick={() => setIsAppDrawerOpen(false)} style={{ padding: '6px' }}><X size={18} /></button>
            </div>

            <form className="drawer-form" onSubmit={handleAddAplicacion}>
              <div>
                <label className="form-label">Lote</label>
                <select className="input-glass select-glass" style={{ width: '100%' }} value={newAplicacion.lote_id} onChange={e => setNewAplicacion(p => ({ ...p, lote_id: e.target.value }))}>
                  {lotes.map(l => (
                    <option key={l.id} value={l.id}>{l.codigo_interno} ({l.cultivo})</option>
                  ))}
                </select>
              </div>
              <div className="form-group-container">
                <div>
                  <label className="form-label">Producto Comercial</label>
                  <input type="text" className="input-glass" style={{ width: '100%' }} placeholder="Ej. Azoxistrobin" required value={newAplicacion.producto_comercial} onChange={e => setNewAplicacion(p => ({ ...p, producto_comercial: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Dosis</label>
                  <input type="text" className="input-glass" style={{ width: '100%' }} placeholder="Ej. 0.5 L/ha" required value={newAplicacion.dosis} onChange={e => setNewAplicacion(p => ({ ...p, dosis: e.target.value }))} />
                </div>
              </div>
              <div className="form-group-container">
                <div>
                  <label className="form-label">Carencia (Días)</label>
                  <input type="number" className="input-glass" style={{ width: '100%' }} required value={newAplicacion.periodo_carencia_dias} onChange={e => setNewAplicacion(p => ({ ...p, periodo_carencia_dias: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Costo (COP)</label>
                  <input type="number" className="input-glass" style={{ width: '100%' }} required value={newAplicacion.costo_aplicacion} onChange={e => setNewAplicacion(p => ({ ...p, costo_aplicacion: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsAppDrawerOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }} style={{ background: 'var(--primary)' }}>Guardar Aplicación</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Drawer Monitoreo */}
      {isMonDrawerOpen && (
        <div className="drawer-backdrop" onClick={() => setIsMonDrawerOpen(false)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Programar Monitoreo</h3>
              <button className="btn btn-secondary" onClick={() => setIsMonDrawerOpen(false)} style={{ padding: '6px' }}><X size={18} /></button>
            </div>

            <form className="drawer-form" onSubmit={handleAddMonitoreo}>
              <div>
                <label className="form-label">Lote</label>
                <select className="input-glass select-glass" style={{ width: '100%' }} value={newMonitoreo.lote_id} onChange={e => setNewMonitoreo(p => ({ ...p, lote_id: e.target.value }))}>
                  {lotes.map(l => (
                    <option key={l.id} value={l.id}>{l.codigo_interno} ({l.cultivo})</option>
                  ))}
                </select>
              </div>
              <div className="form-group-container">
                <div>
                  <label className="form-label">Responsable</label>
                  <input type="text" className="input-glass" style={{ width: '100%' }} required value={newMonitoreo.responsable} onChange={e => setNewMonitoreo(p => ({ ...p, responsable: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Incidencia (%)</label>
                  <input type="number" className="input-glass" style={{ width: '100%' }} required value={newMonitoreo.incidencia_pct} onChange={e => setNewMonitoreo(p => ({ ...p, incidencia_pct: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsMonDrawerOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }} style={{ background: 'var(--primary)' }}>Guardar Monitoreo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Drawer Cosecha */}
      {isCosechaDrawerOpen && (
        <div className="drawer-backdrop" onClick={() => setIsCosechaDrawerOpen(false)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Planificar Cosecha</h3>
              <button className="btn btn-secondary" onClick={() => setIsCosechaDrawerOpen(false)} style={{ padding: '6px' }}><X size={18} /></button>
            </div>

            <form className="drawer-form" onSubmit={handleAddCosecha}>
              <div>
                <label className="form-label">Lote</label>
                <select className="input-glass select-glass" style={{ width: '100%' }} value={newCosecha.lote_id} onChange={e => setNewCosecha(p => ({ ...p, lote_id: e.target.value, area_programada_ha: lotes.find(l => l.id === e.target.value)?.area_ha || 0 }))}>
                  {lotes.map(l => (
                    <option key={l.id} value={l.id}>{l.codigo_interno} ({l.cultivo})</option>
                  ))}
                </select>
              </div>
              <div className="form-group-container">
                <div>
                  <label className="form-label">Fecha Programada</label>
                  <input type="date" className="input-glass" style={{ width: '100%' }} required value={newCosecha.fecha_programada} onChange={e => setNewCosecha(p => ({ ...p, fecha_programada: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Área (ha)</label>
                  <input type="number" step="0.01" className="input-glass" style={{ width: '100%' }} required value={newCosecha.area_programada_ha} onChange={e => setNewCosecha(p => ({ ...p, area_programada_ha: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="form-label">Producción Estimada (kg)</label>
                <input type="number" className="input-glass" style={{ width: '100%' }} required value={newCosecha.produccion_estimada_kg} onChange={e => setNewCosecha(p => ({ ...p, produccion_estimada_kg: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsCosechaDrawerOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }} style={{ background: 'var(--primary)' }}>Validar y Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Drawer Nuevo Costo */}
      {isCostoDrawerOpen && (
        <div className="drawer-backdrop" onClick={() => setIsCostoDrawerOpen(false)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Registrar Costo Operacional</h3>
              <button className="btn btn-secondary" onClick={() => setIsCostoDrawerOpen(false)} style={{ padding: '6px' }}><X size={18} /></button>
            </div>

            <form className="drawer-form" onSubmit={handleAddCosto}>
              <div>
                <label className="form-label">Lote Afectado</label>
                <select className="input-glass select-glass" style={{ width: '100%' }} value={newCosto.lote_id} onChange={e => setNewCosto(p => ({ ...p, lote_id: e.target.value }))}>
                  {lotes.map(l => (
                    <option key={l.id} value={l.id}>{l.codigo_interno} ({l.cultivo})</option>
                  ))}
                </select>
              </div>
              <div className="form-group-container">
                <div>
                  <label className="form-label">Categoría</label>
                  <select className="input-glass select-glass" style={{ width: '100%' }} value={newCosto.categoria} onChange={e => setNewCosto(p => ({ ...p, categoria: e.target.value }))}>
                    <option value="Aplicaciones">Aplicaciones</option>
                    <option value="Mano de Obra">Mano de Obra</option>
                    <option value="Maquinaria">Maquinaria</option>
                    <option value="Combustible">Combustible</option>
                    <option value="Fertilización">Fertilización</option>
                    <option value="Riego">Riego</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Costo (COP)</label>
                  <input type="number" className="input-glass" style={{ width: '100%' }} required value={newCosto.costo} onChange={e => setNewCosto(p => ({ ...p, costo: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="form-label">Descripción</label>
                <input type="text" className="input-glass" style={{ width: '100%' }} required value={newCosto.descripcion} onChange={e => setNewCosto(p => ({ ...p, descripcion: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Responsable Autorización</label>
                <input type="text" className="input-glass" style={{ width: '100%' }} placeholder="Ej. Andrés Castro" required value={newCosto.responsable} onChange={e => setNewCosto(p => ({ ...p, responsable: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsCostoDrawerOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }} style={{ background: 'var(--primary)' }}>Registrar Costo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Drawer Nuevo Trabajador Registro */}
      {isTrabajadorDrawerOpen && (
        <div className="drawer-backdrop" onClick={() => setIsTrabajadorDrawerOpen(false)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Ingresar Operario de Campo</h3>
              <button className="btn btn-secondary" onClick={() => setIsTrabajadorDrawerOpen(false)} style={{ padding: '6px' }}><X size={18} /></button>
            </div>

            <form className="drawer-form" onSubmit={handleAddTrabajadorLog}>
              <div>
                <label className="form-label">Lote Destino</label>
                <select className="input-glass select-glass" style={{ width: '100%' }} value={newTrabajador.lote_id} onChange={e => setNewTrabajador(p => ({ ...p, lote_id: e.target.value }))}>
                  {lotes.map(l => (
                    <option key={l.id} value={l.id}>{l.codigo_interno} ({l.cultivo})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Nombre del Trabajador</label>
                <input type="text" className="input-glass" style={{ width: '100%' }} placeholder="Ej. Carlos Ruiz" required value={newTrabajador.nombre} onChange={e => setNewTrabajador(p => ({ ...p, nombre: e.target.value }))} />
              </div>
              <div className="form-group-container">
                <div>
                  <label className="form-label">Labor a Realizar</label>
                  <input type="text" className="input-glass" style={{ width: '100%' }} placeholder="Ej. Deshierbe" required value={newTrabajador.actividad_realizada} onChange={e => setNewTrabajador(p => ({ ...p, actividad_realizada: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Tiempo Estimado (Hrs)</label>
                  <input type="number" step="0.5" className="input-glass" style={{ width: '100%' }} placeholder="Ej. 4.5" required value={newTrabajador.tiempo_permanencia_hours} onChange={e => setNewTrabajador(p => ({ ...p, tiempo_permanencia_hours: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsTrabajadorDrawerOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }} style={{ background: 'var(--primary)' }}>Registrar Ingreso</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isFichaModalOpen && (
        <div className="drawer-backdrop" style={{ justifyContent: 'center', alignItems: 'center', zIndex: '9999' }} onClick={() => setIsFichaModalOpen(false)}>
          <div className="glass-card" style={{ width: '700px', maxWidth: '95%', height: '80%', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)', animation: 'fadeIn 0.2s ease-out', padding: '0px' }} onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={20} style={{ color: 'var(--primary)' }} />
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Expediente Técnico Completo</h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Lote {selectedLote.codigo_interno} - {selectedLote.nombre}</span>
                </div>
              </div>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setIsFichaModalOpen(false)}><X size={18} /></button>
            </div>

            {/* Modal Tabs selector */}
            <div style={{ display: 'flex', gap: '12px', padding: '0 20px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
              <button className={`notion-tab-btn ${modalActiveTab === 'trazabilidad' ? 'active' : ''}`} onClick={() => setModalActiveTab('trazabilidad')}>Trazabilidad Histórica</button>
              <button className={`notion-tab-btn ${modalActiveTab === 'documentos' ? 'active' : ''}`} onClick={() => setModalActiveTab('documentos')}>Documentos y Adjuntos ({selectedLote.adjuntos?.length || 0})</button>
              <button className={`notion-tab-btn ${modalActiveTab === 'auditoria' ? 'active' : ''}`} onClick={() => setModalActiveTab('auditoria')}>Logs de Auditoría</button>
            </div>

            {/* Modal Body scrollable */}
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '20px' }}>

              {/* Timeline Tab */}
              {modalActiveTab === 'trazabilidad' && (
                <div className="activity-timeline" style={{ borderLeftColor: 'var(--primary-border)' }}>
                  <div className="timeline-item siembra">
                    <div className="timeline-header">
                      <span className="timeline-title">Siembra Inicial</span>
                      <span className="timeline-date">{new Date(selectedLote.fecha_siembra).toLocaleDateString('es-ES', { dateStyle: 'long' })}</span>
                    </div>
                    <div className="timeline-body">
                      Registro de germinación iniciado para la variedad <strong>{selectedLote.variedad}</strong> de {selectedLote.cultivo}.
                    </div>
                  </div>

                  {aplicaciones.filter(a => a.lote_id === selectedLote.id).map(a => (
                    <div key={a.id} className="timeline-item aplicacion">
                      <div className="timeline-header">
                        <span className="timeline-title">Aplicación: {a.producto_comercial} ({a.tipo_producto})</span>
                        <span className="timeline-date">{new Date(a.fecha_aplicacion).toLocaleDateString('es-ES', { dateStyle: 'medium' })}</span>
                      </div>
                      <div className="timeline-body">
                        Tratamiento fitosanitario/nutricional aplicado contra <strong>{a.ingrediente_activo}</strong>. Dosis: {a.dosis}.
                      </div>
                    </div>
                  ))}

                  {monitoreos.filter(m => m.lote_id === selectedLote.id).map(m => (
                    <div key={m.id} className="timeline-item monitoreo">
                      <div className="timeline-header">
                        <span className="timeline-title">Monitoreo Fitosanitario</span>
                        <span className="timeline-date">{new Date(m.fecha_monitoreo).toLocaleDateString('es-ES', { dateStyle: 'medium' })}</span>
                      </div>
                      <div className="timeline-body">
                        Incidencia: {m.incidencia_pct}% | Severidad: {m.severidad_pct}%. Plagas: {m.plagas_detectadas}. Enfermedades: {m.enfermedades_detectadas}.
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Attachments Tab */}
              {modalActiveTab === 'documentos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* File Upload Trigger */}
                  <div style={{ border: '2px dashed var(--border-color)', borderRadius: '8px', padding: '16px', textAlignment: 'center', background: 'rgba(255,255,255,0.005)' }}>
                    <UploadCloud size={24} style={{ color: 'var(--primary)', margin: '0 auto 6px auto' }} />
                    <span style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>Adjuntar Recetas ICA, PDFs o Informes del Lote</span>
                    <input type="file" onChange={handleAttachmentUpload} style={{ fontSize: '11px', margin: '0 auto' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedLote.adjuntos && selectedLote.adjuntos.length > 0 ? (
                      selectedLote.adjuntos.map((file, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-card)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={16} style={{ color: 'var(--primary)' }} />
                            <div>
                              <span style={{ fontWeight: '600', display: 'block' }}>{file.name}</span>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{file.size} | Subido: {file.date}</span>
                            </div>
                          </div>
                          <button className="btn btn-secondary" style={{ padding: '4px' }} onClick={() => alert('Simulación: Descargando archivo ' + file.name)}><Download size={12} /></button>
                        </div>
                      ))
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>Sin documentos o adjuntos.</span>
                    )}
                  </div>
                </div>
              )}

              {/* Audit trail logs */}
              {modalActiveTab === 'auditoria' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {auditorias.filter(a => a.lote_codigo === selectedLote.codigo_interno).length > 0 ? (
                    auditorias.filter(a => a.lote_codigo === selectedLote.codigo_interno).map(aud => (
                      <div key={aud.id} style={{ fontSize: '11.5px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          <span>{aud.usuario}</span>
                          <span>{new Date(aud.fecha).toLocaleString()}</span>
                        </div>
                        <div><strong>Acción:</strong> {aud.accion}</div>
                      </div>
                    ))
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>Sin logs de auditoría para este lote.</span>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {isEvolutionModalOpen && (
        <div className="drawer-backdrop" style={{ justifyContent: 'center', alignItems: 'center', zIndex: '9999' }} onClick={() => setIsEvolutionModalOpen(false)}>
          <div className="glass-card" style={{ width: '800px', maxWidth: '95%', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)', animation: 'fadeIn 0.2s ease-out', padding: '0px' }} onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={20} style={{ color: 'var(--primary)' }} />
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Evolución Temporal Detallada</h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Lote {selectedLote?.codigo_interno || 'N/A'} - {selectedLote?.nombre || 'N/A'}
                  </span>
                </div>
              </div>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setIsEvolutionModalOpen(false)}><X size={18} /></button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Selector inside Modal */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '10px 15px', borderRadius: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                  Seleccione el índice para graficar:
                </span>
                <select
                  className="input-glass select-glass"
                  style={{ padding: '4px 24px 4px 10px', fontSize: '12px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer' }}
                  value={histogramIndex}
                  onChange={e => handleHistogramIndexChange(e.target.value)}
                >
                  <option value="NDVI">NDVI (Índice de Vegetación de Diferencia Normalizada)</option>
                  <option value="NDRE">NDRE (Borde Rojo de Diferencia Normalizada)</option>
                  <option value="SAVI">SAVI (Índice de Vegetación Ajustado al Suelo)</option>
                  <option value="HUMEDAD">Humedad de Superficie NDWI</option>
                </select>
              </div>

              {selectedLote ? (
                (() => {
                  const { points, labels } = getHistoricalIndexPoints(selectedLote, histogramIndex);
                  const minVal = histogramIndex === 'HUMEDAD' ? -0.2 : 0.0;
                  const maxVal = 1.0;
                  const range = maxVal - minVal;
                  
                  const svgW = 700;
                  const svgH = 220;
                  const padL = 40;
                  const padR = 20;
                  const padT = 20;
                  const padB = 30;
                  
                  const chartW = svgW - padL - padR;
                  const chartH = svgH - padT - padB;
                  
                  const coords = points.map((val, idx) => {
                    const x = padL + (idx / (points.length - 1)) * chartW;
                    const ratio = (val - minVal) / range;
                    const y = padT + (1 - ratio) * chartH;
                    return { x, y, val };
                  });
                  
                  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
                  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${svgH - padB} L ${coords[0].x} ${svgH - padB} Z`;
                  
                  return (
                    <>
                      {/* Big Line Chart SVG */}
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '15px' }}>
                        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                          <defs>
                            <linearGradient id="modalAreaGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          
                          {/* Grid Lines */}
                          {[0.0, 0.2, 0.4, 0.6, 0.8, 1.0].map((ratio, idx) => {
                            const val = minVal + ratio * range;
                            const y = padT + (1 - ratio) * chartH;
                            return (
                              <g key={idx}>
                                <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="4 4" />
                                <text x={padL - 8} y={y + 3} textAnchor="end" style={{ fontSize: '9px', fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                                  {val.toFixed(1)}
                                </text>
                              </g>
                            );
                          })}
                          
                          {/* X-Axis labels */}
                          {labels.map((lbl, idx) => {
                            const x = padL + (idx / (labels.length - 1)) * chartW;
                            return (
                              <g key={idx}>
                                <line x1={x} y1={svgH - padB} x2={x} y2={svgH - padB + 5} stroke="var(--border-color)" strokeWidth="1" />
                                <text x={x} y={svgH - padB + 16} textAnchor="middle" style={{ fontSize: '10px', fill: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                                  {lbl}
                                </text>
                              </g>
                            );
                          })}
                          
                          <line x1={padL} y1={svgH - padB} x2={svgW - padR} y2={svgH - padB} stroke="var(--border-color)" strokeWidth="1.5" />
                          <line x1={padL} y1={padT} x2={padL} y2={svgH - padB} stroke="var(--border-color)" strokeWidth="1.5" />
                          
                          {/* Filled Area */}
                          <path d={areaPath} fill="url(#modalAreaGradient)" />
                          
                          {/* Line */}
                          <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
                          
                          {/* Circle dots with labels */}
                          {coords.map((c, idx) => (
                            <g key={idx}>
                              <circle 
                                cx={c.x} 
                                cy={c.y} 
                                r="6" 
                                fill="var(--bg-app)" 
                                stroke="var(--primary)" 
                                strokeWidth="3" 
                                style={{ cursor: 'pointer' }}
                              />
                              <text x={c.x} y={c.y - 10} textAnchor="middle" style={{ fontSize: '10px', fill: 'var(--text-primary)', fontWeight: '800', fontFamily: 'var(--font-sans)' }}>
                                {c.val.toFixed(2)}
                              </text>
                            </g>
                          ))}
                        </svg>
                      </div>

                      {/* Detailed values ledger table inside modal */}
                      <div style={{ marginTop: '10px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', marginBottom: '8px' }}>
                          Tabla de Datos del Gráfico
                        </span>
                        <div className="table-responsive" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                          <table className="sanitary-table compact" style={{ width: '100%', fontSize: '11.5px' }}>
                            <thead>
                              <tr>
                                <th>Mes</th>
                                <th>Valor del Índice ({histogramIndex})</th>
                                <th>Variación Absoluta</th>
                                <th>Variación Porcentual</th>
                                <th>Estado Sanitario Estimado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {points.map((val, idx) => {
                                const prevVal = idx > 0 ? points[idx - 1] : val;
                                const diff = val - prevVal;
                                const pct = prevVal !== 0 ? ((diff / prevVal) * 100).toFixed(1) : '0.0';
                                
                                let statusLabel = "Excelente";
                                let statusColor = "#22c55e";
                                if (histogramIndex === 'HUMEDAD') {
                                  if (val < 0.0) { statusLabel = "Bajo (Seco)"; statusColor = "#ef4444"; }
                                  else if (val < 0.3) { statusLabel = "Medio"; statusColor = "#3690c0"; }
                                  else { statusLabel = "Alto"; statusColor = "#0570b0"; }
                                } else {
                                  if (val < 0.3) { statusLabel = "Crítico"; statusColor = "#ef4444"; }
                                  else if (val < 0.5) { statusLabel = "Bajo"; statusColor = "#f97316"; }
                                  else if (val < 0.7) { statusLabel = "Regular"; statusColor = "#eab308"; }
                                  else if (val < 0.85) { statusLabel = "Bueno"; statusColor = "#84cc16"; }
                                }

                                return (
                                  <tr key={idx}>
                                    <td><strong>{labels[idx]}</strong></td>
                                    <td style={{ fontWeight: '700' }}>{val.toFixed(2)}</td>
                                    <td style={{ color: diff > 0 ? '#22c55e' : diff < 0 ? '#ef4444' : 'var(--text-muted)' }}>
                                      {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                                    </td>
                                    <td style={{ fontWeight: '600', color: diff > 0 ? '#22c55e' : diff < 0 ? '#ef4444' : 'var(--text-muted)' }}>
                                      {diff > 0 ? '▲' : diff < 0 ? '▼' : ''} {diff > 0 ? '+' : ''}{pct}%
                                    </td>
                                    <td>
                                      <span style={{ color: statusColor, fontWeight: 'bold' }}>● {statusLabel}</span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  );
                })()
              ) : null}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '15px', marginTop: '10px' }}>
                <button className="btn btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setIsEvolutionModalOpen(false)}>
                  Cerrar Ventana
                </button>
              </div>

            </div>

          </div>
        </div>
      )}
    </>
  );
}

// --- MISSING DEFAULT MOCK LOG FOR AUDIT FALLBACK ---
const DEFAULT_AUDITORIA = [
  {
    id: "aud-1",
    fecha: "2026-05-25T14:35:00Z",
    usuario: "Laura Gómez",
    lote_codigo: "C1",
    accion: "Cambio de estado a bajo por roya mildiu"
  },
  {
    id: "aud-2",
    fecha: "2026-05-26T07:45:00Z",
    usuario: "Pedro Gómez",
    lote_codigo: "A1",
    accion: "Aplicación de Azoxistrobin"
  }
];
