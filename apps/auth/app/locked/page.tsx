'use client';

import { ShieldAlert, Mail } from 'lucide-react';
import Link from 'next/link';

export default function AccountLockedPage() {
  return (
    <div className="glass-container w-full max-w-md p-8 text-center backdrop-blur-xl">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 dark:bg-red-500/20">
        <ShieldAlert className="h-10 w-10 animate-bounce" />
      </div>
      
      <h2 className="font-display text-2xl font-bold tracking-tight mb-3">
        Cuenta Bloqueada
      </h2>
      
      <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-6">
        Por motivos de seguridad, tu cuenta ha sido suspendida temporalmente debido a múltiples intentos de acceso fallidos o actividades inusuales.
      </p>

      <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-4 mb-6 text-amber-700 dark:text-amber-300 text-xs text-left leading-relaxed">
        <strong>¿Qué debes hacer?</strong>
        <p className="mt-1">
          Por favor, ponte en contacto con el Administrador de tu empresa o con nuestro equipo de soporte técnico para verificar tu identidad y desbloquear tu usuario.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <a 
          href="mailto:soporte@skycrop.app?subject=Cuenta Bloqueada" 
          className="flex items-center justify-center gap-2 w-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold py-2.5 rounded-xl text-sm transition"
        >
          <Mail className="h-4 w-4" />
          Contactar a Soporte
        </a>
        
        <Link 
          href="/sign-in"
          className="text-xs text-[var(--primary)] hover:text-[var(--primary-hover)] font-semibold transition"
        >
          Volver al Inicio de Sesión
        </Link>
      </div>
    </div>
  );
}
