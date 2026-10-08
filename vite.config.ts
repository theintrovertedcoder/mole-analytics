import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// No `define` block. The prototype used one to copy GEMINI_API_KEY into the
// bundle; anything compiled into the browser is public. Only VITE_ variables
// reach the app, and every one of them is a value that is safe to publish
// (a project URL, an anon key). Secrets live in edge-function settings.
export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
} as any);
