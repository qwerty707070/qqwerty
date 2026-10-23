package com.winvisual.mc1214;

import com.winvisual.core.Canvas2D;
import com.winvisual.core.GameSnapshot;
import com.winvisual.core.ReflectAccess;
import com.winvisual.core.WinVisualEngine;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.entity.ItemEntity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.mob.Monster;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.projectile.ProjectileEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.particle.ParticleEffect;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.text.Text;
import org.lwjgl.glfw.GLFW;

public final class WinVisualMod1214 implements ClientModInitializer {

    private static final WinVisualEngine ENGINE = new WinVisualEngine();
    private static final GameSnapshot SNAP = new GameSnapshot();
    private static final double[] CAM_POS = new double[3];
    private static final float[] CAM_ROT = new float[2];
    private static final int[] WIN_W = new int[1];
    private static final int[] WIN_H = new int[1];
    private static final double[] CUR_X = new double[1];
    private static final double[] CUR_Y = new double[1];

    private static final class MenuScreen1214 extends Screen {
        MenuScreen1214() {
            super(Text.literal("WinVisual"));
        }

        @Override
        public boolean shouldPause() {
            return false;
        }

        @Override
        public void render(DrawContext context, int mouseX, int mouseY, float delta) {
            MinecraftClient mc = MinecraftClient.getInstance();
            collectAndRender(mc, context);
        }
    }

    private static WinVisualEngine.HostActions createHost(final MinecraftClient mc) {
        return new WinVisualEngine.HostActions() {
            @Override
            public void openMenuScreen() {
                mc.setScreen(new MenuScreen1214());
            }

            @Override
            public void closeMenuScreen() {
                if (mc.currentScreen instanceof MenuScreen1214) {
                    mc.setScreen(null);
                }
            }

            @Override
            public void spawnHitParticles(double x, double y, double z, int modeIndex, int count) {
                if (mc.world == null) return;
                ParticleEffect fx = ParticleTypes.END_ROD;
                if (modeIndex == 1) fx = ParticleTypes.TOTEM_OF_UNDYING;
                else if (modeIndex == 2) fx = ParticleTypes.HEART;
                else if (modeIndex == 3) fx = ParticleTypes.FLAME;
                else if (modeIndex == 4) fx = ParticleTypes.CRIT;

                for (int i = 0; i < count; i++) {
                    double ang = (Math.PI * 2.0 * i) / Math.max(1, count);
                    double vx = Math.cos(ang) * 0.22;
                    double vz = Math.sin(ang) * 0.22;
                    mc.world.addParticle(fx, x, y, z, vx, 0.14, vz);
                }
            }

            @Override
            public void applyAmbienceTime(long worldTimeTicks) {
                ReflectAccess.trySetDayTime(mc.world, worldTimeTicks);
            }
        };
    }

    @Override
    public void onInitializeClient() {
        ENGINE.init(FabricLoader.getInstance().getGameDir().toFile());

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (client.player == null || client.world == null) return;
            WinVisualEngine.HostActions host = createHost(client);
            populateSnapshot(client, client.getWindow().getScaledWidth(), client.getWindow().getScaledHeight());
            ENGINE.onClientTick(SNAP, host);
            ReflectAccess.tryApplyGamma(client.options, ENGINE.getTargetGamma(1.0));
        });

        HudRenderCallback.EVENT.register((context, tickCounter) -> {
            MinecraftClient mc = MinecraftClient.getInstance();
            if (mc.player == null || mc.world == null) return;
            if (mc.currentScreen instanceof MenuScreen1214) return;
            collectAndRender(mc, context);
        });
    }

    private static void collectAndRender(final MinecraftClient mc, final DrawContext context) {
        if (mc.player == null || mc.world == null) return;
        populateSnapshot(mc, context.getScaledWindowWidth(), context.getScaledWindowHeight());
        Canvas2D canvas = new Canvas2D() {
            @Override
            public void fill(int x1, int y1, int x2, int y2, int argb) {
                context.fill(x1, y1, x2, y2, argb);
            }

            @Override
            public void drawText(String text, int x, int y, int argb) {
                context.drawTextWithShadow(mc.textRenderer, text, x, y, argb);
            }

            @Override
            public int textWidth(String text) {
                return mc.textRenderer.getWidth(text);
            }
        };
        ENGINE.renderFrame(canvas, SNAP, createHost(mc));
    }

    private static void populateSnapshot(final MinecraftClient mc, int guiW, int guiH) {
        SNAP.resetForFrame();
        SNAP.mcVersion = "1.21.4";
        SNAP.guiWidth = guiW;
        SNAP.guiHeight = guiH;
        SNAP.menuScreenOpen = (mc.currentScreen instanceof MenuScreen1214);

        final long winHandle = GLFW.glfwGetCurrentContext();
        if (winHandle != 0L) {
            GLFW.glfwGetWindowSize(winHandle, WIN_W, WIN_H);
            GLFW.glfwGetCursorPos(winHandle, CUR_X, CUR_Y);
            SNAP.mouseX = CUR_X[0] * SNAP.guiWidth / Math.max(1.0, WIN_W[0]);
            SNAP.mouseY = CUR_Y[0] * SNAP.guiHeight / Math.max(1.0, WIN_H[0]);
            SNAP.mouseLeftDown = GLFW.glfwGetMouseButton(winHandle, GLFW.GLFW_MOUSE_BUTTON_LEFT) == GLFW.GLFW_PRESS;
            SNAP.mouseRightDown = GLFW.glfwGetMouseButton(winHandle, GLFW.GLFW_MOUSE_BUTTON_RIGHT) == GLFW.GLFW_PRESS;
            SNAP.keyW = GLFW.glfwGetKey(winHandle, GLFW.GLFW_KEY_W) == GLFW.GLFW_PRESS;
            SNAP.keyA = GLFW.glfwGetKey(winHandle, GLFW.GLFW_KEY_A) == GLFW.GLFW_PRESS;
            SNAP.keyS = GLFW.glfwGetKey(winHandle, GLFW.GLFW_KEY_S) == GLFW.GLFW_PRESS;
            SNAP.keyD = GLFW.glfwGetKey(winHandle, GLFW.GLFW_KEY_D) == GLFW.GLFW_PRESS;
            SNAP.keySpace = GLFW.glfwGetKey(winHandle, GLFW.GLFW_KEY_SPACE) == GLFW.GLFW_PRESS;
            SNAP.keyLookup = new GameSnapshot.KeyLookup() {
                @Override
                public boolean isKeyDown(int glfwKeyCode) {
                    return GLFW.glfwGetKey(winHandle, glfwKeyCode) == GLFW.GLFW_PRESS;
                }
            };
        }

        SNAP.playerId = mc.player.getId();
        SNAP.username = mc.player.getName().getString();
        SNAP.playerX = mc.player.getX();
        SNAP.playerY = mc.player.getY();
        SNAP.playerZ = mc.player.getZ();
        SNAP.onGround = mc.player.isOnGround();
        SNAP.playerHp = mc.player.getHealth();
        SNAP.playerMaxHp = mc.player.getMaxHealth();
        SNAP.playerHurtTime = mc.player.hurtTime;

        ReflectAccess.readCamera(mc.gameRenderer.getCamera(),
                SNAP.playerX, SNAP.playerY + 1.62, SNAP.playerZ, 0f, 0f, CAM_POS, CAM_ROT);
        SNAP.camX = CAM_POS[0];
        SNAP.camY = CAM_POS[1];
        SNAP.camZ = CAM_POS[2];
        SNAP.camYaw = CAM_ROT[0];
        SNAP.camPitch = CAM_ROT[1];
        SNAP.fovDeg = ReflectAccess.readFovOption(mc.options, 80.0);
        SNAP.thirdPerson = ReflectAccess.readThirdPerson(mc.options);

        EquipmentSlot[] slots = new EquipmentSlot[] {
            EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET, EquipmentSlot.MAINHAND
        };
        String[] shortNames = new String[] { "H", "C", "L", "B", "W" };
        for (int i = 0; i < slots.length; i++) {
            ItemStack st = mc.player.getEquippedStack(slots[i]);
            GameSnapshot.EquipmentSlotData d = new GameSnapshot.EquipmentSlotData();
            d.slotShort = shortNames[i];
            d.empty = st == null || st.isEmpty();
            if (!d.empty) {
                d.itemName = st.getName().getString();
                d.durabilityPct = st.getMaxDamage() > 0
                        ? Math.max(0, Math.round(100f * (st.getMaxDamage() - st.getDamage()) / st.getMaxDamage()))
                        : -1;
            }
            SNAP.equipment.add(d);
        }

        for (StatusEffectInstance eff : mc.player.getStatusEffects()) {
            GameSnapshot.EffectData ed = new GameSnapshot.EffectData();
            String raw = eff.getTranslationKey();
            int dot = raw.lastIndexOf('.');
            ed.name = dot >= 0 ? capitalize(raw.substring(dot + 1)) : raw;
            ed.amplifier = eff.getAmplifier();
            ed.durationTicks = eff.getDuration();
            SNAP.effects.add(ed);
        }

        for (Entity e : mc.world.getEntities()) {
            GameSnapshot.EntityData d = convertEntity(e);
            if (d != null) {
                SNAP.entities.add(d);
                if (mc.targetedEntity != null && mc.targetedEntity.getId() == e.getId()) {
                    SNAP.crosshairTarget = d;
                }
            }
        }
    }

    private static GameSnapshot.EntityData convertEntity(Entity e) {
        GameSnapshot.EntityData d = new GameSnapshot.EntityData();
        d.id = e.getId();
        d.x = e.getX();
        d.y = e.getY();
        d.z = e.getZ();
        d.width = e.getWidth();
        d.height = e.getHeight();
        d.name = e.getName().getString();

        if (e instanceof PlayerEntity) {
            PlayerEntity pe = (PlayerEntity) e;
            d.kind = GameSnapshot.KIND_PLAYER;
            d.hp = pe.getHealth() + pe.getAbsorptionAmount();
            d.maxHp = pe.getMaxHealth();
            d.hurtTime = pe.hurtTime;
            ItemStack main = pe.getMainHandStack();
            d.heldItem = (main != null && !main.isEmpty()) ? main.getName().getString() : "";
            return d;
        }
        if (e instanceof LivingEntity) {
            LivingEntity le = (LivingEntity) e;
            d.kind = (e instanceof Monster) ? GameSnapshot.KIND_HOSTILE : GameSnapshot.KIND_PASSIVE;
            d.hp = le.getHealth();
            d.maxHp = le.getMaxHealth();
            d.hurtTime = le.hurtTime;
            return d;
        }
        if (e instanceof ItemEntity) {
            ItemEntity ie = (ItemEntity) e;
            d.kind = GameSnapshot.KIND_ITEM;
            ItemStack st = ie.getStack();
            if (st != null && !st.isEmpty()) {
                d.name = st.getName().getString();
                d.itemCount = st.getCount();
            }
            return d;
        }
        if (e instanceof ProjectileEntity) {
            d.kind = GameSnapshot.KIND_PROJECTILE;
            return d;
        }
        return null;
    }

    private static String capitalize(String s) {
        if (s == null || s.isEmpty()) return "";
        return Character.toUpperCase(s.charAt(0)) + s.substring(1).replace('_', ' ');
    }
}
