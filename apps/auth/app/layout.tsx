import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { esES } from '@clerk/localizations';
import './globals.css';

export const metadata: Metadata = {
  title: 'Acceso - SkyCrop',
  description: 'Portal de autenticación y gestión de identidad centralizado de SkyCrop.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={esES}>
      <html lang="es" className="h-full">
        <body className="relative h-full w-full overflow-hidden bg-bg-app text-text-primary antialiased">
          {/* Fondo Premium Dinámico con Blurs y Gradientes */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            {/* Círculo de luz verde superior izquierda */}
            <div className="absolute -top-[40%] -left-[20%] h-[80vw] w-[80vw] rounded-full bg-emerald-500/10 blur-[120px] dark:bg-emerald-500/5" />
            
            {/* Círculo de luz dorada inferior derecha */}
            <div className="absolute -bottom-[30%] -right-[10%] h-[70vw] w-[70vw] rounded-full bg-amber-500/10 blur-[100px] dark:bg-amber-500/5" />
            
            {/* Patrón de cuadrícula sutil */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(21,128,61,0.05),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(34,197,94,0.03),rgba(0,0,0,0))]" />
          </div>

          {/* Contenedor principal centrado */}
          <main className="flex min-h-screen items-center justify-center p-4 md:p-8">
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}
