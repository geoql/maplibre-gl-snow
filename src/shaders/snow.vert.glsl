#version 300 es
precision highp float;

in vec2 a_offset;
in float a_speed;
in float a_size;
in float a_opacity;
in float a_phase;
in float a_altitude;

// No u_matrix / u_center / u_spread — particles are in screen-space NDC.
// This means snow fills the viewport correctly at any pitch/bearing/zoom.

uniform float u_time;
uniform float u_intensity;
uniform vec2 u_direction;   // wind: [horizontal, vertical] speed (screen-space at bearing=0)
uniform float u_bearing;    // map bearing in radians — rotates wind so it's world-relative
uniform float u_flakeSize;
uniform float u_screenHeight;

out float v_opacity;
out float v_alt;

void main() {
    float t = u_time + a_phase * 8.0;

    // Falling: alt01 = 1.0 (top of screen) → 0.0 (bottom), loops continuously
    float fallRate = a_speed * u_intensity * 0.06;
    float alt01 = fract(a_altitude + a_phase * 0.5 - fallRate * t * 0.04);

    // Screen Y: top (alt01=1) → bottom (alt01=0)
    float sy = alt01 * 2.0 - 1.0;

    // Bearing-relative wind: rotate wind vector by map bearing so that the wind
    // direction stays consistent relative to the world as the map rotates.
    //   bearing=0°  → east wind blows right on screen
    //   bearing=90° → east wind blows downward on screen
    float cb = cos(u_bearing);
    float sb = sin(u_bearing);
    float wx = u_direction.x * cb - u_direction.y * sb;
    float wy = u_direction.x * sb + u_direction.y * cb;
    float windX = wx * 0.000012 * t;
    float windY = wy * 0.000012 * t;  // subtle vertical wind component

    // Lateral drift (sinusoidal for organic, non-mechanical feel)
    float drift = sin(t * 0.25 + a_phase * 3.0) * 0.025
                + sin(t * 0.13 + a_phase * 5.7) * 0.012
                + cos(t * 0.19 + a_phase * 7.3) * 0.008;

    // Screen X/Y: wrap within [-1, 1]
    float sx = fract((a_offset.x + drift + windX) * 0.5 + 0.5) * 2.0 - 1.0;
    // Incorporate vertical wind into the fall position (modifies alt01's effective range)
    float sy_final = clamp(sy + windY * alt01, -1.1, 1.1);

    // Depth layer per particle: golden-ratio scramble → uniform [0,1] distribution
    // Low depthLayer = near camera = large + opaque; high = far = small + faint
    float depthLayer = fract(a_phase * 1.618);
    float closeness = 1.0 - depthLayer;

    // Output directly in clip space — no MVP matrix needed for screen-space rendering
    gl_Position = vec4(sx, sy_final, 0.0, 1.0);

    // Atmospheric perspective: closer particles larger and more opaque
    gl_PointSize = a_size * u_flakeSize * (0.25 + closeness * 0.75) * (u_screenHeight / 800.0);
    v_opacity = a_opacity * (0.35 + closeness * 0.65);
    v_alt = alt01;
}
