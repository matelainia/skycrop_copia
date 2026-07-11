
import {
  Tractor,
  Settings,
  Activity,
  Droplet,
  Cpu,
  Wrench,
  Truck
} from 'lucide-react';

/**
 * Visual styling and HTML badge generation matching monolito styling
 */

export const getMachineIconColor = (type) => {
  switch (type) {
    case 'Tractor':
      return { colorClass: '#15803d', bgClass: '#dcfce7' };
    case 'Cosechadora':
      return { colorClass: '#b91c1c', bgClass: '#fee2e2' };
    case 'Sembradora':
      return { colorClass: '#c2410c', bgClass: '#ffedd5' };
    case 'Atomizador':
    case 'Pulverizadora':
      return { colorClass: '#0369a1', bgClass: '#e0f2fe' };
    case 'Dron':
      return { colorClass: '#0e7490', bgClass: '#ecfeff' };
    case 'Riego':
      return { colorClass: '#4338ca', bgClass: '#e0e7ff' };
    default:
      return { colorClass: '#4b5563', bgClass: '#f3f4f6' };
  }
};

export const renderMachineIcon = (type, size = 16) => {
  switch (type) {
    case 'Tractor': return <Tractor size={size} />;
    case 'Cosechadora': return <Settings size={size} />;
    case 'Sembradora': return <Activity size={size} />;
    case 'Atomizador':
    case 'Pulverizadora': return <Droplet size={size} />;
    case 'Dron': return <Cpu size={size} />;
    case 'Riego': return <Wrench size={size} />;
    default: return <Truck size={size} />;
  }
};

export const getStatusBadgeStyle = (status) => {
  switch (status) {
    case 'Operando':
      return {
        className: 'badge badge-green',
        dotColor: '#16a34a'
      };
    case 'Disponible':
      return {
        className: 'badge badge-blue',
        dotColor: '#2563eb'
      };
    case 'En mantenimiento':
      return {
        className: 'badge badge-yellow',
        dotColor: '#ea580c'
      };
    case 'Fuera de servicio':
      return {
        className: 'badge badge-red',
        dotColor: '#dc2626'
      };
    default:
      return {
        className: 'badge',
        dotColor: '#4b5563'
      };
  }
};
