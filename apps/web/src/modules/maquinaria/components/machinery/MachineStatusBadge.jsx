
import { getStatusBadgeStyle } from '../../utils/statusHelpers';

export const MachineStatusBadge = ({ status }) => {
  const { className, dotColor } = getStatusBadgeStyle(status);
  
  // Return markup matching original monolito styles
  return (
    <span className={className} style={{ 
      textTransform: 'none', 
      padding: '4px 10px', 
      fontSize: '11px', 
      display: 'inline-flex', 
      alignItems: 'center', 
      gap: '5px' 
    }}>
      <span style={{ 
        width: '6px', 
        height: '6px', 
        borderRadius: '50%', 
        background: dotColor, 
        display: 'inline-block' 
      }} />
      {status === 'En mantenimiento' ? 'Mantenimiento' : status}
    </span>
  );
};

export default MachineStatusBadge;
