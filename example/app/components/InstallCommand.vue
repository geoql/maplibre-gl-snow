<script setup lang="ts">
import { SITE } from '~/data/site';

const { track } = useAnalytics();
const copied = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

async function copy() {
  try {
    await navigator.clipboard.writeText(SITE.install);
  } catch {
    // Clipboard can be blocked (permissions, insecure context); the
    // command stays selectable in the <code> block.
    return;
  }
  copied.value = true;
  track('install_copy', { command: SITE.install });
  clearTimeout(timer);
  timer = setTimeout(() => (copied.value = false), 1600);
}

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div class="install">
    <code class="install__cmd">{{ SITE.install }}</code>
    <button
      type="button"
      class="install__btn"
      :aria-label="copied ? 'Copied' : 'Copy install command'"
      @click="copy"
    >
      {{ copied ? 'Copied' : 'Copy' }}
    </button>
    <span class="sr-only" aria-live="polite">{{
      copied ? 'Install command copied' : ''
    }}</span>
  </div>
</template>

<style scoped>
.install {
  display: flex;
  align-items: stretch;
  border: 1px solid var(--rule);
  background: var(--well);
}

.install__cmd {
  flex: 1;
  min-width: 0;
  padding: 0.625rem 0.75rem;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--ink);
  overflow-wrap: anywhere;
  user-select: all;
}

.install__btn {
  flex: none;
  min-width: 4.5rem;
  border: 0;
  border-left: 1px solid var(--rule);
  background: transparent;
  color: var(--accent-ink);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 120ms ease;
}

.install__btn:hover {
  background: var(--rule);
}

.install__btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
</style>
