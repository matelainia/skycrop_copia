import React from 'react';

export default function FilterBar({ children, className, style }) {
  return (
    <div className={`filter-bar ${className || ''}`} style={style}>
      {children}
    </div>
  );
}
