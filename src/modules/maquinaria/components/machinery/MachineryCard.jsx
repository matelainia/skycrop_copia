
import MachineAvatar from './MachineAvatar';
import MachineStatusBadge from './MachineStatusBadge';
import { getMachineIconColor } from '../../utils/statusHelpers';

export const MachineryCard = ({ machine, onClick }) => {
  const { colorClass } = getMachineIconColor(machine.type);
  
  return (
    <div 
      className="glass-card" 
      onClick={() => onClick(machine.id)}
      style={{ 
        padding: '16px', 
        cursor: 'pointer',
        borderLeft: `3px solid ${colorClass}`
      }}
    >
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '10px' }}>
        <MachineAvatar photoUrl={machine.photoUrl} name={machine.name} type={machine.type} size={48} />
        <div>
          <h4 style={{ fontWeight: '700', fontSize: '14px', margin: 0 }}>{machine.name}</h4>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{machine.codigoId}</span>
        </div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginTop: '12px' }}>
        <span>Horómetro: <strong>{machine.hoursOfOperation} h</strong></span>
        <MachineStatusBadge status={machine.status} />
      </div>
    </div>
  );
};

export default MachineryCard;
