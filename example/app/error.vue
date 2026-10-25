<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();

useSeoMeta({
  title: `${props.error.statusCode} — maplibre-gl-snow`,
  robots: 'noindex',
});
</script>

<template>
  <main class="error">
    <p class="error__code">{{ props.error.statusCode }}</p>
    <h1 class="error__title">Nothing fell here.</h1>
    <p class="error__text">
      There is no page at this address. The demo is on the home page.
    </p>
    <a href="/" class="error__link">Back to the demo</a>
  </main>
</template>

<style scoped>
.error {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100dvh;
  max-width: 48rem;
  margin: 0 auto;
  padding: 0 1.25rem;
}

.error__code {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  color: var(--accent-ink);
}

.error__title {
  margin: 1rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(2.75rem, 9vw, 6rem);
  font-weight: 600;
  line-height: 0.95;
  letter-spacing: -0.03em;
}

.error__text {
  max-width: 40ch;
  margin: 1.25rem 0 0;
  font-size: 1.0625rem;
  line-height: 1.5;
  color: var(--ink-2);
}

.error__link {
  align-self: flex-start;
  margin-top: 2rem;
  padding: 0.75rem 1.25rem;
  background: var(--ink);
  color: var(--paper);
  font-weight: 500;
  text-decoration: none;
}

.error__link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
