-- Единый источник настроек для сайта и админки.
-- Одна строка (id = 'singleton'); публичная страница и админка читают её же.
-- Публичного SELECT нет: иначе RLS-политики по умолчанию отдают данные анонимам.

create table if not exists public.site_settings (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

-- Читать и писать может только сервисный ключ (service_role обходит RLS).
-- Если нужен публичный доступ на чтение — раскомментируйте политику ниже.
-- create policy "settings readable by anon"
--   on public.site_settings for select
--   using (true);

create table if not exists public.site_settings_audit (
  id bigserial primary key,
  at timestamptz not null,
  actor text not null,
  ip text not null,
  changed text[] not null default '{}',
  before jsonb not null default '{}'::jsonb,
  after jsonb not null default '{}'::jsonb
);

alter table public.site_settings_audit enable row level security;

create index if not exists site_settings_audit_at_idx
  on public.site_settings_audit (at desc);

-- Начальное значение (IP можно поменять в админке)
insert into public.site_settings (id, payload)
values (
  'singleton',
  jsonb_build_object(
    'brand', 'KINGGRIEF',
    'season', 'Сезон I · Восхождение короля',
    'tagline', 'Твоя империя грифа',
    'serverName', 'KingGrief',
    'serverIp', 'play.kinggrief.net',
    'serverPort', 25565,
    'versions', '1.16.5 — 1.21.4',
    'javaRangeHint', 'Java Edition · лицензия и пиратка',
    'discordUrl', 'https://discord.gg/kinggrief',
    'telegramUrl', 'https://t.me/kinggrief',
    'supportEmail', 'support@kinggrief.net',
    'status', 'soon',
    'onlinePlayers', null,
    'maxPlayers', null,
    'storeOpen', true,
    'storeClosedMessage', 'Магазин временно закрыт — заходите чуть позже.',
    'updatedAt', '1970-01-01T00:00:00.000Z',
    'updatedBy', 'system'
  )
)
on conflict (id) do nothing;
