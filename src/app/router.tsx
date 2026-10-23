import React, { Suspense, lazy } from 'react';
import { HomePage } from '../pages/HomePage';
import { useLauncherStore } from '../stores/launcherStore';
import { Skeleton } from '../components/ui/Skeleton';

const ModulesPage = lazy(() =>
  import('../pages/ModulesPage').then((m) => ({ default: m.ModulesPage }))
);
const NewsPage = lazy(() =>
  import('../pages/NewsPage').then((m) => ({ default: m.NewsPage }))
);
const VersionsPage = lazy(() =>
  import('../pages/VersionsPage').then((m) => ({ default: m.VersionsPage }))
);
const ResourcesPage = lazy(() =>
  import('../pages/ResourcesPage').then((m) => ({ default: m.ResourcesPage }))
);
const SettingsPage = lazy(() =>
  import('../pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const AccountPage = lazy(() =>
  import('../pages/AccountPage').then((m) => ({ default: m.AccountPage }))
);

const PageFallback: React.FC = () => (
  <div className="p-7 space-y-5 max-w-[1040px]">
    <Skeleton className="h-9 w-64" />
    <Skeleton className="h-[220px] w-full rounded-[20px]" />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Skeleton className="h-[130px] rounded-[16px]" />
      <Skeleton className="h-[130px] rounded-[16px]" />
    </div>
  </div>
);

export const AppRouter: React.FC = () => {
  const currentPage = useLauncherStore((s) => s.currentPage);

  if (currentPage === 'home') {
    return <HomePage />;
  }

  return (
    <Suspense fallback={<PageFallback />}>
      {currentPage === 'modules' && <ModulesPage />}
      {currentPage === 'news' && <NewsPage />}
      {currentPage === 'versions' && <VersionsPage />}
      {currentPage === 'resources' && <ResourcesPage />}
      {currentPage === 'settings' && <SettingsPage />}
      {currentPage === 'account' && <AccountPage />}
    </Suspense>
  );
};
