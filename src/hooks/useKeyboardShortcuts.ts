import { useEffect } from 'react';
import { useLauncherStore } from '../stores/launcherStore';

export function useKeyboardShortcuts(): void {
  const setCurrentPage = useLauncherStore((s) => s.setCurrentPage);
  const setLogsModalOpen = useLauncherStore((s) => s.setLogsModalOpen);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setLogsModalOpen(true);
      } else if (e.altKey) {
        if (e.key === '1') setCurrentPage('home');
        if (e.key === '2') setCurrentPage('modules');
        if (e.key === '3') setCurrentPage('news');
        if (e.key === '4') setCurrentPage('versions');
        if (e.key === '5') setCurrentPage('settings');
        if (e.key === '6') setCurrentPage('account');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setCurrentPage, setLogsModalOpen]);
}
