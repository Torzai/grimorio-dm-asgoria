import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { grimorioContent } from './src/content/vite-plugin-content.ts';

export default defineConfig(({ command }) => ({
  plugins: [react(), grimorioContent()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    // Only for the "Editar .md" link, which exists in dev. A build gets an empty string,
    // so the absolute path of whoever builds never ends up in dist/.
    __REPO_ROOT__: JSON.stringify(command === 'serve' ? process.cwd().replaceAll('\\', '/') : ''),
  },
  build: {
    rolldownOptions: {
      output: {
        // Keeps every chunk under Vite's 500 kB warning; all of them still load eagerly.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules\/(react|react-dom|react-router|scheduler)\// },
            { name: 'vendor', test: /node_modules\// },
          ],
        },
      },
    },
  },
}));
