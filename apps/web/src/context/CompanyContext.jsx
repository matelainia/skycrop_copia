import React, { createContext, useContext } from 'react';
import { useAuthContext } from './AuthContext';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const { empresa, role, loading } = useAuthContext();

  const value = {
    companyId: empresa?.id || null, // Clerk Organization ID string (e.g. 'org_3GSw...')
    companyName: empresa?.nombre || null,
    slug: empresa?.slug || null,
    logo: empresa?.logo || null,
    role: role?.nombre || (typeof role === 'string' ? role : null),
    loading
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompanyContext() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompanyContext debe usarse dentro de un CompanyProvider');
  }
  return context;
}
