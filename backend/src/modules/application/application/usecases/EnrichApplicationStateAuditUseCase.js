export class EnrichApplicationStateAuditUseCase {
  constructor(auditRepository) {
    this.auditRepository = auditRepository;
  }

  async execute(applicationId, ipAddress, userAgent) {
    try {
      await this.auditRepository.completeStateAudit(applicationId, ipAddress, userAgent);
      return true;
    } catch (err) {
      // Mantener política legacy: No bloquear al cliente, enriquecimiento no bloqueante
      console.warn(
        `[EnrichApplicationStateAuditUseCase] Falló enriquecimiento de auditoría (operación continuará): ${err.message}`
      );
      return false;
    }
  }
}

export default EnrichApplicationStateAuditUseCase;
