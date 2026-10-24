import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Check,
  CloudOff,
  Download,
  FolderArchive,
  Loader2,
  PackageOpen,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { useLauncherStore } from '../stores/launcherStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useNotificationStore } from '../stores/notificationStore';
import {
  downloadModrinthResourceEverywhere,
  searchModrinthEverywhere,
  type ModrinthResourceType,
} from '../services/modrinthService';
import { tauriListenEvent } from '../services/tauriBridge';
import {
  GAME_FILE_SUBFOLDERS,
  formatGameDirBytes,
  listGameDirFilesEverywhere,
  removeGameDirFileEverywhere,
  type GameFileEntry,
  type GameFileSubfolder,
} from '../services/gameDirectoryService';
import { Button } from '../components/ui/Button';
import { cn } from '../utils/cn';

type CardState =
  | { kind: 'idle' }
  | { kind: 'downloading'; downloaded: number; total: number }
  | { kind: 'done'; filename: string; mode: 'game-folder' | 'browser-download' }
  | { kind: 'error'; message: string };

const SUB_LABELS: Record<GameFileSubfolder, { ru: string; en: string }> = {
  mods: { ru: 'Моды (mods/)', en: 'Mods (mods/)' },
  resourcepacks: { ru: 'Ресурспаки (resourcepacks/)', en: 'Resource packs (resourcepacks/)' },
  shaderpacks: { ru: 'Шейдеры (shaderpacks/)', en: 'Shaders (shaderpacks/)' },
  config: { ru: 'Конфиги (config/)', en: 'Config (config/)' },
  logs: { ru: 'Логи (logs/)', en: 'Logs (logs/)' },
};

export const ResourcesPage: React.FC = () => {
  const versions = useLauncherStore((s) => s.versions);
  const selectedVersionId = useLauncherStore((s) => s.selectedVersionId);
  const gameDirectory = useSettingsStore((s) => s.gameDirectory);
  const isRu = useSettingsStore((s) => s.language) === 'ru';
  const pushToast = useNotificationStore((s) => s.pushToast);

  const [resourceType, setResourceType] = useState<ModrinthResourceType>('mod');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hits, setHits] = useState<Array<{ slug: string; title: string; description: string; iconUrl: string; downloads: number; gameVersions: string[] }>>([]);
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});
  const [installed, setInstalled] = useState<Record<GameFileSubfolder, GameFileEntry[]>>({
    mods: [],
    resourcepacks: [],
    shaderpacks: [],
    config: [],
    logs: [],
  });
  const [refreshing, setRefreshing] = useState(false);

  const searchSeq = useRef(0);
  const abortMap = useRef<Record<string, AbortController>>({});

  const mcVersion = useMemo(() => {
    const v = versions.find((item) => item.id === selectedVersionId);
    return v?.minecraftVersion ?? '1.21.11';
  }, [versions, selectedVersionId]);

  const setCardState = useCallback((slug: string, state: CardState) => {
    setCardStates((prev) => ({ ...prev, [slug]: state }));
  }, []);

  const runSearch = useCallback(
    async (nextType: ModrinthResourceType, nextQuery: string) => {
      const seq = ++searchSeq.current;
      setSearching(true);
      setSearchError(null);
      try {
        const results = await searchModrinthEverywhere(nextQuery, nextType, mcVersion);
        if (seq !== searchSeq.current) return;
        setHits(results);
      } catch (err) {
        if (seq !== searchSeq.current) return;
        setHits([]);
        setSearchError(err instanceof Error ? err.message : String(err));
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    },
    [mcVersion]
  );

  const refreshInstalled = useCallback(async () => {
    setRefreshing(true);
    const subs = GAME_FILE_SUBFOLDERS;
    const next = {} as Record<GameFileSubfolder, GameFileEntry[]>;
    await Promise.all(
      subs.map(async (sub) => {
        next[sub] = await listGameDirFilesEverywhere(gameDirectory, sub);
      })
    );
    setInstalled(next);
    setRefreshing(false);
  }, [gameDirectory]);

  useEffect(() => {
    runSearch(resourceType, query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceType, mcVersion]);

  useEffect(() => {
    refreshInstalled();
  }, [refreshInstalled]);

  // Desktop: live progress events from the Rust downloader
  useEffect(() => {
    let unlisten: Array<() => void> = [];
    tauriListenEvent<{ slug: string; downloadedBytes: number; totalBytes: number }>(
      'modrinth://progress',
      (p) => {
        if (!p?.slug) return;
        setCardStates((prev) => {
          const existing = prev[p.slug];
          if (existing && (existing.kind === 'done' || existing.kind === 'error')) {
            return prev;
          }
          const next: Record<string, CardState> = {
            ...prev,
            [p.slug]: { kind: 'downloading', downloaded: p.downloadedBytes, total: p.totalBytes },
          };
          return next;
        });
      }
    ).then((u) => unlisten.push(u));
    return () => unlisten.forEach((u) => u());
  }, []);

  useEffect(() => () => Object.values(abortMap.current).forEach((c) => c.abort()), []);

  const handleDownload = async (slug: string, title: string) => {
    if (abortMap.current[slug]) return;
    const controller = new AbortController();
    abortMap.current[slug] = controller;
    setCardState(slug, { kind: 'downloading', downloaded: 0, total: 0 });
    try {
      const res = await downloadModrinthResourceEverywhere(
        slug,
        resourceType,
        mcVersion,
        gameDirectory,
        (p) => {
          if (p.slug === slug) {
            setCardState(slug, {
              kind: 'downloading',
              downloaded: p.downloadedBytes,
              total: p.totalBytes,
            });
          }
        },
        controller.signal
      );
      setCardState(slug, { kind: 'done', filename: res.filename, mode: res.mode });
      pushToast({
        type: 'success',
        title: isRu ? `Установлено: ${title}` : `Installed: ${title}`,
        description:
          res.mode === 'game-folder'
            ? isRu
              ? res.savedTo
              : res.savedTo
            : isRu
              ? 'Файл сохранён через загрузчик браузера — перенесите в WinVisual'
              : 'Saved via browser download — move the file into WinVisual',
      });
      refreshInstalled();
    } catch (err) {
      if (controller.signal.aborted) {
        setCardState(slug, { kind: 'idle' });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      setCardState(slug, { kind: 'error', message });
      pushToast({
        type: 'error',
        title: isRu ? 'Ошибка скачивания' : 'Download failed',
        description: message,
      });
    } finally {
      delete abortMap.current[slug];
    }
  };

  const handleRemove = async (sub: GameFileSubfolder, name: string) => {
    const ok = await removeGameDirFileEverywhere(gameDirectory, sub, name);
    pushToast({
      type: ok ? 'success' : 'error',
      title: ok ? (isRu ? 'Удалено' : 'Removed') : isRu ? 'Не удалось удалить' : 'Remove failed',
      description: `${sub}/${name}`,
    });
    if (ok) refreshInstalled();
  };

  const formatDownloads = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(1)}K`
        : `${n}`;

  const typeLabel = isRu
    ? { mod: 'Моды', resourcepack: 'Ресурспаки' }
    : { mod: 'Mods', resourcepack: 'Resource Packs' };

  return (
    <motion.div
      key="page-resources"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="px-6 pt-3.5 pb-2 space-y-3.5"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
            <PackageOpen className="w-5 h-5 text-[var(--accent-primary)]" />
            {isRu ? 'Моды и ресурспаки' : 'Mods & Resource Packs'}
          </h1>
          <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
            {isRu
              ? `Каталог Modrinth — скачивание прямо в ${gameDirectory}/`
              : `Modrinth catalogue — downloads straight into ${gameDirectory}/`}
            {' · '}
            <span className="text-[var(--text-primary)] font-medium">Minecraft {mcVersion}</span>
          </p>
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-[12px] bg-[var(--surface-primary)] border border-[var(--border-primary)]">
          {(['mod', 'resourcepack'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setResourceType(t)}
              className={cn(
                'h-8 px-3.5 rounded-[10px] text-[12px] font-medium transition-colors cursor-pointer',
                resourceType === t
                  ? 'bg-[linear-gradient(135deg,var(--accent-primary)_0%,var(--accent-secondary)_100%)] text-[#09090E] font-semibold shadow-[0_6px_18px_-6px_var(--accent-glow)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              {typeLabel[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') runSearch(resourceType, query);
            }}
            placeholder={
              isRu
                ? 'Поиск в Modrinth: Sodium, Lithium, Iris, Continuity…'
                : 'Search Modrinth: Sodium, Lithium, Iris, Continuity…'
            }
            className={cn(
              'w-full h-10 pl-9 pr-4 rounded-[12px] bg-[var(--surface-primary)] border border-[var(--border-primary)]',
              'text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60',
              'focus:outline-none focus:border-[rgba(var(--accent-rgb),0.6)] focus:ring-2 focus:ring-[var(--accent-primary)]/25'
            )}
          />
        </div>
        <Button variant="primary" size="md" onClick={() => runSearch(resourceType, query)} disabled={searching}>
          {searching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {isRu ? 'Найти' : 'Search'}
        </Button>
      </div>

      {searchError && (
        <div className="rounded-[12px] border border-rose-500/25 bg-rose-500/[0.07] px-4 py-3 text-[12.5px] text-rose-200 flex items-start gap-2.5">
          <CloudOff className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">
              {isRu
                ? 'Не удалось получить каталог Modrinth'
                : 'Failed to fetch the Modrinth catalogue'}
            </p>
            <p className="text-rose-200/75 mt-0.5 break-words">{searchError}</p>
            <p className="text-rose-200/60 mt-1">
              {isRu
                ? 'Попытайтесь ещё раз — или откройте каталог на modrinth.com и скачайте файл вручную в mods/'
                : 'Retry later — or grab the file on modrinth.com into mods/'}
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-[var(--text-primary)] tracking-wide uppercase/70">
            {isRu
              ? `Каталог: ${typeLabel[resourceType]} для ${mcVersion}`
              : `Catalogue: ${typeLabel[resourceType]} for ${mcVersion}`}
          </h2>
          {!searching && (
            <button
              type="button"
              onClick={() => runSearch(resourceType, query)}
              className="text-[11.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              {isRu ? 'Обновить' : 'Refresh'}
            </button>
          )}
        </div>

        {searching ? (
          <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-[120px] rounded-[14px] bg-[var(--surface-primary)] border border-[var(--border-primary)] animate-pulse"
              />
            ))}
          </div>
        ) : hits.length === 0 && !searchError ? (
          <div className="rounded-[14px] border border-dashed border-[var(--border-primary)] bg-[var(--surface-primary)]/40 px-5 py-8 text-center">
            <PackageOpen className="w-7 h-7 mx-auto text-[var(--text-secondary)]/50" />
            <p className="text-[13px] text-[var(--text-secondary)] mt-2.5">
              {isRu
                ? 'Ничего не найдено — попробуйте другой запрос'
                : 'Nothing found — try a different query'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5">
            {hits.map((hit) => {
              const state = cardStates[hit.slug] ?? { kind: 'idle' as const };
              const pct =
                state.kind === 'downloading' && state.total > 0
                  ? Math.min(100, Math.round((state.downloaded / state.total) * 100))
                  : 0;
              return (
                <div
                  key={hit.slug}
                  className={cn(
                    'rounded-[14px] bg-[#0D0F16]/90 border border-white/[0.085] p-3 flex flex-col gap-2.5',
                    'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.055)] hover:border-[rgba(var(--accent-rgb),0.4)] transition-colors'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    {hit.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={hit.iconUrl}
                        alt=""
                        className="w-9 h-9 rounded-[9px] object-cover border border-white/10 shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-[9px] bg-[var(--surface-primary)] border border-white/10 flex items-center justify-center shrink-0">
                        <PackageOpen className="w-4 h-4 text-[var(--accent-primary)]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">
                        {hit.title}
                      </p>
                      <p className="text-[10.5px] text-[var(--text-secondary)] flex items-center gap-1">
                        <Download className="w-3 h-3" />
                        {formatDownloads(hit.downloads)}
                        <span className="opacity-50">·</span>
                        {typeLabel[resourceType].toLowerCase()}
                      </p>
                    </div>
                  </div>

                  <p className="text-[11px] leading-snug text-[var(--text-secondary)] line-clamp-2 min-h-[30px]">
                    {hit.description}
                  </p>

                  {state.kind === 'idle' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-auto w-full"
                      onClick={() => handleDownload(hit.slug, hit.title)}
                    >
                      <Download className="w-3.5 h-3.5" />
                      {isRu ? 'Скачать в WinVisual' : 'Download to WinVisual'}
                    </Button>
                  )}
                  {state.kind === 'downloading' && (
                    <div className="mt-auto space-y-1.5">
                      <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent-primary),var(--accent-secondary))]"
                          initial={{ width: 0 }}
                          animate={{ width: `${state.total > 0 ? pct : 100}%` }}
                          transition={state.total > 0 ? { duration: 0.18 } : { repeat: Infinity }}
                        />
                      </div>
                      <p className="text-[10.5px] text-[var(--text-secondary)] flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {isRu ? 'Скачивание…' : 'Downloading…'}
                        </span>
                        {state.total > 0
                          ? `${formatGameDirBytes(state.downloaded)} / ${formatGameDirBytes(state.total)}`
                          : ''}
                      </p>
                    </div>
                  )}
                  {state.kind === 'done' && (
                    <div className="mt-auto flex items-center gap-1.5 text-[11px] text-emerald-300 bg-emerald-500/[0.08] border border-emerald-500/25 rounded-[8px] px-2.5 py-1.5">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {isRu
                          ? state.mode === 'game-folder'
                            ? 'Установлено в WinVisual'
                            : 'Сохранено (браузер)'
                          : state.mode === 'game-folder'
                            ? 'Installed to WinVisual'
                            : 'Saved (browser)'}
                      </span>
                    </div>
                  )}
                  {state.kind === 'error' && (
                    <div className="mt-auto flex items-start gap-1.5 text-[10.5px] text-rose-300 bg-rose-500/[0.07] border border-rose-500/25 rounded-[8px] px-2.5 py-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                      <span className="line-clamp-2">{state.message}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Installed files in the WinVisual folder */}
      <div className="rounded-[16px] bg-[#0D0F16]/90 border border-white/[0.085] overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.055)]">
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-white/[0.06]">
          <h2 className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <FolderArchive className="w-4 h-4 text-[var(--accent-primary)]" />
            {isRu ? 'Установлено в WinVisual' : 'Installed in WinVisual'}
            <span className="text-[11px] font-normal text-[var(--text-secondary)]">
              {gameDirectory}
            </span>
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={refreshInstalled}
            disabled={refreshing}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            {isRu ? 'Обновить' : 'Refresh'}
          </Button>
        </div>
        <div className="px-4 py-3 space-y-3">
          {GAME_FILE_SUBFOLDERS.map((sub) => (
            <div key={sub}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                {SUB_LABELS[sub][isRu ? 'ru' : 'en']}
              </p>
              {installed[sub].length === 0 ? (
                <p className="text-[11.5px] text-[var(--text-secondary)]/60">
                  {isRu ? 'Пусто' : 'Empty'}
                </p>
              ) : (
                <div className="space-y-1">
                  {installed[sub].map((f) => (
                    <div
                      key={f.name}
                      className="flex items-center justify-between gap-3 rounded-[9px] bg-white/[0.025] border border-white/[0.05] px-3 py-1.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <PackageOpen className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
                        <span className="text-[12px] text-[var(--text-primary)] truncate">
                          {f.name}
                        </span>
                        <span className="text-[10.5px] text-[var(--text-secondary)] shrink-0">
                          {formatGameDirBytes(f.sizeBytes)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemove(sub, f.name)}
                        className="p-1.5 rounded-[7px] text-[var(--text-secondary)] hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                        title={isRu ? 'Удалить' : 'Remove'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
