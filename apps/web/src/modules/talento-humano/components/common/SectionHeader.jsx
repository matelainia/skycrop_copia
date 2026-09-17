import React from 'react';

export default function SectionHeader({ title, children, style }) {
  return (
    <div className="section-header-row" style={style}>
      {title && <h3>{title}</h3>}
      {children && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{children}</div>}
    </div>
  );
}
