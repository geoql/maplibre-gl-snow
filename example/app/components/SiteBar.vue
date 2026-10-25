<script setup lang="ts">
import { SITE } from '~/data/site';
</script>

<template>
  <header class="bar">
    <a href="/" class="bar__mark" aria-label="maplibre-gl-snow home">
      <img src="/favicon.svg" alt="" width="24" height="24" />
      <span class="bar__name"
        >maplibre-gl-<strong class="bar__accent">snow</strong></span
      >
    </a>
    <nav class="bar__nav" aria-label="Project links">
      <OutboundLink :href="SITE.repo" section="header" class="chip">
        <svg
          class="chip__icon"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.7 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"
          />
        </svg>
        <span class="chip__text">GitHub</span>
      </OutboundLink>
      <OutboundLink :href="SITE.npm" section="header" class="chip">
        <span class="chip__mono">npm</span>
      </OutboundLink>
      <ThemeToggle />
    </nav>
  </header>
</template>

<style scoped>
.bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem clamp(0.75rem, 2vw, 1.25rem);
  pointer-events: none;
}

.bar > * {
  pointer-events: auto;
}

.bar__mark {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  height: 2.25rem;
  padding: 0 0.75rem 0 0.5rem;
  border: 1px solid var(--rule);
  background: var(--surface);
  backdrop-filter: blur(14px);
  color: var(--ink);
  text-decoration: none;
}

.bar__mark:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.bar__name {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar__accent {
  font-weight: 600;
  color: var(--accent-ink);
}

.bar__nav {
  display: flex;
  flex: none;
  gap: 0.375rem;
}
</style>
