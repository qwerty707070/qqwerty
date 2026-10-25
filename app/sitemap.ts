import type { MetadataRoute } from 'next';
import { getSettings } from '@/lib/settings-store';
import { PRIVILEGES } from '@/lib/catalog';
import { CASES } from '@/lib/cases';

/**
 * Карта сайта с РЕАЛЬНОЙ датой изменения.
 *
 * Исправляемый баг: раньше lastModified был моментом генерации файла
 * (все URL с одинаковой датой «сейчас»), поэтому поисковик не видел,
 * что страница обновилась. Теперь дата берётся из настроек: любая
 * правка в админке её меняет.
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSettings();
  const base = (process.env.SITE_URL ?? 'https://kinggrief.vercel.app').replace(/\/$/, '');
  const changed = new Date(settings.updatedAt);

  const staticPages: Array<{ path: string; priority: number }> = [
    { path: '/', priority: 1 },
    { path: '/privileges', priority: 0.9 },
    { path: '/cases', priority: 0.9 },
    { path: '/relics', priority: 0.7 },
    { path: '/checkout', priority: 0.5 },
  ];

  return [
    ...staticPages.map((page) => ({
      url: `${base}${page.path}`,
      lastModified: changed,
      changeFrequency: 'weekly' as const,
      priority: page.priority,
    })),
    ...PRIVILEGES.map((privilege) => ({
      url: `${base}/privileges/${privilege.slug}`,
      lastModified: changed,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...CASES.map((item) => ({
      url: `${base}/cases#${item.slug}`,
      lastModified: changed,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}
