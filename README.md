# WinVisual — Minecraft Visual Client Launcher

**Текущий релиз: [v2.8.0](https://github.com/qwerty707070/qqwerty/releases/tag/v2.8.0)** — установщики Windows (.exe / .msi), macOS (.dmg), Linux (.deb / .rpm / .AppImage) и три клиентских JAR-а.

Премиальный лаунчер визуального клиента Minecraft (**Tauri v2 + React 18 + TypeScript + Tailwind CSS + Framer Motion + Radix UI + Zustand**).

## Ключевые возможности
- **Нативное ядро Tauri v2 (`src-tauri/src/`):**
  - `auth.rs` — официальный поток **Microsoft OAuth 2.0 Device Flow → Xbox Live → XSTS → Minecraft Services** без ввода пароля в лаунчере и с шифрованием токенов в системном связочнике ОС (`keyring`).
  - `downloader.rs` — асинхронная потоковая загрузка артефактов Mojang (`piston-meta.mojang.com`) и Fabric (`meta.fabricmc.net`) с ограничением скорости и сверкой контрольных сумм.
  - `launcher.rs` — сборка нативного classpath, выделение памяти JVM (`-Xmx`), передача аргументов G1GC и запуск `KnotClient` с живой трансляцией логов.
- **Визуальные модули и редактор HUD 2.0 (`ModulesPage.tsx`):** перетаскиваемые мышью виджеты (`Watermark`, `WASD + CPS Keystrokes`, `Pulse Target HUD`, `Armor HUD`) и живой конструктор векторного прицела.
- **3D-просмотр скина и плащей 144 Гц (`Character3DViewer.tsx`):** вращаемая 3D-модель игрока с физической симуляцией ткани шейдерных плащей (`Nebula`, `Pulse Crimson`, `Aurora`, `Obsidian`).
- **Интерактивный режим сессии клиента (`LiveClientSessionModal.tsx`):** живая проверка всех настроенных HUD-виджетов, частиц удара, счётчика CPS и внутриигрового меню `ClickGUI [Right Shift]`.

## Запуск и сборка
```bash
# Режим разработки (Vite HMR + API)
npm run dev

# Production-сборка и быстрый сервер
npm run build
npm start

# Сборка нативного установщика Windows (.msi / .exe), macOS (.dmg), Linux (.AppImage / .deb)
npx @tauri-apps/cli build
```

## Client core

Один лаунчер — три версии игры. Клиентское ядро ставится автоматически при запуске: лаунчер
кладёт нужный JAR в `<папка игры>/mods/`, ставит Fabric, Fabric API и оптимизационные моды
(Sodium, Iris, Lithium), а при несовпадении мажорной версии Java скачивает официальный
рантайм Mojang.

| Minecraft | Ядро | Что внутри |
|---|---|---|
| 1.21.11 | `mod-fabric/arcanic-1.21.11/` | Полный клиент: меню (`ArcanicMenu`), гардероб (плащи, ножи, шапки, рюкзаки, крылья, питомцы), пресеты, редактор HUD, Dynamic Island, Target HUD, тосты, косметика, эффекты удара, свои шейдеры |
| 1.21.4 | `mod-fabric/mc-1.21.4/` + `shared-core` | WinVisual shared-core: HUD-виджеты, Studio-меню на дизайн-токенах, инспектор модулей |
| 1.16.5 | `mod-fabric/mc-1.16.5/` + `shared-core` | То же ядро, собранное под Java 8 |

Правка в `mod-fabric/shared-core/` сразу попадает в сборки 1.16.5 и 1.21.4; 1.21.11 собирается
из отдельного дерева `arcanic-1.21.11`.

`mod-fabric/arcanic-1.21.11/` — это копия [Arcanic Visuals](https://github.com/arcanic-su/arcanic)
(GNU GPL v3.0). Атрибуция, список встроенных зависимостей и условия лицензии — в
[NOTICE.md](NOTICE.md). Сборки, содержащие это дерево, распространяются под GPL v3.

## Сборка клиента локально

```bash
# 1.16.5 и 1.21.4 (Gradle 8.11.1, JDK 21)
gradle -p mod-fabric/mc-1.16.5 build
gradle -p mod-fabric/mc-1.21.4 build

# 1.21.11 (Gradle wrapper 9.7.1, JDK 25)
cd mod-fabric/arcanic-1.21.11 && ./gradlew build
```

Готовые JAR-ы появляются в `build/libs/` соответствующего проекта; CI публикует их в релиз
и коммитит в `public/mods/`.
