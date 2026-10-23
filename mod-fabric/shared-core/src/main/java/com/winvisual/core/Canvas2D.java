package com.winvisual.core;

/**
 * High-throughput 2D primitive renderer bridged cleanly onto Minecraft's native
 * DrawableHelper (1.16.5), DrawContext (1.21.4), and GuiGraphics (1.21.11).
 */
public abstract class Canvas2D {

    public abstract void fill(int x1, int y1, int x2, int y2, int argb);

    public abstract void drawText(String text, int x, int y, int argb);

    public abstract int textWidth(String text);

    public int fontHeight() {
        return 9;
    }

    public final void rect(int x, int y, int w, int h, int argb) {
        if (w <= 0 || h <= 0) return;
        fill(x, y, x + w, y + h, argb);
    }

    public final void outlineRect(int x, int y, int w, int h, int thickness, int argb) {
        if (w <= 0 || h <= 0 || thickness <= 0) return;
        fill(x, y, x + w, y + thickness, argb);
        fill(x, y + h - thickness, x + w, y + h, argb);
        fill(x, y + thickness, x + thickness, y + h - thickness, argb);
        fill(x + w - thickness, y + thickness, x + w, y + h - thickness, argb);
    }

    /**
     * Crisp stepped-bevel rounded rectangle with zero blur or texture state mutation.
     */
    public final void roundedRect(int x, int y, int w, int h, int r, int argb) {
        if (w <= 0 || h <= 0) return;
        int rad = Math.max(0, Math.min(r, Math.min(w, h) / 2));
        if (rad <= 1) {
            fill(x, y, x + w, y + h, argb);
            return;
        }
        fill(x + rad, y, x + w - rad, y + h, argb);
        fill(x, y + rad, x + rad, y + h - rad, argb);
        fill(x + w - rad, y + rad, x + w, y + h - rad, argb);
        for (int i = 1; i < rad; i++) {
            double dy = rad - i;
            int inset = rad - (int) Math.round(Math.sqrt(rad * rad - dy * dy));
            fill(x + inset, y + i, x + rad, y + i + 1, argb);
            fill(x + w - rad, y + i, x + w - inset, y + i + 1, argb);
            fill(x + inset, y + h - i - 1, x + rad, y + h - i, argb);
            fill(x + w - rad, y + h - i - 1, x + w - inset, y + h - i, argb);
        }
    }

    /**
     * Signature WinVisual dark obsidian HUD card with outer glow border & top accent strip.
     */
    public final void evoCard(int x, int y, int w, int h, int bgArgb, int borderArgb, int topAccentLeft, int topAccentRight) {
        // Subtle soft shadow
        roundedRect(x - 1, y + 2, w + 2, h + 1, 6, 0x48000000);
        // Outer border shell
        roundedRect(x - 1, y - 1, w + 2, h + 2, 6, borderArgb);
        // Main obsidian body
        roundedRect(x, y, w, h, 5, bgArgb);
        // Top dual-tone neon hairline
        if (topAccentLeft != 0) {
            hGradient(x + 3, y, Math.max(2, w - 6), 2, topAccentLeft, topAccentRight);
        }
    }

    public final void hGradient(int x, int y, int w, int h, int leftArgb, int rightArgb) {
        if (w <= 0 || h <= 0) return;
        int steps = Math.min(24, Math.max(1, w / 3));
        for (int i = 0; i < steps; i++) {
            int sx1 = x + (w * i) / steps;
            int sx2 = x + (w * (i + 1)) / steps;
            float t = steps <= 1 ? 0f : (float) i / (float) (steps - 1);
            fill(sx1, y, Math.max(sx1 + 1, sx2), y + h, lerpColor(leftArgb, rightArgb, t));
        }
    }

    public final void line(double x1, double y1, double x2, double y2, int thickness, int argb) {
        double dx = x2 - x1;
        double dy = y2 - y1;
        double dist = Math.hypot(dx, dy);
        if (dist < 0.5 || dist > 3200.0) return;
        int steps = Math.max(1, (int) Math.ceil(dist / Math.max(1.0, thickness * 0.85)));
        int half = thickness / 2;
        for (int i = 0; i <= steps; i++) {
            double t = (double) i / (double) steps;
            int px = (int) Math.round(x1 + dx * t);
            int py = (int) Math.round(y1 + dy * t);
            fill(px - half, py - half, px - half + thickness, py - half + thickness, argb);
        }
    }

    public final void cornerBox(int x1, int y1, int x2, int y2, int thickness, int cornerLen, int argb) {
        int w = Math.max(2, x2 - x1);
        int h = Math.max(2, y2 - y1);
        int cl = Math.max(3, Math.min(cornerLen, Math.min(w, h) / 3));
        // Shadow pass for high visibility on bright sky/snow
        int shadow = withAlpha(0x000000, ((argb >>> 24) & 0xFF) * 0.65f / 255f);
        drawCornersRaw(x1 - 1, y1 - 1, x2 + 1, y2 + 1, thickness + 2, cl + 1, shadow);
        drawCornersRaw(x1, y1, x2, y2, thickness, cl, argb);
    }

    private void drawCornersRaw(int x1, int y1, int x2, int y2, int t, int cl, int argb) {
        // Top-left
        fill(x1, y1, x1 + cl, y1 + t, argb);
        fill(x1, y1, x1 + t, y1 + cl, argb);
        // Top-right
        fill(x2 - cl, y1, x2, y1 + t, argb);
        fill(x2 - t, y1, x2, y1 + cl, argb);
        // Bottom-left
        fill(x1, y2 - t, x1 + cl, y2, argb);
        fill(x1, y2 - cl, x1 + t, y2, argb);
        // Bottom-right
        fill(x2 - cl, y2 - t, x2, y2, argb);
        fill(x2 - t, y2 - cl, x2, y2, argb);
    }

    public final void drawCenteredText(String text, int centerX, int y, int argb) {
        drawText(text, centerX - textWidth(text) / 2, y, argb);
    }

    public static int withAlpha(int rgb, float alpha01) {
        int a = Math.max(0, Math.min(255, Math.round(alpha01 * 255f)));
        return (a << 24) | (rgb & 0x00FFFFFF);
    }

    public static int lerpColor(int c1, int c2, float t) {
        float k = Math.max(0f, Math.min(1f, t));
        int a1 = (c1 >>> 24) & 0xFF, r1 = (c1 >>> 16) & 0xFF, g1 = (c1 >>> 8) & 0xFF, b1 = c1 & 0xFF;
        int a2 = (c2 >>> 24) & 0xFF, r2 = (c2 >>> 16) & 0xFF, g2 = (c2 >>> 8) & 0xFF, b2 = c2 & 0xFF;
        int a = Math.round(a1 + (a2 - a1) * k);
        int r = Math.round(r1 + (r2 - r1) * k);
        int g = Math.round(g1 + (g2 - g1) * k);
        int b = Math.round(b1 + (b2 - b1) * k);
        return (a << 24) | (r << 16) | (g << 8) | b;
    }

    public static int waveColor(int primaryRgb, int secondaryRgb, double phaseOffset) {
        double now = (System.currentTimeMillis() % 4000L) / 4000.0;
        float wave = (float) (0.5 + 0.5 * Math.sin((now + phaseOffset) * Math.PI * 2.0));
        return lerpColor(0xFF000000 | (primaryRgb & 0xFFFFFF), 0xFF000000 | (secondaryRgb & 0xFFFFFF), wave);
    }
}
