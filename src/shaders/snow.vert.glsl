#version 300 es
precision highp float;

in vec2 a_offset;
in float a_speed;
in float a_size;
in float a_opacity;
in float a_phase;
in float a_altitude;

uniform mat4 u_matrix;
uniform vec2 u_center;
uniform float u_meterScale;
uniform float u_spread;
uniform float u_time;
uniform float u_intensity;
uniform vec2 u_direction;
uniform float u_flakeSize;
uniform float u_screenHeight;

out float v_opacity;
out float v_alt;

void main() {
    float t = u_time + a_phase * 8.0;

    // Falling: alt01 decreases over time (0 = ground, 1 = top)
    float fallRate = a_speed * u_intensity * 0.06;
    float alt01 = fract(a_altitude + a_phase * 0.5 - fallRate * t * 0.04);

    // Z: negative = below camera, so snowflakes fall downward
    float maxAltMeters = 80.0;
    float mercZ = -alt01 * maxAltMeters * u_meterScale;

    // Lateral drift (sinusoidal for organic motion)
    float drift = sin(t * 0.25 + a_phase * 3.0) * 0.03
                + sin(t * 0.13 + a_phase * 5.7) * 0.015
                + cos(t * 0.19 + a_phase * 7.3) * 0.01;

    // Wind horizontal offset (accumulates over time)
    float windX = u_direction.x * 0.00003 * t;

    // Wrap within [-1..1] spread around center
    float ox = fract((a_offset.x + drift + windX) * 0.5 + 0.5) * 2.0 - 1.0;
    float oy = fract(a_offset.y * 0.5 + 0.5) * 2.0 - 1.0;

    // Mercator position (normalized [0,1] — works with defaultProjectionData.mainMatrix)
    float mercX = u_center.x + ox * u_spread;
    float mercY = u_center.y + oy * u_spread;

    gl_Position = u_matrix * vec4(mercX, mercY, mercZ, 1.0);

    // Depth-based size: lower altitude (closer to ground) = larger flakes
    float depthScale = 1.0 - alt01 * 0.5;
    gl_PointSize = a_size * u_flakeSize * depthScale * (u_screenHeight / 800.0);
    // Depth-based opacity: distant flakes (high alt01) are slightly more transparent
    v_opacity = a_opacity * (0.6 + (1.0 - alt01) * 0.4);
    v_alt = alt01;
}
