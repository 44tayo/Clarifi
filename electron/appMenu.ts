import { app, Menu, shell, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'

import { checkForSignedUpdates } from './updater'
import { isAllowedExternalUrl } from './urlSafety'

type WindowGetter = () => BrowserWindow | null

function openExternal(url: string): void {
  if (isAllowedExternalUrl(url)) {
    void shell.openExternal(url)
  }
}

export function installApplicationMenu(getWindow: WindowGetter): void {
  const isMac = process.platform === 'darwin'

  const appMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about' },
      {
        label: 'Check for Updates…',
        click: () => {
          const win = getWindow()
          if (win && !win.isDestroyed()) {
            win.show()
            win.focus()
            win.webContents.send('update:menu-check')
          }
          void checkForSignedUpdates()
        },
      },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  }

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [appMenu] : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? ([{ role: 'pasteAndMatchStyle' }, { role: 'delete' }, { role: 'selectAll' }] as const)
          : ([
              { role: 'delete' },
              { type: 'separator' as const },
              { role: 'selectAll' },
            ] as const)),
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? ([{ type: 'separator' as const }, { role: 'front' as const }] as const)
          : ([{ role: 'close' as const }] as const)),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Clarifi website',
          click: () => openExternal('https://www.clarifiapp.com'),
        },
        ...(!isMac
          ? ([
              { type: 'separator' as const },
              {
                label: 'Check for Updates…',
                click: () => {
                  const win = getWindow()
                  if (win && !win.isDestroyed()) {
                    win.show()
                    win.focus()
                    win.webContents.send('update:menu-check')
                  }
                  void checkForSignedUpdates()
                },
              },
            ] as const)
          : []),
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
