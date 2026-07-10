import React, { useEffect } from 'react';
import { X, CheckCircle, AlertOctagon } from 'lucide-react';
import { useInventoryModule } from '../../context/InventoryModuleContext';

export default function ToastNotification() {
  const { notification, clearNotification } = useInventoryModule();

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        clearNotification();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification, clearNotification]);

  if (!notification) return null;

  const isSuccess = notification.type === 'success';

  const toastStyle = {
    position: 'fixed',
    top: '24px',
    right: '24px',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    borderRadius: '12px',
    background: 'rgba(30, 41, 59, 0.85)',
    backdropFilter: 'blur(12px)',
    border: isSuccess ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
    color: '#f8fafc',
    animation: 'slideIn 0.3s ease-out',
    maxWidth: '400px',
  };

  const iconStyle = {
    color: isSuccess ? '#10b981' : '#ef4444',
    flexShrink: 0
  };

  return (
    <div style={toastStyle}>
      {isSuccess ? <CheckCircle size={20} style={iconStyle} /> : <AlertOctagon size={20} style={iconStyle} />}
      <div style={{ fontSize: '14px', fontWeight: '500', flexGrow: 1 }}>
        {notification.message}
      </div>
      <button 
        onClick={clearNotification}
        style={{
          background: 'none',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#f1f5f9'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
