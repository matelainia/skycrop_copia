
import { Search } from 'lucide-react';

export const FleetFilters = ({
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  setCurrentPage,
  metrics
}) => {
  const tabs = [
    { id: 'Todos', label: 'Todos los Equipos' },
    { id: 'Operando', label: `Operando (${metrics.operatingCount})` },
    { id: 'En Mantenimiento', label: `En Mto. (${metrics.maintenanceCount})` },
    { id: 'Fuera de Servicio', label: `Fuera de Serv. (${metrics.criticalCount})` },
    { id: 'Disponibles', label: `Disponibles (${metrics.availableCount})` }
  ];

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
      {/* Status tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-app)', padding: '3px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setStatusFilter(tab.id); setCurrentPage(1); }}
            style={{
              background: statusFilter === tab.id ? 'var(--primary)' : 'transparent',
              color: statusFilter === tab.id ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              padding: '5px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: statusFilter === tab.id ? 'var(--glow-shadow)' : 'none'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar equipo..."
            className="input-glass"
            style={{ padding: '6px 12px 6px 30px', fontSize: '12px', width: '180px', height: '32px' }}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          />
        </div>
      </div>
    </div>
  );
};

export default FleetFilters;
