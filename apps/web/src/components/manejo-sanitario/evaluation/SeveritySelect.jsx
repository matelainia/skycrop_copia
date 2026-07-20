import React, { useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

/** Paleta de colores por nivel de severidad */
const SEVERITY_OPTIONS = [
  { value: 'absent',   label: 'Ausente',   dot: '#94a3b8', num: 0 },
  { value: 'low',      label: 'Bajo',      dot: '#22c55e', num: 1 },
  { value: 'moderate', label: 'Moderado',  dot: '#f59e0b', num: 2 },
  { value: 'high',     label: 'Alto',      dot: '#f97316', num: 3 },
  { value: 'severe',   label: 'Severo',    dot: '#ef4444', num: 4 },
];

/**
 * SeveritySelect
 * Dropdown elegante de selección de severidad con punto de color.
 *
 * @param {{ value: string, onChange: (value:string) => void, disabled?: boolean }} props
 */
const SeveritySelect = ({ value, onChange, disabled = false, scaleOptions = null }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Permitir escala personalizada (del protocolo) o la paleta por defecto
  const options = scaleOptions
    ? scaleOptions.map((label, i) => ({ value: String(i), label, dot: SEVERITY_OPTIONS[Math.min(i, 4)]?.dot ?? '#94a3b8', num: i }))
    : SEVERITY_OPTIONS;

  const selected = options.find(o => o.value === value) || options[0];

  const handleSelect = (option) => {
    onChange(option.value);
    setOpen(false);
  };

  // Cerrar al hacer click fuera
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="severity-select-wrapper" ref={ref}>
      <button
        type="button"
        className={`severity-select-trigger ${open ? 'open' : ''}`}
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className="severity-dot"
          style={{ background: selected.dot, boxShadow: `0 0 0 3px ${selected.dot}22` }}
        />
        <span style={{ flex: 1, textAlign: 'left' }}>
          {selected.num !== undefined && scaleOptions ? (
            <span style={{ marginRight: 4, fontWeight: 700, color: selected.dot }}>{selected.num}</span>
          ) : null}
          {selected.label}
        </span>
        <ChevronDown
          size={14}
          className={`severity-chevron ${open ? 'open' : ''}`}
        />
      </button>

      {open && (
        <div className="severity-dropdown" role="listbox">
          {options.map(option => (
            <div
              key={option.value}
              className={`severity-option ${value === option.value ? 'selected' : ''}`}
              role="option"
              aria-selected={value === option.value}
              onClick={() => handleSelect(option)}
            >
              <span
                className="severity-dot"
                style={{ background: option.dot, boxShadow: `0 0 0 3px ${option.dot}22` }}
              />
              {option.num !== undefined && scaleOptions && (
                <span style={{ fontWeight: 700, color: option.dot, fontSize: 12 }}>{option.num}</span>
              )}
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SeveritySelect;
