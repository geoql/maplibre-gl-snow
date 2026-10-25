<script setup lang="ts">
const props = defineProps<{
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Text shown next to the label. */
  display: string;
}>();

const model = defineModel<number>({ required: true });
const emit = defineEmits<{ commit: [value: number] }>();

function onInput(event: Event) {
  model.value = Number((event.target as HTMLInputElement).value);
}

function onChange(event: Event) {
  emit('commit', Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="range">
    <label :for="props.id" class="range__label">
      <span>{{ props.label }}</span>
      <output :for="props.id" class="range__value">{{ props.display }}</output>
    </label>
    <input
      :id="props.id"
      type="range"
      :min="props.min"
      :max="props.max"
      :step="props.step"
      :value="model"
      @input="onInput"
      @change="onChange"
    />
  </div>
</template>

<style scoped>
.range {
  display: grid;
  gap: 0.375rem;
}

.range__label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--ink-2);
}

.range__value {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

input[type='range'] {
  width: 100%;
  margin: 0;
  accent-color: var(--accent);
  cursor: pointer;
}

input[type='range']:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
</style>
