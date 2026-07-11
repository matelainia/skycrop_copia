'use client';

import { useSearchParams } from 'next/navigation';
import { XCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

function ErrorCard() {
  const searchParams = useSearchParams();
  const errorMsg = searchParams.get('message') || 'Ocurrió un error inesperado al intentar validar tus credenciales.';

  return (
    <div className="glass-container w-full max-w-md p-8 text-center backdrop-blur-xl">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 dark:bg-red-500/20">
        <XCircle className="h-10 w-10" />
      </div>
      
      <h2 className="font-display text-2xl font-bold tracking-tight mb-3">
        Error de Autenticación
      </h2>
      
      <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-6">
        No se pudo completar el proceso de inicio de sesión.
      </p>

      <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-4 mb-6 text-red-600 dark:text-red-400 text-xs font-mono break-words text-center">
        {errorMsg}
      </div>

      <div className="flex flex-col gap-3">
        <Link 
          href="/sign-in" 
          className="flex items-center justify-center gap-2 w-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold py-2.5 rounded-xl text-sm transition"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar Acceso
        </Link>
        
        <Link 
          href="/sign-up"
          className="text-xs text-[var(--primary)] hover:text-[var(--primary-hover)] font-semibold transition"
        >
          ¿No tienes cuenta? Regístrate
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="glass-container w-full max-w-md p-8 text-center backdrop-blur-xl animate-pulse">
        Cargando detalles del error...
      </div>
    }>
      <ErrorCard />
    </Suspense>
  );
}
