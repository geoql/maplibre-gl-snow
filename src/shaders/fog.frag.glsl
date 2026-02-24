#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_fogOpacity;
uniform vec3 u_fogColor;

out vec4 fragColor;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 center = (uv - 0.5) * 2.0;

    // Vignette — more atmospheric haze at edges, less in center
    float vignette = dot(center, center) * 0.4;
    float alpha = u_fogOpacity * (0.3 + vignette);

    // Premultiplied alpha
    fragColor = vec4(u_fogColor * alpha, alpha);
}
