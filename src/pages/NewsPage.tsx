import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, Clock, Newspaper } from 'lucide-react';
import type { NewsArticle } from '../types/launcher';
import { useLauncherStore } from '../stores/launcherStore';
import { useSettingsStore } from '../stores/settingsStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';

export const NewsPage: React.FC = () => {
  const news = useLauncherStore((s) => s.news);
  const newsLoading = useLauncherStore((s) => s.newsLoading);
  const language = useSettingsStore((s) => s.language);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  const isRu = language === 'ru';
  const featured = news.find((n) => n.featured) ?? news[0];
  const secondary = news.filter((n) => n.id !== featured?.id);

  return (
    <motion.div
      key="page-news"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="p-7 space-y-6 max-w-[1040px]"
    >
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)]">
          {isRu ? 'Новости' : 'News'}
        </h1>
        <p className="mt-1 text-[13.5px] text-[var(--text-secondary)]">
          {isRu
            ? 'Официальные публикации и объявления проекта WinVisual.'
            : 'Official announcements and updates from WinVisual.'}
        </p>
      </div>

      {newsLoading ? (
        <div className="space-y-5">
          <Skeleton className="h-[220px] w-full rounded-[20px]" />
        </div>
      ) : news.length === 0 ? (
        <Card className="p-12 rounded-[20px] flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-[14px] bg-[rgba(var(--accent-rgb),0.14)] border border-[rgba(var(--accent-rgb),0.3)] flex items-center justify-center text-[var(--accent-secondary)]">
            <Newspaper size={22} strokeWidth={1.75} />
          </div>
          <h2 className="text-[17px] font-semibold text-[var(--text-primary)]">
            {isRu ? 'Пока новостей нет' : 'No news published yet'}
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)] max-w-[400px] leading-relaxed">
            {isRu
              ? 'Новые записи появятся здесь сразу после официальной публикации.'
              : 'Official posts will appear here as soon as they are published.'}
          </p>
        </Card>
      ) : (
        <>
          {/* Featured Article Banner */}
          {featured && (
            <Card
              interactive
              onClick={() => setSelectedArticle(featured)}
              className="overflow-hidden rounded-[20px] grid grid-cols-1 lg:grid-cols-12 cursor-pointer group"
            >
              <div className="lg:col-span-7 relative min-h-[240px] overflow-hidden">
                <img
                  src={featured.image}
                  alt={isRu ? featured.titleRu : featured.titleEn}
                  className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(90deg, rgba(16,17,22,0) 60%, rgba(16,17,22,0.92) 100%)',
                  }}
                />
              </div>

              <div className="lg:col-span-5 p-6 flex flex-col justify-between gap-4 bg-[var(--background-secondary)]/60">
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5 text-[11px]">
                    <span className="px-2.5 py-0.5 rounded-full font-semibold tracking-wider uppercase bg-[var(--accent-subtle)] text-[var(--accent-secondary)] border border-[var(--accent-primary)]/30">
                      {isRu ? featured.categoryRu : featured.categoryEn}
                    </span>
                    <span className="text-[var(--text-muted)] inline-flex items-center gap-1">
                      <Calendar size={12} strokeWidth={1.75} />
                      {isRu ? featured.dateRu : featured.dateEn}
                    </span>
                  </div>

                  <h2 className="text-[20px] font-bold text-[var(--text-primary)] leading-snug">
                    {isRu ? featured.titleRu : featured.titleEn}
                  </h2>

                  <p className="text-[13.5px] text-[var(--text-secondary)] leading-relaxed">
                    {isRu ? featured.excerptRu : featured.excerptEn}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-primary)]">
                  <span className="text-[11.5px] text-[var(--text-muted)] inline-flex items-center gap-1.5">
                    <Clock size={13} strokeWidth={1.75} />
                    {isRu ? featured.readTimeRu : featured.readTimeEn}
                  </span>
                  <Button variant="secondary" size="sm">
                    {isRu ? 'Читать далее' : 'Read More'}
                    <ArrowRight size={14} strokeWidth={1.75} />
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Secondary Grid */}
          {secondary.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {secondary.map((item) => (
                <Card
                  key={item.id}
                  interactive
                  onClick={() => setSelectedArticle(item)}
                  className="overflow-hidden flex flex-col cursor-pointer group"
                >
                  <div className="h-[152px] overflow-hidden relative">
                    <img
                      src={item.image}
                      alt={isRu ? item.titleRu : item.titleEn}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                    />
                    <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-black/65 backdrop-blur-md text-[var(--text-primary)] border border-white/10">
                      {isRu ? item.categoryRu : item.categoryEn}
                    </span>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {isRu ? item.dateRu : item.dateEn}
                      </p>
                      <h3 className="text-[15.5px] font-semibold text-[var(--text-primary)] leading-snug">
                        {isRu ? item.titleRu : item.titleEn}
                      </h3>
                      <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed line-clamp-3">
                        {isRu ? item.excerptRu : item.excerptEn}
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-between text-[12px] font-medium text-[var(--accent-secondary)]">
                      <span>{isRu ? 'Открыть статью' : 'Read More'}</span>
                      <ArrowRight
                        size={14}
                        strokeWidth={1.75}
                        className="transition-transform duration-200 group-hover:translate-x-1"
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Full Article Reader Modal */}
      <Modal
        open={Boolean(selectedArticle)}
        onOpenChange={(o) => !o && setSelectedArticle(null)}
        maxWidthClass="max-w-[640px]"
        title={selectedArticle ? (isRu ? selectedArticle.titleRu : selectedArticle.titleEn) : ''}
        description={
          selectedArticle
            ? `${isRu ? selectedArticle.categoryRu : selectedArticle.categoryEn} • ${
                isRu ? selectedArticle.dateRu : selectedArticle.dateEn
              }`
            : ''
        }
      >
        {selectedArticle && (
          <div className="space-y-4">
            <div className="h-[220px] rounded-[14px] overflow-hidden border border-white/10">
              <img
                src={selectedArticle.image}
                alt={isRu ? selectedArticle.titleRu : selectedArticle.titleEn}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-3 text-[13.5px] leading-[1.68] text-[var(--text-secondary)]">
              {(isRu ? selectedArticle.bodyRu : selectedArticle.bodyEn).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  );
};
