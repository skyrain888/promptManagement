import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return win;
}

function createTray(): void {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open PromptStash', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setToolTip('PromptStash');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow?.show());
}

app.on('ready', () => {
  mainWindow = createMainWindow();
  createTray();

  // Hide dock icon on macOS (menubar-only app)
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
});

app.on('window-all-closed', (e: Event) => {
  e.preventDefault(); // Don't quit, stay in tray
});
