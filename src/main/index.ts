import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { watch } from 'chokidar';
import { ArchitectureSession, type WatchHandle } from './architectureSession';
import { ARCHITECTURE_FILE, loadArchitectureFromFolder } from './architectureRepository';
import { listRecentRepos, recordRecentRepo } from './recentRepos';
import type { ArchSystem, ValidationError } from './architectureParser';

const __dirname = dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let architectureSession: ArchitectureSession | null = null;

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        show: false,
        autoHideMenuBar: true,
        backgroundColor: '#0a0a0b',
        webPreferences: {
            preload: join(__dirname, '../preload/index.cjs'),
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

function createArchitectureSession(): ArchitectureSession {
    return new ArchitectureSession({
        load: loadArchitectureFromFolder,
        watch: (filePath, onChange): WatchHandle => {
            const watcher = watch(filePath, {
                ignoreInitial: true,
                awaitWriteFinish: {
                    stabilityThreshold: 75,
                    pollInterval: 20,
                },
            });
            watcher.on('add', onChange);
            watcher.on('change', onChange);
            watcher.on('unlink', onChange);
            watcher.on('error', (error) => {
                sendModelError([
                    {
                        file: ARCHITECTURE_FILE,
                        message: error instanceof Error ? error.message : 'file watcher failed',
                    },
                ]);
            });
            return {
                close: () => watcher.close(),
            };
        },
        emitUpdate: sendModelUpdate,
        emitError: sendModelError,
    });
}

function sendModelUpdate(model: ArchSystem): void {
    mainWindow?.webContents.send('model:update', model);
}

function sendModelError(errors: ValidationError[]): void {
    mainWindow?.webContents.send('model:error', errors);
}

async function openRepository(folderPath: string): Promise<string> {
    await recordRecentRepo(app.getPath('userData'), folderPath);
    await architectureSession?.openFolder(folderPath);
    return folderPath;
}

function registerIpcHandlers(): void {
    ipcMain.handle('folder:open', async (): Promise<string | null> => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Open a folder containing ARCHITECTURE.md',
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        return openRepository(result.filePaths[0]);
    });

    ipcMain.handle('repo:open', async (_event, folderPath: string): Promise<string> => {
        if (typeof folderPath !== 'string') throw new Error('repo:open requires a folder path');
        return openRepository(folderPath);
    });

    ipcMain.handle('recent-repos:list', async () => {
        return listRecentRepos(app.getPath('userData'));
    });
}

void app.whenReady().then(() => {
    architectureSession = createArchitectureSession();
    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    void architectureSession?.close();
});
