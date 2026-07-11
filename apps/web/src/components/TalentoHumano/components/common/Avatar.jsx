import React from 'react';
import { getInitials } from '../../utils/workerHelpers';

export default function Avatar({ worker, size = 36 }) {
  const style = { 
    width: size, 
    height: size, 
    borderRadius: '50%', 
    flexShrink: 0, 
    fontSize: size * 0.36, 
    fontWeight: 700 
  };
  
  if (worker && worker.foto) {
    return <img src={worker.foto} alt="" className="worker-avatar" style={style} />;
  }
  
  return (
    <div className="worker-avatar-placeholder" style={style}>
      {getInitials(worker)}
    </div>
  );
}
