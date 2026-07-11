import React from 'react';
import { Sprout } from 'lucide-react';

interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export function Logo({ size = 24, className = '', showText = true }: LogoProps) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }} className={className}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--primary-light, rgba(21, 128, 61, 0.1))',
        border: '1px solid var(--primary-border, rgba(21, 128, 61, 0.25))',
        borderRadius: '10px',
        padding: '6px'
      }}>
        <Sprout size={size} style={{ color: 'var(--primary, #15803d)' }} />
      </div>
      {showText && (
        <span style={{ 
          fontFamily: 'var(--font-display, Outfit, sans-serif)', 
          fontWeight: 800, 
          fontSize: `${size * 0.9}px`,
          letterSpacing: '-0.03em',
          color: 'var(--text-primary)'
        }}>
          SkyCrop
        </span>
      )}
    </div>
  );
}
