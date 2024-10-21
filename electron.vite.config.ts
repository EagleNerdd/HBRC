import { defineConfig, swcPlugin } from 'electron-vite';
import { resolve } from 'path';

const resolveD = {
  alias: {
    '@main': resolve(__dirname, './src/main'),
    '@renderer': resolve(__dirname, './src/renderer'),
    '@preload': resolve(__dirname, './src/preload'),
    '@shared': resolve(__dirname, './src/shared'),
    '@resources': resolve(__dirname, './src/resources'),
  },
};

export default defineConfig({
  main: {
    plugins: [swcPlugin()],
    resolve: resolveD,
    build: {
      commonjsOptions: {
        ignoreDynamicRequires: true,
        dynamicRequireTargets: ['node_modules/sqlite3/**/*.js'],
      },
    },
  },
  preload: {
    plugins: [swcPlugin()],
    resolve: resolveD,
    // ...
  },
  renderer: {
    resolve: resolveD,
    // ...
  },
});
