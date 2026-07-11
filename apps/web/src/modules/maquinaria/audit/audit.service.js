import { emit } from '../events/machinery.events';

/**
 * Decoupled Auditing Service
 */
class AuditService {
  constructor() {
    this.storageKey = 'skycrop_auditorias_maquinaria';
  }

  /**
   * Log an audit event
   * @param {Object} params
   * @param {string} params.action - Action name (e.g. 'CREATE_MACHINE', 'START_LABOR')
   * @param {string} params.description - Human-readable description
   * @param {Object} [params.previousValues] - Previous state of modified record
   * @param {Object} [params.newValues] - New state of modified record
   * @param {string} [params.user] - User performing the action
   * @param {string} [params.empresaId] - Multi-tenant enterprise reference
   */
  log({
    action,
    description,
    previousValues = null,
    newValues = null,
    user = 'Andrés Castro',
    empresaId = 'Empresa Demo'
  }) {
    const auditEntry = {
      id: `aud-mach-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      fecha: new Date().toISOString(),
      usuario: user,
      empresa: empresaId,
      accion: description,
      actionType: action,
      valoresAnteriores: previousValues,
      valoresNuevos: newValues
    };

    // Store locally in localStorage for persistence, mimicking original module audit style
    try {
      const existing = this.getLogs();
      const updated = [auditEntry, ...existing];
      localStorage.setItem(this.storageKey, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to persist audit log:', err);
    }

    // Emit event on internal bus so other domains can trigger actions
    emit('AuditLogged', auditEntry);

    return auditEntry;
  }

  /**
   * Retrieve all audit logs from storage
   */
  getLogs() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.error('Failed to parse audit logs:', err);
      return [];
    }
  }

  /**
   * Clear all audit logs
   */
  clearLogs() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (err) {
      console.error('Failed to clear audit logs:', err);
    }
  }
}

export const audit = new AuditService();
export default audit;
export const logAudit = (description, action, prev = null, next = null) => {
  return audit.log({
    action,
    description,
    previousValues: prev,
    newValues: next
  });
};
