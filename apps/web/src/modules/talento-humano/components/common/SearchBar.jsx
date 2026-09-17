import React from 'react';
import { Search } from 'lucide-react';

export default function SearchBar({ value, onChange, placeholder, style }) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <Search 
        size={15} 
        style={{ 
          position: 'absolute', 
          left: '12px', 
          top: '12px', 
          color: 'var(--text-muted)' 
        }} 
      />
      <input 
        type="text" 
        className="input-glass" 
        style={{ width: '100%', paddingLeft: '36px' }}
        placeholder={placeholder}
        value={value} 
        onChange={onChange} 
      />
    </div>
  );
}
