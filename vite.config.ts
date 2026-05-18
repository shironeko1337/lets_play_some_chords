import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {resolve} from 'path';

import {cloudflare} from "@cloudflare/vite-plugin";

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/lets_play_some_chords/' : '/',
  plugins: [react(), tailwindcss(), cloudflare()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        debug: resolve(__dirname, 'debug.html'),
      },
    },
  },
});
