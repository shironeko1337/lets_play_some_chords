import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
<<<<<<< HEAD
  plugins: [react(), tailwindcss()],
  base: process.env.GITHUB_PAGES ? '/lets_play_some_chords/' : '/',
=======
  plugins: [react(), tailwindcss(), cloudflare()],
  base: '/lets_play_some_chords/', // GitHub Pages repo name
>>>>>>> 978abb40311a69a109040ea6eaf6efdbdd5a420f
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        debug: resolve(__dirname, 'debug.html'),
      },
    },
  },
});