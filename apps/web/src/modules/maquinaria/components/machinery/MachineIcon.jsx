
import { getMachineIconColor, renderMachineIcon } from '../../utils/statusHelpers';

export const MachineIcon = ({ type, size = 16 }) => {
  const { colorClass, bgClass } = getMachineIconColor(type);
  
  return (
    <div style={{
      width: '28px',
      height: '28px',
      borderRadius: '6px',
      background: bgClass,
      color: colorClass,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }}>
      {renderMachineIcon(type, size)}
    </div>
  );
};

export default MachineIcon;
