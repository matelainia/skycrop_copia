import React from 'react';

interface GlassContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function GlassContainer({ children, className = '', ...props }: GlassContainerProps) {
  return (
    <div 
      className={`sky-glass-card ${className}`} 
      style={{
        backdropFilter: 'var(--backdrop-blur)',
        WebkitBackdropFilter: 'var(--backdrop-blur)'
      }}
      {...props}
    >
      {children}
    </div>
  );
}
