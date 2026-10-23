/// <reference types="vitest/config" />
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    // OAuth redirect URIs are registered against 127.0.0.1, not localhost.
    host: '127.0.0.1',
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
