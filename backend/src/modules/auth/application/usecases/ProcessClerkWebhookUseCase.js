import cacheService from '../../../../shared/cache/cache.service.js';

export class ProcessClerkWebhookUseCase {
  constructor(authRepository, clerkService) {
    this.authRepository = authRepository;
    this.clerkService = clerkService;
  }

  async execute(payloadBuffer, headers) {
    // 1. Verificar firma del Webhook
    const evt = await this.clerkService.verifyWebhookSignature(payloadBuffer, headers);
    const eventType = evt.type;

    console.log(`[ProcessClerkWebhookUseCase] Processing event: ${eventType}`);

    // --- 1. SINCRONIZACIÓN DE USUARIOS (CACHE DE PERFILES) ---
    if (eventType === 'user.created' || eventType === 'user.updated') {
      const { id: userId, email_addresses, first_name, last_name } = evt.data;
      const email = email_addresses?.[0]?.email_address || '';

      await this.authRepository.saveUserProfile({
        id: userId,
        email,
        nombre: first_name || '',
        apellido: last_name || ''
      });
    } else if (eventType === 'user.deleted') {
      const { id: userId } = evt.data;
      await this.authRepository.deleteUserProfile(userId);
    }

    // --- 2. SINCRONIZACIÓN DE ORGANIZACIONES (COMPANIES) ---
    else if (eventType === 'organization.created' || eventType === 'organization.updated') {
      const { id: orgId, name, slug, image_url, logo_url } = evt.data;
      const logo = image_url || logo_url || null;

      await this.authRepository.saveCompany({
        id: orgId,
        nombre: name,
        slug: slug || null,
        logo,
        estado: 'active'
      });
    } else if (eventType === 'organization.deleted') {
      const { id: orgId } = evt.data;
      await this.authRepository.disableCompany(orgId);
    }

    // --- 3. SINCRONIZACIÓN DE MIEMBROS (COMPANY_USERS) ---
    else if (
      eventType === 'organizationMembership.created' ||
      eventType === 'organizationMembership.updated'
    ) {
      const { organization, public_user_data, role } = evt.data;
      const orgId = organization.id;
      const userId = public_user_data.user_id;

      const clerkRoleMap = {
        'org:admin': 'Administrator',
        'org:member': 'Operario',
        admin: 'Administrator',
        member: 'Operario'
      };
      const mappedRole = clerkRoleMap[role] || 'Operario';

      await this.authRepository.saveCompanyUser({
        company_id: orgId,
        clerk_user_id: userId,
        role: mappedRole,
        status: 'active'
      });

      // Invalidar la caché de JWT de este usuario al cambiar su membresía o rol
      cacheService.delete(`jwt:${userId}:${orgId}`);
    } else if (eventType === 'organizationMembership.deleted') {
      const { organization, public_user_data } = evt.data;
      const orgId = organization.id;
      const userId = public_user_data.user_id;

      await this.authRepository.deleteCompanyUser(orgId, userId);

      // Invalidar la caché
      cacheService.delete(`jwt:${userId}:${orgId}`);
    }

    return { success: true };
  }
}

export default ProcessClerkWebhookUseCase;
