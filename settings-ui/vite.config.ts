import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [preact()],
  // Set base to './' for relative asset paths in VS Code webview
  base: './',
  build: {
    // Output directory relative to the project root (../dist/settings)
    outDir: resolve(__dirname, '..', 'dist', 'settings'),
    // Empty the output directory before building
    emptyOutDir: true,
    // Generate sourcemaps for debugging
    sourcemap: true,
    // Rollup options for fine-tuning the build
    rollupOptions: {
      output: {
        // Ensure entry file names are consistent
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }
    }
  },
  // Configure the dev server
  server: {
    // Enable CORS for all origins during development
    // This allows the VS Code webview (vscode-webview://) to fetch resources
    cors: true,
    // Specify the port (use 5174 for settings UI to avoid conflict with chat UI)
    port: 5174,
    // Make the server accessible over the network if needed
    // host: true,
  }
})
