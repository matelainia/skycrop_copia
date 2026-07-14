/**
 * Puerto de Salida (Outbound Port) para el Repositorio de Autenticación.
 * Define la interfaz de acceso a datos que debe implementar el adaptador concreto.
 */
export class AuthRepositoryPort {
  async getCompanyById(companyId) {
    throw new Error('Método no implementado');
  }

  async saveCompany(company) {
    throw new Error('Método no implementado');
  }

  async disableCompany(companyId) {
    throw new Error('Método no implementado');
  }

  async getCompanyUser(companyId, clerkUserId) {
    throw new Error('Método no implementado');
  }

  async saveCompanyUser(companyUser) {
    throw new Error('Método no implementado');
  }

  async deleteCompanyUser(companyId, clerkUserId) {
    throw new Error('Método no implementado');
  }

  async saveUserProfile(userProfile) {
    throw new Error('Método no implementado');
  }

  async deleteUserProfile(clerkUserId) {
    throw new Error('Método no implementado');
  }

  async getRoleWithPermissions(roleId) {
    throw new Error('Método no implementado');
  }
}

export default AuthRepositoryPort;
