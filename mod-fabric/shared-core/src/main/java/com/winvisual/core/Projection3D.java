package com.winvisual.core;

/**
 * Pure camera-space 3D perspective projector compatible with Sodium, Iris Shaders,
 * OpenGL 2.1 (1.16.5), OpenGL 3.2 Core (1.21.4), and RenderPipeline (1.21.11).
 */
public final class Projection3D {

    private Projection3D() {}

    /**
     * Projects a 3D world coordinate into GUI screen space (out[0] = x, out[1] = y, out[2] = depth).
     * Returns false when behind the near plane so off-camera geometry never flips onto the screen.
     */
    public static boolean project(
            double wx,
            double wy,
            double wz,
            double camX,
            double camY,
            double camZ,
            float camYawDeg,
            float camPitchDeg,
            double fovDeg,
            int guiW,
            int guiH,
            double[] out
    ) {
        double dx = wx - camX;
        double dy = wy - camY;
        double dz = wz - camZ;

        // Minecraft yaw: 0 = +Z (South), 90 = -X (West), -90 = +X (East), 180 = -Z (North)
        double yawRad = Math.toRadians(camYawDeg + 180.0);
        double cosYaw = Math.cos(yawRad);
        double sinYaw = Math.sin(yawRad);

        // Rotate world delta around Y into camera horizontal frame
        double cx = dx * cosYaw + dz * sinYaw;
        double cz = dz * cosYaw - dx * sinYaw;

        // Rotate around X by camera pitch (+pitch = looking down)
        double pitchRad = Math.toRadians(camPitchDeg);
        double cosPitch = Math.cos(pitchRad);
        double sinPitch = Math.sin(pitchRad);

        double ry = dy * cosPitch + cz * sinPitch;
        double rz = -cz * cosPitch + dy * sinPitch;

        if (rz <= 0.12) {
            return false;
        }

        double clampedFov = Math.max(15.0, Math.min(150.0, fovDeg));
        double halfHeightTan = Math.tan(Math.toRadians(clampedFov * 0.5));
        if (halfHeightTan <= 1e-4) {
            return false;
        }

        double focalY = (guiH * 0.5) / halfHeightTan;
        double sx = (guiW * 0.5) - (cx / rz) * focalY;
        double sy = (guiH * 0.5) - (ry / rz) * focalY;

        out[0] = sx;
        out[1] = sy;
        out[2] = rz;
        return sx > -guiW && sx < guiW * 2 && sy > -guiH && sy < guiH * 2;
    }

    /**
     * Computes tight 2D screen bounds {minX, minY, maxX, maxY} from all 8 corners of a 3D AABB.
     */
    public static boolean projectBox(
            double cx,
            double baseY,
            double cz,
            double halfW,
            double height,
            double camX,
            double camY,
            double camZ,
            float camYawDeg,
            float camPitchDeg,
            double fovDeg,
            int guiW,
            int guiH,
            int[] outBounds
    ) {
        double minX = Double.POSITIVE_INFINITY;
        double minY = Double.POSITIVE_INFINITY;
        double maxX = Double.NEGATIVE_INFINITY;
        double maxY = Double.NEGATIVE_INFINITY;
        int visibleCorners = 0;
        double[] pt = new double[3];

        for (int ix = -1; ix <= 1; ix += 2) {
            for (int iz = -1; iz <= 1; iz += 2) {
                for (int iy = 0; iy <= 1; iy++) {
                    double wx = cx + ix * halfW;
                    double wy = baseY + iy * height;
                    double wz = cz + iz * halfW;
                    if (project(wx, wy, wz, camX, camY, camZ, camYawDeg, camPitchDeg, fovDeg, guiW, guiH, pt)) {
                        visibleCorners++;
                        if (pt[0] < minX) minX = pt[0];
                        if (pt[1] < minY) minY = pt[1];
                        if (pt[0] > maxX) maxX = pt[0];
                        if (pt[1] > maxY) maxY = pt[1];
                    }
                }
            }
        }

        if (visibleCorners < 2) {
            return false;
        }

        outBounds[0] = (int) Math.round(minX);
        outBounds[1] = (int) Math.round(minY);
        outBounds[2] = (int) Math.round(maxX);
        outBounds[3] = (int) Math.round(maxY);
        return (outBounds[2] - outBounds[0]) >= 2 && (outBounds[3] - outBounds[1]) >= 3;
    }
}
