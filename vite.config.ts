/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    globals: true,            // Makes describe/it/expect available without imports
    environment: 'jsdom',     // Simulates a browser for component tests
    setupFiles: './vitest.setup.ts',  // Runs before each test file
    css: true,                // Process CSS in tests
  },
});