<script setup lang="ts">
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { MaplibreSnowLayer } from '@geoql/maplibre-gl-snow';
import { MAP_STYLE } from '~/data/site';
import type { SnowSettings } from '~/types/snow';

const props = defineProps<{ settings: SnowSettings }>();

// MapLibre v6 looks for its worker next to its own module. Bundling moves the
// module, so point it at the worker file Vite emits.
maplibregl.setWorkerUrl(maplibreWorkerUrl);

const container = useTemplateRef<HTMLDivElement>('map-el');
const colorMode = useColorMode();
const isDark = computed(() => colorMode.value === 'dark');

let map: maplibregl.Map | null = null;
let snow: MaplibreSnowLayer | null = null;

// Added on every style load (first load and each light/dark swap). The same
// instance keeps its settings across swaps.
function ensureSnowLayer() {
  if (!map || !snow || map.getLayer(snow.id)) return;
  map.addLayer(snow);
}

onMounted(() => {
  if (!container.value) return;
  const s = props.settings;

  snow = new MaplibreSnowLayer({
    density: s.density,
    intensity: s.intensity,
    flakeSize: s.flakeSize,
    opacity: s.opacity,
    direction: [s.windAzimuth, s.windSpeed],
    fog: s.fog,
    fogOpacity: s.fogOpacity,
  });

  map = new maplibregl.Map({
    container: container.value,
    style: isDark.value ? MAP_STYLE.dark : MAP_STYLE.light,
    center: [-74.006, 40.7128],
    zoom: 13,
    pitch: 55,
    bearing: -15,
    maxPitch: 85,
    attributionControl: { compact: true },
  });

  map.addControl(
    new maplibregl.NavigationControl({ visualizePitch: true }),
    'bottom-right',
  );
  map.on('style.load', ensureSnowLayer);
});

// MapLibre does not call a custom layer's onRemove when the style is
// replaced, so remove the layer first: that tears down its WebGPU overlay
// before ensureSnowLayer adds a fresh one on the next style load.
watch(isDark, (dark) => {
  if (!map) return;
  if (snow && map.getLayer(snow.id)) map.removeLayer(snow.id);
  map.setStyle(dark ? MAP_STYLE.dark : MAP_STYLE.light, { diff: false });
});

watch(
  () => ({ ...props.settings }),
  (next, prev) => {
    if (!snow) return;
    if (next.density !== prev.density) snow.setDensity(next.density);
    if (next.intensity !== prev.intensity) snow.setIntensity(next.intensity);
    if (next.flakeSize !== prev.flakeSize) snow.setFlakeSize(next.flakeSize);
    if (next.opacity !== prev.opacity) snow.setOpacity(next.opacity);
    if (
      next.windAzimuth !== prev.windAzimuth ||
      next.windSpeed !== prev.windSpeed
    ) {
      snow.setDirection([next.windAzimuth, next.windSpeed]);
    }
    if (next.fog !== prev.fog) snow.setFog(next.fog);
    if (next.fogOpacity !== prev.fogOpacity) {
      snow.setFogOpacity(next.fogOpacity);
    }
  },
);

onBeforeUnmount(() => {
  map?.remove();
  map = null;
  snow = null;
});
</script>

<template>
  <div
    ref="map-el"
    class="snow-map"
    role="region"
    aria-label="Map of lower Manhattan with falling snow"
  />
</template>

<!-- maplibregl-map (and the snow layer) set position: relative on the map
     container, so the container sizes itself instead of relying on inset. -->

<style scoped>
.snow-map {
  width: 100vw;
  height: 100dvh;
}
</style>
