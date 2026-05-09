import { contextBridge, ipcRenderer } from 'electron';

const api = {
    openFolder: (): Promise<string | null> => ipcRenderer.invoke('folder:open'),

    onModelUpdate: (cb: (model: unknown) => void): (() => void) => {
        const listener = (_event: unknown, model: unknown): void => cb(model);
        ipcRenderer.on('model:update', listener);
        return () => {
            ipcRenderer.removeListener('model:update', listener);
        };
    },

    onModelError: (cb: (errors: unknown) => void): (() => void) => {
        const listener = (_event: unknown, errors: unknown): void => cb(errors);
        ipcRenderer.on('model:error', listener);
        return () => {
            ipcRenderer.removeListener('model:error', listener);
        };
    },
};

contextBridge.exposeInMainWorld('archViewer', api);

export type ArchViewerApi = typeof api;
