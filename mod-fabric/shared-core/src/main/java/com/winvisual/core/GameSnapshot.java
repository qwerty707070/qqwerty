package com.winvisual.core;

import java.util.ArrayList;
import java.util.List;

/**
 * Per-frame read-only snapshot collected from MinecraftClient / Minecraft
 * so all 36 visual modules run with identical logic across 1.16.5, 1.21.4, and 1.21.11.
 */
public final class GameSnapshot {

    public static final int KIND_PLAYER = 0;
    public static final int KIND_HOSTILE = 1;
    public static final int KIND_PASSIVE = 2;
    public static final int KIND_ITEM = 3;
    public static final int KIND_PROJECTILE = 4;

    public static final class EntityData {
        public int id;
        public int kind;
        public String name = "";
        public double x;
        public double y;
        public double z;
        public float width = 0.6f;
        public float height = 1.8f;
        public float hp = 20f;
        public float maxHp = 20f;
        public int hurtTime = 0;
        public String heldItem = "";
        public int itemCount = 1;
    }

    public static final class EquipmentSlotData {
        public String slotShort = "";
        public String itemName = "";
        public int durabilityPct = 100; // -1 if non-damageable
        public boolean empty = true;
    }

    public static final class EffectData {
        public String name = "";
        public int amplifier = 0;
        public int durationTicks = 0;
    }

    public interface KeyLookup {
        boolean isKeyDown(int glfwKeyCode);
    }

    public String mcVersion = "1.21.11";
    public String username = "Player";
    public int guiWidth = 960;
    public int guiHeight = 540;

    public double camX;
    public double camY;
    public double camZ;
    public float camYaw;
    public float camPitch;
    public double fovDeg = 80.0;
    public boolean thirdPerson = false;

    public int playerId = -1;
    public double playerX;
    public double playerY;
    public double playerZ;
    public boolean onGround = true;
    public float playerHp = 20f;
    public float playerMaxHp = 20f;
    public int playerHurtTime = 0;
    public int pingMs = 18;

    public double mouseX;
    public double mouseY;
    public boolean mouseLeftDown;
    public boolean mouseRightDown;
    public boolean menuScreenOpen;

    public boolean keyW;
    public boolean keyA;
    public boolean keyS;
    public boolean keyD;
    public boolean keySpace;

    public KeyLookup keyLookup;

    public final List<EntityData> entities = new ArrayList<EntityData>();
    public EntityData crosshairTarget = null;
    public final List<EquipmentSlotData> equipment = new ArrayList<EquipmentSlotData>();
    public final List<EffectData> effects = new ArrayList<EffectData>();

    public void resetForFrame() {
        entities.clear();
        crosshairTarget = null;
        equipment.clear();
        effects.clear();
    }
}
