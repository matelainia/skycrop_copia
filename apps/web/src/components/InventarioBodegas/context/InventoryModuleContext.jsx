import React, { createContext, useContext, useState, useCallback } from 'react';

const InventoryModuleContext = createContext(null);

export function InventoryModuleProvider({ children }) {
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null); // { type: 'success'|'error', message: '...' }

  const clearNotification = useCallback(() => {
    setNotification(null);
  }, []);

  const showSuccess = useCallback((message) => {
    setNotification({ type: 'success', message });
    // Auto clear notification after 4 seconds
    setTimeout(() => {
      setNotification(prev => prev && prev.message === message ? null : prev);
    }, 4000);
  }, []);

  const showError = useCallback((message) => {
    setNotification({ type: 'error', message });
    setTimeout(() => {
      setNotification(prev => prev && prev.message === message ? null : prev);
    }, 5000);
  }, []);

  const withFeedback = useCallback(async (asyncFunc, successMessage = null) => {
    setLoading(true);
    clearNotification();
    try {
      const result = await asyncFunc();
      if (successMessage) {
        showSuccess(successMessage);
      }
      return result;
    } catch (err) {
      console.error("Error in module transaction:", err);
      showError(err.message || "Ha ocurrido un error inesperado.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [clearNotification, showSuccess, showError]);

  const value = {
    loading,
    setLoading,
    notification,
    showSuccess,
    showError,
    clearNotification,
    withFeedback
  };

  return (
    <InventoryModuleContext.Provider value={value}>
      {children}
    </InventoryModuleContext.Provider>
  );
}

export function useInventoryModule() {
  const context = useContext(InventoryModuleContext);
  if (!context) {
    throw new Error('useInventoryModule debe usarse dentro de un InventoryModuleProvider');
  }
  return context;
}
