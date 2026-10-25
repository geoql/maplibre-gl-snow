import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vite-plus/test';
import { PARTICLES, particleCount } from '../app/data/site';

const source = readFileSync(
  new URL('../../src/index.ts', import.meta.url),
  'utf8',
);

function constant(name: string): number {
  const match = source.match(new RegExp(`const ${name} = ([\\d_]+);`));
  if (!match?.[1]) throw new Error(`${name} not found in src/index.ts`);
  return Number(match[1].replaceAll('_', ''));
}

describe('particle count readout', () => {
  it('mirrors the library particle range', () => {
    expect(PARTICLES.min).toBe(constant('MIN_PARTICLE_COUNT'));
    expect(PARTICLES.max).toBe(constant('MAX_PARTICLE_COUNT'));
  });

  it('maps density 0–1 onto the range and clamps', () => {
    expect(particleCount(0)).toBe(2_000);
    expect(particleCount(0.5)).toBe(11_000);
    expect(particleCount(1)).toBe(20_000);
    expect(particleCount(-1)).toBe(2_000);
    expect(particleCount(2)).toBe(20_000);
  });
});
