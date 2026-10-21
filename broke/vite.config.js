import { defineConfig } from 'vite';
// ARTIFACT=1 builds one JS file (maps inlined) for tools/artifact.mjs.
const one = process.env.ARTIFACT === '1';
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 6000, rollupOptions: one ? { output: { inlineDynamicImports: true } } : {} }, server: { port: 5173, strictPort: false } });
