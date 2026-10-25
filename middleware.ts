import { NextResponse, type NextRequest } from 'next/server';

/**
 * Грубая проверка на границе: без куки сессии в админку не пускаем.
 * Подпись куки проверяется уже в самой странице (isAdminRequest), потому что
 * edge-runtime не даёт полноценный node:crypto.
 *
 * Матчер написан явно (а не регуляркой вида `/admin/:path((?!login).*)`):
 * регулярка в матчере молча не срабатывает при изменении структуры путей.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminArea = pathname === '/admin' || pathname.startsWith('/admin/');
  const isPublicAdminPage = pathname.startsWith('/admin/login');
  if (!isAdminArea || isPublicAdminPage) return NextResponse.next();

  if (!request.cookies.get('kg_admin')?.value) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
