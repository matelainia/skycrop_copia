import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Scale, ArrowLeftRight } from 'lucide-react';
import LeafLoader from '../../../LeafLoader.jsx';

const FILTERS = [
  { id: '', label: 'Todos' },
  { id: 'entrada', label: 'Entradas' },
  { id: 'salida', label: 'Salidas' },
  { id: 'ajuste', label: 'Ajustes' },
  { id: 'transferencia', label: 'Transferencias' },
];

const META = {
  entrada: { label: 'Entrada', icon: ArrowUpRight, color: 'var(--primary)' },
  salida: { label: 'Salida', icon: ArrowDownRight, color: 'var(--accent-red, #dc2626)' },
  ajuste: { label: 'Ajuste', icon: Scale, color: '#7c3aed' },
  transferencia: { label: 'Transferencia', icon: ArrowLeftRight, color: '#2563eb' },
};

// Feed global de movimientos (Kardex). Filtro por tipo, orden server desc.
export default function MovementsFeed({ movements = [], loading = false, itemNameOf, warehouseNameOf }) {
  const [filter, setFilter] = useState('');

  if (loading) return <LeafLoader size={64} text="Cargando movimientos..." />;

  const list = filter ? movements.filter((m) => m.tipo === filter) : movements;

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`btn ${filter === f.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '12px', padding: '6px 12px' }}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px', textAlign: 'center' }}>
          Sin movimientos para este filtro.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {list.slice(0, 100).map((m) => {
            const meta = META[m.tipo] || META.ajuste;
            const Icon = meta.icon;
            return (
              <div key={m.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 4px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'var(--primary-light)', color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} />
                </span>
                <div style={{ minWidth: 0, flexGrow: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {meta.label} · {itemNameOf ? itemNameOf(m.itemId) : m.itemId}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {[warehouseNameOf ? warehouseNameOf(m.warehouseId) : null,
                      m.createdAt ? new Date(m.createdAt).toLocaleString('es-EC') : null,
                      m.motivo || null].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span style={{ fontSize: '13px', fontWeight: '800', color: meta.color, flexShrink: 0 }}>
                  {m.tipo === 'salida' ? '−' : '+'}{m.cantidad}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
