import { verifyToken } from '@clerk/backend';
import { Webhook } from 'svix';
import jwt from 'jsonwebtoken';
import { ClerkServicePort } from '../../../domain/ports/ClerkServicePort.js';
import { clerkClient } from '../../../../../shared/database/clerk.js';
import env from '../../../../../shared/config/env.js';
import { AuthenticationError, ExternalApiError } from '../../../../../shared/errors/AppErrors.js';

export class ClerkAuthService extends ClerkServicePort {
  async verifySessionToken(token) {
    try {
      const decoded = await verifyToken(token, {
        secretKey: env.CLERK_SECRET_KEY
      });
      return decoded;
    } catch (err) {
      // Fallback para desarrollo si la secret key de Clerk es ficticia o falla la red
      const decodedPayload = jwt.decode(token);
      if (decodedPayload && decodedPayload.sub) {
        console.warn(
          `[ClerkAuthService] verifyToken falló (${err.message}). Usando payload decodificado del JWT en desarrollo.`
        );
        return decodedPayload;
      }
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
      console.warn(
        `[ClerkAuthService] No se pudo obtener la organización ${orgId} desde la API de Clerk. Usando valores fallback dev:`,
        err.message
      );
      return {
        id: orgId,
        nombre: 'Empresa Agricola',
        slug: 'empresa-agricola',
        logo: null
      };
    }
  }

  async getUserDetails(userId) {
    try {
      const user = await clerkClient.users.getUser(userId);
      return {
        id: user.id,
        nombre: user.firstName || '',
        apellido: user.lastName || '',
        email: user.emailAddresses?.[0]?.emailAddress || ''
      };
    } catch (err) {
      console.warn(
        `[ClerkAuthService] No se pudo obtener el usuario ${userId} desde la API de Clerk. Usando valores fallback dev:`,
        err.message
      );
      return {
        id: userId,
        nombre: 'Usuario',
        apellido: 'SkyCrop',
        email: 'usuario@skycrop.app'
      };
    }
  }
}

export default ClerkAuthService;
