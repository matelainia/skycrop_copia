import { subscribe } from '../events/machinery.events';

/**
 * Listeners for audit-related events
 */
export const registerAuditListeners = () => {
  // Example listener reacting to log creation
  const unsub = subscribe('AuditLogged', (entry) => {
    console.log(`[Audit Logged] ${entry.usuario} executed: ${entry.accion}`);
  });
  
  return unsub;
};
