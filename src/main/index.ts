import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        show: false,
        autoHideMenuBar: true,
        backgroundColor: '#0a0a0b',
        webPreferences: {
            preload: join(__dirname, '../preload/index.mjs'),
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.on('ready-to-show', () => {
        mainWindow?.show();
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    if (process.env.ELECTRON_RENDERER_URL) {
        void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    } else {
        void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }
}

function registerIpcHandlers(): void {
    ipcMain.handle('folder:open', async (): Promise<string | null> => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Open a folder containing ARCHITECTURE.md',
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        return result.filePaths[0];
    });
}

void app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
