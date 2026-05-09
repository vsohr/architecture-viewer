import type { ArchViewerApi } from './index';

declare global {
    interface Window {
        archViewer: ArchViewerApi;
    }
}

export {};
