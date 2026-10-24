package com.winvisual.core;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.Deque;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Unified 144Hz/240Hz real-time visual engine shared across Minecraft 1.16.5, 1.21.4, and 1.21.11.
 */
public final class WinVisualEngine {

    public interface HostActions {
        void openMenuScreen();
        void closeMenuScreen();
        void spawnHitParticles(double x, double y, double z, int modeIndex, int count);
        void applyAmbienceTime(long worldTimeTicks);
    }

    private static final class TrailNode {
        final double x, y, z;
        final long timeMs;

        TrailNode(double x, double y, double z, long timeMs) {
            this.x = x;
            this.y = y;
            this.z = z;
            this.timeMs = timeMs;
        }
    }

    private static final class JumpRing {
        final double x, y, z;
        final long startMs;

        JumpRing(double x, double y, double z, long startMs) {
            this.x = x;
            this.y = y;
            this.z = z;
            this.startMs = startMs;
        }
    }

    private static final class ScreenStar {
        float x, y, vx, vy;
        final long startMs;

        ScreenStar(float x, float y, float vx, float vy, long startMs) {
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
            this.startMs = startMs;
        }
    }

    private static final class ToastItem {
        final String title;
        final boolean enabled;
        final long startMs;

        ToastItem(String title, boolean enabled, long startMs) {
            this.title = title;
            this.enabled = enabled;
            this.startMs = startMs;
        }
    }

    public static final int GLFW_KEY_ESCAPE = 256;
    public static final int GLFW_KEY_DELETE = 261;
    public static final int GLFW_KEY_BACKSPACE = 259;
    public static final int GLFW_KEY_INSERT = 260;
    public static final int GLFW_KEY_RIGHT_SHIFT = 344;

    public final WinVisualConfig config = new WinVisualConfig();

    // Smooth sub-tick entity interpolation state
    private final Map<Integer, double[]> prevTickPositions = new HashMap<Integer, double[]>();
    private final Map<Integer, double[]> currTickPositions = new HashMap<Integer, double[]>();
    private final Map<Integer, Integer> lastHurtSeen = new HashMap<Integer, Integer>();
    private final Map<Integer, Deque<TrailNode>> projectileTrails = new HashMap<Integer, Deque<TrailNode>>();
    private long lastClientTickNs = System.nanoTime();

    // World FX queues
    private final Deque<TrailNode> playerTrail = new ArrayDeque<TrailNode>();
    private final List<JumpRing> jumpRings = new ArrayList<JumpRing>();
    private final List<ScreenStar> hitStars = new ArrayList<ScreenStar>();
    private final List<ToastItem> toasts = new ArrayList<ToastItem>();
    private boolean wasOnGround = true;

    // Live FPS, frametime sparkline, speed & CPS telemetry
    private final float[] frameTimesMs = new float[40];
    private int frameTimeCursor = 0;
    private long lastFrameNs = System.nanoTime();
    private int liveFps = 144;
    private float liveFrameMs = 6.9f;
    private double liveBps = 0.0;
    private double prevSpeedX, prevSpeedZ;
    private long lastSpeedSampleMs = System.currentTimeMillis();

    private final Deque<Long> leftClickTimestamps = new ArrayDeque<Long>();
    private final Deque<Long> rightClickTimestamps = new ArrayDeque<Long>();
    private boolean prevLeftMouse = false;
    private boolean prevRightMouse = false;
    private boolean prevMenuKeyDown = false;
    private final Map<Integer, Boolean> prevBoundKeyStates = new HashMap<Integer, Boolean>();

    // TargetHUD & Combo persistence
    private String lockedTargetName = "";
    private float lockedTargetHp = 20f;
    private float lockedTargetMaxHp = 20f;
    private float smoothTargetHpPct = 1.0f;
    private double lockedTargetDist = 0.0;
    private int lockedTargetHurt = 0;
    private long lastTargetLockMs = 0L;
    private int hitComboCount = 0;
    private long lastHitMs = 0L;

    // Zoom & FullBright smooth state
    private double currentZoomMultiplier = 1.0;

    // Interactive ClickGUI & HUD Editor state
    private int activeTopTab = 0; // 0 = Modules, 1 = HUD Studio, 2 = Themes, 3 = Presets
    private int activeCategoryIdx = 0; // 0 = All, 1..5 = Category
    private int modulePageOffset = 0;
    private WinVisualModule selectedModule = null;
    private UiKit.Tokens uiTokens = null;
    private String uiTokensKey = "";
    private final List<WinVisualModule> keybindScratch = new ArrayList<WinVisualModule>();
    private final List<String[]> arrayListScratch = new ArrayList<String[]>();
    private WinVisualModule bindingModule = null;
    private WinVisualModule draggingHudModule = null;
    private int dragOffsetX = 0;
    private int dragOffsetY = 0;
    private WinVisualModule activeSliderModule = null;
    private int activeSliderX = 0;
    private int activeSliderW = 100;
    private boolean mediaPlaying = true;
    private int mediaTrackIdx = 0;
    private static final java.util.Comparator<String[]> ARRAY_LIST_ORDER = new java.util.Comparator<String[]>() {
        @Override
        public int compare(String[] a, String[] b) {
            return Integer.compare(Integer.parseInt(b[2]), Integer.parseInt(a[2]));
        }
    };
    private static final String[] MEDIA_TRACKS = new String[] {
        "WinVisual • Nightfall Synth",
        "WinVisual • Nebula Drift",
        "WinVisual • 144Hz Pulse"
    };
    private final SimpleDateFormat clockFmt = new SimpleDateFormat("HH:mm", Locale.US);

    public void init(File gameDirectory) {
        config.bindConfigFile(gameDirectory);
        pushToast("WinVisual loaded [Right Shift]", true);
    }

    public double getEffectiveFov(double baseFov, GameSnapshot snap) {
        WinVisualModule zoom = config.get("zoom");
        boolean holding = zoom != null && zoom.enabled && snap.keyLookup != null
                && zoom.keyCode > 0 && snap.keyLookup.isKeyDown(zoom.keyCode) && !snap.menuScreenOpen;
        double target = holding ? Math.max(1.5, zoom.sliderValue) : 1.0;
        double speed = (zoom != null && zoom.modeIndex == 1) ? 0.55 : 0.18;
        currentZoomMultiplier += (target - currentZoomMultiplier) * speed;
        return Math.max(12.0, baseFov / Math.max(1.0, currentZoomMultiplier));
    }

    public double getTargetGamma(double fallbackGamma) {
        WinVisualModule fb = config.get("fullbright");
        if (fb != null && fb.enabled) {
            return fb.modeIndex == 0 ? 15.0 : 4.5;
        }
        return fallbackGamma;
    }

    public void onClientTick(GameSnapshot snap, HostActions host) {
        lastClientTickNs = System.nanoTime();
        config.reloadIfModified(false);

        long nowMs = System.currentTimeMillis();

        // Update player speed in blocks/sec
        long dtMs = Math.max(1L, nowMs - lastSpeedSampleMs);
        if (dtMs >= 100L) {
            double moved = Math.hypot(snap.playerX - prevSpeedX, snap.playerZ - prevSpeedZ);
            liveBps = (moved * 1000.0) / dtMs;
            prevSpeedX = snap.playerX;
            prevSpeedZ = snap.playerZ;
            lastSpeedSampleMs = nowMs;
        }

        // Jump detection -> spawn 3D expanding ground shockwave ring
        if (wasOnGround && !snap.onGround) {
            WinVisualModule jc = config.get("jump-circles");
            if (jc != null && jc.enabled) {
                jumpRings.add(new JumpRing(snap.playerX, snap.playerY + 0.04, snap.playerZ, nowMs));
                if (jumpRings.size() > 16) {
                    jumpRings.remove(0);
                }
            }
        }
        wasOnGround = snap.onGround;

        // Player 3D ribbon trail node
        WinVisualModule tr = config.get("trails");
        if (tr != null && tr.enabled) {
            TrailNode tail = playerTrail.peekLast();
            if (tail == null || Math.hypot(snap.playerX - tail.x, snap.playerZ - tail.z) > 0.09
                    || Math.abs(snap.playerY - tail.y) > 0.09) {
                playerTrail.addLast(new TrailNode(snap.playerX, snap.playerY + 0.12, snap.playerZ, nowMs));
            }
            int maxNodes = Math.max(12, Math.round(tr.sliderValue));
            while (playerTrail.size() > maxNodes) {
                playerTrail.removeFirst();
            }
        } else {
            playerTrail.clear();
        }

        // Entity tick interpolation & hit detection
        Map<Integer, Boolean> aliveIds = new HashMap<Integer, Boolean>();
        for (int i = 0; i < snap.entities.size(); i++) {
            GameSnapshot.EntityData e = snap.entities.get(i);
            aliveIds.put(e.id, Boolean.TRUE);
            double[] cur = currTickPositions.get(e.id);
            if (cur == null) {
                prevTickPositions.put(e.id, new double[] { e.x, e.y, e.z });
                currTickPositions.put(e.id, new double[] { e.x, e.y, e.z });
            } else {
                prevTickPositions.put(e.id, new double[] { cur[0], cur[1], cur[2] });
                cur[0] = e.x;
                cur[1] = e.y;
                cur[2] = e.z;
            }

            // Projectile 3D trail tracking
            if (e.kind == GameSnapshot.KIND_PROJECTILE) {
                Deque<TrailNode> dq = projectileTrails.get(e.id);
                if (dq == null) {
                    dq = new ArrayDeque<TrailNode>();
                    projectileTrails.put(e.id, dq);
                }
                dq.addLast(new TrailNode(e.x, e.y, e.z, nowMs));
                while (dq.size() > 36) dq.removeFirst();
            }

            // Detect fresh entity damage frame -> HitParticles + TargetHUD lock + Combo counter
            Integer prevHurt = lastHurtSeen.get(e.id);
            int pHurt = prevHurt == null ? 0 : prevHurt.intValue();
            if (e.hurtTime > pHurt && e.hurtTime >= 7) {
                double dist = Math.hypot(snap.playerX - e.x, snap.playerZ - e.z);
                if (dist <= 7.5) {
                    hitComboCount = (nowMs - lastHitMs <= 3500L) ? (hitComboCount + 1) : 1;
                    lastHitMs = nowMs;

                    lockedTargetName = e.name;
                    lockedTargetHp = e.hp;
                    lockedTargetMaxHp = Math.max(1f, e.maxHp);
                    lockedTargetDist = dist;
                    lockedTargetHurt = 10;
                    lastTargetLockMs = nowMs;

                    WinVisualModule hpMod = config.get("hit-particles");
                    if (hpMod != null && hpMod.enabled && host != null) {
                        host.spawnHitParticles(e.x, e.y + e.height * 0.65, e.z,
                                hpMod.modeIndex, Math.round(hpMod.sliderValue));
                        if (hpMod.subToggle) {
                            spawnScreenBurst(snap.guiWidth * 0.5f, snap.guiHeight * 0.5f, nowMs);
                        }
                    }
                }
            }
            lastHurtSeen.put(e.id, e.hurtTime);
        }

        // Cleanup stale projectile trails
        Iterator<Integer> pit = projectileTrails.keySet().iterator();
        while (pit.hasNext()) {
            Integer id = pit.next();
            if (!aliveIds.containsKey(id)) pit.remove();
        }

        if (lockedTargetHurt > 0) lockedTargetHurt--;

        // Ambience sky time lock
        WinVisualModule amb = config.get("ambience");
        if (amb != null && amb.enabled && host != null) {
            long[] times = new long[] { 18000L, 13000L, 23200L, 6000L };
            host.applyAmbienceTime(times[Math.max(0, Math.min(times.length - 1, amb.modeIndex))]);
        }
    }

    private void spawnScreenBurst(float cx, float cy, long nowMs) {
        for (int i = 0; i < 8; i++) {
            double ang = (Math.PI * 2.0 * i) / 8.0 + (nowMs % 360) * 0.01;
            float spd = 1.6f + (i % 3) * 0.75f;
            hitStars.add(new ScreenStar(cx, cy, (float) Math.cos(ang) * spd, (float) Math.sin(ang) * spd, nowMs));
        }
        while (hitStars.size() > 40) hitStars.remove(0);
    }

    private void pushToast(String msg, boolean state) {
        toasts.add(new ToastItem(msg, state, System.currentTimeMillis()));
        while (toasts.size() > 5) toasts.remove(0);
    }

    /**
     * Master per-frame entry point invoked at monitor refresh rate (144Hz/240Hz).
     */
    public void renderFrame(Canvas2D g, GameSnapshot snap, HostActions host) {
        long nowNs = System.nanoTime();
        float dtMs = Math.min(50f, Math.max(0.5f, (nowNs - lastFrameNs) / 1_000_000f));
        lastFrameNs = nowNs;
        frameTimesMs[frameTimeCursor] = dtMs;
        frameTimeCursor = (frameTimeCursor + 1) % frameTimesMs.length;
        float sumMs = 0f;
        for (int i = 0; i < frameTimesMs.length; i++) sumMs += Math.max(0.5f, frameTimesMs[i]);
        liveFrameMs = sumMs / frameTimesMs.length;
        liveFps = Math.max(1, Math.round(1000f / liveFrameMs));

        long nowMs = System.currentTimeMillis();
        double partialTick = Math.max(0.0, Math.min(1.0, (nowNs - lastClientTickNs) / 50_000_000.0));
        double effectiveFov = getEffectiveFov(snap.fovDeg, snap);

        handleRealtimeInputs(snap, host, nowMs);

        WinVisualConfig.ThemePalette theme = config.theme();

        // 0. Optional ViewModel / Ambience atmospheric corner glow
        renderAtmosphereTint(g, snap, theme);

        // 1. 3D World Projected Cosmetics, Particles, Trails, JumpCircles & ESP Suite
        render3DWorldVisuals(g, snap, theme, partialTick, effectiveFov, nowMs);

        // 2. All Draggable HUD 2.0 Elements
        renderHudWidgets(g, snap, theme, nowMs);

        // 3. Dynamic Custom Crosshair (when menu closed)
        if (!snap.menuScreenOpen) {
            renderCustomCrosshair(g, snap, theme, nowMs);
        }

        // 4. Interactive In-Game ClickGUI & Draggable HUD Studio [Right Shift]
        if (snap.menuScreenOpen) {
            renderInteractiveMenu(g, snap, host, theme, nowMs);
        }

        // 5. Slide-in Keybind Notification Toasts
        renderToasts(g, snap, theme, nowMs);
    }

    private void handleRealtimeInputs(GameSnapshot snap, HostActions host, long nowMs) {
        // Track real LMB / RMB CPS
        if (snap.mouseLeftDown && !prevLeftMouse) {
            leftClickTimestamps.addLast(nowMs);
        }
        if (snap.mouseRightDown && !prevRightMouse) {
            rightClickTimestamps.addLast(nowMs);
        }
        while (!leftClickTimestamps.isEmpty() && nowMs - leftClickTimestamps.peekFirst() > 1000L) {
            leftClickTimestamps.removeFirst();
        }
        while (!rightClickTimestamps.isEmpty() && nowMs - rightClickTimestamps.peekFirst() > 1000L) {
            rightClickTimestamps.removeFirst();
        }

        if (snap.keyLookup != null) {
            // Right Shift or Insert toggles the in-game WinVisual Studio Menu
            boolean menuKey = snap.keyLookup.isKeyDown(GLFW_KEY_RIGHT_SHIFT)
                    || snap.keyLookup.isKeyDown(GLFW_KEY_INSERT);
            if (menuKey && !prevMenuKeyDown && bindingModule == null) {
                if (snap.menuScreenOpen) {
                    if (host != null) host.closeMenuScreen();
                } else {
                    if (host != null) host.openMenuScreen();
                }
            }
            prevMenuKeyDown = menuKey;

            // Keybind capture mode inside menu
            if (snap.menuScreenOpen && bindingModule != null) {
                if (snap.keyLookup.isKeyDown(GLFW_KEY_DELETE) || snap.keyLookup.isKeyDown(GLFW_KEY_BACKSPACE)) {
                    bindingModule.keyCode = 0;
                    bindingModule.keyLabel = "NONE";
                    bindingModule = null;
                    config.save();
                } else {
                    for (int k = 48; k <= 90; k++) {
                        if (snap.keyLookup.isKeyDown(k)) {
                            bindingModule.keyCode = k;
                            bindingModule.keyLabel = String.valueOf((char) k);
                            pushToast("Bound " + bindingModule.name + " -> [" + bindingModule.keyLabel + "]", true);
                            bindingModule = null;
                            config.save();
                            break;
                        }
                    }
                }
            } else if (!snap.menuScreenOpen) {
                // Module toggle keybinds during gameplay (except hold-Zoom on C)
                for (int i = 0; i < config.modules.size(); i++) {
                    WinVisualModule m = config.modules.get(i);
                    if (m.keyCode <= 0 || "zoom".equals(m.id)) continue;
                    boolean down = snap.keyLookup.isKeyDown(m.keyCode);
                    Boolean wasDown = prevBoundKeyStates.get(m.keyCode);
                    if (down && (wasDown == null || !wasDown.booleanValue())) {
                        m.enabled = !m.enabled;
                        config.save();
                        pushToast(m.name + (m.enabled ? " enabled" : " disabled"), m.enabled);
                    }
                    prevBoundKeyStates.put(m.keyCode, down);
                }
            }
        }

        // Crosshair target live update for TargetHUD
        if (snap.crosshairTarget != null) {
            GameSnapshot.EntityData t = snap.crosshairTarget;
            lockedTargetName = t.name;
            lockedTargetHp = t.hp;
            lockedTargetMaxHp = Math.max(1f, t.maxHp);
            lockedTargetDist = Math.hypot(snap.playerX - t.x, snap.playerZ - t.z);
            if (t.hurtTime > 0) lockedTargetHurt = t.hurtTime;
            lastTargetLockMs = nowMs;
        }
    }

    private void renderAtmosphereTint(Canvas2D g, GameSnapshot snap, WinVisualConfig.ThemePalette theme) {
        WinVisualModule vm = config.get("viewmodel");
        if (vm != null && vm.enabled) {
            float pulse = vm.subToggle ? (float) (0.75 + 0.25 * Math.sin(System.currentTimeMillis() / 900.0)) : 1f;
            int tintTop = Canvas2D.withAlpha(theme.primary, vm.sliderValue * 0.35f * pulse);
            int tintBot = Canvas2D.withAlpha(theme.secondary, vm.sliderValue * 0.45f * pulse);
            g.fill(0, 0, snap.guiWidth, 18, tintTop);
            g.fill(0, snap.guiHeight - 22, snap.guiWidth, snap.guiHeight, tintBot);
        }
    }

    private void render3DWorldVisuals(
            Canvas2D g,
            GameSnapshot snap,
            WinVisualConfig.ThemePalette theme,
            double partialTick,
            double fov,
            long nowMs
    ) {
        double[] p1 = new double[3];
        double[] p2 = new double[3];
        int[] box = new int[4];

        // 1. 3D Jump Circles on ground
        WinVisualModule jc = config.get("jump-circles");
        if (jc != null && jc.enabled) {
            Iterator<JumpRing> jit = jumpRings.iterator();
            while (jit.hasNext()) {
                JumpRing ring = jit.next();
                float age = (nowMs - ring.startMs) / 1500f;
                if (age >= 1.0f) {
                    jit.remove();
                    continue;
                }
                double eased = 1.0 - Math.pow(1.0 - age, 3.0);
                double radius = 0.22 + eased * jc.sliderValue;
                float alpha = (1.0f - age) * 0.85f;
                int segs = jc.modeIndex == 1 ? 6 : 20;
                draw3DRing(g, ring.x, ring.y, ring.z, radius, segs, snap, fov,
                        Canvas2D.withAlpha(theme.primary, alpha), p1, p2);
                if (jc.modeIndex == 0 && radius > 0.35) {
                    draw3DRing(g, ring.x, ring.y, ring.z, radius * 0.65, segs, snap, fov,
                            Canvas2D.withAlpha(theme.secondary, alpha * 0.65f), p1, p2);
                }
            }
        }

        // 2. 3D Player Ribbon Trail
        WinVisualModule tr = config.get("trails");
        if (tr != null && tr.enabled && (snap.thirdPerson || tr.subToggle) && playerTrail.size() > 1) {
            TrailNode prev = null;
            int idx = 0;
            int total = playerTrail.size();
            for (TrailNode node : playerTrail) {
                if (prev != null) {
                    float t = (float) idx / (float) total;
                    int col = Canvas2D.withAlpha(
                            Canvas2D.lerpColor(theme.secondary, theme.primary, t) & 0xFFFFFF,
                            t * 0.85f
                    );
                    if (Projection3D.project(prev.x, prev.y, prev.z, snap.camX, snap.camY, snap.camZ,
                            snap.camYaw, snap.camPitch, fov, snap.guiWidth, snap.guiHeight, p1)
                            && Projection3D.project(node.x, node.y, node.z, snap.camX, snap.camY, snap.camZ,
                            snap.camYaw, snap.camPitch, fov, snap.guiWidth, snap.guiHeight, p2)) {
                        g.line(p1[0], p1[1], p2[0], p2[1], 2, col);
                        if (tr.modeIndex == 0 && Projection3D.project(prev.x, prev.y + 0.55, prev.z,
                                snap.camX, snap.camY, snap.camZ, snap.camYaw, snap.camPitch, fov, snap.guiWidth, snap.guiHeight, p1)
                                && Projection3D.project(node.x, node.y + 0.55, node.z,
                                snap.camX, snap.camY, snap.camZ, snap.camYaw, snap.camPitch, fov, snap.guiWidth, snap.guiHeight, p2)) {
                            g.line(p1[0], p1[1], p2[0], p2[1], 1, Canvas2D.withAlpha(theme.secondary, t * 0.5f));
                        }
                    }
                }
                prev = node;
                idx++;
            }
        }

        // 3. Ambient 3D Fireflies Aura around player
        WinVisualModule ambP = config.get("ambient-particles");
        if (ambP != null && ambP.enabled) {
            int count = ambP.modeIndex == 0 ? 10 : (ambP.modeIndex == 1 ? 18 : 28);
            double rad = ambP.sliderValue;
            double tSec = nowMs / 1000.0;
            for (int i = 0; i < count; i++) {
                double seed = i * 2.39996;
                double orbitR = rad * (0.35 + 0.65 * ((i * 37 % 100) / 100.0));
                double ang = seed + tSec * (0.28 + (i % 5) * 0.06);
                double wx = snap.playerX + Math.cos(ang) * orbitR;
                double wz = snap.playerZ + Math.sin(ang) * orbitR;
                double wy = snap.playerY + 0.4 + 1.8 * (0.5 + 0.5 * Math.sin(tSec * 0.9 + seed));
                if (Projection3D.project(wx, wy, wz, snap.camX, snap.camY, snap.camZ,
                        snap.camYaw, snap.camPitch, fov, snap.guiWidth, snap.guiHeight, p1)) {
                    float pulse = ambP.subToggle ? (float) (0.45 + 0.55 * Math.abs(Math.sin(tSec * 1.6 + i))) : 0.8f;
                    int sz = p1[2] < 4.0 ? 3 : 2;
                    int sx = (int) Math.round(p1[0]);
                    int sy = (int) Math.round(p1[1]);
                    g.rect(sx - 1, sy - 1, sz + 2, sz + 2, Canvas2D.withAlpha(theme.primary, pulse * 0.28f));
                    g.rect(sx, sy, sz, sz, Canvas2D.withAlpha(theme.secondary, pulse * 0.9f));
                }
            }
        }

        // 4. Local Player 3D Cosmetics: ChinaHat Halo & Crystal Wings
        WinVisualModule hat = config.get("china-hat");
        if (hat != null && hat.enabled && (snap.thirdPerson || hat.subToggle)) {
            render3DChinaHat(g, snap.playerX, snap.playerY + 1.92, snap.playerZ, hat.sliderValue,
                    snap, fov, theme, nowMs, p1, p2);
        }
        WinVisualModule wings = config.get("crystal-wings");
        if (wings != null && wings.enabled && snap.thirdPerson) {
            render3DCrystalWings(g, snap.playerX, snap.playerY + 1.25, snap.playerZ, snap.camYaw,
                    wings.sliderValue, snap, fov, theme, nowMs, p1, p2);
        }

        // 5. Entities: Player ESP, Health/Armor ESP, Evo Nametags, Tracers, Mob ESP, Item ESP, Pearl Tracer
        WinVisualModule playerEsp = config.get("player-esp");
        WinVisualModule healthEsp = config.get("health-esp");
        WinVisualModule nametags = config.get("nametags");
        WinVisualModule tracers = config.get("tracers");
        WinVisualModule mobEsp = config.get("mob-esp");
        WinVisualModule itemEsp = config.get("item-esp");
        WinVisualModule pearlEsp = config.get("pearl-tracer");
        WinVisualModule hitOutline = config.get("hitbox-outline");

        for (int i = 0; i < snap.entities.size(); i++) {
            GameSnapshot.EntityData e = snap.entities.get(i);
            if (e.id == snap.playerId) continue;

            double[] pPos = prevTickPositions.get(e.id);
            double ex = pPos != null ? (pPos[0] + (e.x - pPos[0]) * partialTick) : e.x;
            double ey = pPos != null ? (pPos[1] + (e.y - pPos[1]) * partialTick) : e.y;
            double ez = pPos != null ? (pPos[2] + (e.z - pPos[2]) * partialTick) : e.z;
            double dist = Math.hypot(snap.playerX - ex, snap.playerZ - ez);

            // Projectile / Ender Pearl 3D Tracer
            if (e.kind == GameSnapshot.KIND_PROJECTILE && pearlEsp != null && pearlEsp.enabled) {
                int pRgb = pearlEsp.modeIndex == 1 ? 0x22D3EE : (pearlEsp.modeIndex == 2 ? 0xFBBF24 : theme.primary);
                Deque<TrailNode> dq = projectileTrails.get(e.id);
                if (dq != null && dq.size() > 1) {
                    TrailNode prev = null;
                    int k = 0;
                    for (TrailNode n : dq) {
                        if (prev != null
                                && Projection3D.project(prev.x, prev.y, prev.z, snap.camX, snap.camY, snap.camZ,
                                snap.camYaw, snap.camPitch, fov, snap.guiWidth, snap.guiHeight, p1)
                                && Projection3D.project(n.x, n.y, n.z, snap.camX, snap.camY, snap.camZ,
                                snap.camYaw, snap.camPitch, fov, snap.guiWidth, snap.guiHeight, p2)) {
                            float alpha = (float) k / (float) dq.size();
                            g.line(p1[0], p1[1], p2[0], p2[1], 2, Canvas2D.withAlpha(pRgb, alpha * 0.9f));
                        }
                        prev = n;
                        k++;
                    }
                }
                if (pearlEsp.subToggle && Projection3D.project(ex, ey + 0.35, ez, snap.camX, snap.camY, snap.camZ,
                        snap.camYaw, snap.camPitch, fov, snap.guiWidth, snap.guiHeight, p1)) {
                    String tag = String.format(Locale.US, "%s %.1fm", e.name, dist);
                    int tw = g.textWidth(tag) + 8;
                    int tx = (int) p1[0] - tw / 2;
                    int ty = (int) p1[1] - 12;
                    g.roundedRect(tx, ty, tw, 12, 3, 0xCC090B12);
                    g.drawText(tag, tx + 4, ty + 2, 0xFF000000 | pRgb);
                }
                continue;
            }

            // Dropped Item ESP
            if (e.kind == GameSnapshot.KIND_ITEM) {
                if (itemEsp != null && itemEsp.enabled && dist <= itemEsp.sliderValue) {
                    if (Projection3D.project(ex, ey + 0.35, ez, snap.camX, snap.camY, snap.camZ,
                            snap.camYaw, snap.camPitch, fov, snap.guiWidth, snap.guiHeight, p1)) {
                        String label = itemEsp.subToggle && e.itemCount > 1
                                ? (e.name + " x" + e.itemCount)
                                : e.name;
                        int tw = g.textWidth(label) + 8;
                        int tx = (int) p1[0] - tw / 2;
                        int ty = (int) p1[1] - 6;
                        g.roundedRect(tx, ty, tw, 12, 3, 0xCC0A0D16);
                        g.outlineRect(tx, ty, tw, 12, 1, Canvas2D.withAlpha(theme.secondary, 0.55f));
                        g.drawText(label, tx + 4, ty + 2, 0xFFF1F5F9);
                    }
                }
                continue;
            }

            // Mob ESP
            if (e.kind == GameSnapshot.KIND_HOSTILE || e.kind == GameSnapshot.KIND_PASSIVE) {
                boolean allow = mobEsp != null && mobEsp.enabled && dist <= mobEsp.sliderValue
                        && (mobEsp.modeIndex == 1 || e.kind == GameSnapshot.KIND_HOSTILE);
                boolean isFocused = snap.crosshairTarget != null && snap.crosshairTarget.id == e.id
                        && hitOutline != null && hitOutline.enabled;
                if (!allow && !isFocused) continue;

                if (Projection3D.projectBox(ex, ey, ez, e.width * 0.55, e.height,
                        snap.camX, snap.camY, snap.camZ, snap.camYaw, snap.camPitch, fov,
                        snap.guiWidth, snap.guiHeight, box)) {
                    int mobRgb = e.hurtTime > 0 ? 0xFB7185 : (e.kind == GameSnapshot.KIND_HOSTILE ? 0xF43F5E : 0x34D399);
                    g.cornerBox(box[0], box[1], box[2], box[3], 1, 7, 0xE0000000 | mobRgb);
                    if (mobEsp != null && mobEsp.enabled && mobEsp.subToggle) {
                        String tag = String.format(Locale.US, "%s %.0f❤", e.name, e.hp);
                        g.drawCenteredText(tag, (box[0] + box[2]) / 2, box[1] - 11, 0xFFE2E8F0);
                    }
                }
                continue;
            }

            // Player ESP + Health/Armor ESP + Evo Nametags + Snapline Tracers
            if (e.kind == GameSnapshot.KIND_PLAYER) {
                boolean inRange = playerEsp == null || dist <= playerEsp.sliderValue;
                if (!inRange) continue;

                if (tracers != null && tracers.enabled && Projection3D.project(ex, ey + e.height * 0.5, ez,
                        snap.camX, snap.camY, snap.camZ, snap.camYaw, snap.camPitch, fov,
                        snap.guiWidth, snap.guiHeight, p1)) {
                    double ox = snap.guiWidth * 0.5;
                    double oy = tracers.modeIndex == 0 ? snap.guiHeight * 0.5 : snap.guiHeight - 4;
                    int tRgb = tracers.subToggle && dist < 12.0 ? 0xF43F5E : theme.primary;
                    g.line(ox, oy, p1[0], p1[1], 1, Canvas2D.withAlpha(tRgb, tracers.sliderValue));
                }

                if (!Projection3D.projectBox(ex, ey, ez, e.width * 0.55, e.height + 0.08,
                        snap.camX, snap.camY, snap.camZ, snap.camYaw, snap.camPitch, fov,
                        snap.guiWidth, snap.guiHeight, box)) {
                    continue;
                }

                int x1 = box[0], y1 = box[1], x2 = box[2], y2 = box[3];
                int bw = Math.max(4, x2 - x1);
                int bh = Math.max(6, y2 - y1);
                int boxRgb = e.hurtTime > 0 ? 0xFB7185 : theme.primary;

                if (playerEsp != null && playerEsp.enabled) {
                    if (playerEsp.subToggle || playerEsp.modeIndex == 2) {
                        g.rect(x1 + 1, y1 + 1, bw - 2, bh - 2, Canvas2D.withAlpha(boxRgb, 0.14f));
                    }
                    if (playerEsp.modeIndex == 0) {
                        g.cornerBox(x1, y1, x2, y2, 2, Math.max(5, bw / 3), 0xFF000000 | boxRgb);
                    } else {
                        g.outlineRect(x1 - 1, y1 - 1, bw + 2, bh + 2, 1, 0xB8000000);
                        g.outlineRect(x1, y1, bw, bh, 1, 0xFF000000 | boxRgb);
                    }
                }

                // Health Bar ESP beside player box
                if (healthEsp != null && healthEsp.enabled) {
                    float hpRatio = Math.max(0f, Math.min(1f, e.hp / Math.max(1f, e.maxHp)));
                    int hpColor = hpRatio > 0.6f ? 0xFF10B981 : (hpRatio > 0.3f ? 0xFFF59E0B : 0xFFF43F5E);
                    int barThick = Math.max(2, Math.round(healthEsp.sliderValue));
                    int bx = healthEsp.modeIndex == 1 ? (x2 + 3) : (x1 - barThick - 4);
                    g.rect(bx - 1, y1 - 1, barThick + 2, bh + 2, 0xC8000000);
                    int filledH = Math.max(1, Math.round(bh * hpRatio));
                    g.rect(bx, y2 - filledH, barThick, filledH, hpColor);
                    if (healthEsp.subToggle && bh >= 24) {
                        String hpTxt = String.format(Locale.US, "%.1f", e.hp);
                        g.drawText(hpTxt, bx - g.textWidth(hpTxt) - 2, y2 - filledH - 2, hpColor);
                    }
                }

                // Evo Floating Nametag Pill above player box
                if (nametags != null && nametags.enabled) {
                    String tagText = String.format(Locale.US, "%s  %.1f❤  %.0fm", e.name, e.hp, dist);
                    int tw = g.textWidth(tagText) + 10;
                    int tx = (x1 + x2) / 2 - tw / 2;
                    int ty = y1 - 16;
                    g.evoCard(tx, ty, tw, 13, 0xDC090B13, theme.cardBorder,
                            0xFF000000 | theme.primary, 0xFF000000 | theme.secondary);
                    g.drawText(tagText, tx + 5, ty + 3, 0xFFF8FAFC);

                    if (nametags.subToggle && e.heldItem != null && !e.heldItem.isEmpty()) {
                        int iw = g.textWidth(e.heldItem) + 8;
                        int ix = (x1 + x2) / 2 - iw / 2;
                        g.roundedRect(ix, y2 + 3, iw, 11, 3, 0xBD090B12);
                        g.drawText(e.heldItem, ix + 4, y2 + 4, 0xFFCBD5E1);
                    }
                }
            }
        }

        // 6. Screen Hit Burst Stars
        Iterator<ScreenStar> sit = hitStars.iterator();
        while (sit.hasNext()) {
            ScreenStar s = sit.next();
            float age = (nowMs - s.startMs) / 550f;
            if (age >= 1.0f) {
                sit.remove();
                continue;
            }
            s.x += s.vx;
            s.y += s.vy;
            s.vy += 0.08f;
            float alpha = 1.0f - age;
            g.rect(Math.round(s.x), Math.round(s.y), 3, 3, Canvas2D.withAlpha(theme.secondary, alpha));
        }
    }

    private void draw3DRing(
            Canvas2D g,
            double cx,
            double cy,
            double cz,
            double radius,
            int segments,
            GameSnapshot snap,
            double fov,
            int argb,
            double[] p1,
            double[] p2
    ) {
        for (int i = 0; i < segments; i++) {
            double a1 = (Math.PI * 2.0 * i) / segments;
            double a2 = (Math.PI * 2.0 * (i + 1)) / segments;
            boolean ok1 = Projection3D.project(cx + Math.cos(a1) * radius, cy, cz + Math.sin(a1) * radius,
                    snap.camX, snap.camY, snap.camZ, snap.camYaw, snap.camPitch, fov, snap.guiWidth, snap.guiHeight, p1);
            boolean ok2 = Projection3D.project(cx + Math.cos(a2) * radius, cy, cz + Math.sin(a2) * radius,
                    snap.camX, snap.camY, snap.camZ, snap.camYaw, snap.camPitch, fov, snap.guiWidth, snap.guiHeight, p2);
            if (ok1 && ok2) {
                g.line(p1[0], p1[1], p2[0], p2[1], 2, argb);
            }
        }
    }

    private void render3DChinaHat(
            Canvas2D g,
            double hx,
            double hy,
            double hz,
            float radius,
            GameSnapshot snap,
            double fov,
            WinVisualConfig.ThemePalette theme,
            long nowMs,
            double[] apexPt,
            double[] rimPt
    ) {
        if (!Projection3D.project(hx, hy + 0.30, hz, snap.camX, snap.camY, snap.camZ,
                snap.camYaw, snap.camPitch, fov, snap.guiWidth, snap.guiHeight, apexPt)) {
            return;
        }
        double spin = (nowMs % 6000L) / 6000.0 * Math.PI * 2.0;
        double prevRx = 0, prevRy = 0;
        boolean hasPrev = false;
        int segs = 22;
        for (int i = 0; i <= segs; i++) {
            double a = spin + (Math.PI * 2.0 * i) / segs;
            if (Projection3D.project(hx + Math.cos(a) * radius, hy, hz + Math.sin(a) * radius,
                    snap.camX, snap.camY, snap.camZ, snap.camYaw, snap.camPitch, fov,
                    snap.guiWidth, snap.guiHeight, rimPt)) {
                int col = Canvas2D.waveColor(theme.primary, theme.secondary, (double) i / segs);
                g.line(apexPt[0], apexPt[1], rimPt[0], rimPt[1], 1, Canvas2D.withAlpha(col, 0.45f));
                if (hasPrev) {
                    g.line(prevRx, prevRy, rimPt[0], rimPt[1], 2, Canvas2D.withAlpha(col, 0.9f));
                }
                prevRx = rimPt[0];
                prevRy = rimPt[1];
                hasPrev = true;
            } else {
                hasPrev = false;
            }
        }
    }

    private void render3DCrystalWings(
            Canvas2D g,
            double bx,
            double by,
            double bz,
            float yawDeg,
            float span,
            GameSnapshot snap,
            double fov,
            WinVisualConfig.ThemePalette theme,
            long nowMs,
            double[] p1,
            double[] p2
    ) {
        double flap = Math.sin(nowMs / 340.0) * 0.35;
        double baseRad = Math.toRadians(yawDeg + 180.0);
        for (int side = -1; side <= 1; side += 2) {
            for (int feather = 0; feather < 4; feather++) {
                double len = span * (1.0 - feather * 0.16);
                double spread = baseRad + side * (1.15 + flap * 0.4);
                double wx1 = bx + Math.cos(spread) * 0.15;
                double wz1 = bz + Math.sin(spread) * 0.15;
                double wx2 = bx + Math.cos(spread) * len;
                double wz2 = bz + Math.sin(spread) * len;
                double wy2 = by + 0.36 - feather * 0.22 + flap * 0.18;
                if (Projection3D.project(wx1, by, wz1, snap.camX, snap.camY, snap.camZ,
                        snap.camYaw, snap.camPitch, fov, snap.guiWidth, snap.guiHeight, p1)
                        && Projection3D.project(wx2, wy2, wz2, snap.camX, snap.camY, snap.camZ,
                        snap.camYaw, snap.camPitch, fov, snap.guiWidth, snap.guiHeight, p2)) {
                    int col = feather % 2 == 0 ? theme.primary : theme.secondary;
                    g.line(p1[0], p1[1], p2[0], p2[1], 2, Canvas2D.withAlpha(col, 0.85f));
                }
            }
        }
    }

    private void renderHudWidgets(
            Canvas2D g,
            GameSnapshot snap,
            WinVisualConfig.ThemePalette theme,
            long nowMs
    ) {
        int accentA = 0xFF000000 | theme.primary;
        int accentB = 0xFF000000 | theme.secondary;

        // 1. Watermark Pill
        WinVisualModule wm = config.get("watermark");
        if (wm != null && wm.enabled) {
            String clock = wm.subToggle ? ("  •  " + clockFmt.format(new Date(nowMs))) : "";
            String text = "WinVisual " + snap.mcVersion + "  •  " + snap.username + "  •  " + liveFps + " FPS  •  " + snap.pingMs + "ms" + clock;
            int w = g.textWidth(text) + 28;
            wm.hudW = w;
            wm.hudH = 22;
            int x = clampX(wm, snap);
            int y = clampY(wm, snap);
            g.evoCard(x, y, w, 22, theme.cardBg, theme.cardBorder, accentA, accentB);
            g.roundedRect(x + 6, y + 5, 12, 12, 3, accentA);
            g.drawText("W", x + 9, y + 7, 0xFFFFFFFF);
            g.drawText(text, x + 23, y + 7, 0xFFF1F5F9);
            drawHudDragFrame(g, wm, snap, theme);
        }

        // 2. Rotating Minimap (Radar 2.0)
        WinVisualModule map = config.get("minimap");
        if (map != null && map.enabled) {
            int size = Math.round(map.sliderValue);
            map.hudW = size;
            map.hudH = size + 14;
            int x = clampX(map, snap);
            int y = clampY(map, snap);
            g.evoCard(x, y, size, size + 14, theme.cardBg, theme.cardBorder, accentA, accentB);

            int cx = x + size / 2;
            int cy = y + size / 2 + 2;
            double maxBlocks = map.modeIndex == 0 ? 48.0 : (map.modeIndex == 1 ? 80.0 : 120.0);
            double scale = (size * 0.44) / maxBlocks;

            // Crosshair grid lines inside radar
            g.fill(x + 6, cy, x + size - 6, cy + 1, 0x22FFFFFF);
            g.fill(cx, y + 8, cx + 1, y + size - 4, 0x22FFFFFF);

            double rot = Math.toRadians(-snap.camYaw + 180.0);
            double cosR = Math.cos(rot), sinR = Math.sin(rot);

            for (int i = 0; i < snap.entities.size(); i++) {
                GameSnapshot.EntityData e = snap.entities.get(i);
                if (e.id == snap.playerId) continue;
                double dx = e.x - snap.playerX;
                double dz = e.z - snap.playerZ;
                if (Math.hypot(dx, dz) > maxBlocks) continue;
                int rx = cx + (int) Math.round((dx * cosR - dz * sinR) * scale);
                int ry = cy + (int) Math.round((dx * sinR + dz * cosR) * scale);
                int dotCol = e.kind == GameSnapshot.KIND_PLAYER ? accentA
                        : (e.kind == GameSnapshot.KIND_HOSTILE ? 0xFFF43F5E
                        : (e.kind == GameSnapshot.KIND_ITEM ? 0xFF38BDF8 : 0xFF34D399));
                g.rect(rx - 1, ry - 1, 3, 3, dotCol);
            }
            // Local player arrow center dot
            g.rect(cx - 2, cy - 2, 4, 4, 0xFFFFFFFF);
            String coordFoot = ((int) Math.round(snap.playerX)) + ", " + ((int) Math.round(snap.playerZ));
            g.drawCenteredText(coordFoot, cx, y + size + 2, 0xFF94A3B8);
            drawHudDragFrame(g, map, snap, theme);
        }

        // 3. Target HUD (combat active OR preview inside menu)
        WinVisualModule thud = config.get("target-hud");
        if (thud != null && thud.enabled) {
            long holdMs = Math.round(thud.sliderValue * 1000f);
            boolean activeTarget = !lockedTargetName.isEmpty() && (nowMs - lastTargetLockMs <= holdMs);
            if (activeTarget || snap.menuScreenOpen) {
                String tName = activeTarget ? lockedTargetName : snap.username;
                float curHp = activeTarget ? lockedTargetHp : snap.playerHp;
                float maxHp = activeTarget ? lockedTargetMaxHp : Math.max(1f, snap.playerMaxHp);
                double dist = activeTarget ? lockedTargetDist : 2.9;

                float targetRatio = Math.max(0f, Math.min(1f, curHp / maxHp));
                smoothTargetHpPct += (targetRatio - smoothTargetHpPct) * 0.16f;

                int w = 178, h = 52;
                thud.hudW = w;
                thud.hudH = h;
                int x = clampX(thud, snap);
                int y = clampY(thud, snap);

                int border = lockedTargetHurt > 0 ? 0xCCF43F5E : theme.cardBorder;
                g.evoCard(x, y, w, h, theme.cardBg, border, accentA, accentB);

                // Avatar badge
                g.roundedRect(x + 8, y + 9, 32, 32, 6, Canvas2D.withAlpha(theme.primary, 0.25f));
                g.outlineRect(x + 8, y + 9, 32, 32, 1, accentA);
                String init = tName.isEmpty() ? "P" : tName.substring(0, 1).toUpperCase(Locale.US);
                g.drawCenteredText(init, x + 24, y + 21, 0xFFFFFFFF);

                g.drawText(tName, x + 46, y + 9, 0xFFFFFFFF);
                String meta = String.format(Locale.US, "%.1f HP • %.1fm", curHp, dist);
                g.drawText(meta, x + 46, y + 21, 0xFF94A3B8);

                String verdict = curHp <= snap.playerHp ? "WIN" : "FOE";
                int vCol = curHp <= snap.playerHp ? 0xFF34D399 : 0xFFFCA5A5;
                g.drawText(verdict, x + w - g.textWidth(verdict) - 8, y + 9, vCol);

                // Smooth animated gradient HP bar
                int barW = w - 54;
                g.roundedRect(x + 46, y + 34, barW, 8, 3, 0x44FFFFFF);
                int fillW = Math.max(3, Math.round(barW * smoothTargetHpPct));
                g.hGradient(x + 46, y + 34, fillW, 8, accentA, accentB);
                drawHudDragFrame(g, thud, snap, theme);
            }
        }

        // 4. Potions HUD
        WinVisualModule pot = config.get("potions-hud");
        if (pot != null && pot.enabled && (!snap.effects.isEmpty() || snap.menuScreenOpen)) {
            int rows = Math.max(1, snap.effects.size());
            int w = 138;
            int h = 18 + rows * 14;
            pot.hudW = w;
            pot.hudH = h;
            int x = clampX(pot, snap);
            int y = clampY(pot, snap);
            g.evoCard(x, y, w, h, theme.cardBg, theme.cardBorder, accentA, accentB);
            g.drawText("Effects", x + 7, y + 5, accentB);
            if (snap.effects.isEmpty()) {
                g.drawText("Speed II", x + 7, y + 18, 0xFFE2E8F0);
                g.drawText("01:24", x + w - 34, y + 18, 0xFF94A3B8);
            } else {
                for (int i = 0; i < snap.effects.size(); i++) {
                    GameSnapshot.EffectData ef = snap.effects.get(i);
                    int secs = Math.max(0, ef.durationTicks / 20);
                    String dur = String.format(Locale.US, "%02d:%02d", secs / 60, secs % 60);
                    String nm = ef.name + (ef.amplifier > 0 ? (" " + (ef.amplifier + 1)) : "");
                    g.drawText(nm, x + 7, y + 18 + i * 14, 0xFFE2E8F0);
                    g.drawText(dur, x + w - g.textWidth(dur) - 6, y + 18 + i * 14, 0xFF94A3B8);
                }
            }
            drawHudDragFrame(g, pot, snap, theme);
        }

        // 5. Keybinds HUD (Evo Active Binds card)
        WinVisualModule kb = config.get("keybinds-hud");
        if (kb != null && kb.enabled) {
            List<WinVisualModule> bound = keybindScratch;
            bound.clear();
            for (int i = 0; i < config.modules.size(); i++) {
                WinVisualModule m = config.modules.get(i);
                if (m.keyCode > 0 && (kb.modeIndex == 0 || m.enabled)) {
                    bound.add(m);
                }
            }
            int rows = Math.max(1, bound.size());
            int w = 138;
            int h = 18 + rows * 13;
            kb.hudW = w;
            kb.hudH = h;
            int x = clampX(kb, snap);
            int y = clampY(kb, snap);
            g.evoCard(x, y, w, h, theme.cardBg, theme.cardBorder, accentA, accentB);
            g.drawText("Keybinds", x + 7, y + 5, accentB);
            for (int i = 0; i < bound.size(); i++) {
                WinVisualModule m = bound.get(i);
                int ry = y + 18 + i * 13;
                g.drawText(m.name, x + 7, ry, m.enabled ? 0xFFF8FAFC : 0xFF94A3B8);
                String tag = "[" + m.keyLabel + "]";
                g.drawText(tag, x + w - g.textWidth(tag) - 6, ry, m.enabled ? accentA : 0xFF64748B);
            }
            drawHudDragFrame(g, kb, snap, theme);
        }

        // 6. Keystrokes + CPS
        WinVisualModule ks = config.get("keystrokes");
        if (ks != null && ks.enabled) {
            ks.hudW = 92;
            ks.hudH = ks.modeIndex == 0 ? 78 : 58;
            int x = clampX(ks, snap);
            int y = clampY(ks, snap);
            drawKeyCap(g, x + 31, y, 28, 18, "W", snap.keyW, theme);
            drawKeyCap(g, x, y + 20, 28, 18, "A", snap.keyA, theme);
            drawKeyCap(g, x + 31, y + 20, 28, 18, "S", snap.keyS, theme);
            drawKeyCap(g, x + 62, y + 20, 28, 18, "D", snap.keyD, theme);
            drawKeyCap(g, x, y + 40, 90, 14, "───", snap.keySpace, theme);
            if (ks.modeIndex == 0) {
                String lTxt = ks.subToggle ? ("LMB " + leftClickTimestamps.size()) : "LMB";
                String rTxt = ks.subToggle ? ("RMB " + rightClickTimestamps.size()) : "RMB";
                drawKeyCap(g, x, y + 56, 44, 18, lTxt, snap.mouseLeftDown, theme);
                drawKeyCap(g, x + 46, y + 56, 44, 18, rTxt, snap.mouseRightDown, theme);
            }
            drawHudDragFrame(g, ks, snap, theme);
        }

        // 7. Armor Status Bar
        WinVisualModule arm = config.get("armor-hud");
        if (arm != null && arm.enabled && !snap.equipment.isEmpty()) {
            int w = 196, h = 24;
            arm.hudW = w;
            arm.hudH = h;
            int x = clampX(arm, snap);
            int y = clampY(arm, snap);
            g.evoCard(x, y, w, h, theme.cardBg, theme.cardBorder, accentA, accentB);
            int slotW = (w - 10) / Math.max(1, snap.equipment.size());
            for (int i = 0; i < snap.equipment.size(); i++) {
                GameSnapshot.EquipmentSlotData s = snap.equipment.get(i);
                int sx = x + 6 + i * slotW;
                String txt = s.empty ? (s.slotShort + " —") : (s.durabilityPct >= 0 ? (s.slotShort + " " + s.durabilityPct + "%") : s.slotShort);
                int col = s.empty ? 0xFF475569 : (s.durabilityPct >= 0 && s.durabilityPct < 25 ? 0xFFF43F5E : 0xFFE2E8F0);
                g.drawText(txt, sx, y + 8, col);
            }
            drawHudDragFrame(g, arm, snap, theme);
        }

        // 8. Performance Gauges + Sparkline
        WinVisualModule perf = config.get("performance-hud");
        if (perf != null && perf.enabled) {
            Runtime rt = Runtime.getRuntime();
            long usedMb = (rt.totalMemory() - rt.freeMemory()) / (1024L * 1024L);
            long maxMb = Math.max(1L, rt.maxMemory() / (1024L * 1024L));
            int ramPct = (int) Math.min(99L, (usedMb * 100L) / maxMb);

            int w = 142, h = perf.subToggle ? 48 : 30;
            perf.hudW = w;
            perf.hudH = h;
            int x = clampX(perf, snap);
            int y = clampY(perf, snap);
            g.evoCard(x, y, w, h, theme.cardBg, theme.cardBorder, accentA, accentB);
            g.drawText(String.format(Locale.US, "%d FPS  %.1fms", liveFps, liveFrameMs), x + 7, y + 6, 0xFFFFFFFF);
            g.drawText("RAM " + ramPct + "%", x + 7, y + 17, 0xFF94A3B8);

            if (perf.subToggle) {
                for (int i = 0; i < 32; i++) {
                    float ms = frameTimesMs[(frameTimeCursor + i) % frameTimesMs.length];
                    int barH = Math.max(2, Math.min(12, Math.round(14f - ms * 0.4f)));
                    g.fill(x + 8 + i * 4, y + 43 - barH, x + 10 + i * 4, y + 43, accentA);
                }
            }
            drawHudDragFrame(g, perf, snap, theme);
        }

        // 9. Coordinates + Nether + Speed BPS
        WinVisualModule coords = config.get("coordinates");
        if (coords != null && coords.enabled) {
            String txt = String.format(Locale.US, "XYZ %d %d %d  •  %.1f b/s",
                    (int) Math.round(snap.playerX),
                    (int) Math.round(snap.playerY),
                    (int) Math.round(snap.playerZ),
                    liveBps);
            int w = g.textWidth(txt) + 14;
            coords.hudW = w;
            coords.hudH = 20;
            int x = clampX(coords, snap);
            int y = clampY(coords, snap);
            g.evoCard(x, y, w, 20, theme.cardBg, theme.cardBorder, accentA, accentB);
            g.drawText(txt, x + 7, y + 6, 0xFFE2E8F0);
            drawHudDragFrame(g, coords, snap, theme);
        }

        // 10. Evo Media Player Widget
        WinVisualModule media = config.get("media-player");
        if (media != null && media.enabled) {
            int w = 152, h = 32;
            media.hudW = w;
            media.hudH = h;
            int x = clampX(media, snap);
            int y = clampY(media, snap);
            g.evoCard(x, y, w, h, theme.cardBg, theme.cardBorder, accentA, accentB);
            String title = MEDIA_TRACKS[mediaTrackIdx % MEDIA_TRACKS.length];
            g.drawText(title, x + 7, y + 6, 0xFFF1F5F9);
            g.drawText(mediaPlaying ? "▶ LIVE AUDIO" : "❚❚ PAUSED", x + 7, y + 18, 0xFF94A3B8);
            int bars = Math.round(media.sliderValue);
            for (int b = 0; b < bars; b++) {
                int bh = mediaPlaying && media.subToggle
                        ? (2 + (int) Math.round(8.0 * Math.abs(Math.sin(nowMs / 180.0 + b * 0.9))))
                        : 3;
                g.fill(x + w - 8 - b * 4, y + 26 - bh, x + w - 6 - b * 4, y + 26, accentA);
            }
            drawHudDragFrame(g, media, snap, theme);
        }

        // 11. Active Modules ArrayList (top-right badge column, clean cards)
        WinVisualModule arr = config.get("array-list");
        if (arr != null && arr.enabled) {
            List<String[]> entries = arrayListScratch;
            entries.clear();
            for (int i = 0; i < config.modules.size(); i++) {
                WinVisualModule m = config.modules.get(i);
                if (m.enabled && m.category != WinVisualModule.Category.HUD) {
                    String suffix = m.modes.length > 0 ? m.activeMode() : "";
                    int entryW = g.textWidth(m.name) + (suffix.isEmpty() ? 0 : 6 + g.textWidth(suffix));
                    entries.add(new String[] { m.name, suffix, String.valueOf(entryW) });
                }
            }
            // Sort on the width measured once above instead of re-measuring every comparison.
            entries.sort(ARRAY_LIST_ORDER);

            int rowH = Math.max(10, Math.round(arr.sliderValue));
            int gap = 4;
            int pad = 14;
            int maxTw = pad;
            for (int i = 0; i < entries.size(); i++) {
                maxTw = Math.max(maxTw, pad + Integer.parseInt(entries.get(i)[2]));
            }
            int w = Math.min(maxTw, 240);
            int h = entries.isEmpty() ? 0 : Math.min(12, entries.size()) * (rowH + gap) - gap;
            int x = Math.max(4, Math.min(snap.guiWidth - w - 4, arr.hudX));
            int y = Math.max(4, Math.min(snap.guiHeight - h - 4, arr.hudY));
            if (h > 0) {
                g.evoCard(x, y, w, h, theme.cardBg, theme.cardBorder,
                        accentA, accentB);
            }
            int curY = y + 3;
            for (int i = 0; i < Math.min(12, entries.size()); i++) {
                String[] e = entries.get(i);
                int col = arr.modeIndex == 0
                        ? Canvas2D.waveColor(theme.primary, theme.secondary, i * 0.08)
                        : accentA;
                g.drawText(e[0], x + 7, curY + 1, col);
                if (!e[1].isEmpty()) {
                    g.drawText(" §7" + e[1], x + 7 + g.textWidth(e[0]), curY + 1, 0xFF94A3B8);
                }
                if (arr.subToggle) {
                    g.fill(x + 3, curY - 1, x + 5, curY + rowH - 1, col);
                }
                curY += rowH + gap;
            }
            drawHudDragFrame(g, arr, snap, theme);
        }

        // 12. Hit Combo Badge
        WinVisualModule combo = config.get("hit-combo");
        if (combo != null && combo.enabled && hitComboCount >= 2 && (nowMs - lastHitMs <= combo.sliderValue * 1000L)) {
            String cTxt = "COMBO x" + hitComboCount;
            int cw = g.textWidth(cTxt) + 14;
            int cx = snap.guiWidth / 2 - cw / 2;
            int cy = snap.guiHeight / 2 + 24;
            g.evoCard(cx, cy, cw, 16, theme.cardBg, accentA, accentA, accentB);
            g.drawText(cTxt, cx + 7, cy + 4, 0xFFFFFFFF);
        }
    }

    private void drawKeyCap(Canvas2D g, int x, int y, int w, int h, String label, boolean pressed, WinVisualConfig.ThemePalette theme) {
        int bg = pressed ? Canvas2D.withAlpha(theme.primary, 0.72f) : theme.cardBg;
        int border = pressed ? (0xFF000000 | theme.secondary) : theme.cardBorder;
        g.roundedRect(x, y, w, h, 4, bg);
        g.outlineRect(x, y, w, h, 1, border);
        g.drawCenteredText(label, x + w / 2, y + (h - 8) / 2, pressed ? 0xFFFFFFFF : 0xFFE2E8F0);
    }

    private void drawHudDragFrame(Canvas2D g, WinVisualModule m, GameSnapshot snap, WinVisualConfig.ThemePalette theme) {
        if (!snap.menuScreenOpen) return;
        boolean hovered = snap.mouseX >= m.hudX && snap.mouseX <= m.hudX + m.hudW
                && snap.mouseY >= m.hudY && snap.mouseY <= m.hudY + m.hudH;
        if (hovered || draggingHudModule == m) {
            g.outlineRect(m.hudX - 2, m.hudY - 2, m.hudW + 4, m.hudH + 4, 1, 0xFF000000 | theme.secondary);
        }
    }

    private void renderCustomCrosshair(Canvas2D g, GameSnapshot snap, WinVisualConfig.ThemePalette theme, long nowMs) {
        WinVisualModule ch = config.get("custom-crosshair");
        if (ch == null || !ch.enabled) return;

        int cx = snap.guiWidth / 2;
        int cy = snap.guiHeight / 2;
        int dynExpand = (int) Math.min(5, Math.round(liveBps * 0.35)) + (nowMs - lastHitMs < 200L ? 3 : 0);
        int gap = Math.round(ch.sliderValue) + dynExpand;
        int len = Math.max(3, config.crosshairSize);
        int thick = Math.max(1, config.crosshairThickness);
        int col = (nowMs - lastHitMs < 220L) ? 0xFFF43F5E : (0xFF000000 | theme.primary);

        if (ch.modeIndex == 1) {
            // Circle + dot
            int segs = 16;
            double[] prev = null;
            for (int i = 0; i <= segs; i++) {
                double a = (Math.PI * 2.0 * i) / segs;
                double px = cx + Math.cos(a) * (gap + 3);
                double py = cy + Math.sin(a) * (gap + 3);
                if (prev != null) g.line(prev[0], prev[1], px, py, 1, col);
                prev = new double[] { px, py };
            }
        } else {
            if (ch.modeIndex != 2) {
                g.rect(cx - thick / 2, cy - gap - len, thick, len, col);
            }
            g.rect(cx - thick / 2, cy + gap, thick, len, col);
            g.rect(cx - gap - len, cy - thick / 2, len, thick, col);
            g.rect(cx + gap, cy - thick / 2, len, thick, col);
        }
        if (ch.subToggle) {
            g.rect(cx - 1, cy - 1, 2, 2, 0xFFFFFFFF);
        }
    }

    /** Reuses one token object per theme instead of rebuilding it every frame. */
    private UiKit.Tokens tokens(WinVisualConfig.ThemePalette theme) {
        String key = theme.id + "#" + config.themeIndex;
        if (uiTokens == null || !key.equals(uiTokensKey)) {
            uiTokens = new UiKit.Tokens(theme);
            uiTokensKey = key;
        }
        return uiTokens;
    }

    private void renderInteractiveMenu(
            Canvas2D g,
            GameSnapshot snap,
            HostActions host,
            WinVisualConfig.ThemePalette theme,
            long nowMs
    ) {
        boolean clickLeft = snap.mouseLeftDown && !prevLeftMouse;
        boolean clickRight = snap.mouseRightDown && !prevRightMouse;
        UiKit.Tokens t = tokens(theme);

        // Full-screen scrim. HUD Studio keeps a lighter one so widgets stay readable.
        g.fill(0, 0, snap.guiWidth, snap.guiHeight, activeTopTab == 1 ? 0x3A04060B : 0x8C04060B);

        // --- existing drag / slider interaction state ---------------------
        if (!snap.mouseLeftDown) {
            if (draggingHudModule != null || activeSliderModule != null) {
                draggingHudModule = null;
                activeSliderModule = null;
                config.save();
            }
        } else if (draggingHudModule != null) {
            int nx = (int) Math.round(snap.mouseX) - dragOffsetX;
            int ny = (int) Math.round(snap.mouseY) - dragOffsetY;
            int midX = (snap.guiWidth - draggingHudModule.hudW) / 2;
            if (Math.abs(nx - midX) <= 6) {
                nx = midX;
                g.fill(snap.guiWidth / 2, 0, snap.guiWidth / 2 + 1, snap.guiHeight, 0x66FFFFFF);
            }
            draggingHudModule.hudX = Math.max(4, Math.min(snap.guiWidth - draggingHudModule.hudW - 4, nx));
            draggingHudModule.hudY = Math.max(4, Math.min(snap.guiHeight - draggingHudModule.hudH - 4, ny));
        } else if (activeSliderModule != null) {
            float ratio = (float) ((snap.mouseX - activeSliderX) / Math.max(1.0, activeSliderW));
            ratio = Math.max(0f, Math.min(1f, ratio));
            activeSliderModule.sliderValue = activeSliderModule.sliderMin
                    + ratio * (activeSliderModule.sliderMax - activeSliderModule.sliderMin);
        }

        // --- HUD Studio: floating toolbar, whole screen free for dragging --
        if (activeTopTab == 1) {
            int barW = 420;
            int barH = 40;
            int bx = (snap.guiWidth - barW) / 2;
            int by = 12;
            UiKit.window(g, bx, by, barW, barH, t);
            UiKit.glyphTile(g, bx + 10, by + 9, 22, "W", true, t);
            g.drawText("HUD Studio", bx + 40, by + 10, t.text);
            g.drawText("Drag any widget to move it", bx + 40, by + 21, t.textDim);

            String done = "Done";
            int dw = g.textWidth(done) + 20;
            int dx = bx + barW - dw - 10;
            g.roundedRect(dx, by + 10, dw, 20, 10, t.accent);
            g.drawCenteredText(done, dx + dw / 2, by + 16, 0xFF0A0C12);
            if (clickLeft && UiKit.inBox(snap.mouseX, snap.mouseY, dx, by + 10, dw, 20)) {
                activeTopTab = 0;
            } else if (clickLeft) {
                tryStartHudDrag(snap);
            }
            prevLeftMouse = snap.mouseLeftDown;
            prevRightMouse = snap.mouseRightDown;
            final long hudUnused = nowMs;
            if (hudUnused < 0) pushToast("", false);
            return;
        }

        // --- window geometry ----------------------------------------------
        int winW = Math.min(820, snap.guiWidth - 24);
        int winH = Math.min(492, snap.guiHeight - 24);
        int wx = (snap.guiWidth - winW) / 2;
        int wy = (snap.guiHeight - winH) / 2;
        int railW = 142;
        int topH = 50;
        int footH = 22;

        UiKit.window(g, wx, wy, winW, winH, t);

        // Left rail ---------------------------------------------------------
        g.roundedRect(wx + 1, wy + 1, railW, winH - 2, t.radius, 0x59000000);
        g.fill(wx + railW, wy + 10, wx + railW + 1, wy + winH - 10, 0x12FFFFFF);

        UiKit.glyphTile(g, wx + 14, wy + 14, 24, "W", true, t);
        g.drawText("WinVisual", wx + 46, wy + 13, t.text);
        g.drawText("Studio  " + snap.mcVersion, wx + 46, wy + 24, t.textMute);

        String[] navLabels = new String[] { "All modules", "ESP & render", "HUD 2.0", "Particles", "Cosmetics", "World & view" };
        int[] navCounts = new int[navLabels.length];
        navCounts[0] = config.modules.size();
        WinVisualModule.Category[] cats = WinVisualModule.Category.values();
        for (int i = 0; i < config.modules.size(); i++) {
            WinVisualModule m = config.modules.get(i);
            for (int c = 0; c < cats.length; c++) {
                if (m.category == cats[c]) navCounts[c + 1]++;
            }
        }

        int navY = wy + 54;
        for (int i = 0; i < navLabels.length; i++) {
            int iy = navY + i * 27;
            boolean sel = activeCategoryIdx == i;
            boolean hov = UiKit.inBox(snap.mouseX, snap.mouseY, wx + 8, iy, railW - 16, 23);
            UiKit.navItem(g, wx + 8, iy, railW - 16, 23, navLabels[i], navCounts[i], sel, hov, t, g);
            if (clickLeft && hov) {
                activeCategoryIdx = i;
                modulePageOffset = 0;
            }
        }

        // Rail footer: theme switcher
        int themeY = wy + winH - 54;
        UiKit.divider(g, wx + 12, themeY - 8, railW - 24);
        UiKit.sectionLabel(g, "Theme", wx + 14, themeY, t);
        g.roundedRect(wx + 14, themeY + 12, 11, 11, 3, t.accent);
        g.roundedRect(wx + 28, themeY + 12, 11, 11, 3, t.accent2);
        g.drawText(UiKit.ellipsize(g, theme.name, railW - 60), wx + 44, themeY + 13, t.textDim);
        if (clickLeft && UiKit.inBox(snap.mouseX, snap.mouseY, wx + 8, themeY + 6, railW - 16, 22)) {
            config.themeIndex = (config.themeIndex + 1) % WinVisualConfig.THEMES.length;
            config.save();
            pushToast("Theme: " + WinVisualConfig.THEMES[config.themeIndex].name, true);
        }

        // Content origin ----------------------------------------------------
        int cx0 = wx + railW + 1;
        int cw = winW - railW - 1;

        String[] tabs = new String[] { "Modules", "HUD", "Themes", "Presets" };
        int tabW = 68;
        int tabHit = UiKit.segmented(g, tabs, activeTopTab, cx0 + 14, wy + 14, tabW, 21,
                snap.mouseX, snap.mouseY, clickLeft, t);
        if (tabHit >= 0) {
            activeTopTab = tabHit;
            if (tabHit != 0) selectedModule = null;
        }

        int closeX = wx + winW - 30;
        boolean closeHov = UiKit.inBox(snap.mouseX, snap.mouseY, closeX, wy + 14, 20, 20);
        g.roundedRect(closeX, wy + 14, 20, 20, 6, closeHov ? 0x1FFFFFFF : 0x0EFFFFFF);
        g.drawCenteredText("X", closeX + 10, wy + 20, t.textDim);
        if (clickLeft && closeHov) {
            if (host != null) host.closeMenuScreen();
        }

        g.drawText("Right Shift", cx0 + 14 + tabs.length * (tabW + 4) + 10, wy + 20, t.textMute);

        UiKit.divider(g, cx0 + 12, wy + topH - 6, cw - 24);

        int contentX = cx0 + 14;
        int contentY = wy + topH + 4;
        int contentW = cw - 28;
        int contentH = winH - topH - footH - 10;

        if (activeTopTab == 2) {
            renderThemesSubPage(g, snap, contentX, contentY, contentW, contentH, clickLeft, theme);
        } else if (activeTopTab == 3) {
            renderPresetsSubPage(g, snap, contentX, contentY, contentW, contentH, clickLeft, theme);
        } else {
            renderModulesSubPage(g, snap, contentX, contentY, contentW, contentH, clickLeft, clickRight, t);
        }

        // Footer ------------------------------------------------------------
        UiKit.divider(g, cx0 + 12, wy + winH - footH, cw - 24);
        g.drawText("LMB toggle    RMB settings    RShift close", cx0 + 14, wy + winH - footH + 6, t.textMute);
        String sync = "Synced with launcher";
        g.drawText(sync, wx + winW - 14 - g.textWidth(sync), wy + winH - footH + 6, t.textMute);

        prevLeftMouse = snap.mouseLeftDown;
        prevRightMouse = snap.mouseRightDown;
        final long unusedNow = nowMs;
        if (unusedNow < 0) pushToast("", false);
    }

    private void tryStartHudDrag(GameSnapshot snap) {
        for (int i = config.modules.size() - 1; i >= 0; i--) {
            WinVisualModule m = config.modules.get(i);
            if (m.draggableHud && m.enabled && inBox(snap.mouseX, snap.mouseY, m.hudX, m.hudY, m.hudW, m.hudH)) {
                draggingHudModule = m;
                dragOffsetX = (int) Math.round(snap.mouseX) - m.hudX;
                dragOffsetY = (int) Math.round(snap.mouseY) - m.hudY;
                break;
            }
        }
    }

    private void renderModulesSubPage(
            Canvas2D g,
            GameSnapshot snap,
            int x,
            int y,
            int w,
            int h,
            boolean clickLeft,
            boolean clickRight,
            UiKit.Tokens t
    ) {
        List<WinVisualModule> filtered = new ArrayList<WinVisualModule>();
        WinVisualModule.Category[] catValues = WinVisualModule.Category.values();
        for (int i = 0; i < config.modules.size(); i++) {
            WinVisualModule m = config.modules.get(i);
            if (activeCategoryIdx == 0 || m.category == catValues[activeCategoryIdx - 1]) {
                filtered.add(m);
            }
        }

        boolean inspectorOpen = selectedModule != null;
        int inspW = inspectorOpen ? Math.max(176, Math.min(240, w / 3)) : 0;
        int gridW = w - (inspectorOpen ? inspW + 10 : 0);

        int cardH = 38;
        int gap = 7;
        int colW = (gridW - gap) / 2;
        int rows = Math.max(1, (h - 20) / (cardH + gap));
        int perPage = rows * 2;
        int maxOffset = Math.max(0, ((filtered.size() - 1) / perPage) * perPage);
        modulePageOffset = Math.max(0, Math.min(modulePageOffset, maxOffset));

        int enabledCount = 0;
        for (int i = 0; i < filtered.size(); i++) {
            if (filtered.get(i).enabled) enabledCount++;
        }

        // --- header row ----------------------------------------------------
        UiKit.sectionLabel(g, filtered.size() + " modules  /  " + enabledCount + " enabled", x, y, t);
        int pageIdx = (modulePageOffset / perPage) + 1;
        int pageTotal = (maxOffset / perPage) + 1;
        String pageTxt = pageIdx + " / " + pageTotal;
        int px = x + gridW - g.textWidth(pageTxt);
        g.drawText(pageTxt, px, y, t.textMute);
        int arrowY = y - 3;
        int prevX = px - 34;
        int nextX = px - 16;
        boolean prevHov = UiKit.inBox(snap.mouseX, snap.mouseY, prevX, arrowY, 14, 15);
        boolean nextHov = UiKit.inBox(snap.mouseX, snap.mouseY, nextX, arrowY, 14, 15);
        g.roundedRect(prevX, arrowY, 14, 15, 4, prevHov ? 0x1FFFFFFF : 0x0EFFFFFF);
        g.drawCenteredText("<", prevX + 7, arrowY + 4, t.textDim);
        g.roundedRect(nextX, arrowY, 14, 15, 4, nextHov ? 0x1FFFFFFF : 0x0EFFFFFF);
        g.drawCenteredText(">", nextX + 7, arrowY + 4, t.textDim);
        if (clickLeft && prevHov) modulePageOffset = Math.max(0, modulePageOffset - perPage);
        if (clickLeft && nextHov) modulePageOffset = Math.min(maxOffset, modulePageOffset + perPage);

        // --- card grid -----------------------------------------------------
        int gridY = y + 14;

        for (int idx = modulePageOffset; idx < Math.min(filtered.size(), modulePageOffset + perPage); idx++) {
            WinVisualModule m = filtered.get(idx);
            int slot = idx - modulePageOffset;
            int col = slot % 2;
            int row = slot / 2;
            int cardX = x + col * (colW + gap);
            int cardY = gridY + row * (cardH + gap);

            boolean hov = UiKit.inBox(snap.mouseX, snap.mouseY, cardX, cardY, colW, cardH);
            boolean sel = selectedModule == m;
            UiKit.card(g, cardX, cardY, colW, cardH, sel, hov, t);
            UiKit.glyphTile(g, cardX + 8, cardY + 7, 24, UiKit.glyphFor(m.name), m.enabled, t);

            int textW = colW - 24 - 40 - 34;
            g.drawText(UiKit.ellipsize(g, m.name, textW), cardX + 38, cardY + 8, t.text);
            String sub = m.enabled ? (m.modes.length > 0 ? m.activeMode() : m.category.badge) : m.category.title;
            g.drawText(UiKit.ellipsize(g, sub, textW), cardX + 38, cardY + 20, t.textMute);

            UiKit.switchPill(g, cardX + colW - 32, cardY + 13, m.enabled, t);

            if (hov) {
                if (clickLeft) {
                    m.enabled = !m.enabled;
                    config.save();
                } else if (clickRight) {
                    selectedModule = sel ? null : m;
                }
            }
        }

        if (filtered.isEmpty()) {
            g.drawText("Nothing here yet", x, gridY + 6, t.textMute);
        }

        // --- inspector -----------------------------------------------------
        if (!inspectorOpen) return;

        WinVisualModule m = selectedModule;
        int ix = x + gridW + 10;
        int iy = gridY - 14;
        int ih = h - 6;
        UiKit.card(g, ix, iy, inspW, ih, false, false, t);

        int pad = 12;
        int innerW = inspW - pad * 2;

        UiKit.glyphTile(g, ix + pad, iy + pad, 30, UiKit.glyphFor(m.name), m.enabled, t);
        g.drawText(UiKit.ellipsize(g, m.name, innerW - 40), ix + pad + 38, iy + pad + 2, t.text);
        g.drawText(m.enabled ? "Enabled" : "Disabled", ix + pad + 38, iy + pad + 14,
                m.enabled ? t.accent2 : t.textMute);

        int cy = iy + pad + 40;
        String[] desc = UiKit.wrap(g, m.description, innerW, 3);
        for (int i = 0; i < desc.length; i++) {
            g.drawText(desc[i], ix + pad, cy, t.textDim);
            cy += 11;
        }

        cy += 6;
        UiKit.divider(g, ix + pad, cy, innerW);
        cy += 8;

        // Mode
        if (m.modes.length > 0) {
            UiKit.sectionLabel(g, m.modeLabel, ix + pad, cy, t);
            cy += 13;
            int cols = 2;
            int chipW = (innerW - 4) / cols;
            for (int i = 0; i < Math.min(m.modes.length, 4); i++) {
                int r = i / cols;
                int c = i % cols;
                int bx = ix + pad + c * (chipW + 4);
                int by = cy + r * 18;
                boolean on = i == m.modeIndex;
                g.roundedRect(bx, by, chipW, 15, 7, on ? Canvas2D.withAlpha(t.accent & 0xFFFFFF, 0.85f) : 0x0EFFFFFF);
                if (!on) g.outlineRect(bx, by, chipW, 15, 1, 0x1AFFFFFF);
                g.drawCenteredText(UiKit.ellipsize(g, m.modes[i], chipW - 6), bx + chipW / 2, by + 4,
                        on ? 0xFF0A0C12 : t.textDim);
                if (clickLeft && UiKit.inBox(snap.mouseX, snap.mouseY, bx, by, chipW, 15)) {
                    m.modeIndex = i;
                    config.save();
                }
            }
            cy += ((Math.min(m.modes.length, 4) + 1) / 2) * 18 + 6;
        }

        // Slider
        UiKit.sectionLabel(g, m.sliderLabel, ix + pad, cy, t);
        String val = String.format(Locale.US, "%.1f", m.sliderValue);
        g.drawText(val, ix + inspW - pad - g.textWidth(val), cy, t.accent2);
        cy += 12;
        float ratio = (m.sliderValue - m.sliderMin) / Math.max(0.001f, m.sliderMax - m.sliderMin);
        UiKit.slider(g, ix + pad, cy + 2, innerW, ratio, t);
        if (clickLeft && UiKit.inBox(snap.mouseX, snap.mouseY, ix + pad - 3, cy - 3, innerW + 6, 14)) {
            activeSliderModule = m;
            activeSliderX = ix + pad;
            activeSliderW = innerW;
            float r2 = (float) ((snap.mouseX - activeSliderX) / Math.max(1.0, activeSliderW));
            r2 = Math.max(0f, Math.min(1f, r2));
            m.sliderValue = m.sliderMin + r2 * (m.sliderMax - m.sliderMin);
        }
        cy += 20;

        // Sub toggle
        if (m.subToggleLabel != null) {
            g.drawText(UiKit.ellipsize(g, m.subToggleLabel, innerW - 34), ix + pad, cy, t.textDim);
            UiKit.switchPill(g, ix + inspW - pad - 24, cy - 1, m.subToggle, t);
            if (clickLeft && UiKit.inBox(snap.mouseX, snap.mouseY, ix + pad, cy - 4, innerW, 16)) {
                m.subToggle = !m.subToggle;
                config.save();
            }
            cy += 18;
        }

        // Keybind
        g.drawText("Keybind", ix + pad, cy, t.textDim);
        String kb = bindingModule == m ? "press..." : ("[" + m.keyLabel + "]");
        int kbW = Math.max(38, g.textWidth(kb) + 12);
        g.roundedRect(ix + inspW - pad - kbW, cy - 3, kbW, 14, 5,
                bindingModule == m ? Canvas2D.withAlpha(t.accent & 0xFFFFFF, 0.85f) : 0x0EFFFFFF);
        g.drawCenteredText(kb, ix + inspW - pad - kbW / 2, cy, t.textDim);
        if (clickLeft && UiKit.inBox(snap.mouseX, snap.mouseY, ix + inspW - pad - kbW, cy - 4, kbW, 16)) {
            bindingModule = m;
        }
        cy += 18;

        // Master switch
        UiKit.divider(g, ix + pad, cy, innerW);
        cy += 8;
        g.drawText("Module enabled", ix + pad, cy, t.textDim);
        UiKit.switchPill(g, ix + inspW - pad - 24, cy - 1, m.enabled, t);
        if (clickLeft && UiKit.inBox(snap.mouseX, snap.mouseY, ix + pad, cy - 4, innerW, 16)) {
            m.enabled = !m.enabled;
            config.save();
        }

        // Empty-space right click closes the inspector
        if (clickRight && UiKit.inBox(snap.mouseX, snap.mouseY, ix, iy, inspW, ih)) {
            boolean onControl = snap.mouseY < cy + 16;
            if (!onControl) selectedModule = null;
        }
    }

    private void renderThemesSubPage(
            Canvas2D g,
            GameSnapshot snap,
            int px,
            int bodyY,
            int panelW,
            int bodyH,
            boolean clickLeft,
            WinVisualConfig.ThemePalette activeTheme
    ) {
        UiKit.Tokens t = tokens(activeTheme);
        UiKit.sectionLabel(g, "Accent themes - synced with the launcher", px, bodyY, t);

        int gap = 8;
        int cols = Math.max(2, Math.min(3, panelW / 150));
        int cardW = (panelW - gap * (cols - 1)) / cols;
        int cardH = 74;

        for (int i = 0; i < WinVisualConfig.THEMES.length; i++) {
            WinVisualConfig.ThemePalette tp = WinVisualConfig.THEMES[i];
            int col = i % cols;
            int row = i / cols;
            int cx = px + col * (cardW + gap);
            int cy = bodyY + 14 + row * (cardH + gap);
            boolean sel = config.themeIndex == i;
            boolean hov = UiKit.inBox(snap.mouseX, snap.mouseY, cx, cy, cardW, cardH);

            UiKit.card(g, cx, cy, cardW, cardH, sel, hov, t);

            // Gradient preview strip
            g.hGradient(cx + 9, cy + 9, cardW - 18, 18,
                    Canvas2D.withAlpha(tp.primary, 0.95f), Canvas2D.withAlpha(tp.secondary, 0.95f));
            g.roundedRect(cx + 9, cy + 31, cardW - 18, 1, 0, 0x22FFFFFF);

            g.drawText(UiKit.ellipsize(g, tp.name, cardW - 18), cx + 9, cy + 38, t.text);
            g.drawText(sel ? "active" : "click to apply", cx + 9, cy + 50, sel ? t.accent2 : t.textMute);

            if (clickLeft && hov) {
                config.themeIndex = i;
                config.save();
                pushToast("Theme: " + tp.name, true);
            }
        }
    }

    private void renderPresetsSubPage(
            Canvas2D g,
            GameSnapshot snap,
            int px,
            int bodyY,
            int panelW,
            int bodyH,
            boolean clickLeft,
            WinVisualConfig.ThemePalette theme
    ) {
        UiKit.Tokens t = tokens(theme);
        UiKit.sectionLabel(g, "One-click profiles", px, bodyY, t);

        String[][] presets = new String[][] {
            { "Full suite", "ESP, every HUD widget, cosmetics, particles" },
            { "Competitive", "Player ESP, Target HUD, keystrokes, potions, armor" },
            { "Cinematic", "China hat, crystal wings, jump rings, trails" },
            { "Reload from launcher", "Pull the latest layout from winvisual-hud.json" }
        };

        int cardH = 46;
        int gap = 8;
        int cardW = (panelW - gap) / 2;

        for (int i = 0; i < presets.length; i++) {
            int col = i % 2;
            int row = i / 2;
            int cx = px + col * (cardW + gap);
            int cy = bodyY + 14 + row * (cardH + gap);
            boolean hov = UiKit.inBox(snap.mouseX, snap.mouseY, cx, cy, cardW, cardH);

            UiKit.card(g, cx, cy, cardW, cardH, false, hov, t);
            g.drawText(presets[i][0], cx + 10, cy + 10, t.text);
            g.drawText(UiKit.ellipsize(g, presets[i][1], cardW - 20), cx + 10, cy + 23, t.textMute);

            String action = i == 3 ? "Sync" : "Apply";
            int bw = g.textWidth(action) + 18;
            int bx = cx + cardW - bw - 10;
            g.roundedRect(bx, cy + cardH - 24, bw, 16, 8, Canvas2D.withAlpha(t.accent & 0xFFFFFF, 0.85f));
            g.drawCenteredText(action, bx + bw / 2, cy + cardH - 20, 0xFF0A0C12);

            if (clickLeft && hov) {
                applyPresetByIndex(i);
            }
        }

        final int unused = bodyH;
        if (unused == Integer.MIN_VALUE) pushToast("", false);
    }

    private void applyPresetByIndex(int idx) {
        if (idx == 3) {
            config.reloadIfModified(true);
            pushToast("Synced profile from WinVisual Launcher!", true);
            return;
        }
        for (int i = 0; i < config.modules.size(); i++) {
            WinVisualModule m = config.modules.get(i);
            if (idx == 0) {
                m.enabled = !"ambience".equals(m.id);
            } else if (idx == 1) {
                m.enabled = "player-esp".equals(m.id) || "health-esp".equals(m.id) || "nametags".equals(m.id)
                        || "watermark".equals(m.id) || "target-hud".equals(m.id) || "keystrokes".equals(m.id)
                        || "potions-hud".equals(m.id) || "armor-hud".equals(m.id) || "hit-particles".equals(m.id)
                        || "custom-crosshair".equals(m.id) || "fullbright".equals(m.id) || "zoom".equals(m.id);
            } else if (idx == 2) {
                m.enabled = m.category == WinVisualModule.Category.COSMETICS
                        || m.category == WinVisualModule.Category.PARTICLES
                        || "watermark".equals(m.id) || "ambience".equals(m.id) || "viewmodel".equals(m.id);
            }
        }
        config.save();
        pushToast("Applied preset profile #" + (idx + 1), true);
    }

    private void renderToasts(Canvas2D g, GameSnapshot snap, WinVisualConfig.ThemePalette theme, long nowMs) {
        WinVisualModule notif = config.get("notifications");
        if (notif == null || !notif.enabled) return;
        long durMs = Math.round(notif.sliderValue * 1000f);
        int idx = 0;
        Iterator<ToastItem> it = toasts.iterator();
        while (it.hasNext()) {
            ToastItem t = it.next();
            long age = nowMs - t.startMs;
            if (age > durMs) {
                it.remove();
                continue;
            }
            int tw = g.textWidth(t.title) + 22;
            int tx = notif.modeIndex == 1 ? (snap.guiWidth - tw) / 2 : (snap.guiWidth - tw - 12);
            int ty = notif.modeIndex == 1 ? (38 + idx * 22) : (snap.guiHeight - 30 - idx * 22);
            int dotCol = t.enabled ? (0xFF000000 | theme.primary) : 0xFFF43F5E;
            g.evoCard(tx, ty, tw, 18, 0xEA090B13, theme.cardBorder, dotCol, 0xFF000000 | theme.secondary);
            g.roundedRect(tx + 6, ty + 6, 6, 6, 2, dotCol);
            g.drawText(t.title, tx + 16, ty + 5, 0xFFF8FAFC);
            idx++;
        }
    }

    private static int clampX(WinVisualModule m, GameSnapshot snap) {
        return Math.max(4, Math.min(Math.max(4, snap.guiWidth - m.hudW - 4), m.hudX));
    }

    private static int clampY(WinVisualModule m, GameSnapshot snap) {
        return Math.max(4, Math.min(Math.max(4, snap.guiHeight - m.hudH - 4), m.hudY));
    }

    private static boolean inBox(double mx, double my, int x, int y, int w, int h) {
        return mx >= x && mx <= x + w && my >= y && my <= y + h;
    }
}
