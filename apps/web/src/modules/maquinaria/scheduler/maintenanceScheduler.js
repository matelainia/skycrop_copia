/**
 * Maintenance Scheduler for preventive fleet servicing alerts
 */
export class MaintenanceScheduler {
  /**
   * Evaluate a list of machines and return active warnings
   * @param {Array} machinery - List of machines
   */
  getAlerts(machinery = []) {
    const critical = [];
    const warning = [];
    const outOfService = [];

    machinery.forEach(m => {
      const hoursLeft = Number(m.nextMaintenanceHours) || 0;
      
      if (m.status === 'Fuera de servicio') {
        outOfService.push({
          machine: m,
          reason: 'Inspección técnica o reparación correctiva requerida.'
        });
      } else if (hoursLeft <= 20) {
        critical.push({
          machine: m,
          hoursLeft,
          level: 'CRITICAL',
          message: `Mantenimiento Crítico Requerido: ${m.codigoId}. Límite programado excedido o a punto de vencer.`
        });
      } else if (hoursLeft <= 100) {
        warning.push({
          machine: m,
          hoursLeft,
          level: 'WARNING',
          message: `Mantenimiento Próximo: ${m.codigoId}. Rutina de servicio preventiva recomendada.`
        });
      }
    });

    return {
      critical,
      warning,
      outOfService,
      hasAlerts: critical.length > 0 || warning.length > 0 || outOfService.length > 0
    };
  }

  /**
   * Check if a specific machine needs service
   */
  needsImmediateService(machine) {
    if (!machine) return false;
    return machine.status === 'Fuera de servicio' || (Number(machine.nextMaintenanceHours) || 0) <= 20;
  }
}

export const maintenanceScheduler = new MaintenanceScheduler();
export default maintenanceScheduler;
