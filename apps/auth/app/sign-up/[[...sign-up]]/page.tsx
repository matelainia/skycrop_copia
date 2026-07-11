'use client';

import { SignUp } from '@clerk/nextjs';
import { Sprout, ShieldCheck, Tractor, Users } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SignUpPage() {
  return (
    <div className="flex w-full max-w-5xl overflow-hidden rounded-3xl border border-white/20 bg-white/5 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-black/20 md:min-h-[600px] lg:flex-row flex-col">
      
      {/* Columna Izquierda: Banner de Marca */}
      <div className="relative flex flex-col justify-between bg-gradient-to-br from-emerald-800 via-emerald-900 to-green-950 p-8 text-white lg:w-1/2 w-full">
        {/* Luces de fondo decorativas */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(16,185,129,0.2),transparent_60%)]" />
        
        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md">
            <Sprout className="h-6 w-6 text-emerald-400" />
          </div>
          <span className="font-display text-2xl font-bold tracking-tight">SkyCrop</span>
        </div>

        {/* Mensaje Principal */}
        <div className="relative z-10 my-12 flex flex-col gap-6">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-display text-3xl font-extrabold leading-tight tracking-tight md:text-4xl"
          >
            Únete a la nueva era de la agricultura digital.
          </motion.h1>
          <p className="text-emerald-100/80 font-sans leading-relaxed">
            Regístrate y comienza a digitalizar tus fincas, lotes, maquinarias y procesos laborales con el sistema de trazabilidad y analítica más avanzado del sector.
          </p>

          {/* Características */}
          <div className="mt-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <Users className="h-5 w-5 text-emerald-400" />
              </div>
              <span className="text-sm font-medium text-emerald-100/90">Estructura SaaS Multiempresa y Roles</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <Tractor className="h-5 w-5 text-emerald-400" />
              </div>
              <span className="text-sm font-medium text-emerald-100/90">Control Integral de Inventario y Flota</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              </div>
              <span className="text-sm font-medium text-emerald-100/90">Seguridad Centralizada con MFA</span>
            </div>
          </div>
        </div>

        {/* Footer del Banner */}
        <div className="relative z-10 text-xs text-emerald-200/50">
          © 2026 SkyCrop Inc. Todos los derechos reservados.
        </div>
      </div>

      {/* Columna Derecha: Formulario de Clerk */}
      <div className="flex flex-col items-center justify-center p-8 bg-white/40 dark:bg-black/10 lg:w-1/2 w-full overflow-y-auto">
        <SignUp
          appearance={{
            elements: {
              card: 'bg-transparent shadow-none border-none p-0',
              headerTitle: 'text-2xl font-bold font-display text-[var(--text-primary)]',
              headerSubtitle: 'text-[var(--text-secondary)] font-sans',
              socialButtonsBlockButton: 'border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] transition rounded-xl',
              formButtonPrimary: 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white transition py-2.5 rounded-xl text-sm font-semibold shadow-md cursor-pointer',
              formFieldLabel: 'text-[var(--text-secondary)] text-xs font-semibold',
              formFieldInput: 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] rounded-xl focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] py-2.5',
              footerActionText: 'text-[var(--text-muted)]',
              footerActionLink: 'text-[var(--primary)] hover:text-[var(--primary-hover)] font-semibold transition',
              identityPreviewText: 'text-[var(--text-secondary)]',
              identityPreviewEditButton: 'text-[var(--primary)] hover:text-[var(--primary-hover)]',
              dividerLine: 'bg-[var(--border-color)]',
              dividerText: 'text-[var(--text-muted)] text-xs',
            }
          }}
        />
      </div>

    </div>
  );
}
