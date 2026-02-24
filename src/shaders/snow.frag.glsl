#version 300 es
precision highp float;

in float v_opacity;
in float v_alt;

uniform vec3 u_color;
uniform float u_opacity;

out vec4 fragColor;

void main() {
    // Soft circular flake using distance from point center
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center) * 2.0;

    if (dist > 1.0) discard;

    // Soft edge falloff (Gaussian-like)
    float alpha = 1.0 - smoothstep(0.6, 1.0, dist);

    // Premultiplied alpha for MapLibre renderingMode: '3d'
    float finalAlpha = alpha * v_opacity * u_opacity;
    fragColor = vec4(u_color * finalAlpha, finalAlpha);
}
