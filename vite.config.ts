import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// No `define` block. The prototype used one to copy GEMINI_API_KEY into the
// bundle; anything compiled into the browser is public. Only VITE_ variables
// reach the app, and every one of them is a value that is safe to publish
// (a project URL, an anon key). Secrets are edge-function settings.

/** A sample-data build asks search engines not to index it: its numbers are made up. */
function noindexWhenSample(sample: boolean): Plugin {
  return {
    name: 'noindex-when-sample',
    transformIndexHtml: html => (sample ? html.replace('</head>', '    <meta name="robots" content="noindex, nofollow" />\n  </head>') : html),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const sample = (process.env.VITE_SAMPLE_DATA ?? env.VITE_SAMPLE_DATA) === 'true';
  return {
    plugins: [react(), noindexWhenSample(sample)],
    server: { port: 3000 },
    test: {
      include: ['tests/unit/**/*.test.ts'],
      environment: 'node',
    },
  } as any;
});
