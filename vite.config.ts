import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

import { DEFAULT_PRODUCTION_API_URL } from './electron/app-config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const clarifiApiUrl = env.CLARIFI_API_URL?.trim() || DEFAULT_PRODUCTION_API_URL
  const electronDefine = {
    __CLARIFI_API_URL__: JSON.stringify(clarifiApiUrl),
  }

  return {
    plugins: [
      react(),
      electron([
        {
          entry: 'electron/main.ts',
          onstart(args) {
            args.startup()
          },
          vite: {
            define: electronDefine,
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron', 'keytar', 'form-data', 'node-fetch'],
                output: {
                  inlineDynamicImports: true,
                },
              },
            },
          },
        },
        {
          entry: 'electron/preload.ts',
          onstart(options) {
            options.reload()
          },
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron'],
              },
            },
          },
        },
      ]),
      renderer(),
    ],
    base: './',
    build: {
      rollupOptions: {
        input: {
          main: 'index.html',
          widget: 'widget.html',
        },
      },
    },
    server: {
      port: 5173,
      strictPort: true,
    },
  }
})
