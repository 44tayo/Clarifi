import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

import { DEFAULT_PRODUCTION_API_URL } from './electron/app-config'

/** Cursor sets ELECTRON_RUN_AS_NODE=1; child Electron must not inherit it or it SIGABRTs. */
function electronChildEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  return env
}

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
            args.startup(['.', '--no-sandbox'], { env: electronChildEnv() })
          },
          vite: {
            define: electronDefine,
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: [
                  'electron',
                  'keytar',
                  'form-data',
                  'node-fetch',
                  'ws',
                  'bufferutil',
                  'utf-8-validate',
                ],
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
        {
          entry: 'electron/detection-banner-preload.ts',
          onstart() {
            // Banner preload rebuilds with main; no separate Electron restart.
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
          detectionBanner: 'detection-banner.html',
        },
      },
    },
    server: {
      port: 5173,
      strictPort: true,
    },
  }
})
