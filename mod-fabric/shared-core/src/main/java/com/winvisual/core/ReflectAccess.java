package com.winvisual.core;

import java.lang.reflect.Field;
import java.lang.reflect.Method;

/**
 * Cached reflection bridge for fields/methods whose signatures changed between
 * Minecraft 1.16.5 (Java 8 Yarn), 1.21.4 (Java 21 Yarn), and 1.21.11 (Java 21 Mojmap).
 */
public final class ReflectAccess {

    private ReflectAccess() {}

    /**
     * Reads [camX, camY, camZ, camYaw, camPitch] from net.minecraft.client.render.Camera / Camera.
     */
    public static void readCamera(Object cam, double fallbackX, double fallbackY, double fallbackZ,
                                  float fallbackYaw, float fallbackPitch, double[] outPos, float[] outRot) {
        outPos[0] = fallbackX;
        outPos[1] = fallbackY;
        outPos[2] = fallbackZ;
        outRot[0] = fallbackYaw;
        outRot[1] = fallbackPitch;
        if (cam == null) return;

        Object vec = invokeZeroArg(cam, "getPos", "position", "getPosition");
        if (vec != null) {
            Double vx = readDouble(vec, "x");
            Double vy = readDouble(vec, "y");
            Double vz = readDouble(vec, "z");
            if (vx != null && vy != null && vz != null) {
                outPos[0] = vx.doubleValue();
                outPos[1] = vy.doubleValue();
                outPos[2] = vz.doubleValue();
            }
        }
        Number yaw = invokeNumber(cam, "getYaw", "getYRot", "yRot");
        Number pitch = invokeNumber(cam, "getPitch", "getXRot", "xRot");
        if (yaw != null) outRot[0] = yaw.floatValue();
        if (pitch != null) outRot[1] = pitch.floatValue();
    }

    public static double readFovOption(Object options, double fallback) {
        if (options == null) return fallback;
        Double direct = readDouble(options, "fov");
        if (direct != null && direct.doubleValue() > 5.0) return direct.doubleValue();
        Object optObj = invokeZeroArg(options, "getFov", "fov");
        if (optObj != null) {
            Number val = invokeNumber(optObj, "getValue", "get");
            if (val != null && val.doubleValue() > 5.0) return val.doubleValue();
        }
        return fallback;
    }

    public static boolean readThirdPerson(Object options) {
        if (options == null) return false;
        Object persp = invokeZeroArg(options, "getPerspective", "getCameraType");
        if (persp != null) {
            Object fp = invokeZeroArg(persp, "isFirstPerson");
            if (fp instanceof Boolean) {
                return !((Boolean) fp).booleanValue();
            }
        }
        return false;
    }

    public static void tryApplyGamma(Object options, double targetGamma) {
        if (options == null) return;
        try {
            Field f = findField(options.getClass(), "gamma");
            if (f != null && (f.getType() == double.class || f.getType() == Double.class)) {
                f.setDouble(options, targetGamma);
                return;
            }
            Object optObj = invokeZeroArg(options, "getGamma", "gamma");
            if (optObj != null) {
                Field vf = findField(optObj.getClass(), "value");
                if (vf != null) {
                    vf.set(optObj, Double.valueOf(targetGamma));
                }
            }
        } catch (Throwable ignored) {
        }
    }

    public static void trySetDayTime(Object world, long ticks) {
        if (world == null) return;
        for (String name : new String[] { "setTimeOfDay", "setDayTime" }) {
            try {
                Method m = world.getClass().getMethod(name, long.class);
                m.invoke(world, Long.valueOf(ticks));
                return;
            } catch (Throwable ignored) {
            }
        }
    }

    public static void trySpawnParticle(Object world, Object particle,
                                        double x, double y, double z,
                                        double vx, double vy, double vz) {
        if (world == null || particle == null) return;
        Method[] methods = world.getClass().getMethods();
        for (int i = 0; i < methods.length; i++) {
            Method m = methods[i];
            String n = m.getName();
            if (!"addParticle".equals(n) && !"addParticleClient".equals(n)) continue;
            Class<?>[] p = m.getParameterTypes();
            if (p.length == 7 && p[0].isAssignableFrom(particle.getClass())
                    && p[1] == double.class && p[6] == double.class) {
                try {
                    m.invoke(world, particle, Double.valueOf(x), Double.valueOf(y), Double.valueOf(z),
                            Double.valueOf(vx), Double.valueOf(vy), Double.valueOf(vz));
                    return;
                } catch (Throwable ignored) {
                }
            }
        }
    }

    private static Object invokeZeroArg(Object target, String... names) {
        Class<?> cls = target.getClass();
        for (int i = 0; i < names.length; i++) {
            try {
                Method m = cls.getMethod(names[i]);
                m.setAccessible(true);
                return m.invoke(target);
            } catch (Throwable ignored) {
            }
        }
        return null;
    }

    private static Number invokeNumber(Object target, String... names) {
        Object res = invokeZeroArg(target, names);
        return (res instanceof Number) ? (Number) res : null;
    }

    private static Double readDouble(Object target, String fieldName) {
        try {
            Field f = findField(target.getClass(), fieldName);
            if (f != null) {
                Object v = f.get(target);
                if (v instanceof Number) return Double.valueOf(((Number) v).doubleValue());
            }
        } catch (Throwable ignored) {
        }
        return null;
    }

    private static Field findField(Class<?> cls, String name) {
        Class<?> cur = cls;
        while (cur != null && cur != Object.class) {
            try {
                Field f = cur.getDeclaredField(name);
                f.setAccessible(true);
                return f;
            } catch (NoSuchFieldException ignored) {
                cur = cur.getSuperclass();
            }
        }
        return null;
    }
}
