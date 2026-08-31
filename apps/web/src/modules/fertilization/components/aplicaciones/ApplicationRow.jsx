import { memo, useState } from 'react';
import { Sprout, Leaf } from 'lucide-react';
import { PhenologyBadgeFert, ApplicationStatusBadge } from './AplicacionBadges.jsx';
import ApplicationActions from './ApplicationActions.jsx';
import { getMethodLabel } from '../../types/aplicaciones.types.js';

const METHOD_ICON = {
  edafica: Sprout,
  foliar: Leaf,
};

function FertilizersCell({ fertilizantes }) {
  const [showAll, setShowAll] = useState(false);
  if (!fertilizantes || fertilizantes.length === 0) {
    return <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>;
  }
  const visible = showAll ? fertilizantes : fertilizantes.slice(0, 2);
  const remaining = fertilizantes.length - 2;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {visible.map((f, i) => (
        <span key={i} style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3 }}>{f}</span>
      ))}
      {remaining > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            background: 'none', border: 'none', padding: 0,
            fontSize: 12, color: 'var(--primary)', cursor: 'pointer',
            textAlign: 'left', fontWeight: 600,
          }}
          aria-label={`Mostrar ${remaining} fertilizantes más`}
          title={fertilizantes.slice(2).join(', ')}
        >
          + {remaining} más
        </button>
      )}
      {showAll && remaining > 0 && (
        <button
          onClick={() => setShowAll(false)}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', textAlign: 'left' }}
        >
          Mostrar menos
        </button>
      )}
    </div>
  );
}

function NutrientesCell({ nutrientes }) {
  if (!nutrientes || typeof nutrientes !== 'object' || Object.keys(nutrientes).length === 0) {
    return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>;
  }
  // Mostrar solo nutrientes con valor (no 0 artificial salvo que exista)
  const entries = Object.entries(nutrientes).filter(([, v]) => v !== null && v !== undefined && !isNaN(Number(v)));
  if (entries.length === 0) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>;

  // Orden preferido: N, P, K, Ca, Mg, S, etc.
  const order = ['N', 'P2O5', 'P', 'K2O', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Zn', 'B', 'Mn'];
  entries.sort((a, b) => {
    const ia = order.indexOf(a[0]);
    const ib = order.indexOf(b[0]);
    if (ia === -1 && ib === -1) return a[0].localeCompare(b[0]);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {entries.slice(0, 5).map(([k, v]) => (
        <span key={k} style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>
          {k}: {Number(v).toFixed(1)} kg
        </span>
      ))}
      {entries.length > 5 && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }} title={entries.slice(5).map(([k, v]) => `${k}: ${Number(v).toFixed(1)} kg`).join(', ')}>
          + {entries.length - 5} más
        </span>
      )}
    </div>
  );
}

function MethodCell({ metodo, metodoLabel }) {
  const normalized = (metodo || '').toLowerCase();
  let Icon = null;
  if (normalized.includes('edafica') || normalized.includes('suelo') || normalized.includes('edáfica')) Icon = METHOD_ICON.edafica;
  else if (normalized.includes('foliar')) Icon = METHOD_ICON.foliar;
  const label = metodoLabel || getMethodLabel(metodo) || '—';
  if (label === '—') return <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)' }}>
      {Icon && <Icon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-hidden="true" />}
      {label}
    </span>
  );
}

const ApplicationRow = memo(function ApplicationRow({ aplicacion, onAction }) {
  const hasLote = aplicacion.loteNombre && aplicacion.loteNombre !== '—';
  return (
    <tr className="app-table__row">
      <td className="app-table__td" data-label="Fecha">
        <span style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', fontWeight: 500 }}>
          {aplicacion.fechaFormatted}
        </span>
      </td>
      <td className="app-table__td" data-label="Lote / Sector">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            {aplicacion.loteNombre}
          </span>
          {aplicacion.sectorNombre && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{aplicacion.sectorNombre}</span>
          )}
        </div>
      </td>
      <td className="app-table__td" data-label="Cultivo">
        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
          {aplicacion.cultivo}
        </span>
      </td>
      <td className="app-table__td" data-label="Fase Fenológica">
        <PhenologyBadgeFert phase={aplicacion.faseFenologica} />
      </td>
      <td className="app-table__td" data-label="Fertilizantes Aplicados">
        <FertilizersCell fertilizantes={aplicacion.fertilizantes} />
      </td>
      <td className="app-table__td" data-label="Método">
        <MethodCell metodo={aplicacion.metodo} metodoLabel={aplicacion.metodoLabel} />
      </td>
      <td className="app-table__td" data-label="Nutrientes">
        <NutrientesCell nutrientes={aplicacion.nutrientes} />
      </td>
      <td className="app-table__td" data-label="Estado">
        <ApplicationStatusBadge status={aplicacion.estado} label={aplicacion.estadoLabel} />
      </td>
      <td className="app-table__td app-table__td--actions" data-label="Acciones">
        <ApplicationActions aplicacion={aplicacion} onAction={onAction} />
      </td>
    </tr>
  );
});

export default ApplicationRow;
