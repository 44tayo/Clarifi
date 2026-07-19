import { app, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'

const ALLOWED_UPDATE_HOSTS = ['github.com', 'api.github.com'] as const

let updatePromptOpen = false

export async function configureUpdater(): Promise<void> {
  if (!app.isPackaged) {
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.allowDowngrade = false

  autoUpdater.on('update-available', (info) => {
    if (updatePromptOpen) return
    updatePromptOpen = true
    void dialog
      .showMessageBox({
        type: 'info',
        title: 'Update available',
        message: `Clarifi ${info.version} is ready to download.`,
        detail: 'Updates install after download and require a restart.',
        buttons: ['Download', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(async ({ response }) => {
        updatePromptOpen = false
        if (response === 0) {
          await autoUpdater.downloadUpdate()
        }
      })
      .catch(() => {
        updatePromptOpen = false
      })
  })

  autoUpdater.on('update-downloaded', (info) => {
    void dialog
      .showMessageBox({
        type: 'info',
        title: 'Update ready',
        message: `Clarifi ${info.version} downloaded.`,
        detail: 'Restart now to install the update.',
        buttons: ['Restart', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall()
        }
      })
  })

  autoUpdater.on('error', (error) => {
    console.error('Auto-updater error:', error.message)
  })

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: process.env.GH_UPDATE_OWNER ?? 'Tayowill',
    repo: process.env.GH_UPDATE_REPO ?? 'clarificluely',
  })

  autoUpdater.requestHeaders = {}

  const originalCheckForUpdates = autoUpdater.checkForUpdates.bind(autoUpdater)

  autoUpdater.checkForUpdates = async () => {
    const feedUrl = autoUpdater.getFeedURL()
    if (typeof feedUrl === 'string') {
      const hostname = new URL(feedUrl).hostname
      if (!ALLOWED_UPDATE_HOSTS.includes(hostname as (typeof ALLOWED_UPDATE_HOSTS)[number])) {
        throw new Error(`Blocked update from untrusted host: ${hostname}`)
      }
    }
    return originalCheckForUpdates()
  }
}

export async function checkForSignedUpdates(): Promise<void> {
  if (!app.isPackaged) {
    return
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    console.error('Update check failed:', error instanceof Error ? error.message : error)
  }
}
