import { AuthRepositoryPort } from '../../../domain/ports/AuthRepositoryPort.js';
import { supabaseAdmin } from '../../../../../shared/database/supabase.js';
import { DatabaseError } from '../../../../../shared/errors/AppErrors.js';

export class SupabaseAuthRepository extends AuthRepositoryPort {
  async getCompanyById(companyId) {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`Error al consultar empresa ${companyId}`, error);
    }
    return data;
  }

  async getCompanyByClerkId(clerkOrgId) {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('clerk_org_id', clerkOrgId)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`Error al consultar empresa por Clerk ID ${clerkOrgId}`, error);
    }
    return data;
  }

  async saveCompany(company) {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .upsert(
        [
          {
            clerk_org_id: company.clerk_org_id || company.id,
            nombre: company.nombre,
            slug: company.slug || null,
            logo: company.logo || null,
            estado: company.estado || 'active',
            updated_at: new Date().toISOString()
          }
        ],
        { onConflict: 'clerk_org_id' }
      )
      .select()
      .single();

    if (error) {
      throw new DatabaseError('Error al guardar empresa en Supabase', error);
    }
    return data;
  }

  async disableCompany(companyId) {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .update({ estado: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', companyId)
      .select()
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`Error al desactivar empresa ${companyId}`, error);
    }
    return data;
  }

  async getCompanyUser(companyId, clerkUserId) {
    const { data, error } = await supabaseAdmin
      .from('company_users')
      .select('*')
      .eq('company_id', companyId)
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(
        `Error al consultar membresía para usuario ${clerkUserId} en empresa ${companyId}`,
        error
      );
    }
    return data;
  }

  async saveCompanyUser(companyUser) {
    const roleMap = {
      owner: 'gerente',
      administrator: 'administrador',
      supervisor: 'supervisor',
      operario: 'operario',
      ingeniero: 'ingeniero',
      'org:admin': 'administrador',
      'org:member': 'operario'
    };
    const inputRole = (companyUser.role_id || companyUser.role || 'operario').toLowerCase();
    const roleId = roleMap[inputRole] || inputRole;

    const { data, error } = await supabaseAdmin
      .from('company_users')
      .upsert(
        [
          {
            company_id: companyUser.company_id,
            clerk_user_id: companyUser.clerk_user_id,
            role_id: roleId,
            status: companyUser.status || 'active'
          }
        ],
        { onConflict: 'company_id,clerk_user_id' }
      )
      .select()
      .single();

    if (error) {
      throw new DatabaseError('Error al guardar membresía de usuario', error);
    }
    return data;
  }

  async deleteCompanyUser(companyId, clerkUserId) {
    const { error } = await supabaseAdmin
      .from('company_users')
      .delete()
      .eq('company_id', companyId)
      .eq('clerk_user_id', clerkUserId);

    if (error) {
      throw new DatabaseError(
        `Error al eliminar membresía para usuario ${clerkUserId} en empresa ${companyId}`,
        error
      );
    }
    return true;
  }

  async saveUserProfile(userProfile) {
    // Escribimos directamente en la tabla 'profiles' (no en la vista 'usuarios')
    // porque las vistas no tienen constraints físicos y Supabase upsert genera
    // INSERT ... ON CONFLICT (id) DO UPDATE, que requiere un constraint real.
    // profiles tiene PRIMARY KEY (id), por lo que ON CONFLICT funciona correctamente.
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert(
        [
          {
            id: userProfile.id,
            email: userProfile.email,
            nombre: userProfile.nombre || '',
            apellido: userProfile.apellido || '',
            updated_at: new Date().toISOString()
          }
        ],
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) {
      throw new DatabaseError('Error al sincronizar perfil de usuario', error);
    }
    return data;
  }

  async deleteUserProfile(clerkUserId) {
    // Eliminamos de 'profiles' directamente (nunca de la vista 'usuarios').
    // ON DELETE CASCADE en company_users limpiará las membresías automáticamente.
    const { error } = await supabaseAdmin.from('profiles').delete().eq('id', clerkUserId);

    if (error) {
      throw new DatabaseError(`Error al eliminar perfil del usuario ${clerkUserId}`, error);
    }
    return true;
  }

  async getRoleWithPermissions(roleId) {
    const { data: role, error: rErr } = await supabaseAdmin
      .from('roles')
      .select('*')
      .eq('id', roleId)
      .maybeSingle();

    if (rErr) {
      throw new DatabaseError(`Error al consultar rol ${roleId}`, rErr);
    }

    const { data: permisos, error: pErr } = await supabaseAdmin
      .from('permisos')
      .select('*')
      .eq('rol_id', roleId);

    if (pErr) {
      throw new DatabaseError(`Error al consultar permisos para rol ${roleId}`, pErr);
    }

    return {
      role: role || { id: roleId, nombre: roleId },
      permissions: permisos || []
    };
  }

  async createDefaultLote(companyId) {
    // Upsert idempotente: si ya existe un lote con ese codigo_interno para la empresa,
    // no falla ni duplica. UNIQUE(company_id, codigo_interno) garantiza la seguridad.
    const { data, error } = await supabaseAdmin
      .from('lotes')
      .upsert(
        [
          {
            company_id: companyId,
            codigo_interno: 'LM',
            nombre: 'Las Margaritas',
            cultivo: 'Café',
            centroide_lat: 4.1234,
            centroide_lng: -73.6543,
            area_ha: 15.5
          }
        ],
        { onConflict: 'company_id,codigo_interno', ignoreDuplicates: true }
      )
      .select()
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`Error al crear predio por defecto para empresa ${companyId}`, error);
    }
    return data;
  }

  /**
   * Ejecuta el bootstrap completo de usuario/organización en una sola transacción
   * PostgreSQL mediante la función RPC `bootstrap_user_org`.
   *
   * La función en la BD garantiza:
   *  1. Upsert en profiles
   *  2. Upsert en companies
   *  3. Lote por defecto si no existe ninguno (idempotente)
   *  4. Upsert en company_users
   *
   * @returns {{ company_id: string, user_id: string, role_id: string }}
   */
  async bootstrapUserOrg({
    userId,
    email,
    nombre,
    apellido,
    clerkOrgId,
    orgNombre,
    orgSlug,
    orgLogo,
    roleId
  }) {
    const { data, error } = await supabaseAdmin.rpc('bootstrap_user_org', {
      p_user_id: userId,
      p_email: email,
      p_nombre: nombre || '',
      p_apellido: apellido || '',
      p_clerk_org_id: clerkOrgId,
      p_org_nombre: orgNombre,
      p_org_slug: orgSlug || null,
      p_org_logo: orgLogo || null,
      p_role_id: roleId
    });

    if (error) {
      throw new DatabaseError(
        `bootstrap_user_org falló para usuario ${userId} en org ${clerkOrgId}`,
        error
      );
    }

    if (!data?.company_id) {
      throw new DatabaseError(
        'bootstrap_user_org no retornó company_id. Verifica que la función exista en la BD.',
        {}
      );
    }

    return data; // { company_id, user_id, role_id }
  }
}

export default SupabaseAuthRepository;
