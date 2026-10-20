import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // relative asset paths so the build can be hosted from any folder
  build: { chunkSizeWarningLimit: 1000 },
});
