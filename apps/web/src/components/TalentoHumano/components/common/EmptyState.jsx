import React from 'react';

export default function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="empty-state">
      {Icon && (
        <div className="empty-state-icon">
          <Icon size={28} />
        </div>
      )}
      {title && <h4>{title}</h4>}
      {description && <p>{description}</p>}
    </div>
  );
}
