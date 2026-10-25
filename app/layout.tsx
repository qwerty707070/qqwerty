import type { Metadata } from 'next';
import Link from 'next/link';
import { getSettings } from '@/lib/settings-store';
import { isAdminRequest } from '@/lib/auth';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: 'KINGGRIEF — Твоя империя грифа',
    template: '%s · KINGGRIEF',
  },
  description:
    'Привилегии, кейсы и рилики KingGrief. Единый источник данных для сайта и админ-панели.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const isAdmin = isAdminRequest();

  return (
    <html lang="ru">
      <body>
        <header className="site-header">
          <div className="container site-header__inner">
            <Link href="/" className="brand">
              <span className="brand__mark">♛</span>
              {settings.brand}
            </Link>

            <nav className="site-nav">
              <Link href="/privileges">Привилегии</Link>
              <Link href="/cases">Кейсы</Link>
              <Link href="/relics">Рилики</Link>
              <Link href="/#connect">Подключение</Link>
              <Link href="/admin/design">Админка</Link>
            </nav>

            <div className="header-actions">
              <Link href="/#connect" className="btn btn--ghost btn--sm">
                IP сервера
              </Link>
              <Link href="/privileges" className="btn btn--primary btn--sm">
                В магазин
              </Link>
              {isAdmin ? (
                <Link href="/admin/design" className="badge badge--green">
                  <span className="dot" /> admin
                </Link>
              ) : (
                <Link href="/admin/login" className="badge">
                  вход
                </Link>
              )}
            </div>
          </div>
        </header>

        <main>{children}</main>

        <footer className="footer">
          <div className="container footer__inner">
            <div>
              © {new Date().getFullYear()} {settings.brand} — {settings.tagline.toLowerCase()}
            </div>
            <div className="row">
              <a href={settings.discordUrl} className="muted">
                Discord
              </a>
              <span className="muted">·</span>
              <a href={settings.telegramUrl} className="muted">
                Telegram
              </a>
              <span className="muted">·</span>
              <a href={`mailto:${settings.supportEmail}`} className="muted">
                {settings.supportEmail}
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
