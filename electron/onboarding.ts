import { app, BrowserWindow } from 'electron'
import * as path from 'path'
import { markOnboardingComplete } from './onboardingState'
import {
  setOnboardingWindow as setTutorialOnboardingWindow,
  stopTutorial,
} from './onboardingTutorial'
import {
  destroyAuthPane,
  hideAuthPane,
  reapplyAuthPaneBounds,
  setAuthPaneParent,
} from './onboardingAuthPane'
import {
  createOverlayWindow,
  destroyOverlayWindow,
  getOverlayWindow,
  showOverlayWindow,
} from './overlay'
import { createDictationPillWindow } from './dictationPill'
import { syncDictationEntitlement } from './planAccess'
import { registerKeybinds } from './keybindManager'
import { sendOverlayTourStep } from './overlayTour'

let onboardingWindow: BrowserWindow | null = null

const isDev = !app.isPackaged

export function getOnboardingWindow(): BrowserWindow | null {
  return onboardingWindow
}

export function notifyOnboardingAuthConnected(): void {
  if (!onboardingWindow || onboardingWindow.isDestroyed()) return
  onboardingWindow.webContents.send('onboarding:auth-connected')
}

export function ensureDictationPillAtLaunch(): void {
  createDictationPillWindow()
  void syncDictationEntitlement()
}

export function createOnboardingWindow(): BrowserWindow {
  if (onboardingWindow && !onboardingWindow.isDestroyed()) {
    onboardingWindow.focus()
    return onboardingWindow
  }

  // Real overlay deploys only after onboarding — tear down any leftover instance.
  destroyOverlayWindow()

  onboardingWindow = new BrowserWindow({
    width: 980,
    height: 640,
    minWidth: 820,
    minHeight: 560,
    center: true,
    resizable: true,
    show: false,
    acceptFirstMouse: true,
    title: 'Clarifi',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: '#0f0f10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  setTutorialOnboardingWindow(onboardingWindow)
  setAuthPaneParent(onboardingWindow)

  onboardingWindow.on('resize', () => {
    reapplyAuthPaneBounds()
  })

  onboardingWindow.once('ready-to-show', () => {
    onboardingWindow?.show()
  })

  if (isDev) {
    onboardingWindow.loadURL('http://localhost:5173/onboarding.html')
  } else {
    onboardingWindow.loadFile(path.join(__dirname, '../dist/onboarding.html'))
  }

  ensureDictationPillAtLaunch()

  onboardingWindow.on('closed', () => {
    destroyAuthPane()
    setAuthPaneParent(null)
    onboardingWindow = null
    setTutorialOnboardingWindow(null)
    stopTutorial()
  })

  return onboardingWindow
}

export function beginLiveOverlayTour(): void {
  if (!getOverlayWindow() || getOverlayWindow()?.isDestroyed()) {
    createOverlayWindow()
  }
  showOverlayWindow()
  ensureDictationPillAtLaunch()
}

export function endLiveOverlayTour(): void {
  sendOverlayTourStep(null)
}

export async function completeOnboarding(): Promise<void> {
  stopTutorial()
  endLiveOverlayTour()
  hideAuthPane()
  await markOnboardingComplete()

  if (onboardingWindow && !onboardingWindow.isDestroyed()) {
    onboardingWindow.close()
    onboardingWindow = null
    setTutorialOnboardingWindow(null)
  }

  if (!getOverlayWindow() || getOverlayWindow()?.isDestroyed()) {
    createOverlayWindow()
  }
  showOverlayWindow()
  createDictationPillWindow()
  if (isDictationEnabled()) {
    startDictationPttMonitor()
    showDictationPillWindow()
  }
  registerKeybinds()
}

export function destroyOnboardingWindow(): void {
  destroyAuthPane()
  setAuthPaneParent(null)
  if (onboardingWindow && !onboardingWindow.isDestroyed()) {
    onboardingWindow.destroy()
  }
  onboardingWindow = null
  setTutorialOnboardingWindow(null)
  stopTutorial()
}
