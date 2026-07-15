/**
 * Puerto de Salida (Outbound Port) para servicios de Clerk.
 * Desacopla al dominio de la librería @clerk/backend y de Svix.
 */
export class ClerkServicePort {
  async verifySessionToken(token) {
    throw new Error('Método no implementado');
  }

  async verifyWebhookSignature(payload, headers) {
    throw new Error('Método no implementado');
  }

  async getOrganizationDetails(orgId) {
    throw new Error('Método no implementado');
  }

  async getUserDetails(userId) {
    throw new Error('Método no implementado');
  }
}

export default ClerkServicePort;
