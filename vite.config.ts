import { copyFileSync, cpSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { DEFAULT_PRODUCTION_API_URL } from './electron/app-config'

function copyStealthNativePlugin() {
  return {
    name: 'copy-stealth-native',
    closeBundle() {
      const root = process.cwd()
      const destDir = join(root, 'dist-electron/resources')
      mkdirSync(destDir, { recursive: true })

      if (process.platform === 'darwin') {
        const excludeSrc = join(root, 'resources/window_capture_exclude.node')
        if (existsSync(excludeSrc)) {
          copyFileSync(excludeSrc, join(destDir, 'window_capture_exclude.node'))
        }
      }

      const pttSrc = join(root, 'resources/dictation_ptt.node')
      if (process.platform === 'darwin' && existsSync(pttSrc)) {
        copyFileSync(pttSrc, join(destDir, 'dictation_ptt.node'))
      }
    },
  }
}

function copyMemoryMigrationsPlugin() {
  return {
    name: 'copy-memory-migrations',
    closeBundle() {
      const root = process.cwd()
      const src = join(root, 'electron/memory/migrations')
      if (!existsSync(src)) return
      const destDir = join(root, 'dist-electron/memory/migrations')
      mkdirSync(destDir, { recursive: true })
      cpSync(src, destDir, { recursive: true })
    },
  }
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
            args.startup()
          },
          vite: {
            define: electronDefine,
            plugins: [copyStealthNativePlugin(), copyMemoryMigrationsPlugin()],
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron', 'keytar', 'form-data', 'node-fetch', 'better-sqlite3'],
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
          overlay: 'overlay.html',
          onboarding: 'onboarding.html',
          settings: 'settings.html',
          dictationPill: 'dictation-pill.html',
          meetingPrompt: 'meeting-prompt.html',
        },
      },
    },
    server: {
      port: 5173,
      strictPort: true,
    },
  }
})
