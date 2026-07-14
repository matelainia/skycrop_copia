export class ConfirmHighToxicityAuditUseCase {
  constructor(auditRepository) {
    this.auditRepository = auditRepository;
  }

  async execute(confirmation) {
    return await this.auditRepository.saveHighToxicityConfirmation(confirmation);
  }
}

export default ConfirmHighToxicityAuditUseCase;
