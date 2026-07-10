import React from 'react';

export default function StatusBadge({ status, className, style }) {
  let badgeClass = className || 'badge-blue';
  if (!className && status) {
    switch (status) {
      case 'Activa':
      case 'Completada':
      case 'Completado':
        badgeClass = 'badge-green';
        break;
      case 'On Leave':
      case 'En Curso':
      case 'Procesando':
        badgeClass = 'badge-yellow';
        break;
      case 'Inactivo':
      case 'Vencida':
      case 'Fallido':
        badgeClass = 'badge-red';
        break;
      default:
        badgeClass = 'badge-blue';
    }
  }

  return (
    <span className={`badge ${badgeClass}`} style={style}>
      {status === 'Vencida' ? 'Certificación Vencida' : status}
    </span>
  );
}
