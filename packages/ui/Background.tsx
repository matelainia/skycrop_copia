import React from 'react';

interface BackgroundProps {
  children?: React.ReactNode;
  className?: string;
}

export function Background({ children, className = '' }: BackgroundProps) {
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      minHeight: '100vh',
      overflow: 'hidden',
      backgroundColor: 'var(--bg-app)',
      transition: 'background-color 0.3s'
    }} className={className}>
      
      {/* Círculos y destellos difuminados */}
      <div style={{
        position: 'absolute',
        top: '-20%',
        left: '-10%',
        width: '60vw',
        height: '60vw',
        borderRadius: '50%',
        background: 'rgba(21, 128, 61, 0.08)',
        filter: 'blur(100px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      <div style={{
        position: 'absolute',
        bottom: '-20%',
        right: '-10%',
        width: '50vw',
        height: '50vw',
        borderRadius: '50%',
        background: 'rgba(217, 119, 6, 0.06)',
        filter: 'blur(80px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      <div style={{
        position: 'absolute',
        top: '40%',
        left: '50%',
        width: '30vw',
        height: '30vw',
        borderRadius: '50%',
        background: 'rgba(29, 78, 216, 0.04)',
        filter: 'blur(120px)',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', minHeight: '100vh' }}>
        {children}
      </div>
    </div>
  );
}
