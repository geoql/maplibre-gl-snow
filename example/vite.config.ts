import { defineConfig } from 'vite-plus';

export default defineConfig({
  base: '/maplibre-gl-snow/',
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
