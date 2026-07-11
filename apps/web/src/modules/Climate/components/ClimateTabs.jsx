import { useClimateContext } from '../context/ClimateContext';

export default function ClimateTabs() {
  const { activeTab, setActiveTab } = useClimateContext();

  const tabs = [
    { id: 'temperatura', label: 'Temperatura' },
    { id: 'precipitación', label: 'Precipitaciones' },
    { id: 'humedad', label: 'Humedad' },
    { id: 'viento', label: 'Viento' }
  ];

  return (
    <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '15px' }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: isActive ? '700' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'var(--font-sans)'
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
