import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="sky-input-group">
      {label && <label className="sky-label">{label}</label>}
      <input
        className={`sky-input ${className}`}
        {...props}
      />
      {error && <span style={{ color: 'var(--accent-red)', fontSize: '11px', fontWeight: '500', marginTop: '2px' }}>{error}</span>}
    </div>
  );
}
