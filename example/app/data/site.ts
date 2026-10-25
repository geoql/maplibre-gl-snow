export const SITE = {
  name: 'maplibre-gl-snow',
  title: 'maplibre-gl-snow — WebGPU snow for MapLibre GL JS',
  description:
    'A MapLibre GL JS custom layer that renders falling snow with Three.js WebGPU compute shaders. Live demo with density, wind and fog controls.',
  repo: 'https://github.com/geoql/maplibre-gl-snow',
  npm: 'https://www.npmjs.com/package/@geoql/maplibre-gl-snow',
  jsr: 'https://jsr.io/@geoql/maplibre-gl-snow',
  install: 'pnpm add @geoql/maplibre-gl-snow maplibre-gl three',
} as const;

/** Basemap per colour mode. The snow is white, so dark reads best. */
export const MAP_STYLE = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://tiles.openfreemap.org/styles/liberty',
} as const;

/** Mirrors MIN/MAX_PARTICLE_COUNT in src/index.ts. */
export const PARTICLES = { min: 2_000, max: 20_000 } as const;

export function particleCount(density: number): number {
  const d = Math.max(0, Math.min(1, density));
  return Math.round(PARTICLES.min + d * (PARTICLES.max - PARTICLES.min));
}
