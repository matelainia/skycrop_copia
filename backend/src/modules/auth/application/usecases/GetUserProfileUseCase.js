import { ValidationError } from '../../../../shared/errors/AppErrors.js';
import { generateSupabaseJwt } from '../../../../shared/utils/jwt.js';
import cacheService from '../../../../shared/cache/cache.service.js';

// Mapa canónico de roles de Clerk a roles internos de SkyCrop
const CLERK_ROLE_MAP = {
  'org:admin': 'administrador',
  'org:member': 'operario',
  owner: 'gerente',
  administrator: 'administrador',
  supervisor: 'supervisor',
  ingeniero: 'ingeniero',
  admin: 'administrador',
  member: 'operario'
};

// Roles válidos en la base de datos (sincronizado con 005_roles.sql)
const VALID_ROLES = new Set([
  'super_admin',
  'gerente',
  'administrador',
  'ingeniero',
  'supervisor',
  'operario',
  'auditor',
  'invitado',
  'consulta'
]);

export class GetUserProfileUseCase {
  constructor(authRepository, clerkService) {
    this.authRepository = authRepository;
    this.clerkService = clerkService;
  }

  async execute(clerkToken) {
    // ── 1. Verificar y decodificar el token de Clerk ───────────────────────
    const decoded = await this.clerkService.verifySessionToken(clerkToken);
    const clerkUserId = decoded.sub;

    // ── 2. Validaciones explícitas antes de tocar la base de datos ─────────
    if (!clerkUserId) {
      throw new ValidationError('Token inválido: falta el campo sub (user ID).');
    }

    const orgId = decoded.org_id || decoded.orgId || decoded.o?.id;
    const orgRole = decoded.org_role || decoded.orgRole || decoded.o?.rol;

    if (!orgId) {
      throw new ValidationError('ORGANIZATION_REQUIRED');
    }

    // ── 3. Obtener detalles del usuario desde Clerk (con caché de 15 min) ──
    const cacheKeyUser = `user-details:${clerkUserId}`;
    let userDetails = cacheService.get(cacheKeyUser);
    if (!userDetails) {
      userDetails = await this.clerkService.getUserDetails(clerkUserId);
      cacheService.set(cacheKeyUser, userDetails, 15 * 60 * 1000);
    }

    const email = userDetails.email || decoded.email || '';
    const nombre = userDetails.nombre || '';
    const apellido = userDetails.apellido || '';

    if (!email) {
      throw new ValidationError('No se pudo obtener el email del usuario desde Clerk.');
    }

    // ── 4. Mapear el rol de Clerk a un rol interno válido ──────────────────
    const rawRole = (orgRole || '').toLowerCase();
    const mappedRoleId = CLERK_ROLE_MAP[rawRole] || 'operario';

    // Confirmación de seguridad: el rol mapeado debe existir en la BD
    if (!VALID_ROLES.has(mappedRoleId)) {
      throw new ValidationError(`Rol mapeado '${mappedRoleId}' no es un rol válido del sistema.`);
    }

    // ── 5. Obtener detalles de la organización desde Clerk ─────────────────
    const cacheKeyOrg = `org-details:${orgId}`;
    let orgDetails = cacheService.get(cacheKeyOrg);
    if (!orgDetails) {
      orgDetails = await this.clerkService.getOrganizationDetails(orgId);
      cacheService.set(cacheKeyOrg, orgDetails, 15 * 60 * 1000);
    }

    // ── 6. Bootstrap atómico e idempotente (1 round-trip a la BD) ──────────
    // La función PostgreSQL `bootstrap_user_org` garantiza en una sola transacción:
    //  - Upsert en profiles
    //  - Upsert en companies
    //  - Lote por defecto si la empresa no tiene ninguno
    //  - Upsert en company_users
    console.log(
      `[GetUserProfileUseCase] Bootstrap atómico para usuario ${clerkUserId} en org ${orgId}`
    );
    const bootstrapResult = await this.authRepository.bootstrapUserOrg({
      userId: clerkUserId,
      email,
      nombre,
      apellido,
      clerkOrgId: orgId,
      orgNombre: orgDetails.nombre,
      orgSlug: orgDetails.slug || null,
      orgLogo: orgDetails.logo || null,
      roleId: mappedRoleId
    });

    const companyUuid = bootstrapResult.company_id;
    const dbRoleId = bootstrapResult.role_id;

    // ── 7. Obtener rol y permisos desde la BD ──────────────────────────────
    const { role: dbRole, permissions } =
      await this.authRepository.getRoleWithPermissions(dbRoleId);

    // ── 8. Obtener datos completos de la empresa ───────────────────────────
    const company = await this.authRepository.getCompanyById(companyUuid);

    // ── 9. Generar token JWT de Supabase (con caché condicional) ───────────
    // El JWT solo se guarda en caché una vez que el bootstrap completó con éxito.
    // Esto evita cachear un token que corresponde a un estado inconsistente.
    const cacheKey = `jwt:${clerkUserId}:${orgId}`;
    let supabaseToken = cacheService.get(cacheKey);
    if (!supabaseToken) {
      supabaseToken = generateSupabaseJwt(clerkUserId, email, companyUuid, dbRoleId);
      cacheService.set(cacheKey, supabaseToken, 10 * 60 * 1000);
    }

    // ── 10. Retornar perfil completo ───────────────────────────────────────
    return {
      user: {
        id: clerkUserId,
        email,
        nombre,
        apellido,
        company_id: orgId,
        rol_id: dbRoleId,
        role: dbRole?.nombre || dbRoleId
      },
      company,
      empresa: company, // compatibilidad hacia atrás
      role: dbRole,
      permissions: permissions || [],
      supabaseToken
    };
  }
}

export default GetUserProfileUseCase;
