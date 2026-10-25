import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vite-plus/test';

// One colour-mode source: @nuxtjs/color-mode. VueUse's useDark/useColorMode
// keep a second theme state that flips <html> during hydration (FOUC).
const APP_DIR = fileURLToPath(new URL('../app', import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe('colour mode source', () => {
  it('never uses VueUse for the theme', () => {
    const offenders = files(APP_DIR).filter((file) => {
      const text = readFileSync(file, 'utf8');
      return /useDark\(|@vueuse\/core/.test(text);
    });
    expect(offenders).toEqual([]);
  });
});
