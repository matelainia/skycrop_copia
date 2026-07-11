import React from 'react';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  text?: string;
}

export function Loading({ size = 'md', showText = false, text = 'Cargando...' }: LoadingProps) {
  const spinnerSize = size === 'sm' ? '16px' : size === 'lg' ? '40px' : '24px';
  const borderWidth = size === 'sm' ? '2px' : '3px';

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div 
        className="sky-loading-spinner"
        style={{ width: spinnerSize, height: spinnerSize, borderWidth }}
      />
      {showText && (
        <span style={{ 
          fontSize: '13px', 
          fontWeight: 500, 
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-sans)'
        }}>
          {text}
        </span>
      )}
    </div>
  );
}
