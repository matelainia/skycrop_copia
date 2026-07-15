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

  async saveCompany(company) {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .upsert(
        [
          {
            id: company.id,
            nombre: company.nombre,
            slug: company.slug || null,
            logo: company.logo || null,
            estado: company.estado || 'active',
            updated_at: new Date().toISOString()
          }
        ],
        { onConflict: 'id' }
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
    const { data, error } = await supabaseAdmin
      .from('company_users')
      .upsert(
        [
          {
            company_id: companyUser.company_id,
            clerk_user_id: companyUser.clerk_user_id,
            role: companyUser.role,
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
    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .upsert(
        [
          {
            id: userProfile.id,
            email: userProfile.email,
            nombre: userProfile.nombre || '',
            apellido: userProfile.apellido || '',
            created_at: userProfile.created_at || new Date().toISOString()
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
    const { error } = await supabaseAdmin.from('usuarios').delete().eq('id', clerkUserId);

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
}

export default SupabaseAuthRepository;
