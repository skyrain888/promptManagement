import { globalShortcut, BrowserWindow, clipboard, screen } from 'electron';

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

  win.on('blur', () => {
    win.hide();
  });

  return win;
}

export function registerShortcuts(onSaveClipboard: () => void): void {
  // Cmd+Shift+P — toggle floating search window
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    if (!searchWindow) {
      searchWindow = createSearchWindow();
    }
    if (searchWindow.isVisible()) {
      searchWindow.hide();
    } else {
      searchWindow.show();
      searchWindow.focus();
    }
  });

  // Cmd+Shift+S — save clipboard content as new prompt
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    onSaveClipboard();
  });
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll();
}
