package com.winvisual.core;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Complete WinVisual 36-module registry, 6 color themes, crosshair config,
 * friend list, and zero-dependency bidirectional sync with <gameDir>/config/winvisual-hud.json.
 */
public final class WinVisualConfig {

    public static final class ThemePalette {
        public final String id;
        public final String name;
        public final int primary;
        public final int secondary;
        public final int cardBg;
        public final int cardBorder;

        public ThemePalette(String id, String name, int primary, int secondary, int cardBg, int cardBorder) {
            this.id = id;
            this.name = name;
            this.primary = primary;
            this.secondary = secondary;
            this.cardBg = cardBg;
            this.cardBorder = cardBorder;
        }
    }

    public static final ThemePalette[] THEMES = new ThemePalette[] {
        new ThemePalette("violet", "Royal Violet", 0x8B7CFF, 0xC4B5FD, 0xDF0B0D16, 0x558B7CFF),
        new ThemePalette("pulse-neon", "Pulse Neon", 0xA855F7, 0x38BDF8, 0xDF0A0C16, 0x55A855F7),
        new ThemePalette("crimson", "Pulse Crimson", 0xF43F5E, 0xFDA4AF, 0xDF110A10, 0x55F43F5E),
        new ThemePalette("cyber", "Cyber Cyan", 0x22D3EE, 0x818CF8, 0xDF081118, 0x5522D3EE),
        new ThemePalette("emerald", "Emerald Glow", 0x10B981, 0x6EE7B7, 0xDF081310, 0x5510B981),
        new ThemePalette("arctic", "Obsidian Pure", 0xF8FAFC, 0x94A3B8, 0xE6090A0F, 0x45FFFFFF)
    };

    public final List<WinVisualModule> modules = new ArrayList<WinVisualModule>();
    private final Map<String, WinVisualModule> byId = new LinkedHashMap<String, WinVisualModule>();

    public int themeIndex = 0;
    public String equippedCape = "nebula";

    // Crosshair parameters synced with WinVisual Launcher
    public int crosshairGap = 4;
    public int crosshairSize = 7;
    public int crosshairThickness = 2;
    public boolean crosshairDot = true;
    public boolean crosshairOutline = true;

    private File configFile;
    private long lastLoadedMtime = -1L;
    private long lastPollMs = 0L;

    public WinVisualConfig() {
        registerDefaults();
    }

    public ThemePalette theme() {
        return THEMES[Math.max(0, Math.min(THEMES.length - 1, themeIndex))];
    }

    public WinVisualModule get(String id) {
        return byId.get(id);
    }

    private void add(WinVisualModule m) {
        modules.add(m);
        byId.put(m.id, m);
    }

    private void registerDefaults() {
        // === 1. ESP & RENDER (WinVisual core visual suite) ===
        add(new WinVisualModule("player-esp", "Player ESP", "2D projected bounding boxes around players", WinVisualModule.Category.ESP, true, 0, "NONE")
                .withModes("Style", 0, "Corners", "Full Box", "Filled Glow")
                .withSlider("Max Range", 24f, 160f, 96f)
                .withSubToggle("Tint Fill", true));

        add(new WinVisualModule("health-esp", "Health & Armor ESP", "Side HP gradient bar & held item next to ESP box", WinVisualModule.Category.ESP, true, 0, "NONE")
                .withModes("Position", 0, "Left Bar", "Right Bar", "Bottom")
                .withSlider("Thickness", 1f, 4f, 2f)
                .withSubToggle("Numeric HP", true));

        add(new WinVisualModule("nametags", "Nametags", "Floating distance-scaled player name, HP & ping badge", WinVisualModule.Category.ESP, true, 0, "NONE")
                .withModes("Style", 0, "Glass Pill", "Minimal", "Compact")
                .withSlider("Scale", 0.7f, 1.6f, 1.0f)
                .withSubToggle("Show Held Item", true));

        add(new WinVisualModule("tracers", "Tracers", " translucent snaplines to visible nearby players", WinVisualModule.Category.ESP, false, 0, "NONE")
                .withModes("Origin", 0, "Crosshair", "Bottom")
                .withSlider("Opacity", 0.2f, 1.0f, 0.55f)
                .withSubToggle("Distance Color", true));

        add(new WinVisualModule("mob-esp", "Mob ESP", "Projected corner boxes on hostile & passive mobs", WinVisualModule.Category.ESP, false, 0, "NONE")
                .withModes("Filter", 0, "Hostile Only", "All Mobs")
                .withSlider("Range", 16f, 96f, 48f)
                .withSubToggle("Mob Labels", true));

        add(new WinVisualModule("item-esp", "Item ESP", "Floating count tags & boxes on dropped ground items", WinVisualModule.Category.ESP, true, 0, "NONE")
                .withModes("Style", 0, "Pill Tag", "Box + Tag")
                .withSlider("Range", 12f, 64f, 36f)
                .withSubToggle("Stack Count", true));

        add(new WinVisualModule("pearl-tracer", "Pearl Tracer", "3D glowing trajectory trail & distance on Ender Pearls", WinVisualModule.Category.ESP, true, 0, "NONE")
                .withModes("Color", 0, "Theme Neon", "Cyan", "Gold")
                .withSlider("Trail Length", 10f, 50f, 28f)
                .withSubToggle("Landing Tag", true));

        add(new WinVisualModule("hitbox-outline", "Target Outline", "Crisp frame around focused entity in crosshair", WinVisualModule.Category.ESP, true, 0, "NONE")
                .withModes("Style", 0, "Neon Glow", "Sharp")
                .withSlider("Width", 1f, 3f, 2f)
                .withSubToggle("Hurt Flash", true));

        // === 2. DRAGGABLE HUD 2.0 ===
        add(new WinVisualModule("watermark", "Watermark", "WinVisual pill header with FPS, ping & clock", WinVisualModule.Category.HUD, true, 0, "NONE")
                .withModes("Style", 0, "Glass Pill", "Neon Line", "Minimal")
                .withSlider("Opacity", 0.5f, 1.0f, 0.92f)
                .withSubToggle("Show Clock", true)
                .withHudBox(14, 14, 246, 24));

        add(new WinVisualModule("target-hud", "Target HUD", "Animated combat target card with smooth HP & WIN diff", WinVisualModule.Category.HUD, true, 0, "NONE")
                .withModes("Style", 0, "Neon Card", "Pulse Bar", "Compact")
                .withSlider("Hold Sec", 1f, 8f, 3.5f)
                .withSubToggle("Hurt Pulse", true)
                .withHudBox(330, 178, 174, 54));

        add(new WinVisualModule("minimap", "Rotating Minimap", "Live rotating radar with players, mobs, items & compass", WinVisualModule.Category.HUD, true, 0, "NONE")
                .withModes("Range", 0, "48 Blocks", "80 Blocks", "120 Blocks")
                .withSlider("Size", 76f, 132f, 96f)
                .withSubToggle("Player Names", true)
                .withHudBox(14, 46, 98, 108));

        add(new WinVisualModule("potions-hud", "Potions HUD", "Active status effects list with live countdown timers", WinVisualModule.Category.HUD, true, 0, "NONE")
                .withModes("Sort", 0, "Duration", "Alphabetical")
                .withSlider("Opacity", 0.5f, 1.0f, 0.9f)
                .withSubToggle("Timer Bar", true)
                .withHudBox(14, 162, 134, 62));

        add(new WinVisualModule("keybinds-hud", "Keybinds HUD", "Shows all keybound modules and live ON/OFF state", WinVisualModule.Category.HUD, true, 0, "NONE")
                .withModes("Filter", 0, "All Bound", "Active Only")
                .withSlider("Opacity", 0.5f, 1.0f, 0.9f)
                .withSubToggle("Glow Dot", true)
                .withHudBox(14, 234, 134, 68));

        add(new WinVisualModule("keystrokes", "Keystrokes", "Reactive WASD + LMB/RMB tiles with live CPS readout", WinVisualModule.Category.HUD, true, 0, "NONE")
                .withModes("Layout", 0, "WASD + Mouse", "Compact WASD")
                .withSlider("Opacity", 0.5f, 1.0f, 0.88f)
                .withSubToggle("Show CPS", true)
                .withHudBox(14, 314, 104, 86));

        add(new WinVisualModule("armor-hud", "Armor Status", "Equipped armor & held weapon durability percentages", WinVisualModule.Category.HUD, true, 0, "NONE")
                .withModes("Orient", 0, "Horizontal", "Vertical")
                .withSlider("Opacity", 0.5f, 1.0f, 0.9f)
                .withSubToggle("Durability %", true)
                .withHudBox(300, 246, 198, 28));

        add(new WinVisualModule("performance-hud", "Performance Gauges", "Real FPS, frame time ms, JVM RAM % & BPS sparkline", WinVisualModule.Category.HUD, true, 0, "NONE")
                .withModes("Graph", 0, "Sparkline", "Compact")
                .withSlider("Opacity", 0.5f, 1.0f, 0.9f)
                .withSubToggle("Frame Graph", true)
                .withHudBox(122, 46, 138, 52));

        add(new WinVisualModule("coordinates", "Coordinates & BPS", "Live XYZ, Nether coordinates, direction & speed", WinVisualModule.Category.HUD, true, 0, "NONE")
                .withModes("Mode", 0, "XYZ + Nether", "XYZ Compact")
                .withSlider("Opacity", 0.5f, 1.0f, 0.9f)
                .withSubToggle("Show Speed", true)
                .withHudBox(128, 376, 168, 24));

        add(new WinVisualModule("media-player", "Media Player", "WinVisual Now Playing widget with animated spectrum bars", WinVisualModule.Category.HUD, true, 0, "NONE")
                .withModes("Preset", 0, "Synthwave", "Night Drive", "Lo-Fi Rain")
                .withSlider("Bars", 4f, 10f, 7f)
                .withSubToggle("Animate EQ", true)
                .withHudBox(122, 104, 148, 36));

        add(new WinVisualModule("array-list", "Active Modules", "Sorted active visual modules badge list on top-right", WinVisualModule.Category.HUD, true, 0, "NONE")
                .withModes("Color", 0, "Theme Wave", "Static Accent")
                .withSlider("Spacing", 11f, 15f, 12f)
                .withSubToggle("Side Bar", true)
                .withHudBox(516, 14, 118, 120));

        // === 3. PARTICLES & TRAILS ===
        add(new WinVisualModule("hit-particles", "Hit Particles", "Spawns world & screen particles on entity damage", WinVisualModule.Category.PARTICLES, true, 0, "NONE")
                .withModes("Particle", 0, "EndRod", "Totem", "Heart", "Flame", "Crit")
                .withSlider("Count", 4f, 24f, 12f)
                .withSubToggle("Screen Stars", true));

        add(new WinVisualModule("trails", "3D Ribbon Trail", "Glowing smooth 3D world trail following player motion", WinVisualModule.Category.PARTICLES, true, 0, "NONE")
                .withModes("Style", 0, "Dual Ribbon", "Neon Line", "Orbs")
                .withSlider("Length", 15f, 70f, 42f)
                .withSubToggle("First Person", false));

        add(new WinVisualModule("jump-circles", "Jump Circles", "Expanding 3D shockwave rings on ground when jumping", WinVisualModule.Category.PARTICLES, true, 0, "NONE")
                .withModes("Ring", 0, "Double Wave", "Hex Pulse", "Single")
                .withSlider("Radius", 0.8f, 2.4f, 1.45f)
                .withSubToggle("Inner Glow", true));

        add(new WinVisualModule("ambient-particles", "Fireflies Aura", "Floating glowing motes drifting in 3D air around you", WinVisualModule.Category.PARTICLES, true, 0, "NONE")
                .withModes("Density", 0, "Subtle", "Medium", "Lush")
                .withSlider("Radius", 3f, 10f, 6f)
                .withSubToggle("Pulse Alpha", true));

        // === 4. COSMETICS ===
        add(new WinVisualModule("china-hat", "ChinaHat Halo", "24-segment rotating 3D gradient cone hat above head", WinVisualModule.Category.COSMETICS, true, 0, "NONE")
                .withModes("Model", 0, "Neon Cone", "Crown Halo", "Sakura Ring")
                .withSlider("Radius", 0.45f, 0.9f, 0.65f)
                .withSubToggle("Show FirstPerson", false));

        add(new WinVisualModule("crystal-wings", "Crystal Wings", "Articulated flapping 3D geometric wings in F5 view", WinVisualModule.Category.COSMETICS, true, 0, "NONE")
                .withModes("Design", 0, "Crystal", "Seraphim", "Cyber Blade")
                .withSlider("Span", 0.7f, 1.6f, 1.1f)
                .withSubToggle("Chroma Edge", true));

        add(new WinVisualModule("cape-shader", "Cape Physics", "Synced cloak preset & back aura particle shimmer", WinVisualModule.Category.COSMETICS, true, 0, "NONE")
                .withModes("Cloak", 0, "Nebula", "Eclipse", "Cyber", "Crimson")
                .withSlider("Wave Speed", 0.5f, 2.0f, 1.15f)
                .withSubToggle("Shimmer Trail", true));

        add(new WinVisualModule("hit-combo", "Combo & Hit Flash", "Tracks consecutive combat hits with accent pulse", WinVisualModule.Category.COSMETICS, true, 0, "NONE")
                .withModes("Feedback", 0, "Combo Pill", "Edge Pulse")
                .withSlider("Reset Sec", 2f, 6f, 3.5f)
                .withSubToggle("Sound Cue", true));

        // === 5. WORLD, CAMERA & HAND ===
        add(new WinVisualModule("custom-crosshair", "Custom Crosshair", "Dynamic movement & attack-reactive neon crosshair", WinVisualModule.Category.WORLD, true, 0, "NONE")
                .withModes("Shape", 0, "Dynamic Cross", "Circle + Dot", "T-Cross")
                .withSlider("Gap", 2f, 10f, 4f)
                .withSubToggle("Center Dot", true));

        add(new WinVisualModule("zoom", "Smooth Zoom", "Hold C for smooth cinematic FOV magnification", WinVisualModule.Category.WORLD, true, 67 /* GLFW_KEY_C */, "C")
                .withModes("Curve", 0, "Smooth Glide", "Instant")
                .withSlider("Zoom Factor", 2.0f, 8.0f, 3.8f)
                .withSubToggle("Cinema Bars", false));

        add(new WinVisualModule("fullbright", "FullBright", "Clean night & cave illumination with instant restore", WinVisualModule.Category.WORLD, true, 66 /* GLFW_KEY_B */, "B")
                .withModes("Level", 0, "Max 1500%", "Soft 400%")
                .withSlider("Strength", 4f, 15f, 12f)
                .withSubToggle("Warm Tint", false));

        add(new WinVisualModule("ambience", "Ambience Time", "Locks client sky atmosphere to Sunset or Midnight", WinVisualModule.Category.WORLD, false, 0, "NONE")
                .withModes("Sky", 0, "Midnight", "Sunset", "Dawn", "Noon")
                .withSlider("Tint", 0f, 0.35f, 0.10f)
                .withSubToggle("Sky Vignette", true));

        add(new WinVisualModule("viewmodel", "ViewModel Tint", "Subtle theme aura vignette & hand shader accent", WinVisualModule.Category.WORLD, false, 0, "NONE")
                .withModes("Tint", 0, "Neon Glow", "Cyber")
                .withSlider("Intensity", 0.05f, 0.35f, 0.14f)
                .withSubToggle("Pulse", true));

        add(new WinVisualModule("notifications", "HUD Notifications", "Slide-in corner toast when modules toggle via keybind", WinVisualModule.Category.WORLD, true, 0, "NONE")
                .withModes("Position", 0, "Bottom Right", "Top Center")
                .withSlider("Duration", 1.2f, 4.0f, 2.2f)
                .withSubToggle("Compact", false));
    }

    public void bindConfigFile(File gameDir) {
        File dir = new File(gameDir, "config");
        if (!dir.exists()) {
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
        }
        this.configFile = new File(dir, "winvisual-hud.json");
        reloadIfModified(true);
    }

    public void reloadIfModified(boolean force) {
        if (configFile == null) return;
        long now = System.currentTimeMillis();
        if (!force && now - lastPollMs < 1500L) return;
        lastPollMs = now;
        if (!configFile.exists()) {
            save();
            return;
        }
        long mtime = configFile.lastModified();
        if (!force && mtime == lastLoadedMtime) return;
        lastLoadedMtime = mtime;

        try {
            byte[] raw = readAllBytes(configFile);
            String json = new String(raw, StandardCharsets.UTF_8);
            applyJson(json);
        } catch (Exception ignored) {
        }
    }

    private static byte[] readAllBytes(File f) throws Exception {
        byte[] buf = new byte[(int) f.length()];
        FileInputStream in = new FileInputStream(f);
        try {
            int off = 0;
            while (off < buf.length) {
                int r = in.read(buf, off, buf.length - off);
                if (r <= 0) break;
                off += r;
            }
        } finally {
            in.close();
        }
        return buf;
    }

    public void applyJson(String json) {
        Matcher tm = Pattern.compile("\"theme\"\\s*:\\s*\"([^\"]+)\"").matcher(json);
        if (tm.find()) {
            String tid = tm.group(1);
            for (int i = 0; i < THEMES.length; i++) {
                if (THEMES[i].id.equalsIgnoreCase(tid)) {
                    themeIndex = i;
                    break;
                }
            }
        }
        Matcher cm = Pattern.compile("\"equippedCape\"\\s*:\\s*\"([^\"]+)\"").matcher(json);
        if (cm.find()) {
            equippedCape = cm.group(1);
        }
        Matcher gapM = Pattern.compile("\"gap\"\\s*:\\s*(\\d+)").matcher(json);
        if (gapM.find()) crosshairGap = Integer.parseInt(gapM.group(1));
        Matcher szM = Pattern.compile("\"size\"\\s*:\\s*(\\d+)").matcher(json);
        if (szM.find()) crosshairSize = Integer.parseInt(szM.group(1));
        Matcher thM = Pattern.compile("\"thickness\"\\s*:\\s*(\\d+)").matcher(json);
        if (thM.find()) crosshairThickness = Integer.parseInt(thM.group(1));

        // Parse per-widget coordinates from "hudPositions": { "watermark": { "x": 18, "y": 18 }, ... }
        for (WinVisualModule m : modules) {
            if (m.draggableHud) {
                Pattern hp = Pattern.compile("\"" + Pattern.quote(m.id) + "\"\\s*:\\s*\\{\\s*\"x\"\\s*:\\s*(-?\\d+)\\s*,\\s*\"y\"\\s*:\\s*(-?\\d+)");
                Matcher hm = hp.matcher(json);
                if (hm.find()) {
                    m.hudX = Math.max(2, Integer.parseInt(hm.group(1)));
                    m.hudY = Math.max(2, Integer.parseInt(hm.group(2)));
                }
            }

            // Parse module object entries: { "id": "...", "enabled": true/false, ... }
            Pattern mp = Pattern.compile("\\{[^{}]*\"id\"\\s*:\\s*\"" + Pattern.quote(m.id) + "\"[^{}]*\\}");
            Matcher mm = mp.matcher(json);
            if (mm.find()) {
                String block = mm.group(0);
                Matcher em = Pattern.compile("\"enabled\"\\s*:\\s*(true|false)").matcher(block);
                if (em.find()) {
                    m.enabled = Boolean.parseBoolean(em.group(1));
                }
                Matcher mi = Pattern.compile("\"modeIndex\"\\s*:\\s*(\\d+)").matcher(block);
                if (mi.find() && m.modes.length > 0) {
                    m.modeIndex = Math.max(0, Math.min(m.modes.length - 1, Integer.parseInt(mi.group(1))));
                }
                Matcher sv = Pattern.compile("\"sliderValue\"\\s*:\\s*(-?[0-9.]+)").matcher(block);
                if (sv.find()) {
                    try {
                        m.sliderValue = Float.parseFloat(sv.group(1));
                    } catch (NumberFormatException ignored) {
                    }
                }
                Matcher kc = Pattern.compile("\"keyCode\"\\s*:\\s*(\\d+)").matcher(block);
                if (kc.find()) {
                    m.keyCode = Integer.parseInt(kc.group(1));
                }
                Matcher kb = Pattern.compile("\"keybind\"\\s*:\\s*\"([^\"]*)\"").matcher(block);
                if (kb.find()) {
                    m.keyLabel = kb.group(1);
                }
            }
        }
    }

    public void save() {
        if (configFile == null) return;
        try {
            StringBuilder sb = new StringBuilder(4096);
            sb.append("{\n");
            sb.append("  \"version\": \"2.7.4\",\n");
            sb.append("  \"theme\": \"").append(theme().id).append("\",\n");
            sb.append("  \"equippedCape\": \"").append(escape(equippedCape)).append("\",\n");
            sb.append("  \"crosshair\": {\n");
            sb.append("    \"gap\": ").append(crosshairGap).append(",\n");
            sb.append("    \"size\": ").append(crosshairSize).append(",\n");
            sb.append("    \"thickness\": ").append(crosshairThickness).append(",\n");
            sb.append("    \"centerDot\": ").append(crosshairDot).append(",\n");
            sb.append("    \"outline\": ").append(crosshairOutline).append(",\n");
            sb.append("    \"accentColor\": true\n");
            sb.append("  },\n");
            sb.append("  \"hudPositions\": {\n");
            List<WinVisualModule> hudMods = new ArrayList<WinVisualModule>();
            for (WinVisualModule m : modules) {
                if (m.draggableHud) hudMods.add(m);
            }
            for (int i = 0; i < hudMods.size(); i++) {
                WinVisualModule m = hudMods.get(i);
                sb.append("    \"").append(m.id).append("\": { \"x\": ").append(m.hudX).append(", \"y\": ").append(m.hudY).append(" }");
                if (i + 1 < hudMods.size()) sb.append(",");
                sb.append("\n");
            }
            sb.append("  },\n");
            sb.append("  \"modules\": [\n");
            for (int i = 0; i < modules.size(); i++) {
                WinVisualModule m = modules.get(i);
                sb.append("    { \"id\": \"").append(m.id)
                  .append("\", \"enabled\": ").append(m.enabled)
                  .append(", \"keybind\": \"").append(escape(m.keyLabel))
                  .append("\", \"keyCode\": ").append(m.keyCode)
                  .append(", \"modeIndex\": ").append(m.modeIndex)
                  .append(", \"sliderValue\": ").append(String.format(java.util.Locale.US, "%.2f", m.sliderValue))
                  .append(" }");
                if (i + 1 < modules.size()) sb.append(",");
                sb.append("\n");
            }
            sb.append("  ]\n");
            sb.append("}\n");

            FileOutputStream out = new FileOutputStream(configFile);
            try {
                out.write(sb.toString().getBytes(StandardCharsets.UTF_8));
            } finally {
                out.close();
            }
            lastLoadedMtime = configFile.lastModified();
        } catch (Exception ignored) {
        }
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
