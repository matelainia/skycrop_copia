import React from 'react';

interface TypographyProps {
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'caption';
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export function Typography({ variant = 'body', children, style, className = '' }: TypographyProps) {
  switch (variant) {
    case 'h1':
      return <h1 className={`sky-title ${className}`} style={{ fontSize: '28px', ...style }}>{children}</h1>;
    case 'h2':
      return <h2 className={`sky-title ${className}`} style={{ fontSize: '22px', ...style }}>{children}</h2>;
    case 'h3':
      return <h3 className={`sky-title ${className}`} style={{ fontSize: '18px', ...style }}>{children}</h3>;
    case 'caption':
      return <span className={`sky-subtitle ${className}`} style={{ fontSize: '12px', opacity: 0.8, ...style }}>{children}</span>;
    case 'body':
    default:
      return <p className={`sky-subtitle ${className}`} style={{ fontSize: '14px', ...style }}>{children}</p>;
  }
}
