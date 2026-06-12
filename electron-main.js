import { app, BrowserWindow, ipcMain } from 'electron';
import { createServer } from './server/index.js';

// 防止 EPIPE：stdout/stderr 管道断开时静默处理，避免 Uncaught Exception
process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE') return;
  throw err;
});
process.stderr.on('error', (err) => {
  if (err.code === 'EPIPE') return;
  throw err;
});

const PORT = 3456;
let mainWindow = null;

async function startServer() {
  const server = await createServer();
  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`[Express] 服务器运行在 http://localhost:${PORT}`);
      resolve();
    });
  });
}

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // IPC: 隐藏/显示窗口按钮（红绿灯）
  ipcMain.on('hide-window-buttons', () => {
    if (mainWindow) mainWindow.setWindowButtonVisibility(false);
  });
  ipcMain.on('show-window-buttons', () => {
    if (mainWindow) mainWindow.setWindowButtonVisibility(true);
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', async () => {
  await startServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});