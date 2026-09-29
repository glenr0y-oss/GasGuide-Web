import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Pure math runs in plain Node; screen tests opt into a DOM with
    // `// @vitest-environment jsdom` at the top of the file.
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
});
