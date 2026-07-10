// ─────────────────────────────────────────────────────────────────────────────
// PlanificadorAplicaciones.jsx
// Planificador de Aplicaciones Fitosanitarias — SkyCrop ERP
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  ChevronLeft, Plus, Trash2, AlertTriangle, CheckCircle,
  Info, User, Wrench, Shield, ShieldAlert, FlaskConical,
  Leaf, X, Clock, Calendar, Zap, Package, AlertCircle, Loader2, Database
} from 'lucide-react';
import ContextualTooltip from './ui/ContextualTooltip';
import ModalAdvertenciaToxicidad, { filtrarIngredientesAltaToxicidad } from './ui/ModalAdvertenciaToxicidad';
import { workerRepository } from '../repositories/workerRepository';
import { machineryRepository } from '../repositories/machineryRepository';
import { productRepository } from '../repositories/productRepository';




// ─────────────────────────────────────────────────────────────────────────────
// BASE DE DATOS MOCK (sólo como fallback si el API no responde)
// ─────────────────────────────────────────────────────────────────────────────

export const PRODUCTOS_DB = [
  {
    id: 'prod-1', nombre: 'Amistar® Top 325 SC', tipo: 'Fungicida',
    ingredientes: [
      { nombre: 'Azoxystrobin', concentracion: '20%', grupo_quimico: 'QoI (Estrobilurina)', registro_ica: '1054-ICA', cat_toxicologica: 'III', frac: 'C3', irac: '—', hrac: '—', funcion: 'Fungicida' },
      { nombre: 'Difenoconazol', concentracion: '12.5%', grupo_quimico: 'DMI (Triazol)', registro_ica: '1054-ICA', cat_toxicologica: 'III', frac: 'G1', irac: '—', hrac: '—', funcion: 'Fungicida' }
    ],
    dosis_recomendada: 0.75, dosis_max: 1.0, unidad_dosis: 'L/ha', carencia_dias: 21, residualidad_dias: 14
  },
  {
    id: 'prod-2', nombre: 'Clorantraniliprol 20 SC', tipo: 'Insecticida',
    ingredientes: [
      { nombre: 'Clorantraniliprol', concentracion: '20%', grupo_quimico: 'Diamida antranílica', registro_ica: '2189-ICA', cat_toxicologica: 'III', frac: '—', irac: '28', hrac: '—', funcion: 'Insecticida' }
    ],
    dosis_recomendada: 0.2, dosis_max: 0.4, unidad_dosis: 'L/ha', carencia_dias: 14, residualidad_dias: 21
  },
  {
    id: 'prod-3', nombre: 'Roundup Power® 360 SL', tipo: 'Herbicida',
    ingredientes: [
      { nombre: 'Glifosato (sal isopropilamina)', concentracion: '36%', grupo_quimico: 'Inhibidor EPSPS', registro_ica: '3021-ICA', cat_toxicologica: 'III', frac: '—', irac: '—', hrac: 'H9', funcion: 'Herbicida' }
    ],
    dosis_recomendada: 2.5, dosis_max: 4.0, unidad_dosis: 'L/ha', carencia_dias: 7, residualidad_dias: 21
  },
  {
    id: 'prod-4', nombre: 'Lorsban® 4E', tipo: 'Insecticida',
    ingredientes: [
      { nombre: 'Clorpirifos', concentracion: '48%', grupo_quimico: 'Organofosforado', registro_ica: '4102-ICA', cat_toxicologica: 'II', frac: '—', irac: '1B', hrac: '—', funcion: 'Insecticida' }
    ],
    dosis_recomendada: 1.0, dosis_max: 2.0, unidad_dosis: 'L/ha', carencia_dias: 30, residualidad_dias: 45
  },
  {
    id: 'prod-5', nombre: 'Mancozeb 80 WP', tipo: 'Fungicida',
    ingredientes: [
      { nombre: 'Mancozeb', concentracion: '80%', grupo_quimico: 'Ditiocarbamato', registro_ica: '5092-ICA', cat_toxicologica: 'III', frac: 'M3', irac: '—', hrac: '—', funcion: 'Fungicida' }
    ],
    dosis_recomendada: 2.0, dosis_max: 3.0, unidad_dosis: 'kg/ha', carencia_dias: 28, residualidad_dias: 14
  },
  {
    id: 'prod-6', nombre: 'Aceite Mineral 83 EC', tipo: 'Coadyuvante',
    ingredientes: [
      { nombre: 'Aceite Mineral parafínico', concentracion: '83%', grupo_quimico: 'Coadyuvante', registro_ica: '6033-ICA', cat_toxicologica: 'IV', frac: 'N/A', irac: '—', hrac: '—', funcion: 'Coadyuvante' }
    ],
    dosis_recomendada: 0.5, dosis_max: 1.0, unidad_dosis: 'L/ha', carencia_dias: 0, residualidad_dias: 0
  },
  {
    id: 'prod-7', nombre: 'Trichoderma harzianum WP', tipo: 'Bioinsumo',
    ingredientes: [
      { nombre: 'Trichoderma harzianum', concentracion: '1×10⁸ UFC/g', grupo_quimico: 'Hongo antagonista', registro_ica: '7024-ICA', cat_toxicologica: 'IV', frac: 'BM01', irac: '—', hrac: '—', funcion: 'Biofungicida' }
    ],
    dosis_recomendada: 1.0, dosis_max: 2.0, unidad_dosis: 'kg/ha', carencia_dias: 0, residualidad_dias: 7
  },
  {
    id: 'prod-8', nombre: 'Fosfito de Potasio 40-20', tipo: 'Fertilización foliar',
    ingredientes: [
      { nombre: 'Ácido fosforoso (Fosfito)', concentracion: '40%', grupo_quimico: 'Fertilizante inductor', registro_ica: '8115-ICA', cat_toxicologica: 'IV', frac: 'P07', irac: '—', hrac: '—', funcion: 'Fertilizante foliar / Fungistático' }
    ],
    dosis_recomendada: 2.0, dosis_max: 3.5, unidad_dosis: 'L/ha', carencia_dias: 0, residualidad_dias: 7
  },
  {
    id: 'prod-9', nombre: 'Emamectina Benzoato 5 SG', tipo: 'Insecticida',
    ingredientes: [
      { nombre: 'Emamectina Benzoato', concentracion: '5%', grupo_quimico: 'Avermectina', registro_ica: '9056-ICA', cat_toxicologica: 'II', frac: '—', irac: '6', hrac: '—', funcion: 'Insecticida' }
    ],
    dosis_recomendada: 0.25, dosis_max: 0.5, unidad_dosis: 'kg/ha', carencia_dias: 7, residualidad_dias: 14
  },
  {
    id: 'prod-10', nombre: 'Cobre Metálico 50 WP', tipo: 'Fungicida',
    ingredientes: [
      { nombre: 'Óxido cuproso', concentracion: '50%', grupo_quimico: 'Cobre (Inorgánico multisitio)', registro_ica: '10047-ICA', cat_toxicologica: 'III', frac: 'M1', irac: '—', hrac: '—', funcion: 'Fungicida / Bactericida' }
    ],
    dosis_recomendada: 1.5, dosis_max: 2.5, unidad_dosis: 'kg/ha', carencia_dias: 14, residualidad_dias: 10
  },
  {
    id: 'prod-11', nombre: 'Imidacloprid 35 SC', tipo: 'Insecticida',
    ingredientes: [
      { nombre: 'Imidacloprid', concentracion: '35%', grupo_quimico: 'Neonicotinoide', registro_ica: '11018-ICA', cat_toxicologica: 'II', frac: '—', irac: '4A', hrac: '—', funcion: 'Insecticida' }
    ],
    dosis_recomendada: 0.35, dosis_max: 0.6, unidad_dosis: 'L/ha', carencia_dias: 21, residualidad_dias: 28
  },
  {
    id: 'prod-12', nombre: 'Cal Dolomítica 95%', tipo: 'Correctivo',
    ingredientes: [
      { nombre: 'CaCO₃ + MgCO₃', concentracion: '95%', grupo_quimico: 'Mineral correctivo', registro_ica: '12029-ICA', cat_toxicologica: 'IV', frac: 'N/A', irac: '—', hrac: '—', funcion: 'Corrector de acidez' }
    ],
    dosis_recomendada: 500, dosis_max: 2000, unidad_dosis: 'kg/ha', carencia_dias: 0, residualidad_dias: 90
  },
  {
    id: 'prod-13', nombre: 'Propiconazol 25 EC', tipo: 'Fungicida',
    ingredientes: [
      { nombre: 'Propiconazol', concentracion: '25%', grupo_quimico: 'DMI (Triazol)', registro_ica: '13040-ICA', cat_toxicologica: 'III', frac: 'G1', irac: '—', hrac: '—', funcion: 'Fungicida' }
    ],
    dosis_recomendada: 0.5, dosis_max: 0.8, unidad_dosis: 'L/ha', carencia_dias: 21, residualidad_dias: 14
  },
  {
    id: 'prod-14', nombre: 'Lambda-cihalotrina 10 EC', tipo: 'Insecticida',
    ingredientes: [
      { nombre: 'Lambda-cihalotrina', concentracion: '10%', grupo_quimico: 'Piretroide sintético', registro_ica: '14051-ICA', cat_toxicologica: 'II', frac: '—', irac: '3A', hrac: '—', funcion: 'Insecticida' }
    ],
    dosis_recomendada: 0.15, dosis_max: 0.25, unidad_dosis: 'L/ha', carencia_dias: 7, residualidad_dias: 14
  },
  {
    id: 'prod-15', nombre: 'Metarhizium anisopliae WP', tipo: 'Bioinsumo',
    ingredientes: [
      { nombre: 'Metarhizium anisopliae', concentracion: '1×10⁹ con./g', grupo_quimico: 'Hongo entomopatógeno', registro_ica: '15062-ICA', cat_toxicologica: 'IV', frac: '—', irac: 'M05.09', hrac: '—', funcion: 'Bioinsecticida' }
    ],
    dosis_recomendada: 1.5, dosis_max: 2.5, unidad_dosis: 'kg/ha', carencia_dias: 0, residualidad_dias: 14
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES DE UI
// ─────────────────────────────────────────────────────────────────────────────

export const ESTADOS_CONFIG = [
  { key: 'Programada',      emoji: '🟡', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)' },
  { key: 'En preparación',  emoji: '🔵', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)' },
  { key: 'Ejecutada',       emoji: '🟢', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.35)' },
  { key: 'Cancelada',       emoji: '🔴', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)' },
];

const TIPOS_APLICACION = ['Fungicida', 'Herbicida', 'Insecticida', 'Fertilización foliar', 'Bioinsumos', 'Correctivos'];
const METODOS_APLICACION = ['Foliar con tractor', 'Foliar con dron', 'Foliar manual (bomba)', 'Incorporado al suelo', 'Fertigación', 'Drench', 'Aplicación en semillas'];
const UNIDADES_DOSIS = ['L/ha', 'mL/ha', 'kg/ha', 'g/ha', 'cc/ha', 't/ha'];

const getCatToxicologicaStyle = (catRaw) => {
  const cat = String(catRaw || '').toUpperCase().trim();
  if (['I', 'IA', 'IB', '1', '1A', '1B'].includes(cat)) {
    return {
      bg: 'rgba(239, 68, 68, 0.12)',
      color: '#ef4444',
      border: 'rgba(239, 68, 68, 0.2)'
    };
  }
  if (['II', '2'].includes(cat)) {
    return {
      bg: 'rgba(234, 179, 8, 0.12)',
      color: '#ca8a04',
      border: 'rgba(234, 179, 8, 0.25)'
    };
  }
  if (['III', '3'].includes(cat)) {
    return {
      bg: 'rgba(59, 130, 246, 0.12)',
      color: '#3b82f6',
      border: 'rgba(59, 130, 246, 0.2)'
    };
  }
  if (['IV', '4'].includes(cat)) {
    return {
      bg: 'rgba(34, 197, 94, 0.12)',
      color: '#22c55e',
      border: 'rgba(34, 197, 94, 0.2)'
    };
  }
  return {
    bg: 'rgba(107, 114, 128, 0.12)',
    color: '#6b7280',
    border: 'rgba(107, 114, 128, 0.2)'
  };
};

const makeRow = () => ({
  _id: `row-${Date.now()}-${Math.random().toFixed(6)}`,
  _search: '',
  nombre_producto: '',
  registro_ica: '',
  ingrediente_activo: '',
  concentracion: '',
  dosis: '',
  unidad: 'L/ha',
  costo_estimado: '',
  carencia_dias: '',     // editable: auto desde API o manual
  residualidad_dias: '', // editable: auto desde API o manual
  _db_data: null,        // datos completos del producto (API)
  _is_manual: false      // true si fue escrito manualmente sin seleccionar de la BD
});

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: CardBlock
// ─────────────────────────────────────────────────────────────────────────────

function CardBlock({ title, subtitle, icon: Icon, children, accentColor = 'var(--primary)', style = {} }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: '14px',
      border: '1px solid var(--border-color)',
      boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
      overflow: 'hidden',
      ...style
    }}>
      {/* Card Header */}
      <div style={{
        padding: '18px 24px 16px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', gap: '14px',
        background: 'rgba(255,255,255,0.015)'
      }}>
        {Icon && (
          <div style={{
            width: '32px', height: '32px', borderRadius: '10px', flexShrink: 0,
            background: `${accentColor === 'var(--primary)' ? 'rgba(34,197,94' : accentColor.startsWith('#') ? `${accentColor}` + '1a' : 'rgba(34,197,94'},0.12)`,
            border: `1.5px solid ${accentColor === 'var(--primary)' ? 'rgba(34,197,94,0.3)' : accentColor + '40'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: accentColor === 'var(--primary)' ? '#22c55e' : accentColor
          }}>
            <Icon size={15} style={{ flexShrink: 0 }} />
          </div>
        )}
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
          {subtitle && <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '2px 0 0', lineHeight: '1.3' }}>{subtitle}</p>}
        </div>
      </div>
      {/* Card Body */}
      <div style={{ padding: '20px 24px' }}>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT: PlanificadorAplicaciones
// ─────────────────────────────────────────────────────────────────────────────

export default function PlanificadorAplicaciones({ lotes = [], preselectedLoteId = '', onSave, onCancel }) {
  const [form, setForm] = useState({
    lote_id: preselectedLoteId || lotes[0]?.id || '',
    fecha_programada: new Date().toISOString().split('T')[0],
    hora_programada: '07:00',
    tipo_aplicacion: 'Fungicida',
    estado: 'Programada',
    operario: '',
    maquinaria: '',
    metodo_aplicacion: 'Foliar con tractor',
    observaciones: ''
  });

  const [productos, setProductos] = useState([makeRow()]);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(null);
  // API search state: { [rowId]: { results: [], loading: false } }
  const [searchState, setSearchState] = useState({});
  const debounceTimers = useRef({});
  const overlayRef = useRef(null);

  // ── Estado modal de advertencia alta toxicidad ─────────────────────────
  const [showToxModal, setShowToxModal] = useState(false);
  const [toxModalLoading, setToxModalLoading] = useState(false);
  // Guardamos el objeto app que se enviará a onSave después de la confirmación
  const pendingAppRef = useRef(null);

  const [operariosList, setOperariosList] = useState([]);
  const [maquinariasList, setMaquinariasList] = useState([]);
  const [showOperarioDropdown, setShowOperarioDropdown] = useState(false);
  const [showMaquinariaDropdown, setShowMaquinariaDropdown] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const trabajadoresData = await workerRepository.getAllActive();
        if (trabajadoresData) {
          setOperariosList(trabajadoresData);
        }
      } catch (err) {
        console.warn('Error loading trabajadores:', err);
      }

      try {
        const maquinariaData = await machineryRepository.getAll();
        if (maquinariaData) {
          setMaquinariasList(maquinariaData);
        }
      } catch (err) {
        console.warn('Error loading maquinaria:', err);
      }
    }
    loadData();
  }, []);

  const filteredOperarios = useMemo(() => {
    const query = (form.operario || '').toLowerCase().trim();
    if (!query) return operariosList;
    return operariosList.filter(op =>
      `${op.nombres} ${op.apellidos}`.toLowerCase().includes(query) ||
      (op.rol || '').toLowerCase().includes(query)
    );
  }, [operariosList, form.operario]);

  const filteredMaquinarias = useMemo(() => {
    const query = (form.maquinaria || '').toLowerCase().trim();
    if (!query) return maquinariasList;
    return maquinariasList.filter(m =>
      (m.name || '').toLowerCase().includes(query) ||
      (m.codigo_id || '').toLowerCase().includes(query) ||
      (m.type || '').toLowerCase().includes(query)
    );
  }, [maquinariasList, form.maquinaria]);

  const selectedLote = useMemo(() => lotes.find(l => l.id === form.lote_id), [lotes, form.lote_id]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('[data-product-dropdown]')) {
        setDropdownOpen(null);
      }
      if (!e.target.closest('[data-operario-dropdown]')) {
        setShowOperarioDropdown(false);
      }
      if (!e.target.closest('[data-maquinaria-dropdown]')) {
        setShowMaquinariaDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Derived State ─────────────────────────────────────────────────────────

  const ingredientesActivos = useMemo(() => {
    const result = [];
    productos.forEach(prod => {
      if (prod._db_data) {
        // Datos de la API: ingredientes es [{ nombre, concentracion, grupo_quimico, ... }]
        const ings = Array.isArray(prod._db_data.ingredientes) ? prod._db_data.ingredientes : [];
        ings.forEach(ing => {
          result.push({
            ...ing,
            grupo_quimico: (ing.grupo_quimico || '').replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim() || '—',
            frac: (ing.frac || '').replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim() || '—',
            irac: (ing.irac || '').replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim() || '—',
            hrac: (ing.hrac || '').replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim() || '—',
            _producto: prod.nombre_producto
          });
        });
      } else if (prod.ingrediente_activo.trim()) {
        result.push({
          nombre: prod.ingrediente_activo,
          concentracion: prod.concentracion || '—',
          grupo_quimico: '—',
          cat_toxicologica: '—',
          frac: '—',
          irac: '—',
          hrac: '—',
          funcion: '—',
          _producto: prod.nombre_producto
        });
      }
    });
    return result;
  }, [productos]);

  // ── Ingredientes de alta toxicidad detectados (IA / IB) ──────────────
  const ingredientesAltaToxicidad = useMemo(
    () => filtrarIngredientesAltaToxicidad(ingredientesActivos),
    [ingredientesActivos]
  );

  // Usar el campo editable del row (se auto-rellena desde la API, o puede ser manual)
  const maxCarencia = useMemo(() =>
    Math.max(0, ...productos.map(p => parseInt(p.carencia_dias, 10) || 0)), [productos]);

  const maxResidualidad = useMemo(() =>
    Math.max(0, ...productos.map(p => parseInt(p.residualidad_dias, 10) || 0)), [productos]);

  const costoTotal = useMemo(() =>
    productos.reduce((acc, p) => acc + (parseFloat(p.costo_estimado) || 0), 0), [productos]);

  const warnings = useMemo(() => {
    const warns = [];
    const active = productos.filter(p => p.nombre_producto.trim());

    if (active.length === 0) {
      warns.push({ type: 'error', key: 'no-products', msg: 'Debe agregar al menos un producto antes de guardar la aplicación.' });
    }

    active.forEach(p => {
      if (!p.dosis || Number(p.dosis) === 0) {
        warns.push({ type: 'warning', key: `no-dosis-${p._id}`, msg: `"${p.nombre_producto}" no tiene dosis definida.` });
      }
      if (p._db_data?.dosis_max && Number(p.dosis) > p._db_data.dosis_max) {
        warns.push({ type: 'danger', key: `overdose-${p._id}`, msg: `La dosis de "${p.nombre_producto}" (${p.dosis} ${p.unidad}) supera el máximo recomendado (${p._db_data.dosis_max} ${p._db_data.unidad_dosis}).` });
      }
    });

    // FRAC, IRAC, HRAC resistance checks
    const fracMap = {};
    const iracMap = {};
    const hracMap = {};
    const safeCodes = ['N/A', 'BM01', 'M05.09', 'M3', 'M1', '—', ''];

    active.forEach(p => {
      if (p._db_data && Array.isArray(p._db_data.ingredientes)) {
        p._db_data.ingredientes.forEach(ing => {
          if (ing.frac && ing.frac !== '—' && !safeCodes.includes(ing.frac)) {
            if (!fracMap[ing.frac]) fracMap[ing.frac] = [];
            fracMap[ing.frac].push(p.nombre_producto);
          }
          if (ing.irac && ing.irac !== '—' && !safeCodes.includes(ing.irac)) {
            if (!iracMap[ing.irac]) iracMap[ing.irac] = [];
            iracMap[ing.irac].push(p.nombre_producto);
          }
          if (ing.hrac && ing.hrac !== '—' && !safeCodes.includes(ing.hrac)) {
            if (!hracMap[ing.hrac]) hracMap[ing.hrac] = [];
            hracMap[ing.hrac].push(p.nombre_producto);
          }
        });
      }
    });

    Object.entries(fracMap).forEach(([code, names]) => {
      if (names.length > 1) {
        warns.push({ type: 'danger', key: `frac-${code}`, msg: `Riesgo de resistencia cruzada: código FRAC ${code} está presente en múltiples productos (${names.join(', ')}).` });
      }
    });
    Object.entries(iracMap).forEach(([code, names]) => {
      if (names.length > 1) {
        warns.push({ type: 'danger', key: `irac-${code}`, msg: `Riesgo de resistencia cruzada: código IRAC ${code} está presente en múltiples productos (${names.join(', ')}).` });
      }
    });
    Object.entries(hracMap).forEach(([code, names]) => {
      if (names.length > 1) {
        warns.push({ type: 'danger', key: `hrac-${code}`, msg: `Riesgo de resistencia cruzada: código HRAC ${code} está presente en múltiples productos (${names.join(', ')}).` });
      }
    });

    return warns;
  }, [productos]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const updateForm = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const addProducto = () => setProductos(prev => [...prev, makeRow()]);
  const removeProducto = (id) => {
    setProductos(prev => prev.filter(p => p._id !== id));
    setSearchState(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const updateProductoField = (id, field, value) =>
    setProductos(prev => prev.map(p => p._id === id ? { ...p, [field]: value } : p));

  // ── Búsqueda async en la API con debounce ────────────────────────────────
  const searchProductos = useCallback((rowId, query) => {
    // Limpiar timer previo
    if (debounceTimers.current[rowId]) clearTimeout(debounceTimers.current[rowId]);

    if (!query || query.trim().length === 0) {
      setSearchState(prev => ({ ...prev, [rowId]: { results: [], loading: false } }));
      return;
    }

    setSearchState(prev => ({ ...prev, [rowId]: { ...prev[rowId], loading: true } }));

    debounceTimers.current[rowId] = setTimeout(async () => {
      try {
        const data = await productRepository.search(query);
        setSearchState(prev => ({ ...prev, [rowId]: { results: Array.isArray(data) ? data : [], loading: false } }));
      } catch (err) {
        console.warn('[PRODUCTOS SEARCH]', err.message);
        // Fallback al mock local
        const q = query.toLowerCase();
        const fallback = PRODUCTOS_DB
          .filter(p => p.nombre.toLowerCase().includes(q) || p.ingredientes.some(i => i.nombre.toLowerCase().includes(q)))
          .map(p => ({ id: p.id, nombre: p.nombre, tipo: p.tipo, fabricante: null }));
        setSearchState(prev => ({ ...prev, [rowId]: { results: fallback, loading: false } }));
      }
    }, 280);
  }, []);

  // ── Selección de un producto desde el dropdown ────────────────────────────
  const handleSelectProduct = useCallback(async (rowId, suggestion) => {
    setDropdownOpen(null);
    setSearchState(prev => ({ ...prev, [rowId]: { results: [], loading: false } }));

    // Si viene del mock local (id empieza con 'prod-'), usar datos locales
    if (typeof suggestion.id === 'string' && suggestion.id.startsWith('prod-')) {
      const dbProd = PRODUCTOS_DB.find(p => p.id === suggestion.id);
      if (dbProd) {
        setProductos(prev => prev.map(p => {
          if (p._id !== rowId) return p;
          return {
            ...p,
            _search: '',
            nombre_producto: dbProd.nombre,
            registro_ica: dbProd.ingredientes[0]?.registro_ica || '',
            ingrediente_activo: dbProd.ingredientes.map(i => i.nombre).join(' + '),
            concentracion: dbProd.ingredientes.map(i => i.concentracion).join(' / '),
            dosis: String(dbProd.dosis_recomendada),
            unidad: dbProd.unidad_dosis,
            costo_estimado: '',
            carencia_dias: String(dbProd.carencia_dias ?? ''),
            residualidad_dias: String(dbProd.residualidad_dias ?? ''),
            _db_data: dbProd,
            _is_manual: false
          };
        }));
      }
      return;
    }

    // Pedir detalle completo al backend
    try {
      setSearchState(prev => ({ ...prev, [rowId]: { results: [], loading: true } }));
      const prod = await productRepository.getDetails(suggestion.id);

      setProductos(prev => prev.map(p => {
        if (p._id !== rowId) return p;
        return {
          ...p,
          _search: '',
          nombre_producto: prod.nombre,
          registro_ica: prod.registro_ica || '',
          ingrediente_activo: (prod.ingredientes || []).map(i => i.nombre).join(' + '),
          concentracion: (prod.ingredientes || []).map(i => i.concentracion).join(' / '),
          dosis: String(prod.dosis_recomendada || ''),
          unidad: prod.unidad_dosis || 'L/ha',
          costo_estimado: String(prod.costo_estimado || ''),
          carencia_dias: String(prod.carencia_dias ?? ''),
          residualidad_dias: String(prod.residualidad_dias ?? ''),
          _db_data: prod,
          _is_manual: false
        };
      }));
    } catch (err) {
      console.warn('[PRODUCTOS DETAIL]', err.message);
      // Si falla el detalle, al menos llenar nombre
      setProductos(prev => prev.map(p =>
        p._id !== rowId ? p : { ...p, _search: '', nombre_producto: suggestion.nombre, _is_manual: false }
      ));
    } finally {
      setSearchState(prev => ({ ...prev, [rowId]: { results: [], loading: false } }));
    }
  }, []);

  // ── Construir objeto app ─────────────────────────────────────────────
  const buildApp = useCallback(() => {
    const activeProds = productos.filter(p => p.nombre_producto.trim());
    return {
      id: `app-${Date.now()}`,
      lote_id: form.lote_id,
      tipo_aplicacion: 'Fitosanitaria',
      tipo_producto: form.tipo_aplicacion,
      producto_comercial: activeProds.map(p => p.nombre_producto).join(' + '),
      ingrediente_activo: activeProds.map(p => p.ingrediente_activo).join(' + '),
      dosis: activeProds.map(p => `${p.dosis} ${p.unidad}`).join(' + '),
      unidad_medida: activeProds[0]?.unidad || 'L',
      volumen_aplicado: parseInt(activeProds[0]?.volumen_agua) || 200,
      metodo_aplicacion: form.metodo_aplicacion,
      operario_responsable: form.operario || 'Por asignar',
      maquinaria_utilizada: form.maquinaria || 'Por asignar',
      condiciones_climaticas: 'Por registrar en campo',
      fecha_aplicacion: `${form.fecha_programada}T${form.hora_programada}:00.000Z`,
      costo_aplicacion: costoTotal,
      registro_ica: 'Pendiente',
      periodo_carencia_dias: maxCarencia,
      periodo_reingreso_horas: 24,
      clasificacion_toxicologica: 'Por definir',
      residualidad_nivel: maxResidualidad > 21 ? 'Alto' : maxResidualidad > 7 ? 'Medio' : 'Bajo',
      estado_programacion: form.estado,
      observaciones: form.observaciones,
      productos_detalle: activeProds
    };
  }, [productos, form, costoTotal, maxCarencia, maxResidualidad]);

  // ── handleSave: valida y dispara modal si hay IA/IB ──────────────────
  const handleSave = () => {
    setSubmitAttempted(true);
    const hasFormError = !form.lote_id || !form.fecha_programada;
    const hasProductError = warnings.some(w => w.type === 'error');
    if (hasFormError || hasProductError) return;

    if (ingredientesAltaToxicidad.length > 0) {
      // Construir el app y guardarlo para ejecutar después de la confirmación
      pendingAppRef.current = buildApp();
      setShowToxModal(true);
      return;
    }

    // Sin ingredientes IA/IB → guardar directamente
    onSave(buildApp());
  };

  // ── handleToxModalConfirm: auditoría + guardado ───────────────────────
  const handleToxModalConfirm = useCallback(async (geolocalizacion) => {
    setToxModalLoading(true);
    const app = pendingAppRef.current;

    try {
      await productRepository.logToxicityAudit({
        appId: app?.id || `app-${Date.now()}`,
        user: 'anonimo',
        ingredients: ingredientesAltaToxicidad.map(i => ({
          nombre: i.nombre,
          categoria: i._catNorm
        })),
        geolocalizacion: geolocalizacion || null
      });
    } catch (err) {
      // No bloquear el flujo si la auditoría falla
      console.warn('[AUDITORÍA AT] No se pudo registrar la auditoría:', err.message);
    } finally {
      setToxModalLoading(false);
      setShowToxModal(false);
      if (app) onSave(app);
      pendingAppRef.current = null;
    }
  }, [ingredientesAltaToxicidad, onSave]);

  const handleToxModalCancel = useCallback(() => {
    setShowToxModal(false);
    pendingAppRef.current = null;
  }, []);

  // ── Style helpers ─────────────────────────────────────────────────────────

  const inputStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'inherit'
  };

  const labelStyle = {
    fontSize: '10.5px', fontWeight: '700', color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.5px',
    display: 'block', marginBottom: '6px'
  };

  const fieldGroup = (label, required, content) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={labelStyle}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
      </label>
      {content}
    </div>
  );

  const activeEstado = ESTADOS_CONFIG.find(e => e.key === form.estado);
  const warningCount = warnings.filter(w => w.type === 'warning').length;
  const dangerCount = warnings.filter(w => w.type === 'danger' || w.type === 'error').length;

  const tipoColor = (tipo) => {
    if (tipo === 'Fungicida') return { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' };
    if (tipo === 'Insecticida') return { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
    if (tipo === 'Herbicida') return { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
    if (tipo === 'Bioinsumo') return { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' };
    if (tipo === 'Coadyuvante') return { color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
    return { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' };
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
    {/* ── MODAL ADVERTENCIA ALTA TOXICIDAD ─────────────────────────────── */}
    {showToxModal && (
      <ModalAdvertenciaToxicidad
        ingredientes={ingredientesAltaToxicidad}
        onConfirm={handleToxModalConfirm}
        onCancel={handleToxModalCancel}
        isLoading={toxModalLoading}
      />
    )}
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* ── STICKY HEADER ───────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)',
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
        backdropFilter: 'blur(16px)'
      }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={onCancel}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '12.5px', padding: '4px 8px',
              borderRadius: '6px', transition: 'all 0.15s', fontFamily: 'inherit'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <ChevronLeft size={14} />
            Volver
          </button>
          <span style={{ color: 'var(--border-color)', fontSize: '16px' }}>›</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Manejo Sanitario</span>
          <span style={{ color: 'var(--border-color)', fontSize: '16px' }}>›</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Aplicaciones</span>
          <span style={{ color: 'var(--border-color)', fontSize: '16px' }}>›</span>
          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>Nuevo Registro</span>
        </div>

        {/* Right: warnings + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {dangerCount > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px',
              borderRadius: '8px', background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)', fontSize: '11.5px', color: '#ef4444'
            }}>
              <AlertTriangle size={13} />
              <span>{dangerCount} {dangerCount === 1 ? 'error' : 'errores'}</span>
            </div>
          )}
          {warningCount > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px',
              borderRadius: '8px', background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.25)', fontSize: '11.5px', color: '#f59e0b'
            }}>
              <AlertCircle size={13} />
              <span>{warningCount} {warningCount === 1 ? 'advertencia' : 'advertencias'}</span>
            </div>
          )}
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px', fontSize: '13px', background: 'transparent',
              border: '1px solid var(--border-color)', borderRadius: '8px',
              color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s',
              fontFamily: 'inherit'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-muted)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              background: '#16a34a', color: 'white', border: 'none',
              borderRadius: '8px', padding: '9px 18px', fontSize: '13px',
              fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 2px 12px rgba(22,163,74,0.4)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#15803d'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(22,163,74,0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#16a34a'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(22,163,74,0.4)'; }}
          >
            <CheckCircle size={15} />
            Guardar Aplicación
          </button>
        </div>
      </div>

      {/* ── PAGE TITLE ──────────────────────────────────────────────────── */}
      <div style={{ padding: '24px 24px 4px' }}>
        <h2 style={{ fontSize: '21px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Registro de Aplicaciones
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
          Programa y gestiona aplicaciones futuras por lote con dosis, ingredientes y periodos de carencia.
        </p>
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 24px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ─── CARD 1: INFORMACIÓN GENERAL ──────────────────────────────── */}
        <CardBlock title="Información General" subtitle="Datos de identificación y programación de la aplicación" icon={Calendar} accentColor="#22c55e">
          {/* Row 1: Lote, Cultivo, Área, Fecha, Hora, Tipo */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.7fr 1.1fr 0.75fr 1.1fr', gap: '16px', marginBottom: '16px' }}>
            {fieldGroup('Lote / Sector', true,
              <select
                value={form.lote_id}
                onChange={e => updateForm('lote_id', e.target.value)}
                style={{ ...inputStyle, borderColor: submitAttempted && !form.lote_id ? '#ef4444' : 'var(--border-color)' }}
              >
                <option value="">Seleccionar lote...</option>
                {lotes.map(l => (
                  <option key={l.id} value={l.id}>{l.codigo_interno} — {l.cultivo}</option>
                ))}
              </select>
            )}
            {fieldGroup('Cultivo', false,
              <input readOnly value={selectedLote?.cultivo || '—'}
                style={{ ...inputStyle, background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)', cursor: 'default' }} />
            )}
            {fieldGroup('Área (ha)', false,
              <input readOnly value={selectedLote ? `${selectedLote.area_ha}` : '—'}
                style={{ ...inputStyle, background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)', cursor: 'default' }} />
            )}
            {fieldGroup('Fecha Programada', true,
              <input type="date" value={form.fecha_programada}
                onChange={e => updateForm('fecha_programada', e.target.value)}
                style={{ ...inputStyle, borderColor: submitAttempted && !form.fecha_programada ? '#ef4444' : 'var(--border-color)' }} />
            )}
            {fieldGroup('Hora', false,
              <input type="time" value={form.hora_programada}
                onChange={e => updateForm('hora_programada', e.target.value)}
                style={inputStyle} />
            )}
            {fieldGroup('Tipo de Aplicación', true,
              <select value={form.tipo_aplicacion} onChange={e => updateForm('tipo_aplicacion', e.target.value)} style={inputStyle}>
                {TIPOS_APLICACION.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>

          {/* Row 2: Operario, Maquinaria, Método */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            {fieldGroup('Operario', false,
              <div style={{ position: 'relative' }} data-operario-dropdown>
                <input
                  type="text"
                  placeholder="Nombre del operario..."
                  value={form.operario}
                  onChange={e => {
                    updateForm('operario', e.target.value);
                    setShowOperarioDropdown(true);
                  }}
                  onFocus={() => setShowOperarioDropdown(true)}
                  style={inputStyle}
                />
                {showOperarioDropdown && filteredOperarios.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    zIndex: 300,
                    background: '#ffffff',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.28)',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {filteredOperarios.map(op => (
                      <div
                        key={op.id}
                        onClick={() => {
                          updateForm('operario', `${op.nombres} ${op.apellidos}`);
                          setShowOperarioDropdown(false);
                        }}
                        style={{
                          padding: '10px 14px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background 0.12s',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-primary)' }}>
                          {op.nombres} {op.apellidos}
                        </span>
                        {op.rol && (
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '50px',
                            background: 'rgba(34,197,94,0.1)',
                            color: '#22c55e'
                          }}>
                            {op.rol}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {fieldGroup('Maquinaria / Equipo', false,
              <div style={{ position: 'relative' }} data-maquinaria-dropdown>
                <input
                  type="text"
                  placeholder="Ej: Dron DJI Agras T40..."
                  value={form.maquinaria}
                  onChange={e => {
                    updateForm('maquinaria', e.target.value);
                    setShowMaquinariaDropdown(true);
                  }}
                  onFocus={() => setShowMaquinariaDropdown(true)}
                  style={inputStyle}
                />
                {showMaquinariaDropdown && filteredMaquinarias.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    zIndex: 300,
                    background: '#ffffff',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.28)',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {filteredMaquinarias.map(m => (
                      <div
                        key={m.id}
                        onClick={() => {
                          updateForm('maquinaria', m.codigo_id ? `[${m.codigo_id}] ${m.name}` : m.name);
                          setShowMaquinariaDropdown(false);
                        }}
                        style={{
                          padding: '10px 14px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background 0.12s',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {m.name}
                          </span>
                          {m.codigo_id && (
                            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                              Cód: {m.codigo_id}
                            </span>
                          )}
                        </div>
                        {m.type && (
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '50px',
                            background: 'rgba(59,130,246,0.1)',
                            color: '#3b82f6'
                          }}>
                            {m.type}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {fieldGroup('Método de Aplicación', false,
              <select value={form.metodo_aplicacion} onChange={e => updateForm('metodo_aplicacion', e.target.value)} style={inputStyle}>
                {METODOS_APLICACION.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </div>

          {/* Estado chips */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '18px' }}>
            <label style={{ ...labelStyle, marginBottom: '12px' }}>Estado de la Aplicación</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {ESTADOS_CONFIG.map(estado => (
                <button key={estado.key}
                  onClick={() => updateForm('estado', estado.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    padding: '8px 18px', borderRadius: '50px', fontFamily: 'inherit',
                    border: `1.5px solid ${form.estado === estado.key ? estado.border : 'var(--border-color)'}`,
                    background: form.estado === estado.key ? estado.bg : 'transparent',
                    color: form.estado === estado.key ? estado.color : 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '13px',
                    fontWeight: form.estado === estado.key ? '600' : '400',
                    transform: form.estado === estado.key ? 'translateY(-1px)' : 'none',
                    boxShadow: form.estado === estado.key ? `0 2px 10px ${estado.bg}` : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  <span>{estado.emoji}</span>
                  {estado.key}
                  {form.estado === estado.key && <CheckCircle size={12} />}
                </button>
              ))}
            </div>
          </div>
        </CardBlock>

        {/* ─── CARD 2: PRODUCTOS A APLICAR ──────────────────────────────── */}
        <CardBlock title="Productos a Aplicar" subtitle="Busque y seleccione un producto de la base de datos maestra. Si no existe, escríbalo manualmente." icon={Package} accentColor="#8b5cf6">
          <div style={{ overflowX: 'auto', marginBottom: '16px', minHeight: '280px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  {['Producto', 'Ingrediente activo', 'Concentración', 'Dosis', 'Unidad', 'Registro ICA', 'Carencia (d)', 'Residualidad (d)', ''].map((h, i) => (
                    <th key={i} style={{
                      padding: '9px 10px', textAlign: 'left',
                      fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                      letterSpacing: '0.4px', color: 'var(--text-muted)', whiteSpace: 'nowrap'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productos.map((row) => (
                  <tr key={row._id}
                    style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.025)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Producto con autocomplete dinámico (API) */}
                    <td style={{ padding: '7px 10px', minWidth: '200px', position: 'relative' }} data-product-dropdown>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          placeholder="Buscar o escribir producto..."
                          value={dropdownOpen === row._id ? row._search : row.nombre_producto}
                          onChange={e => {
                            const val = e.target.value;
                            updateProductoField(row._id, '_search', val);
                            // Si está escribiendo (no ha seleccionado de BD), actualizar nombre y marcar manual
                            if (!row._db_data || dropdownOpen === row._id) {
                              updateProductoField(row._id, 'nombre_producto', val);
                              updateProductoField(row._id, '_is_manual', true);
                              updateProductoField(row._id, '_db_data', null);
                            }
                            setDropdownOpen(row._id);
                            searchProductos(row._id, val);
                          }}
                          onFocus={() => {
                            setDropdownOpen(row._id);
                            if (!searchState[row._id]?.results?.length) {
                              searchProductos(row._id, row._search || row.nombre_producto);
                            }
                          }}
                          style={{
                            ...inputStyle, fontSize: '12.5px', padding: '6px 32px 6px 10px',
                            borderColor: submitAttempted && !row.nombre_producto ? '#ef4444'
                              : row._db_data ? 'rgba(139,92,246,0.4)'
                              : 'var(--border-color)'
                          }}
                          data-product-dropdown
                        />
                        {/* Indicadores en el input */}
                        <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                          {searchState[row._id]?.loading
                            ? <Loader2 size={13} style={{ color: '#8b5cf6', animation: 'spin 1s linear infinite' }} />
                            : row._db_data
                            ? <Database size={12} style={{ color: '#8b5cf6', opacity: 0.7 }} />
                            : null
                          }
                        </div>
                      </div>

                      {/* Dropdown de resultados */}
                      {dropdownOpen === row._id && (
                        <div data-product-dropdown style={{
                          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300,
                          background: '#ffffff', border: '1px solid var(--border-color)',
                          borderRadius: '10px', boxShadow: '0 8px 30px rgba(0,0,0,0.28)',
                          maxHeight: '240px', overflowY: 'auto'
                        }}>
                          {(searchState[row._id]?.results || []).map(suggestion => {
                            const tc = tipoColor(suggestion.tipo);
                            return (
                              <div key={suggestion.id}
                                onMouseDown={() => handleSelectProduct(row._id, suggestion)}
                                style={{
                                  padding: '10px 14px', cursor: 'pointer',
                                  borderBottom: '1px solid var(--border-color)',
                                  transition: 'background 0.12s',
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <div>
                                  <span style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-primary)', display: 'block' }}>{suggestion.nombre}</span>
                                  {suggestion.ingrediente_activo && (
                                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                                      {suggestion.ingrediente_activo} {suggestion.concentracion ? `(${suggestion.concentracion})` : ''}
                                    </span>
                                  )}
                                </div>
                                {suggestion.tipo && (
                                  <span style={{
                                    fontSize: '10.5px', fontWeight: '700', padding: '2px 8px', borderRadius: '50px',
                                    background: tc.bg, color: tc.color, flexShrink: 0, marginTop: '2px'
                                  }}>{suggestion.tipo}</span>
                                )}
                              </div>
                            );
                          })}
                          {!searchState[row._id]?.loading && (searchState[row._id]?.results || []).length === 0 && (row._search || row.nombre_producto).length > 0 && (
                            <div style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '12px' }}>
                              <span style={{ opacity: 0.7 }}>Sin resultados en la BD.</span>{' '}
                              <span style={{ color: '#8b5cf6', fontWeight: '600' }}>El nombre ingresado se guardará manualmente.</span>
                            </div>
                          )}
                          {!searchState[row._id]?.loading && (searchState[row._id]?.results || []).length === 0 && !(row._search || row.nombre_producto) && (
                            <div style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
                              Escribe para buscar en la base de datos maestra...
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Ingrediente activo */}
                    <td style={{ padding: '7px 10px', minWidth: '155px' }}>
                      <input type="text" value={row.ingrediente_activo}
                        readOnly={!!row._db_data}
                        onChange={e => !row._db_data && updateProductoField(row._id, 'ingrediente_activo', e.target.value)}
                        placeholder="Auto o manual..."
                        style={{
                          ...inputStyle, fontSize: '12px', padding: '6px 10px',
                          background: row._db_data ? 'rgba(34,197,94,0.04)' : 'var(--bg-surface)',
                          borderColor: row._db_data ? 'rgba(34,197,94,0.2)' : 'var(--border-color)',
                          cursor: row._db_data ? 'default' : 'text'
                        }} />
                    </td>

                    {/* Concentración */}
                    <td style={{ padding: '7px 10px', minWidth: '105px' }}>
                      <input type="text" value={row.concentracion}
                        readOnly={!!row._db_data}
                        onChange={e => !row._db_data && updateProductoField(row._id, 'concentracion', e.target.value)}
                        placeholder="Ej: 20%"
                        style={{
                          ...inputStyle, fontSize: '12px', padding: '6px 10px',
                          background: row._db_data ? 'rgba(34,197,94,0.04)' : 'var(--bg-surface)',
                          borderColor: row._db_data ? 'rgba(34,197,94,0.2)' : 'var(--border-color)',
                          cursor: row._db_data ? 'default' : 'text'
                        }} />
                    </td>

                    {/* Dosis */}
                    <td style={{ padding: '7px 10px', minWidth: '85px' }}>
                      <input type="number" min="0" step="0.01" value={row.dosis}
                        onChange={e => updateProductoField(row._id, 'dosis', e.target.value)}
                        placeholder="0.00"
                        style={{
                          ...inputStyle, fontSize: '12.5px', padding: '6px 10px',
                          borderColor: submitAttempted && !row.dosis ? '#ef4444' : 'var(--border-color)'
                        }} />
                    </td>

                    {/* Unidad */}
                    <td style={{ padding: '7px 10px', minWidth: '90px' }}>
                      <select value={row.unidad} onChange={e => updateProductoField(row._id, 'unidad', e.target.value)}
                        style={{ ...inputStyle, fontSize: '12px', padding: '6px 8px' }}>
                        {UNIDADES_DOSIS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>

                    {/* Registro ICA */}
                    <td style={{ padding: '7px 10px', minWidth: '110px' }}>
                      <input type="text" value={row.registro_ica}
                        readOnly={!!row._db_data}
                        onChange={e => !row._db_data && updateProductoField(row._id, 'registro_ica', e.target.value)}
                        placeholder="Ej: 0001"
                        style={{
                          ...inputStyle, fontSize: '12px', padding: '6px 10px',
                          background: row._db_data ? 'rgba(34,197,94,0.04)' : 'var(--bg-surface)',
                          borderColor: row._db_data ? 'rgba(34,197,94,0.2)' : 'var(--border-color)',
                          cursor: row._db_data ? 'default' : 'text'
                        }} />
                    </td>

                    {/* Carencia (días) — editable */}
                    <td style={{ padding: '7px 10px', minWidth: '90px' }}>
                      <input
                        type="number" min="0" step="1"
                        placeholder={row._db_data ? '—' : '0'}
                        value={row.carencia_dias}
                        onChange={e => updateProductoField(row._id, 'carencia_dias', e.target.value)}
                        style={{
                          ...inputStyle, fontSize: '12px', padding: '6px 8px',
                          background: row._db_data ? 'rgba(245,158,11,0.06)' : 'var(--bg-surface)',
                          borderColor: row._db_data ? 'rgba(245,158,11,0.3)' : 'var(--border-color)',
                          textAlign: 'center'
                        }}
                      />
                    </td>

                    {/* Residualidad (días) — editable */}
                    <td style={{ padding: '7px 10px', minWidth: '100px' }}>
                      <input
                        type="number" min="0" step="1"
                        placeholder={row._db_data ? '—' : '0'}
                        value={row.residualidad_dias}
                        onChange={e => updateProductoField(row._id, 'residualidad_dias', e.target.value)}
                        style={{
                          ...inputStyle, fontSize: '12px', padding: '6px 8px',
                          background: row._db_data ? 'rgba(59,130,246,0.06)' : 'var(--bg-surface)',
                          borderColor: row._db_data ? 'rgba(59,130,246,0.3)' : 'var(--border-color)',
                          textAlign: 'center'
                        }}
                      />
                    </td>

                    {/* Eliminar */}
                    <td style={{ padding: '7px 8px' }}>
                      <button onClick={() => removeProducto(row._id)}
                        style={{
                          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)',
                          borderRadius: '6px', padding: '5px 8px', cursor: 'pointer',
                          color: '#ef4444', display: 'flex', alignItems: 'center', transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.07)'}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer: Add + Cost */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <button onClick={addProducto}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px', fontFamily: 'inherit',
                background: 'rgba(139,92,246,0.07)', border: '1.5px dashed rgba(139,92,246,0.4)',
                color: '#8b5cf6', borderRadius: '8px', padding: '9px 18px',
                fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.13)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,92,246,0.07)'}
            >
              <Plus size={15} />
              Agregar Producto
            </button>
            {costoTotal > 0 && (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                Costo total estimado:{' '}
                <span style={{ color: '#22c55e', fontWeight: '700', fontSize: '15px' }}>
                  ${costoTotal.toLocaleString('es-CO')}
                </span>
              </div>
            )}
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {warnings.map(w => (
                <div key={w.key} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  padding: '10px 14px', borderRadius: '8px',
                  background: w.type === 'warning' ? 'rgba(245,158,11,0.07)' : 'rgba(239,68,68,0.07)',
                  border: `1px solid ${w.type === 'warning' ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.2)'}`,
                  borderLeft: `3px solid ${w.type === 'warning' ? '#f59e0b' : '#ef4444'}`
                }}>
                  <AlertTriangle size={14} style={{ color: w.type === 'warning' ? '#f59e0b' : '#ef4444', flexShrink: 0, marginTop: '1px' }} />
                  <span style={{ fontSize: '12.5px', color: w.type === 'warning' ? '#d97706' : '#ef4444', lineHeight: '1.4' }}>{w.msg}</span>
                </div>
              ))}
            </div>
          )}
        </CardBlock>

        {/* ─── CARDS 3 + 4 SIDE BY SIDE ─────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1fr', gap: '20px' }}>

          {/* Card 3: Ingredientes Activos */}
          <CardBlock title="Ingredientes Activos" subtitle="Calculado automáticamente desde los productos seleccionados. No editable." icon={FlaskConical} accentColor="#3b82f6">
            {ingredientesActivos.length > 0 ? (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid var(--border-color)' }}>
                        {['Ingrediente Activo', 'Conc.', 'Grupo Químico', 'Categoría Toxicológica', 'FRAC', 'IRAC', 'HRAC', 'Función'].map((h, i) => (
                          <th key={i} style={{
                            padding: '7px 10px', textAlign: 'left',
                            fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                            letterSpacing: '0.4px', color: 'var(--text-muted)', whiteSpace: 'nowrap'
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ingredientesActivos.map((ing, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.12s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.03)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '8px 10px', fontWeight: '600', color: 'var(--text-primary)' }}>{ing.nombre}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{ing.concentracion}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontSize: '11px' }}>{ing.grupo_quimico}</td>
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                            {ing.cat_toxicologica && ing.cat_toxicologica !== '—' ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                                {(() => {
                                  const style = getCatToxicologicaStyle(ing.cat_toxicologica);
                                  return (
                                    <span style={{
                                      fontSize: '11px', padding: '2px 8px', borderRadius: '6px', fontWeight: '600',
                                      background: style.bg,
                                      color: style.color,
                                      border: `1px solid ${style.border}`
                                    }}>
                                      Cat. {ing.cat_toxicologica}
                                    </span>
                                  );
                                })()}
                                {ing.alerta && (
                                  <ContextualTooltip alerta={ing.alerta} ingrediente={ing.nombre} />
                                )}
                              </div>
                            ) : <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {ing.frac && ing.frac !== '—' ? (
                              <span style={{
                                fontFamily: 'monospace', fontSize: '12px', fontWeight: '700',
                                color: '#3b82f6', background: 'rgba(59,130,246,0.1)',
                                padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.2)',
                                whiteSpace: 'nowrap', display: 'inline-block'
                              }}>
                                {ing.frac}
                              </span>
                            ) : <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {ing.irac && ing.irac !== '—' ? (
                              <span style={{
                                fontFamily: 'monospace', fontSize: '12px', fontWeight: '700',
                                color: '#10b981', background: 'rgba(16,185,129,0.1)',
                                padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.2)',
                                whiteSpace: 'nowrap', display: 'inline-block'
                              }}>
                                {ing.irac}
                              </span>
                            ) : <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {ing.hrac && ing.hrac !== '—' ? (
                              <span style={{
                                fontFamily: 'monospace', fontSize: '12px', fontWeight: '700',
                                color: '#a855f7', background: 'rgba(168,85,247,0.1)',
                                padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(168,85,247,0.2)',
                                whiteSpace: 'nowrap', display: 'inline-block'
                              }}>
                                {ing.hrac}
                              </span>
                            ) : <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>}
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontSize: '11.5px' }}>{ing.funcion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <Info size={12} style={{ color: '#3b82f6' }} />
                  Total ingredientes activos: <strong style={{ color: '#3b82f6', marginLeft: '3px' }}>{ingredientesActivos.length}</strong>
                </div>
              </>
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '36px 20px', color: 'var(--text-muted)', textAlign: 'center', gap: '10px'
              }}>
                <FlaskConical size={28} style={{ opacity: 0.25 }} />
                <p style={{ margin: 0, fontSize: '12.5px', lineHeight: '1.5' }}>
                  Selecciona productos en la sección anterior para ver los ingredientes activos automáticamente.
                </p>
              </div>
            )}
          </CardBlock>

          {/* Card 4: Carencia y Residualidad */}
          <CardBlock title="Carencia y Residualidad" subtitle="Períodos máximos calculados automáticamente" icon={Shield} accentColor="#f59e0b">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Carencia KPI */}
              <div style={{
                padding: '20px', borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(245,158,11,0.09), rgba(251,191,36,0.03))',
                border: '1px solid rgba(245,158,11,0.22)',
                display: 'flex', alignItems: 'center', gap: '16px'
              }}>
                <div style={{
                  width: '50px', height: '50px', borderRadius: '12px', flexShrink: 0,
                  background: 'rgba(245,158,11,0.15)', border: '1.5px solid rgba(245,158,11,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <ShieldAlert size={22} style={{ color: '#f59e0b' }} />
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '3px' }}>
                    Período de Carencia
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                    <span style={{ fontSize: '38px', fontWeight: '800', color: '#f59e0b', lineHeight: 1 }}>{maxCarencia}</span>
                    <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '600' }}>días</span>
                  </div>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Días hasta la cosecha</span>
                </div>
              </div>

              {/* Residualidad KPI */}
              <div style={{
                padding: '20px', borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(59,130,246,0.09), rgba(96,165,250,0.03))',
                border: '1px solid rgba(59,130,246,0.22)',
                display: 'flex', alignItems: 'center', gap: '16px'
              }}>
                <div style={{
                  width: '50px', height: '50px', borderRadius: '12px', flexShrink: 0,
                  background: 'rgba(59,130,246,0.15)', border: '1.5px solid rgba(59,130,246,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Zap size={22} style={{ color: '#3b82f6' }} />
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '3px' }}>
                    Residualidad Estimada
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                    <span style={{ fontSize: '38px', fontWeight: '800', color: '#3b82f6', lineHeight: 1 }}>{maxResidualidad}</span>
                    <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '600' }}>días</span>
                  </div>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Días de protección</span>
                </div>
              </div>

              {/* Informative note */}
              <div style={{
                display: 'flex', gap: '8px', alignItems: 'flex-start',
                padding: '10px 14px', borderRadius: '8px',
                background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.13)',
                fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.45'
              }}>
                <Info size={13} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '1px' }} />
                <span>Estos valores son referenciales. Si existen varios productos, se muestra el mayor período (el que aplica al lote). Verifique siempre la etiqueta del producto y la regulación local.</span>
              </div>
            </div>
          </CardBlock>
        </div>

        {/* ─── CARD 5: OBSERVACIONES ────────────────────────────────────── */}
        <CardBlock title="Observaciones para el Operario" subtitle="Instrucciones especiales, condiciones de seguridad, EPP requerido y recomendaciones de campo" icon={Info} accentColor="#6b7280">
          <textarea
            placeholder="Escriba aquí instrucciones específicas para el operario: precauciones de seguridad, condiciones climáticas recomendadas, zonas críticas del lote, EPP requerido, horario de aplicación, etc."
            value={form.observaciones}
            onChange={e => updateForm('observaciones', e.target.value)}
            rows={5}
            style={{
              ...inputStyle, resize: 'vertical', minHeight: '110px',
              lineHeight: '1.65', fontSize: '13.5px'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{form.observaciones.length} caracteres</span>
          </div>
        </CardBlock>

        {/* ─── RESUMEN FOOTER ───────────────────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px',
          padding: '20px 24px', borderRadius: '14px',
          background: 'rgba(34,197,94,0.03)', border: '1px solid rgba(34,197,94,0.1)'
        }}>
          {[
            { label: 'Productos', value: productos.filter(p => p.nombre_producto.trim()).length, unit: 'a aplicar', color: '#22c55e', Icon: Package },
            { label: 'Ingredientes', value: ingredientesActivos.length, unit: 'activos totales', color: '#3b82f6', Icon: FlaskConical },
            { label: 'Carencia máx.', value: maxCarencia, unit: 'días', color: '#f59e0b', Icon: Shield }
          ].map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '10px', flexShrink: 0,
                background: `${item.color}18`, border: `1.5px solid ${item.color}35`,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <item.Icon size={18} style={{ color: item.color }} />
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block' }}>{item.label}</span>
                <span style={{ fontSize: '20px', fontWeight: '800', color: item.color, display: 'block', lineHeight: 1.1 }}>{item.value}</span>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{item.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ─── BOTTOM ACTION BAR ────────────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '12px',
          paddingTop: '8px', borderTop: '1px solid var(--border-color)'
        }}>
          <button onClick={onCancel}
            style={{
              padding: '10px 22px', fontSize: '13.5px', background: 'transparent', fontFamily: 'inherit',
              border: '1px solid var(--border-color)', borderRadius: '8px',
              color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-muted)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
          >
            Cancelar
          </button>
          <button onClick={handleSave}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'inherit',
              background: '#16a34a', color: 'white', border: 'none',
              borderRadius: '8px', padding: '11px 26px', fontSize: '14px',
              fontWeight: '700', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(22,163,74,0.38)', transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#15803d'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(22,163,74,0.48)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#16a34a'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(22,163,74,0.38)'; }}
          >
            <CheckCircle size={16} />
            Guardar Aplicación
          </button>
        </div>

      </div>
    </div>
    </>
  );
}
