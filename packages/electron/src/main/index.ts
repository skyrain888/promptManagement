import { app, BrowserWindow, Tray, Menu, nativeImage, clipboard } from 'electron';
import path from 'node:path';
import { Database } from '@promptstash/core';
import { CategoryRepo, PromptRepo } from '@promptstash/core';
import { startServer } from './server.js';
import { registerShortcuts, unregisterShortcuts } from './shortcuts.js';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const DB_PATH = path.join(
  app.getPath('userData'),
  'data.db'
);

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    show: false,
    webPreferences: {
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

app.on('ready', async () => {
  const db = new Database(DB_PATH);

  // Seed defaults
  const catRepo = new CategoryRepo(db);
  catRepo.seedDefaults();

  // Start local HTTP server
  await startServer(db);

  mainWindow = createMainWindow();
  createTray();

  // Register global shortcuts
  const promptRepo = new PromptRepo(db);
  registerShortcuts(() => {
    const text = clipboard.readText();
    if (text.trim()) {
      const catList = catRepo.listAll();
      const defaultCat = catList.find((c) => c.name === '其他') ?? catList[0];
      promptRepo.create({
        title: text.slice(0, 20) + (text.length > 20 ? '...' : ''),
        content: text,
        categoryId: defaultCat.id,
      });
    }
  });

  if (process.platform === 'darwin') {
    app.dock.hide();
  }
});

app.on('will-quit', () => {
  unregisterShortcuts();
});

app.on('window-all-closed', (e: Event) => {
  e.preventDefault();
});
