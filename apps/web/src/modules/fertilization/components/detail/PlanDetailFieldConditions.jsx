/**
 * PlanDetailFieldConditions.jsx
 * Tarjeta de condiciones actuales del lote/campo.
 */
import React from 'react';
import { Thermometer, Droplets, Wind, CloudRain, Layers, FlaskConical } from 'lucide-react';

function ConditionItem({ icon: Icon, label, value, unit = '' }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="pd-condition-item">
      <div className="pd-condition-icon" aria-hidden="true">
        <Icon size={18} />
      </div>
      <div>
        <div className="pd-condition-label">{label}</div>
        <div className="pd-condition-value">{value}{unit}</div>
      </div>
    </div>
  );
}

export default function PlanDetailFieldConditions({ fieldCondition }) {
  if (!fieldCondition) {
    return (
      <div className="pd-card sc-animate-fade-up" aria-label="Condiciones del campo">
        <div className="pd-card__header">
          <h2 className="pd-card__title"><Thermometer size={15} aria-hidden="true" />Condiciones del Campo</h2>
        </div>
        <div className="pd-empty">
          <div className="pd-empty__icon"><Thermometer size={20} /></div>
          <span className="pd-empty__title">Sin datos de condiciones</span>
          <span className="pd-empty__desc">Las condiciones climáticas se registran desde el módulo de Clima o manualmente.</span>
        </div>
      </div>
    );
  }

  const recordedAt = fieldCondition.recorded_at
    ? new Date(fieldCondition.recorded_at).toLocaleString('es-CO', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
    : null;

  return (
    <div className="pd-card sc-animate-fade-up" aria-label="Condiciones actuales del campo">
      <div className="pd-card__header">
        <h2 className="pd-card__title">
          <Thermometer size={15} aria-hidden="true" />
          Condiciones del Campo
        </h2>
        {recordedAt && (
          <span className="pd-card__meta" style={{ fontSize:11 }}>
            {fieldCondition.location_label ? `${fieldCondition.location_label} · ` : ''}
            {recordedAt}
          </span>
        )}
      </div>

      <div className="pd-card__body">
        <div className="pd-conditions-grid">
          <ConditionItem icon={Thermometer} label="Temperatura" value={fieldCondition.temperature_c} unit="°C" />
          <ConditionItem icon={Droplets}    label="Humedad"     value={fieldCondition.humidity_pct}  unit="%" />
          <ConditionItem icon={Wind}        label="Viento"
            value={fieldCondition.wind_speed_kmh !== null
              ? `${fieldCondition.wind_speed_kmh}${fieldCondition.wind_direction ? ` ${fieldCondition.wind_direction}` : ''}`
              : null}
            unit=" km/h"
          />
          <ConditionItem icon={CloudRain}   label="Precipitación"  value={fieldCondition.precipitation_mm} unit=" mm" />
          <ConditionItem icon={Layers}      label="H. Suelo"       value={fieldCondition.soil_moisture_pct} unit="%" />
          <ConditionItem icon={FlaskConical} label="pH Suelo"      value={fieldCondition.soil_ph} />
        </div>
      </div>
    </div>
  );
}
