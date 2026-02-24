# @geoql/maplibre-gl-snow

WebGPU-accelerated snow particle layer for [MapLibre GL JS](https://maplibre.org/).

[![npm version](https://img.shields.io/npm/v/@geoql/maplibre-gl-snow.svg)](https://www.npmjs.com/package/@geoql/maplibre-gl-snow)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@geoql/maplibre-gl-snow)](https://bundlephobia.com/package/@geoql/maplibre-gl-snow)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![oxlint](https://img.shields.io/badge/linter-oxlint-7c5dfa?logo=oxc)](https://oxc.rs)
[![tsdown](https://img.shields.io/badge/bundler-tsdown-3178c6)](https://tsdown.dev/)
[![typescript](https://img.shields.io/npm/dependency-version/@geoql/maplibre-gl-snow/dev/typescript?logo=TypeScript)](https://www.typescriptlang.org/)
[![WebGPU](https://img.shields.io/badge/WebGPU-Yes-brightgreen)](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

> [**Live Demo**](https://geoql.github.io/maplibre-gl-snow/)

Renders 100,000+ animated snow particles using Three.js WebGPU renderer with TSL compute shaders. Particles are georeferenced in Mercator coordinates — snow always fills the viewport regardless of zoom level. Supports wind direction, intensity, fog overlay, and more.

## Installation

```bash
# npm
npm install @geoql/maplibre-gl-snow maplibre-gl three

# pnpm
pnpm add @geoql/maplibre-gl-snow maplibre-gl three

# yarn
yarn add @geoql/maplibre-gl-snow maplibre-gl three

# bun
bun add @geoql/maplibre-gl-snow maplibre-gl three
```

## Usage

```typescript
import maplibregl from 'maplibre-gl';
import { MaplibreSnowLayer } from '@geoql/maplibre-gl-snow';
import 'maplibre-gl/dist/maplibre-gl.css';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  center: [-74.006, 40.7128],
  zoom: 13,
  pitch: 55,
  maxPitch: 85,
});

map.on('load', () => {
  const snow = new MaplibreSnowLayer({
    density: 0.5,
    intensity: 0.5,
    flakeSize: 4,
    opacity: 0.8,
    direction: [0, 50], // [azimuth degrees, horizontal speed px/s]
    fog: true,
    fogOpacity: 0.08,
  });

  map.addLayer(snow);
});
```

## Options

```typescript
interface MaplibreSnowOptions {
  id?: string;
  density?: number;
  intensity?: number;
  flakeSize?: number;
  opacity?: number;
  direction?: [number, number];
  fog?: boolean;
  fogOpacity?: number;
}
```

| Option       | Type               | Default   | Description                                        |
| ------------ | ------------------ | --------- | -------------------------------------------------- |
| `id`         | `string`           | `'snow'`  | Unique layer ID                                    |
| `density`    | `number` (0–1)     | `0.5`     | Particle density — maps to 10k–200k particles      |
| `intensity`  | `number` (0–1)     | `0.5`     | Fall speed multiplier                              |
| `flakeSize`  | `number`           | `4`       | Base flake size in CSS pixels                      |
| `opacity`    | `number` (0–1)     | `0.8`     | Global opacity multiplier                          |
| `direction`  | `[number, number]` | `[0, 50]` | Wind as `[azimuth degrees, horizontal speed px/s]` |
| `fog`        | `boolean`          | `true`    | Enable atmospheric fog overlay                     |
| `fogOpacity` | `number` (0–1)     | `0.08`    | Fog opacity                                        |

## API

```typescript
const snow = new MaplibreSnowLayer(options);

// Update settings at runtime
snow.setDensity(0.8);
snow.setIntensity(0.7);
snow.setFlakeSize(6);
snow.setOpacity(0.6);
snow.setDirection([45, 80]); // wind from NE at 80 px/s
snow.setFog(false);
snow.setFogOpacity(0.12);
```

## How It Works

The layer implements MapLibre's `CustomLayerInterface` with a two-canvas architecture:

1. **WebGPU overlay** — Three.js `WebGPURenderer` on a separate `<canvas>` positioned absolutely over the MapLibre canvas. `pointer-events: none` ensures clicks pass through to the map.
2. **TSL compute shaders** — 100k particles stored in GPU `instancedArray` buffers. Compute shaders handle:
   - `computeInit` — spawns particles in a zoom-adaptive volume centered on the viewport
   - `computeUpdate` — applies gravity, wind drift, and respawns particles that fall below ground
3. **Georeferenced particles** — positions stored as `(mercX, mercY, mercAlt)` in Mercator [0,1] space. Spawn volume adapts to zoom level so snow always fills the viewport.
4. **Camera sync** — uses MapLibre's projection matrix directly. A `PerspectiveCamera` with `updateProjectionMatrix` no-op'd prevents Three.js from overwriting the matrix.
5. **Animation** — MapLibre drives the frame loop via `triggerRepaint()`, calling our `render()` callback which runs compute + render each frame.

## Browser Support

Requires a WebGPU-capable browser (Chrome 113+, Edge 113+, Firefox Nightly with `dom.webgpu.enabled`, or Safari 17.4+ with WebGPU enabled).

> **Note:** This library is **WebGPU-only**. There is no WebGL fallback. If WebGPU is unavailable, the layer silently does nothing.

## Exports

```typescript
// Main class
export { MaplibreSnowLayer } from '@geoql/maplibre-gl-snow';

// Default export (same class)
export { default } from '@geoql/maplibre-gl-snow';

// Types
export type { MaplibreSnowOptions } from '@geoql/maplibre-gl-snow';
```

## Requirements

- MapLibre GL JS >= 3.0.0
- Three.js >= 0.183.0 (WebGPU-enabled build)
- Node.js >= 24.0.0

## Contributing

1. Fork and create a feature branch from `main`
2. Make changes following [conventional commits](https://www.conventionalcommits.org/)
3. Ensure commits are signed ([why?](https://withblue.ink/2020/05/17/how-and-why-to-sign-git-commits.html))
4. Submit a PR

```bash
bun install
bun run build
bun run lint
bun run typecheck
```

## License

[MIT](./LICENSE)
