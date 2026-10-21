# Aether Visual — Minecraft Visual Client Launcher

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
