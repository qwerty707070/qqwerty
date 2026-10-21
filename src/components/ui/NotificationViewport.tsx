import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useNotificationStore, type NotificationType } from '../../stores/notificationStore';

const ICON_MAP: Record<NotificationType, { Icon: typeof CheckCircle2; colorClass: string }> = {
  success: { Icon: CheckCircle2, colorClass: 'text-emerald-400' },
  error: { Icon: AlertCircle, colorClass: 'text-rose-400' },
  warning: { Icon: AlertTriangle, colorClass: 'text-amber-400' },
  info: { Icon: Info, colorClass: 'text-[var(--accent-secondary)]' },
};

export const NotificationViewport: React.FC = () => {
  const { toasts, dismissToast } = useNotificationStore();

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 w-[340px] max-w-[calc(100vw-32px)] pointer-events-none"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((item) => {
          const { Icon, colorClass } = ICON_MAP[item.type];
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto glass-panel rounded-[14px] px-4 py-3 flex items-start gap-3"
            >
              <Icon size={18} strokeWidth={1.75} className={`${colorClass} shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[var(--text-primary)] leading-snug">
                  {item.title}
                </p>
                {item.description && (
                  <p className="mt-0.5 text-[12px] text-[var(--text-secondary)] leading-snug truncate">
                    {item.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(item.id)}
                aria-label="Dismiss notification"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-0.5 rounded-[6px] cursor-pointer"
              >
                <X size={15} strokeWidth={1.75} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
