import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/forgot-password(.*)',
  '/verify-email(.*)',
  '/locked(.*)',
  '/error(.*)'
]);

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();

  const isPublic = isPublicRoute(request);

  // 1. Si no está autenticado y no es una ruta pública, redirigir a /sign-in
  if (!userId && !isPublic) {
    const signInUrl = new URL('/sign-in', request.url);
    // Preservar la URL de retorno si existía
    const redirectUrl = request.nextUrl.searchParams.get('redirect_url');
    if (redirectUrl) {
      signInUrl.searchParams.set('redirect_url', redirectUrl);
    }
    return NextResponse.redirect(signInUrl);
  }

  // 2. Si ya está autenticado y está intentando acceder a una ruta de login/registro o a la raíz,
  // redirigir a la aplicación principal (app.skycrop.app o localhost:5173)
  if (userId && (request.nextUrl.pathname === '/' || isPublic)) {
    // Si la ruta contiene un callback o query específico, permitir que pase
    if (request.nextUrl.searchParams.has('__clerk_status') || request.nextUrl.pathname.includes('sign-out')) {
      return NextResponse.next();
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173';
    return NextResponse.redirect(appUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Excluir archivos estáticos e internos de Next.js
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:css|js|gif|svg|png|jpg|jpeg|webp|woff2?)).*)',
    // Rutas de API y auto-proxy de Clerk
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};
