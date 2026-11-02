import { defineConfig } from 'vite';

// `npm run build` bundles src/live.js (three.js and Ultra Water included, tree-shaken and
// minified) into ../art/beach/live.js, and src/spin.js (the Favorites page's turning
// product models) into ../art/beach/spin.js. The site loads both as plain ES modules;
// three.js goes in a chunk they share.
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
      input: { live: 'src/live.js', spin: 'src/spin.js' },
      preserveEntrySignatures: 'exports-only',
      output: { format: 'es', entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js' },
    },
  },
});
