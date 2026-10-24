package com.winvisual.core;

/**
 * WinVisual module descriptor with per-module modes, sliders, sub-toggles,
 * keybinds, and draggable HUD coordinates.
 */
public final class WinVisualModule {

    public enum Category {
        COMBAT("Combat", "Combat"),
        PLAYERS("Players", "Players"),
        WORLD("World", "World"),
        EFFECTS("Effects", "Effects"),
        HANDS("Hands", "Hands"),
        COSMETICS("Cosmetics", "Cosmetics"),
        HUD("HUD", "HUD");

        public final String title;
        public final String badge;

        Category(String title, String badge) {
            this.title = title;
            this.badge = badge;
        }
    }

    public final String id;
    public final String name;
    public final String description;
    public final Category category;

    public boolean enabled;
    public int keyCode; // GLFW key code, 0 = unbound
    public String keyLabel;

    public String modeLabel;
    public String[] modes;
    public int modeIndex;

    public String sliderLabel;
    public float sliderValue;
    public float sliderMin;
    public float sliderMax;

    public String subToggleLabel;
    public boolean subToggle;

    // Draggable HUD anchor (used when category == HUD or positioned widgets)
    public boolean draggableHud;
    public int hudX;
    public int hudY;
    public int hudW;
    public int hudH;

    public boolean expanded;

    public WinVisualModule(
            String id,
            String name,
            String description,
            Category category,
            boolean defaultEnabled,
            int defaultKeyCode,
            String defaultKeyLabel
    ) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.category = category;
        this.enabled = defaultEnabled;
        this.keyCode = defaultKeyCode;
        this.keyLabel = defaultKeyLabel;
        this.modes = new String[0];
        this.modeLabel = "Mode";
        this.sliderLabel = "Scale";
        this.sliderMin = 0.5f;
        this.sliderMax = 2.0f;
        this.sliderValue = 1.0f;
    }

    public WinVisualModule withModes(String label, int defaultIdx, String... items) {
        this.modeLabel = label;
        this.modes = items;
        this.modeIndex = Math.max(0, Math.min(items.length - 1, defaultIdx));
        return this;
    }

    public WinVisualModule withSlider(String label, float min, float max, float val) {
        this.sliderLabel = label;
        this.sliderMin = min;
        this.sliderMax = max;
        this.sliderValue = val;
        return this;
    }

    public WinVisualModule withSubToggle(String label, boolean defaultVal) {
        this.subToggleLabel = label;
        this.subToggle = defaultVal;
        return this;
    }

    public WinVisualModule withHudBox(int x, int y, int w, int h) {
        this.draggableHud = true;
        this.hudX = x;
        this.hudY = y;
        this.hudW = w;
        this.hudH = h;
        return this;
    }

    public String activeMode() {
        if (modes == null || modes.length == 0) return "";
        int idx = Math.max(0, Math.min(modes.length - 1, modeIndex));
        return modes[idx];
    }

    public void cycleMode() {
        if (modes != null && modes.length > 0) {
            modeIndex = (modeIndex + 1) % modes.length;
        }
    }
}
