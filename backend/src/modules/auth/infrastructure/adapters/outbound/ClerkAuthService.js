import { verifyToken } from '@clerk/backend';
import { Webhook } from 'svix';
import { ClerkServicePort } from '../../../domain/ports/ClerkServicePort.js';
import { clerkClient } from '../../../../shared/database/clerk.js';
import env from '../../../../shared/config/env.js';
import { AuthenticationError, ExternalApiError } from '../../../../shared/errors/AppErrors.js';

export class ClerkAuthService extends ClerkServicePort {
  async verifySessionToken(token) {
    try {
      const decoded = await verifyToken(token, {
        secretKey: env.CLERK_SECRET_KEY
      });
      return decoded;
    } catch (err) {
      throw new AuthenticationError(`Token de Clerk inválido o expirado: ${err.message}`);
    }
  }

  async verifyWebhookSignature(payloadBuffer, headers) {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('CLERK_WEBHOOK_SECRET no está configurada en las variables de entorno.');
    }

    try {
      const wh = new Webhook(webhookSecret);
      // Svix requiere el buffer de body crudo convertido a string
      const payloadStr = payloadBuffer.toString();
      const evt = wh.verify(payloadStr, headers);
      return evt;
    } catch (err) {
      throw new AuthenticationError(`Firma de webhook de Clerk no válida: ${err.message}`);
    }
  }

  async getOrganizationDetails(orgId) {
    try {
      const org = await clerkClient.organizations.getOrganization({ organizationId: orgId });
      return {
        id: org.id,
        nombre: org.name,
        slug: org.slug || null,
        logo: org.imageUrl || org.logoUrl || null
      };
    } catch (err) {
      throw new ExternalApiError(
        `Error al consultar detalles de la organización ${orgId} en Clerk`,
        'ClerkAPI',
        err
      );
    }
  }
}

export default ClerkAuthService;
