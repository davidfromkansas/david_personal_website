import { defineConfig } from 'vite';

// `npm run build` bundles src/live.js (three.js and Ultra Water included, tree-shaken and
// minified) into ../art/beach/live.js, which the site loads as a plain ES module.
// `npm run dev` serves dev/ for previewing and for scripts/render_beach.mjs.
export default defineConfig({
  publicDir: false,
  server: { fs: { allow: ['..'] } },
  build: {
    outDir: '../art/beach',
    emptyOutDir: false,
    target: 'es2022',
    modulePreload: false,
    rollupOptions: {
      input: 'src/live.js',
      preserveEntrySignatures: 'exports-only',
      output: { format: 'es', entryFileNames: 'live.js' },
    },
  },
});
