package com.winvisual.core;

/**
 * WinVisual design system.
 *
 * <p>One place that owns every visual token (surface, border, accent gradient,
 * radius, glow, typography rhythm) and every primitive the studio UI is built
 * from. All screens — module browser, HUD studio, themes, presets — draw through
 * these helpers so the whole client shares one look.</p>
 *
 * <p>Written against the Java 8 language level because shared-core is compiled
 * into the 1.16.5, 1.21.4 and 1.21.11 builds alike.</p>
 */
public final class UiKit {

    private UiKit() {
    }

    /* ------------------------------------------------------------------ */
    /*  Tokens                                                             */
    /* ------------------------------------------------------------------ */

    public static final class Tokens {
        public final int accent;
        public final int accent2;
        public final int accentSoft;
        public final int surface;
        public final int surfaceRaised;
        public final int surfaceSunken;
        public final int border;
        public final int borderStrong;
        public final int text;
        public final int textDim;
        public final int textMute;
        public final int danger;
        public final int radius;
        public final int shadow;

        public Tokens(WinVisualConfig.ThemePalette theme) {
            this.accent = 0xFF000000 | theme.primary;
            this.accent2 = 0xFF000000 | theme.secondary;
            this.accentSoft = Canvas2D.withAlpha(theme.primary, 0.24f);
            this.surface = 0xF4070910;
            this.surfaceRaised = 0x14FFFFFF;
            this.surfaceSunken = 0x38000000;
            this.border = 0x1FFFFFFF;
            this.borderStrong = 0x33000000 | theme.primary;
            this.text = 0xFFF5F7FC;
            this.textDim = 0xFF98A2B8;
            this.textMute = 0xFF5E687E;
            this.danger = 0xFFF43F5E;
            this.radius = 9;
            this.shadow = 0x66000000;
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Low level                                                          */
    /* ------------------------------------------------------------------ */

    /** Soft drop shadow built from stacked translucent rounded rects. */
    public static void shadow(Canvas2D g, int x, int y, int w, int h, int r, int argb, int layers) {
        for (int i = layers; i >= 1; i--) {
            int a = Math.round(((argb >>> 24) & 0xFF) * (0.16f / i));
            if (a <= 0) continue;
            int col = (a << 24) | (argb & 0x00FFFFFF);
            g.roundedRect(x - i, y - i + 1, w + i * 2, h + i * 2, r + i, col);
        }
    }

    /** Text with extra letter spacing — fakes emphasis on a fixed-width bitmap font. */
    public static void tracked(Canvas2D g, String text, int x, int y, int argb, int spacing) {
        int cx = x;
        for (int i = 0; i < text.length(); i++) {
            String ch = String.valueOf(text.charAt(i));
            g.drawText(ch, cx, y, argb);
            cx += g.textWidth(ch) + spacing;
        }
    }

    public static int trackedWidth(Canvas2D g, String text, int spacing) {
        if (text.length() == 0) return 0;
        int w = 0;
        for (int i = 0; i < text.length(); i++) {
            w += g.textWidth(String.valueOf(text.charAt(i)));
        }
        return w + spacing * (text.length() - 1);
    }

    /** Section label in the small-caps style used across the studio. */
    public static void sectionLabel(Canvas2D g, String text, int x, int y, Tokens t) {
        tracked(g, text.toUpperCase(java.util.Locale.US), x, y, t.textMute, 1);
    }

    public static String ellipsize(Canvas2D g, String text, int maxWidth) {
        if (g.textWidth(text) <= maxWidth) return text;
        String cut = text;
        while (cut.length() > 1 && g.textWidth(cut + "...") > maxWidth) {
            cut = cut.substring(0, cut.length() - 1);
        }
        return cut + "...";
    }

    /** Word wrap used by the inspector description block. */
    public static String[] wrap(Canvas2D g, String text, int maxWidth, int maxLines) {
        java.util.List<String> lines = new java.util.ArrayList<String>();
        String[] words = text.split(" ");
        StringBuilder line = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            String probe = line.length() == 0 ? words[i] : line + " " + words[i];
            if (g.textWidth(probe) > maxWidth && line.length() > 0) {
                lines.add(line.toString());
                line = new StringBuilder(words[i]);
                if (lines.size() == maxLines) {
                    line = new StringBuilder();
                    break;
                }
            } else {
                line = new StringBuilder(probe);
            }
        }
        if (line.length() > 0 && lines.size() < maxLines) lines.add(line.toString());
        return lines.toArray(new String[0]);
    }

    /* ------------------------------------------------------------------ */
    /*  Surfaces                                                           */
    /* ------------------------------------------------------------------ */

    /** Main studio window: shadow, body, hairline border and accent hairline. */
    public static void window(Canvas2D g, int x, int y, int w, int h, Tokens t) {
        shadow(g, x, y, w, h, t.radius + 2, t.shadow, 7);
        g.roundedRect(x, y, w, h, t.radius + 2, t.surface);
        g.outlineRect(x, y, w, h, 1, t.border);
        g.hGradient(x + 1, y, w - 2, 1, t.accent, t.accent2);
    }

    /** Content card. {@code hovered} lifts the surface and brightens the border. */
    public static void card(Canvas2D g, int x, int y, int w, int h, boolean selected, boolean hovered, Tokens t) {
        int bg;
        if (selected) {
            bg = Canvas2D.lerpColor(0xFF0B0E16, t.accent, 0.20f);
        } else if (hovered) {
            bg = 0xFF11151F;
        } else {
            bg = 0xFF0D101A;
        }
        g.roundedRect(x, y, w, h, t.radius, bg);
        g.outlineRect(x, y, w, h, 1, selected ? t.borderStrong : (hovered ? 0x2EFFFFFF : t.border));
        if (selected) {
            g.roundedRect(x, y + 8, 2, h - 16, 1, t.accent);
        }
    }

    /** Sunken well used for inspector rows and the search field. */
    public static void well(Canvas2D g, int x, int y, int w, int h, Tokens t) {
        g.roundedRect(x, y, w, h, 6, 0xFF0A0D15);
        g.outlineRect(x, y, w, h, 1, 0x14FFFFFF);
    }

    /** Square glyph tile with the accent gradient. */
    public static void glyphTile(Canvas2D g, int x, int y, int size, String glyph, boolean active, Tokens t) {
        if (active) {
            g.hGradient(x, y, size, size, Canvas2D.withAlpha(t.accent & 0xFFFFFF, 0.9f),
                    Canvas2D.withAlpha(t.accent2 & 0xFFFFFF, 0.9f));
        } else {
            g.roundedRect(x, y, size, size, 6, t.surfaceRaised);
        }
        g.drawCenteredText(glyph, x + size / 2, y + (size - g.fontHeight()) / 2 + 1,
                active ? 0xFF0A0C12 : t.textDim);
    }

    /** Small count/label badge. */
    public static void badge(Canvas2D g, int x, int y, String text, int argbText, int argbBg) {
        int w = g.textWidth(text) + 10;
        g.roundedRect(x, y, w, 12, 6, argbBg);
        g.drawText(text, x + 5, y + 2, argbText);
    }

    /** Pill toggle switch. */
    public static void switchPill(Canvas2D g, int x, int y, boolean on, Tokens t) {
        int w = 24;
        int h = 12;
        g.roundedRect(x, y, w, h, 6, on ? Canvas2D.withAlpha(t.accent & 0xFFFFFF, 0.85f) : 0x38000000);
        if (!on) g.outlineRect(x, y, w, h, 1, 0x26FFFFFF);
        g.roundedRect(on ? x + w - 10 : x + 2, y + 2, 8, h - 4, 4, on ? 0xFF0A0C12 : 0x99FFFFFF);
    }

    /** Left navigation entry. */
    public static void navItem(Canvas2D g, int x, int y, int w, int h, String label, int count,
                               boolean selected, boolean hovered, Tokens t, Canvas2D textCtx) {
        if (selected) {
            g.roundedRect(x, y, w, h, 6, Canvas2D.withAlpha(t.accent & 0xFFFFFF, 0.18f));
            g.roundedRect(x, y + 4, 2, h - 8, 1, t.accent);
        } else if (hovered) {
            g.roundedRect(x, y, w, h, 6, 0x0EFFFFFF);
        }
        g.drawText(label, x + 10, y + (h - g.fontHeight()) / 2 + 1, selected ? t.text : t.textDim);
        if (count >= 0) {
            String c = String.valueOf(count);
            g.drawText(c, x + w - 8 - textCtx.textWidth(c), y + (h - g.fontHeight()) / 2 + 1,
                    selected ? t.accent2 : t.textMute);
        }
    }

    public static void divider(Canvas2D g, int x, int y, int w) {
        g.fill(x, y, x + w, y + 1, 0x14FFFFFF);
    }

    /* ------------------------------------------------------------------ */
    /*  Controls                                                           */
    /* ------------------------------------------------------------------ */

    /** Slider track + accent gradient fill + knob. Returns nothing; caller handles input. */
    public static void slider(Canvas2D g, int x, int y, int w, float ratio, Tokens t) {
        float r = Math.max(0f, Math.min(1f, ratio));
        int trackH = 4;
        g.roundedRect(x, y, w, trackH, 2, 0x40000000);
        g.outlineRect(x, y, w, trackH, 1, 0x1AFFFFFF);
        int fillW = Math.round(w * r);
        if (fillW > 0) {
            g.hGradient(x, y, Math.max(2, fillW), trackH, t.accent, t.accent2);
        }
        int knobX = x + Math.max(0, Math.min(w - 6, fillW - 3));
        g.roundedRect(knobX, y - 3, 6, trackH + 6, 3, 0xFFF5F7FC);
    }

    /** Horizontal segmented control. Returns the clicked index or -1. */
    public static int segmented(Canvas2D g, String[] items, int activeIdx, int x, int y, int itemW, int h,
                                double mouseX, double mouseY, boolean click, Tokens t) {
        int hit = -1;
        for (int i = 0; i < items.length; i++) {
            int ix = x + i * (itemW + 4);
            boolean on = i == activeIdx;
            g.roundedRect(ix, y, itemW, h, h / 2, on ? Canvas2D.withAlpha(t.accent & 0xFFFFFF, 0.85f) : 0x0EFFFFFF);
            if (!on) g.outlineRect(ix, y, itemW, h, 1, 0x1AFFFFFF);
            g.drawCenteredText(ellipsize(g, items[i], itemW - 6), ix + itemW / 2, y + (h - g.fontHeight()) / 2 + 1,
                    on ? 0xFF0A0C12 : t.textDim);
            if (click && inBox(mouseX, mouseY, ix, y, itemW, h)) hit = i;
        }
        return hit;
    }

    public static boolean inBox(double mx, double my, int x, int y, int w, int h) {
        return mx >= x && mx <= x + w && my >= y && my <= y + h;
    }

    /** 1-2 letter glyph derived from the module name, used in tiles. */
    public static String glyphFor(String name) {
        if (name == null || name.length() == 0) return "?";
        String[] parts = name.trim().split("[\\s_\\-]+");
        if (parts.length >= 2 && parts[1].length() > 0) {
            return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase(java.util.Locale.US);
        }
        return name.substring(0, Math.min(2, name.length())).toUpperCase(java.util.Locale.US);
    }
}
