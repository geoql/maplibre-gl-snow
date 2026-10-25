<script setup lang="ts">
import { particleCount, SITE } from '~/data/site';
import type { SnowControl } from '~/types/analytics';
import { DEFAULT_SETTINGS, type SnowSettings } from '~/types/snow';

const settings = defineModel<SnowSettings>({ required: true });

const { track } = useAnalytics();

// Mobile starts collapsed so the map stays visible; desktop CSS ignores it.
const open = ref(false);
const webgpu = ref<boolean | null>(null);

onMounted(() => {
  webgpu.value = 'gpu' in navigator;
});

const flakes = computed(() =>
  particleCount(settings.value.density).toLocaleString('en-US'),
);

function commit(control: SnowControl, value: number | boolean) {
  track('demo_interaction', { control, value });
}

function set<K extends keyof SnowSettings>(key: K, value: SnowSettings[K]) {
  settings.value = { ...settings.value, [key]: value };
}

function onFog(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  set('fog', checked);
  commit('fog', checked);
}

function reset() {
  settings.value = { ...DEFAULT_SETTINGS };
  commit('reset', true);
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
</script>

<template>
  <aside class="panel" :data-open="open" aria-labelledby="panel-title">
    <div class="panel__head">
      <p class="panel__count">
        <span class="panel__numeral">{{ flakes }}</span>
        <span class="panel__unit">flakes in flight</span>
      </p>
      <button
        type="button"
        class="panel__toggle"
        :aria-expanded="open"
        aria-controls="panel-body"
        @click="open = !open"
      >
        {{ open ? 'Hide' : 'Controls' }}
      </button>
    </div>

    <div id="panel-body" class="panel__body">
      <h1 id="panel-title" class="panel__title">
        WebGPU snow for MapLibre GL JS
      </h1>
      <p class="panel__lede">
        A custom layer that runs every flake on the GPU with Three.js compute
        shaders. Drag the map; the snow stays with it.
      </p>

      <p v-if="webgpu === false" class="panel__notice" role="status">
        This browser has no WebGPU, so the layer draws nothing. Open the demo in
        Chrome or Edge 113+, or Safari 26+.
      </p>

      <fieldset class="panel__group">
        <legend>Snowfall</legend>
        <SnowRange
          id="density"
          label="Density"
          :min="0"
          :max="1"
          :step="0.01"
          :display="pct(settings.density)"
          :model-value="settings.density"
          @update:model-value="set('density', $event)"
          @commit="commit('density', $event)"
        />
        <SnowRange
          id="intensity"
          label="Fall speed"
          :min="0"
          :max="1"
          :step="0.01"
          :display="pct(settings.intensity)"
          :model-value="settings.intensity"
          @update:model-value="set('intensity', $event)"
          @commit="commit('intensity', $event)"
        />
        <SnowRange
          id="flake-size"
          label="Flake size"
          :min="1"
          :max="20"
          :step="0.5"
          :display="`${settings.flakeSize} px`"
          :model-value="settings.flakeSize"
          @update:model-value="set('flakeSize', $event)"
          @commit="commit('flake_size', $event)"
        />
        <SnowRange
          id="opacity"
          label="Opacity"
          :min="0"
          :max="1"
          :step="0.01"
          :display="pct(settings.opacity)"
          :model-value="settings.opacity"
          @update:model-value="set('opacity', $event)"
          @commit="commit('opacity', $event)"
        />
      </fieldset>

      <fieldset class="panel__group">
        <legend>Wind</legend>
        <SnowRange
          id="wind-azimuth"
          label="Direction"
          :min="0"
          :max="359"
          :step="1"
          :display="`${settings.windAzimuth}°`"
          :model-value="settings.windAzimuth"
          @update:model-value="set('windAzimuth', $event)"
          @commit="commit('wind_azimuth', $event)"
        />
        <SnowRange
          id="wind-speed"
          label="Speed"
          :min="0"
          :max="200"
          :step="1"
          :display="`${settings.windSpeed} px/s`"
          :model-value="settings.windSpeed"
          @update:model-value="set('windSpeed', $event)"
          @commit="commit('wind_speed', $event)"
        />
      </fieldset>

      <fieldset class="panel__group">
        <legend>Fog</legend>
        <label class="panel__check">
          <input type="checkbox" :checked="settings.fog" @change="onFog" />
          <span>Fog overlay</span>
        </label>
        <SnowRange
          id="fog-opacity"
          label="Fog opacity"
          :min="0"
          :max="0.5"
          :step="0.01"
          :display="pct(settings.fogOpacity)"
          :model-value="settings.fogOpacity"
          @update:model-value="set('fogOpacity', $event)"
          @commit="commit('fog_opacity', $event)"
        />
      </fieldset>

      <button type="button" class="panel__reset" @click="reset">
        Reset to defaults
      </button>

      <div class="panel__install">
        <p class="panel__label">Install</p>
        <InstallCommand />
        <p class="panel__links">
          <OutboundLink :href="SITE.repo" section="panel">Source</OutboundLink>
          <span aria-hidden="true">·</span>
          <OutboundLink :href="SITE.npm" section="panel">npm</OutboundLink>
          <span aria-hidden="true">·</span>
          <OutboundLink :href="SITE.jsr" section="panel">JSR</OutboundLink>
        </p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.panel {
  position: fixed;
  z-index: 15;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--rule);
  background: var(--surface);
  backdrop-filter: blur(16px);
  color: var(--ink);
}

.panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.875rem 1rem 0.75rem;
  border-bottom: 1px solid var(--rule);
}

.panel__count {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin: 0;
}

.panel__numeral {
  font-family: var(--font-display);
  font-size: clamp(2rem, 5vw, 3.25rem);
  font-weight: 600;
  line-height: 0.95;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  color: var(--accent-ink);
}

.panel__unit {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--ink-2);
}

.panel__toggle {
  display: none;
  height: 2.25rem;
  padding: 0 0.875rem;
  border: 1px solid var(--rule);
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
}

.panel__body {
  display: grid;
  gap: 1.125rem;
  padding: 1rem;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.panel__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.panel__lede {
  margin: -0.5rem 0 0;
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.5;
  color: var(--ink-2);
}

.panel__notice {
  margin: 0;
  padding: 0.625rem 0.75rem;
  border-left: 2px solid var(--warn);
  background: var(--well);
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--ink);
}

.panel__group {
  display: grid;
  gap: 0.875rem;
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}

.panel__group legend,
.panel__label {
  margin: 0 0 0.125rem;
  padding: 0;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.panel__check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--ink-2);
  cursor: pointer;
}

.panel__check input {
  width: 1rem;
  height: 1rem;
  margin: 0;
  accent-color: var(--accent);
}

.panel__check input:focus-visible,
.panel__toggle:focus-visible,
.panel__reset:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.panel__reset {
  justify-self: start;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-2);
  font: inherit;
  font-size: 0.8125rem;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.panel__reset:hover {
  color: var(--ink);
}

.panel__install {
  display: grid;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--rule);
}

.panel__links {
  display: flex;
  gap: 0.5rem;
  margin: 0;
  font-size: 0.8125rem;
  color: var(--ink-3);
}

.panel__links a {
  color: var(--accent-ink);
  text-underline-offset: 3px;
}

/* Desktop and tablet: a column on the left, under the bar. */
@media (min-width: 640px) {
  .panel {
    top: 3.75rem;
    left: clamp(0.75rem, 2vw, 1.25rem);
    width: 20rem;
    max-height: calc(100dvh - 5rem);
  }
}

/* Phone: a bottom sheet that starts collapsed. */
@media (max-width: 639.98px) {
  .panel {
    left: 0;
    right: 0;
    bottom: 0;
    max-height: 70dvh;
    border-width: 1px 0 0;
    padding-bottom: env(safe-area-inset-bottom);
  }

  .panel__head {
    border-bottom-color: transparent;
  }

  .panel[data-open='true'] .panel__head {
    border-bottom-color: var(--rule);
  }

  .panel__toggle {
    display: inline-flex;
    align-items: center;
  }

  .panel__body {
    display: none;
  }

  .panel[data-open='true'] .panel__body {
    display: grid;
  }
}
</style>
