

export const HoursChart = () => {
  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700' }}>HORAS TRABAJADAS (7 DÍAS)</h3>
        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)' }}>124.5 h</span>
      </div>
      <svg viewBox="0 0 300 120" style={{ width: '100%', height: '100px' }}>
        {/* Grid Lines */}
        <line x1="20" y1="20" x2="280" y2="20" stroke="var(--border-color)" strokeWidth="0.5" />
        <line x1="20" y1="50" x2="280" y2="50" stroke="var(--border-color)" strokeWidth="0.5" />
        <line x1="20" y1="80" x2="280" y2="80" stroke="var(--border-color)" strokeWidth="0.5" />
        <line x1="20" y1="100" x2="280" y2="100" stroke="var(--text-muted)" strokeWidth="1" />

        {/* Trend line */}
        <path
          d="M20,95 L63,60 L106,75 L149,70 L192,62 L235,68 L278,35"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Area under trend */}
        <path
          d="M20,95 L63,60 L106,75 L149,70 L192,62 L235,68 L278,35 L278,100 L20,100 Z"
          fill="rgba(16, 185, 129, 0.08)"
        />

        {/* Points */}
        <circle cx="20" cy="95" r="4" fill="var(--primary)" />
        <circle cx="63" cy="60" r="4" fill="var(--primary)" />
        <circle cx="106" cy="75" r="4" fill="var(--primary)" />
        <circle cx="149" cy="70" r="4" fill="var(--primary)" />
        <circle cx="192" cy="62" r="4" fill="var(--primary)" />
        <circle cx="235" cy="68" r="4" fill="var(--primary)" />
        <circle cx="278" cy="35" r="4" fill="var(--primary)" />

        {/* X labels */}
        <text x="20" y="112" fontSize="8" textAnchor="middle" fill="var(--text-muted)">20 may</text>
        <text x="106" y="112" fontSize="8" textAnchor="middle" fill="var(--text-muted)">22 may</text>
        <text x="192" y="112" fontSize="8" textAnchor="middle" fill="var(--text-muted)">24 may</text>
        <text x="278" y="112" fontSize="8" textAnchor="middle" fill="var(--text-muted)">26 may</text>
      </svg>
    </div>
  );
};

export default HoursChart;
