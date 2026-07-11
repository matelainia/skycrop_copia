
import MachineIcon from './MachineIcon';

export const MachineAvatar = ({ photoUrl, name, type, size = 40 }) => {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={{ 
          width: `${size}px`, 
          height: `${size}px`, 
          borderRadius: '8px', 
          objectFit: 'cover', 
          border: '1px solid var(--border-color)' 
        }}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    );
  }

  return <MachineIcon type={type} size={size * 0.4} />;
};

export default MachineAvatar;
