import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth, useUser, OrganizationList } from '@clerk/clerk-react';
import { AuthService, PermissionService } from '@skycrop/services';
import { setSupabaseToken } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { isLoaded, isSignedIn, orgId, getToken, signOut } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      console.log('[DEBUG FRONTEND] loadProfile ejecutado. isLoaded:', isLoaded, 'isSignedIn:', isSignedIn, 'orgId:', orgId);
      if (!isLoaded) return;

      if (!isSignedIn) {
        console.log('[DEBUG FRONTEND] El usuario no está autenticado, redirigiendo a sign-in');
        setProfile(null);
        setSupabaseToken(null, null);
        setLoading(false);
        const authUrl = import.meta.env.VITE_AUTH_URL || 'http://localhost:3001';
        window.location.href = `${authUrl}/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`;
        return;
      }

      // Si está autenticado pero no tiene organización activa en Clerk, no cargar perfil
      if (!orgId) {
        setProfile(null);
        setSupabaseToken(null, null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('[DEBUG FRONTEND] Obteniendo token de sesión de Clerk...');
        const token = await getToken();
        console.log('[DEBUG FRONTEND] Token de Clerk obtenido:', token ? 'Token presente' : 'Token vacío/nulo');
        if (!token) {
          throw new Error('No se pudo obtener el token de sesión de Clerk');
        }

        console.log('[DEBUG FRONTEND] Llamando a fetchUserProfile con token...');
        const data = await AuthService.fetchUserProfile(token);
        console.log('[DEBUG FRONTEND] fetchUserProfile respuesta exitosa:', data);
        
        setProfile(data);
        setSupabaseToken(data.supabaseToken, orgId);
        setError(null);
      } catch (err) {
        console.error('[DEBUG FRONTEND] Excepción atrapada en loadProfile:', err);
        setError(err.message || 'Error de autenticación');
      } finally {
        setLoading(false);
      }
    }

    loadProfile();

    // Refrescar el token de Supabase cada 9 minutos para evitar su expiración (dura 15 min)
    let interval;
    if (isSignedIn && orgId) {
      interval = setInterval(async () => {
        try {
          const token = await getToken();
          if (token) {
            const data = await AuthService.fetchUserProfile(token);
            setProfile(data);
            setSupabaseToken(data.supabaseToken, orgId);
          }
        } catch (err) {
          console.warn('Error refrescando token de Supabase:', err);
        }
      }, 9 * 60 * 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoaded, isSignedIn, orgId]);

  const logout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Error cerrando sesión:', err);
    }
  };

  const hasPermission = (recurso, accion) => {
    if (!profile) return false;
    return PermissionService.hasPermission(profile.permissions, recurso, accion);
  };

  const value = {
    user: profile?.user || null,
    empresa: profile?.company || profile?.empresa || null, // company para compatibilidad
    role: profile?.role || null,
    permissions: profile?.permissions || [],
    loading: !isLoaded || (loading && !(isSignedIn && !orgId)),
    error,
    logout,
    hasPermission
  };

  console.log('[DEBUG FRONTEND] AuthProvider rendering. Value:', {
    user: value.user,
    empresa: value.empresa,
    role: value.role,
    permissionsCount: value.permissions.length,
    loading: value.loading,
    error: value.error
  });

  if (!isLoaded || (loading && !(isSignedIn && !orgId))) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-primary)'
      }}>
        <div className="sky-loading-spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }} />
        <p style={{ 
          marginTop: '16px', 
          fontFamily: 'var(--font-display, Outfit, sans-serif)', 
          fontWeight: 600,
          color: 'var(--primary, #15803d)'
        }}>
          Cargando SkyCrop...
        </p>
      </div>
    );
  }

  // Interceptación de interfaz cuando falta seleccionar organización
  if (isSignedIn && !orgId) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-app, #f8fafc)',
        padding: '24px',
        fontFamily: 'var(--font-sans, sans-serif)'
      }}>
        <div style={{
          maxWidth: '480px',
          width: '100%',
          background: 'var(--bg-card, #ffffff)',
          padding: '32px',
          borderRadius: '24px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
          border: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            marginBottom: '20px',
            boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.2)'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </div>
          <h2 style={{
            fontFamily: 'var(--font-display, Outfit, sans-serif)',
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--text-primary, #0f172a)',
            marginBottom: '8px'
          }}>Selecciona tu Organización</h2>
          <p style={{
            fontSize: '14px',
            color: 'var(--text-secondary, #64748b)',
            marginBottom: '24px',
            lineHeight: '1.5'
          }}>Para acceder a SkyCrop, debes crear una nueva organización o seleccionar una existente en la que colabores.</p>
          
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <OrganizationList 
              hidePersonal={true} 
              afterCreateOrganizationUrl={window.location.href}
              afterSelectOrganizationUrl={window.location.href}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext debe usarse dentro de un AuthProvider');
  }
  return context;
}
