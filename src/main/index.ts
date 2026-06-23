import { app, shell, BrowserWindow, dialog } from 'electron'
import { join } from 'path'
import path from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'
import { openDb } from './db'
import { registerIpc } from './ipc'
import { backupDb } from './backup'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    fullscreen: true,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.duckduckwash.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const userData = app.getPath('userData')
  const dbPath = path.join(userData, 'laundry.db')
  const backupDir = path.join(userData, 'backups')

  let db: ReturnType<typeof openDb>
  try {
    db = openDb(dbPath)
  } catch (err) {
    // Never die silently — a non-technical user just sees the app fail to open.
    // Show the reason so they can report it.
    dialog.showErrorBox(
      'DuckDuckWash could not start',
      'There was a problem opening the database.\n\n' +
        (err instanceof Error ? err.message : String(err)) +
        '\n\nPlease send this message to support.'
    )
    app.quit()
    return
  }
  app.on('before-quit', () => db.close())
  backupDb(db, backupDir).catch((err) => console.error('startup backup failed:', err))
  registerIpc(db, backupDir)

  createWindow()

  // Auto-update from GitHub Releases. Downloads in the background and installs
  // on next quit — no prompts the aunt has to understand. Packaged builds only.
  if (!is.dev) {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => console.error('update check failed:', err))
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
