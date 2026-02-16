import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';

/** Strip crossorigin attributes from HTML — required for Chrome extensions */
function chromeExtensionHtml(): Plugin {
  return {
    name: 'chrome-extension-html',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(/ crossorigin/g, '');
    },
  };
}

export default defineConfig({
  base: './',
  publicDir: 'public',
  plugins: [chromeExtensionHtml()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
        popup: resolve(__dirname, 'popup.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});
