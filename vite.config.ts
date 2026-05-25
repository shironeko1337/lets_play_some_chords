import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {resolve} from 'path';

import {cloudflare} from "@cloudflare/vite-plugin";

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*_test.ts'],
    exclude: ['src/quiz/song_generator_test.ts'],
  },
  base: process.env.GITHUB_PAGES ? '/lets_play_some_chords/' : '/',
  plugins: [react(), tailwindcss(), cloudflare()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        debug: resolve(__dirname, 'debug.html'),
        generate_song: resolve(__dirname, 'generate_song.html'),
      },
    },
  },
});
