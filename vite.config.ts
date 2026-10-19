/**
 * Vite build configuration.
 *
 * The most important line is `base`. The site is published as a GitHub Pages
 * *project* site at https://konstantinbiryukov.github.io/last-of-us-map/ —
 * not at the domain root — so every generated asset URL must start with
 * `/last-of-us-map/`. The old Vue CLI config used `publicPath` for the same job.
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  // Use the GitHub Pages sub-path for builds and `vite preview`.
  // In `vite dev` we also use it so local URLs look like production
  // (http://localhost:5173/last-of-us-map/#/).
  base: command === 'build' || command === 'serve' ? '/last-of-us-map/' : '/',

  plugins: [react()],

  build: {
    outDir: 'dist',
    // Mapbox GL and Three.js are large. Put them in their own chunks so the
    // browser can cache them separately from our own (frequently changing) code.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/mapbox-gl')) return 'mapbox';
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/react')) return 'react';
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 2000,
    sourcemap: false, // keep the published site small; enable locally when debugging a production build
  },

  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
}));
