import { ValidationError } from '../../../../shared/errors/AppErrors.js';
import { generateSupabaseJwt } from '../../../../shared/utils/jwt.js';
import cacheService from '../../../../shared/cache/cache.service.js';

export class GetUserProfileUseCase {
  constructor(authRepository, clerkService) {
    this.authRepository = authRepository;
    this.clerkService = clerkService;
  }

  async execute(clerkToken) {
    // 1. Verificar el token de sesión con Clerk
    const decoded = await this.clerkService.verifySessionToken(clerkToken);

    const clerkUserId = decoded.sub;

    // Obtener detalles del usuario (nombre, apellido, email) desde Clerk (con caché local de 15 mins)
    const cacheKeyUser = `user-details:${clerkUserId}`;
    let userDetails = cacheService.get(cacheKeyUser);
    if (!userDetails) {
      userDetails = await this.clerkService.getUserDetails(clerkUserId);
      cacheService.set(cacheKeyUser, userDetails, 15 * 60 * 1000);
    }

    const email = userDetails.email || decoded.email || '';
    const orgId = decoded.org_id || decoded.orgId || decoded.o?.id;
    const orgRole = decoded.org_role || decoded.orgRole || decoded.o?.rol;

    if (!orgId) {
      throw new ValidationError('ORGANIZATION_REQUIRED');
    }

    const cacheKey = `jwt:${clerkUserId}:${orgId}`;

    // 2. Intentar recuperar el token Supabase de la caché
    let supabaseToken = cacheService.get(cacheKey);

    // 3. Obtener o crear de forma diferida (on-demand) la empresa
    let company = await this.authRepository.getCompanyById(orgId);
    if (!company) {
      console.log(`[GetUserProfileUseCase] Sincronizando empresa ${orgId} de forma diferida...`);
      const orgDetails = await this.clerkService.getOrganizationDetails(orgId);
      company = await this.authRepository.saveCompany({
        id: orgId,
        nombre: orgDetails.nombre,
        slug: orgDetails.slug,
        logo: orgDetails.logo,
        estado: 'active'
      });
    }

    // 4. Obtener o crear de forma diferida la membresía de usuario
    let compUser = await this.authRepository.getCompanyUser(orgId, clerkUserId);
    if (!compUser) {
      const clerkRoleMap = {
        'org:admin': 'Administrator',
        'org:member': 'Operario',
        admin: 'Administrator',
        member: 'Operario'
      };
      const mappedRole = clerkRoleMap[orgRole] || 'Operario';
      console.log(
        `[GetUserProfileUseCase] Creando membresía diferida para ${clerkUserId} en org ${orgId} con rol: ${mappedRole}`
      );
      compUser = await this.authRepository.saveCompanyUser({
        company_id: orgId,
        clerk_user_id: clerkUserId,
        role: mappedRole,
        status: 'active'
      });
    }

    // 5. Mapear roles de la empresa a IDs de permisos de la base de datos
    const dbRoleMap = {
      Owner: 'administrador',
      Administrator: 'administrador',
      Supervisor: 'supervisor',
      Operario: 'operario'
    };
    const dbRoleId = dbRoleMap[compUser.role] || 'operario';

    const { role: dbRole, permissions } =
      await this.authRepository.getRoleWithPermissions(dbRoleId);

    // 6. Regenerar token si no estaba en caché
    if (!supabaseToken) {
      supabaseToken = generateSupabaseJwt(clerkUserId, email, orgId, compUser.role);
      // Guardar token en caché por 10 minutos
      cacheService.set(cacheKey, supabaseToken, 10 * 60 * 1000);
    }

    return {
      user: {
        id: clerkUserId,
        email: email,
        nombre: userDetails?.nombre || '',
        apellido: userDetails?.apellido || '',
        company_id: orgId,
        rol_id: dbRoleId,
        role: compUser.role,
        created_at: compUser.created_at
      },
      company,
      empresa: company, // Compatibilidad hacia atrás
      role: dbRole,
      permissions: permissions || [],
      supabaseToken
    };
  }
}

export default GetUserProfileUseCase;
