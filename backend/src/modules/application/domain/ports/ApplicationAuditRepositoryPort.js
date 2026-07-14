/**
 * Puerto de Salida (Outbound Port) para el Repositorio de Auditoría de Aplicaciones.
 */
export class ApplicationAuditRepositoryPort {
  /**
   * Registra la aceptación de responsabilidad de un usuario al recetar ingredientes de alta toxicidad.
   */
  async saveHighToxicityConfirmation(confirmation) {
    throw new Error('Método no implementado');
  }

  /**
   * Enriquece la auditoría de estado de aplicación agregando IP de cliente y agente de usuario.
   */
  async completeStateAudit(applicationId, ipAddress, userAgent) {
    throw new Error('Método no implementado');
  }
}

export default ApplicationAuditRepositoryPort;
