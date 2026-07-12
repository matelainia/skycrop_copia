import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { esES } from '@clerk/localizations';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Acceso - SkyCrop',
  description: 'Portal de autenticación y gestión de identidad centralizado de SkyCrop.',
  icons: {
    icon: '/favicon.ico',
  },
};

const customEsES = {
  ...esES,
  signIn: {
    ...esES.signIn,
    start: {
      ...esES.signIn?.start,
      title: 'Bienvenido',
      subtitle: '',
    },
  },
  signUp: {
    ...esES.signUp,
    start: {
      ...esES.signUp?.start,
      subtitle: '',
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={customEsES}>
      <html lang="es" className={`${inter.variable} ${outfit.variable} h-full`} suppressHydrationWarning>
        <body className="relative h-full w-full overflow-hidden !bg-white text-text-primary antialiased" suppressHydrationWarning>
          {/* Contenedor principal centrado */}
          <main className="flex min-h-screen items-center justify-center p-4 md:p-8">
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}
