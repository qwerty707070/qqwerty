import { NextResponse, type NextRequest } from 'next/server';

/**
 * Дешёвая проверка на границе: если куки сессии нет вообще — сразу на логин,
 * не рендеря админку. Криптографическая проверка подписи выполняется
 * в самих страницах (isAdminRequest), потому что здесь нет доступа к
 * серверному crypto в полном объёме.
 */
export function middleware(request: NextRequest) {
  const token = request.cookies.get('kg_admin')?.value;
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/design/:path*', '/admin/:path((?!login).*)'],
};
