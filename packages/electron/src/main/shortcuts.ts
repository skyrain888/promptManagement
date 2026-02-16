import { globalShortcut, BrowserWindow, Notification, screen } from 'electron';
import path from 'node:path';

let searchWindow: BrowserWindow | null = null;

export function createSearchWindow(): BrowserWindow {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  const winWidth = 680;
  const winHeight = 420;
  const x = Math.round((screenWidth - winWidth) / 2);

  const win = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x,
    y: 180,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(`${process.env.VITE_DEV_SERVER_URL}/search.html`);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/search.html'));
  }

  // Hide instead of destroy on close (renderer calls window.close())
  win.on('close', (e) => {
    e.preventDefault();
    win.hide();
  });

  win.on('blur', () => {
    win.hide();
  });

  return win;
}

export function registerShortcuts(onSaveClipboard: () => boolean): void {
  // Cmd+Shift+P — toggle floating search window
  const p = globalShortcut.register('CommandOrControl+Shift+P', () => {
    if (!searchWindow || searchWindow.isDestroyed()) {
      searchWindow = createSearchWindow();
    }
    if (searchWindow.isVisible()) {
      searchWindow.hide();
    } else {
      searchWindow.show();
      searchWindow.focus();
    }
  });
  if (!p) console.warn('[shortcuts] Failed to register Cmd+Shift+P');

  // Cmd+Shift+Alt+S — save clipboard content as new prompt
  const s = globalShortcut.register('CommandOrControl+Shift+Alt+S', () => {
    console.log('[shortcuts] Save clipboard triggered');
    const saved = onSaveClipboard();
    new Notification({
      title: 'PromptStash',
      body: saved ? 'Clipboard saved as prompt' : 'Clipboard is empty',
    }).show();
  });
  console.log(`[shortcuts] Cmd+Shift+Alt+S registered: ${s}`);
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll();
}
