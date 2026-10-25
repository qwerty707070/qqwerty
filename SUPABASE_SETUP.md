# Supabase для KINGGRIEF — что уже сделано и что осталось

## Готово (создано агентом 25.10.2026)

| Параметр | Значение |
|---|---|
| Проект | `kinggrief` |
| Ref | `enlvqtofjsqsxzrupqzy` |
| Регион | `eu-central-1` (Франкфурт) |
| URL | `https://enlvqtofjsqsxzrupqzy.supabase.co` |
| Таблицы | `public.site_settings`, `public.site_settings_audit` |
| RLS | включён; доступ только `service_role` (обход RLS) |
| Начальные данные | строка `singleton` с настройками по умолчанию (`play.kinggrief.net`) |

Проверено через SQL: `upsert` ровно того JSON, который пишет приложение
(`{ id: 'singleton', payload: {...}, updated_at }`), и чтение обратно — работают.
После проверки данные возвращены к значениям по умолчанию.

Пароль базы и `service_role`-ключ выданы в чате; в репозиторий они не коммитятся.

## Что нужно сделать в вашем проекте Vercel

Проект, на котором живёт `kinggrief.vercel.app`, **не находится в аккаунте, подключённом
к этому чату** (там 0 проектов: команда `qwerty` / idanjakraft@gmail.com). Поэтому переменные
нужно добавить руками — 2 минуты:

1. Vercel → ваш проект → **Settings → Environment Variables**.
2. Добавить для **Production, Preview и Development**:

```
SUPABASE_URL=https://enlvqtofjsqsxzrupqzy.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role JWT — выдан в чате>
ADMIN_PASSWORD=<ваш пароль админки>
ADMIN_SESSION_SECRET=<32+ случайных символа>
```

3. **Redeploy** (Deployments → ⋯ → Redeploy), переменные применяются только к новому деплою.

> Важно: `service_role`, **не** `anon`. При включённом RLS анонимный ключ на чтение вернёт
> пусто, приложение молча возьмёт значения по умолчанию — и снова будет казаться, что
> «сохранение не работает».

## Если ваш код использует другие имена/таблицы

Тогда одних переменных недостаточно: приложение должно читать настройки из
`public.site_settings` (поле `payload`) и писать туда же. В этом репозитории это делает
`lib/settings-store.ts`; готовый код можно выложить как есть — проект Vercel `kinggrief-fixed`
уже создан и переменные окружения в него добавлены.

## Как проверить, что всё работает

1. В админке: `/admin/diagnose` → должно быть «Всё в порядке» (или только замечание про 2FA),
   блок «Хранилище» → `Supabase` и «постоянное».
2. Поменять IP → открыть главную **в другом браузере**: новый адрес.
3. Через 30 секунд обновить админку: значение должно остаться новым (а не откатиться).

## SQL для самостоятельной проверки

```sql
select payload->>'serverIp' as ip,
       payload->>'updatedBy' as changed_by,
       updated_at
from public.site_settings;

select at, ip, changed, before, after
from public.site_settings_audit
order by at desc
limit 10;
```
