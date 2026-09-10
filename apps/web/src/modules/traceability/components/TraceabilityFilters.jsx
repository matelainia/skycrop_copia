import React, { useState } from 'react';

/**
 * TraceabilityFilters — lote, rango fechas, tipo actividad, responsable.
 */
const TIPOS = [
  { id: 'todas', label: 'Todas las actividades' },
  { id: 'fertilization_application', label: 'Fertilización' },
  { id: 'sanitary_application', label: 'Manejo Sanitario' },
  { id: 'sanitary_monitoring', label: 'Monitoreo sanitario' },
  { id: 'general_monitoring', label: 'Monitoreo' },
  { id: 'nutrition_monitoring', label: 'Monitoreo de nutrición' },
  { id: 'harvest_collection', label: 'Cosecha' },
  { id: 'cultural_labor', label: 'Labores Culturales' },
  { id: 'soil_analysis', label: 'Análisis de Suelos' },
  { id: 'worker_activity', label: 'Personal' }
];

export function TraceabilityFilters({ filters, onChange, lotes, onExport }) {
  const [range, setRange] = useState('');
  const set = (k, v) => onChange?.({ ...filters, [k]: v, page: 1 });

  const applyRange = (val) => {
    setRange(val);
    const now = new Date();
    if (val === '30d') {
      const d = new Date(now); d.setDate(d.getDate() - 30);
      onChange?.({ ...filters, desde: d.toISOString().slice(0, 10), hasta: now.toISOString().slice(0, 10), page: 1 });
    } else if (val === '90d') {
      const d = new Date(now); d.setDate(d.getDate() - 90);
      onChange?.({ ...filters, desde: d.toISOString().slice(0, 10), hasta: now.toISOString().slice(0, 10), page: 1 });
    } else if (val === '') {
      onChange?.({ ...filters, desde: '', hasta: '', page: 1 });
    }
  };

  return (
    <div className="trz-filters">
      <label className="trz-field">
        <span>Selecciona un lote</span>
        <select value={filters.lote_id || ''} onChange={(e) => set('lote_id', e.target.value)}>
          <option value="">— Seleccionar —</option>
          {(lotes || []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.codigo_interno || l.nombre} · {l.area_ha ? `${l.area_ha} ha` : ''} {l.cultivo ? `· ${l.cultivo}` : ''}
            </option>
          ))}
        </select>
      </label>
      <label className="trz-field">
        <span>Rango de fechas</span>
        <select value={range} onChange={(e) => applyRange(e.target.value)}>
          <option value="">Todo el historial</option>
          <option value="30d">Últimos 30 días</option>
          <option value="90d">Últimos 90 días</option>
        </select>
      </label>
      <label className="trz-field">
        <span>Filtrar por tipo de actividad</span>
        <select value={filters.event_type || 'todas'} onChange={(e) => set('event_type', e.target.value)}>
          {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </label>
      <label className="trz-field trz-field-search">
        <span>Responsable</span>
        <input
          placeholder="Ej. Carlos Méndez"
          value={filters.responsable || ''}
          onChange={(e) => set('responsable', e.target.value)}
        />
      </label>
      <button className="trz-btn-export" onClick={onExport} title="Exportar evidencia del lote (CSV)">
        ⬇ Exportar
      </button>
    </div>
  );
}

export default TraceabilityFilters;
