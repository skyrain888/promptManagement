import { app, BrowserWindow, Tray, Menu, nativeImage, clipboard, systemPreferences, Notification } from 'electron';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { Database } from '@promptstash/core';
import { CategoryRepo } from '@promptstash/core';
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

  win.once('ready-to-show', () => {
    win.show();
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

function showMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    mainWindow = createMainWindow();
  }
}

function createTrayIcon(): Electron.NativeImage {
  // Draw a 22x22 template icon: a document with lines (represents prompts)
  const size = 22;
  const canvas = Buffer.alloc(size * size * 4, 0); // RGBA

  const setPixel = (x: number, y: number) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    canvas[i] = 0;       // R
    canvas[i + 1] = 0;   // G
    canvas[i + 2] = 0;   // B
    canvas[i + 3] = 255;  // A
  };

  // Draw rounded rect outline (document shape) from (5,2) to (16,19)
  for (let x = 7; x <= 15; x++) { setPixel(x, 2); setPixel(x, 19); }
  for (let y = 4; y <= 17; y++) { setPixel(5, y); setPixel(16, y); }
  setPixel(6, 3); setPixel(15, 3);
  setPixel(6, 18); setPixel(15, 18);

  // Horizontal lines (text lines inside document)
  for (let x = 8; x <= 14; x++) { setPixel(x, 7); }
  for (let x = 8; x <= 14; x++) { setPixel(x, 10); }
  for (let x = 8; x <= 11; x++) { setPixel(x, 13); }

  const icon = nativeImage.createFromBuffer(canvas, { width: size, height: size, scaleFactor: 1.0 });
  icon.setTemplateImage(true);
  return icon;
}

function createTray(onSaveClipboard: () => boolean): void {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: '打开 PromptStash', click: () => showMainWindow() },
    {
      label: '保存剪贴板',
      accelerator: 'CmdOrCtrl+Shift+Alt+S',
      click: () => {
        const saved = onSaveClipboard();
        const { Notification } = require('electron');
        new Notification({
          title: 'PromptStash',
          body: saved ? '剪贴板内容已保存为提示词' : '剪贴板为空',
        }).show();
      },
    },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);
  tray.setToolTip('PromptStash');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => showMainWindow());
}

app.on('ready', async () => {
  // Hide dock first on macOS, before creating any windows
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  const db = new Database(DB_PATH);

  // Seed defaults
  const catRepo = new CategoryRepo(db);
  catRepo.seedDefaults();

  // Start local HTTP server
  await startServer(db);

  const dispatchToWindow = (data: Record<string, unknown>): void => {
    showMainWindow();
    const payload = JSON.stringify(data);
    const send = () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.executeJavaScript(
          `window.dispatchEvent(new CustomEvent('promptstash:create-from-clipboard', { detail: JSON.parse(${JSON.stringify(payload)}) }));`
        );
      }
    };
    if (mainWindow && mainWindow.webContents.isLoading()) {
      mainWindow.webContents.once('did-finish-load', send);
    } else {
      setTimeout(send, 300);
    }
  };

  const sendToRenderer = (text: string): void => {
    // Immediately show window with content (before LLM call) using fallback data
    const catList = catRepo.listAll();
    const defaultCat = catList[0];
    dispatchToWindow({
      content: text,
      title: text.replace(/\n/g, ' ').trim().slice(0, 20) + (text.length > 20 ? '...' : ''),
      categoryId: defaultCat?.id || '',
      tags: [],
    });

    // Then call LLM in background to enhance title/category/tags
    fetch('http://127.0.0.1:9877/api/prompts/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    })
      .then((r) => r.json())
      .then((data: any) => {
        if (data && !data.fallback) {
          // Update with LLM results
          dispatchToWindow({
            content: text,
            title: data.title || '',
            categoryId: data.categoryId || '',
            tags: data.tags || [],
            suggestedCategory: data.category,
            isNewCategory: data.isNewCategory,
          });
        }
      })
      .catch(() => {
        // Already showing fallback data, nothing more to do
      });
  };

  const saveClipboardToUI = (): boolean => {
    if (process.platform === 'darwin') {
      // Check if we have accessibility permission (needed to simulate Cmd+C)
      const hasAccess = systemPreferences.isTrustedAccessibilityClient(false);
      if (hasAccess) {
        try {
          execSync(
            `osascript -e 'tell application "System Events" to keystroke "c" using command down'`,
            { timeout: 1000 }
          );
        } catch {
          // Fall through to read clipboard as-is
        }
        // Wait for clipboard to update, then read
        setTimeout(() => {
          const text = clipboard.readText();
          if (text.trim()) {
            sendToRenderer(text);
          }
        }, 150);
        return true;
      }

      // No accessibility permission — prompt for it, then fall back to existing clipboard
      systemPreferences.isTrustedAccessibilityClient(true);
      const text = clipboard.readText();
      if (text.trim()) {
        sendToRenderer(text);
        return true;
      }
      new Notification({
        title: 'PromptStash',
        body: '请先复制文本 (Cmd+C)，或在系统设置中授予辅助功能权限以支持自动抓取选中文本',
      }).show();
      return false;
    }

    // Non-macOS: read clipboard directly
    const text = clipboard.readText();
    if (!text.trim()) return false;
    sendToRenderer(text);
    return true;
  };

  createTray(saveClipboardToUI);
  mainWindow = createMainWindow();
  registerShortcuts(saveClipboardToUI);
});

app.on('will-quit', () => {
  unregisterShortcuts();
});

app.on('window-all-closed', () => {
  // Prevent app from quitting when all windows close — keep tray running
});
