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
    // Saltar internos de Next.js y archivos estáticos
    '/((?!_next|[^?]*\\.(?:html|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest))).*',
    // Siempre correr para rutas de API y trpc
    '/(api|trpc)(.*)',
  ],
};
