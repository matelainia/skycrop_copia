import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { AuthService, PermissionService } from '@skycrop/services';
import { setSupabaseToken } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      if (!isLoaded) return;

      if (!isSignedIn) {
        setProfile(null);
        setSupabaseToken(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const token = await getToken();
        if (!token) {
          throw new Error('No se pudo obtener el token de sesión de Clerk');
        }

        const data = await AuthService.fetchUserProfile(token);
        
        setProfile(data);
        setSupabaseToken(data.supabaseToken);
        setError(null);
      } catch (err) {
        console.error('Error cargando perfil de usuario:', err);
        setError(err.message || 'Error de autenticación');
      } finally {
        setLoading(false);
      }
    }

    loadProfile();

    // Refrescar el token de Supabase cada 9 minutos para evitar su expiración (dura 15 min)
    let interval;
    if (isSignedIn) {
      interval = setInterval(async () => {
        try {
          const token = await getToken();
          if (token) {
            const data = await AuthService.fetchUserProfile(token);
            setProfile(data);
            setSupabaseToken(data.supabaseToken);
          }
        } catch (err) {
          console.warn('Error refrescando token de Supabase:', err);
        }
      }, 9 * 60 * 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoaded, isSignedIn]);

  const logout = () => {
    const authUrl = import.meta.env.VITE_AUTH_URL || 'http://localhost:3001';
    AuthService.logout(authUrl);
  };

  const hasPermission = (recurso, accion) => {
    if (!profile) return false;
    return PermissionService.hasPermission(profile.permissions, recurso, accion);
  };

  const value = {
    user: profile?.user || null,
    empresa: profile?.empresa || null,
    role: profile?.role || null,
    permissions: profile?.permissions || [],
    loading: !isLoaded || loading,
    error,
    logout,
    hasPermission
  };

  if (!isLoaded || loading) {
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
