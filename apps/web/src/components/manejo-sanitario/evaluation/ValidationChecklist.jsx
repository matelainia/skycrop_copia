import React from 'react';
import { Check } from 'lucide-react';

/**
 * ValidationChecklist
 * Lista de validaciones con checkmarks y estados.
 *
 * @param {{ items: Array<{ label: string, done: boolean }> }} props
 */
const ValidationChecklist = ({ items = [] }) => {
  return (
    <div className="eval-checklist">
      {items.map((item, idx) => (
        <div key={idx} className="eval-check-item">
          <div className={`eval-check-icon ${item.done ? 'done' : 'pending'}`}>
            {item.done
              ? <Check size={10} strokeWidth={3} />
              : <span style={{ fontSize: 9, fontWeight: 700 }}>○</span>
            }
          </div>
          <span style={{
            color: item.done ? 'var(--text-secondary)' : 'var(--text-muted)',
            textDecoration: item.done ? 'none' : 'none',
            fontWeight: item.done ? 500 : 400
          }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
};

export default ValidationChecklist;
