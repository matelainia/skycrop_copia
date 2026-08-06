/**
 * PlanDetailItemsTable.jsx
 * Tabla de insumos programados en el plan de fertilización.
 */
import React from 'react';
import { Sprout } from 'lucide-react';

function AppDots({ done = 0, planned = 1 }) {
  const dots = Array.from({ length: Math.max(planned, 1) }, (_, i) => (
    <span
      key={i}
      className={`pd-apps-dot ${i < done ? 'pd-apps-dot--done' : ''}`}
      aria-hidden="true"
    />
  ));
  return (
    <div className="pd-apps-progress">
      <div className="pd-apps-dots">{dots}</div>
      <span style={{ fontSize:11, color:'var(--pd-secondary)' }}>{done}/{planned}</span>
    </div>
  );
}

export default function PlanDetailItemsTable({ items = [] }) {
  if (items.length === 0) {
    return (
      <section className="pd-card sc-animate-fade-up" aria-label="Insumos del plan">
        <div className="pd-card__header">
          <h2 className="pd-card__title"><Sprout size={15} aria-hidden="true" />Detalle del Plan de Fertilización</h2>
        </div>
        <div className="pd-empty">
          <div className="pd-empty__icon"><Sprout size={22} /></div>
          <span className="pd-empty__title">Sin insumos programados</span>
          <span className="pd-empty__desc">Añade productos al plan para verlos aquí.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="pd-card sc-animate-fade-up" aria-label="Insumos del plan">
      <div className="pd-card__header">
        <h2 className="pd-card__title">
          <Sprout size={15} aria-hidden="true" />
          Detalle del Plan de Fertilización
        </h2>
        <span className="pd-card__meta">{items.length} insumos programados</span>
      </div>

      <div style={{ overflowX:'auto' }}>
        <table className="pd-items-table" aria-label="Tabla de insumos del plan">
          <thead>
            <tr>
              <th scope="col">Producto / Fórmula</th>
              <th scope="col">Tipo</th>
              <th scope="col">Dosis</th>
              <th scope="col">Método</th>
              <th scope="col">Aplicaciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="pd-product-name">{item.product_name}</div>
                  {item.product_formula && (
                    <div className="pd-product-formula">{item.product_formula}</div>
                  )}
                </td>
                <td style={{ fontSize:12, color:'var(--pd-secondary)' }}>
                  {item.item_type || '—'}
                </td>
                <td style={{ fontSize:13 }}>
                  {item.dose_value ? `${item.dose_value} ${item.dose_unit || ''}` : '—'}
                </td>
                <td style={{ fontSize:12, color:'var(--pd-secondary)' }}>
                  {item.application_method || '—'}
                </td>
                <td>
                  <AppDots done={item.applications_done || 0} planned={item.applications_planned || 1} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
