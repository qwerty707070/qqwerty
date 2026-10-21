import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Power, RotateCcw } from 'lucide-react';
import { TitleBar } from './TitleBar';
import { Sidebar } from './Sidebar';
import { BackgroundEffects } from '../effects/BackgroundEffects';
import { NotificationViewport } from '../ui/NotificationViewport';
import { DownloadProgressModal, LogsViewerModal } from '../launcher/DownloadProgress';
import { LiveClientSessionModal } from '../launcher/LiveClientSessionModal';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { BrandMark } from '../ui/BrandMark';
import { useLauncherStore } from '../../stores/launcherStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { tauriCloseWindow, tauriToggleMaximizeWindow } from '../../services/tauriBridge';
import { cn } from '../../utils/cn';

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [windowClosedState, setWindowClosedState] = useState(false);

  const windowMinimized = useLauncherStore((s) => s.windowMinimized);
  const setWindowMinimized = useLauncherStore((s) => s.setWindowMinimized);
  const downloadProgress = useLauncherStore((s) => s.downloadProgress);
  const language = useSettingsStore((s) => s.language);

  const handleToggleMax = async () => {
    await tauriToggleMaximizeWindow();
    setIsMaximized((v) => !v);
  };

  const handleCloseClick = async () => {
    if (downloadProgress.active) {
      setCloseModalOpen(true);
      return;
    }
    const closedNative = await tauriCloseWindow();
    if (!closedNative) {
      setWindowClosedState(true);
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden flex items-center justify-center bg-[#040508] p-0 lg:p-4">
      <BackgroundEffects />

      {windowClosedState ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 glass-panel rounded-[20px] p-7 text-center space-y-4 max-w-sm"
        >
          <div className="flex justify-center">
            <BrandMark size={44} />
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">
              {language === 'ru' ? 'Лаунчер закрыт' : 'Launcher Closed'}
            </h2>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              {language === 'ru'
                ? 'Все пользовательские настройки, модули HUD и профили сохранены.'
                : 'All client profiles, HUD layout, and settings have been persisted.'}
            </p>
          </div>
          <Button variant="primary" size="md" onClick={() => setWindowClosedState(false)}>
            <RotateCcw size={15} strokeWidth={2} />
            {language === 'ru' ? 'Запустить WinVisual' : 'Relaunch WinVisual'}
          </Button>
        </motion.div>
      ) : windowMinimized ? (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          onClick={() => setWindowMinimized(false)}
          className="relative z-10 glass-panel rounded-full px-5 py-3 flex items-center gap-3 hover:border-[var(--border-hover)] cursor-pointer shadow-2xl"
        >
          <BrandMark size={26} />
          <span className="text-[13px] font-medium text-[var(--text-primary)]">
            WinVisual Launcher — {language === 'ru' ? 'Нажмите, чтобы развернуть' : 'Click to restore'}
          </span>
        </motion.button>
      ) : (
        <motion.div
          layout
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            'relative z-10 flex flex-col overflow-hidden bg-[var(--background-primary)]',
            'border border-white/[0.085] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.06)]',
            isMaximized
              ? 'w-full h-full rounded-none'
              : 'w-full h-full lg:w-[1240px] lg:max-w-[calc(100vw-32px)] lg:h-[780px] lg:max-h-[calc(100vh-32px)] lg:rounded-[20px]'
          )}
        >
          <TitleBar
            isMaximized={isMaximized}
            onToggleMaximize={handleToggleMax}
            onRequestClose={handleCloseClick}
          />

          <div className="flex-1 min-h-0 flex overflow-hidden">
            <Sidebar />
            <main className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden relative bg-[var(--background-primary)]">
              <AnimatePresence mode="wait">{children}</AnimatePresence>
            </main>
          </div>
        </motion.div>
      )}

      <DownloadProgressModal />
      <LogsViewerModal />
      <LiveClientSessionModal />
      <NotificationViewport />

      <Modal
        open={closeModalOpen}
        onOpenChange={setCloseModalOpen}
        title={language === 'ru' ? 'Прервать активную загрузку?' : 'Interrupt active transfer?'}
        description={
          language === 'ru'
            ? 'Сейчас выполняется загрузка и проверка файлов клиента. При закрытии лаунчера передача будет остановлена.'
            : 'Client files are currently downloading and being verified. Closing now will abort the transfer.'
        }
      >
        <div className="flex justify-end gap-2.5 pt-2">
          <Button variant="secondary" onClick={() => setCloseModalOpen(false)}>
            {language === 'ru' ? 'Остаться' : 'Keep Open'}
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              useLauncherStore.getState().cancelDownload();
              setCloseModalOpen(false);
              const closedNative = await tauriCloseWindow();
              if (!closedNative) setWindowClosedState(true);
            }}
          >
            <Power size={15} strokeWidth={1.75} />
            {language === 'ru' ? 'Отменить и выйти' : 'Abort & Quit'}
          </Button>
        </div>
      </Modal>
    </div>
  );
};
