import { join } from 'node:path';
import { ARCHITECTURE_FILE } from './architectureRepository';
import type { ArchSystem, ParseResult, ValidationError } from './architectureParser';

export interface WatchHandle {
    close: () => void | Promise<void>;
}

export interface ArchitectureSessionOptions {
    load: (folderPath: string) => Promise<ParseResult>;
    watch: (filePath: string, onChange: () => void) => WatchHandle;
    emitUpdate: (model: ArchSystem) => void;
    emitError: (errors: ValidationError[]) => void;
    debounceMs?: number;
}

export class ArchitectureSession {
    private readonly load: (folderPath: string) => Promise<ParseResult>;
    private readonly watch: (filePath: string, onChange: () => void) => WatchHandle;
    private readonly emitUpdate: (model: ArchSystem) => void;
    private readonly emitError: (errors: ValidationError[]) => void;
    private readonly debounceMs: number;
    private activeFolder: string | null = null;
    private watcher: WatchHandle | null = null;
    private reloadTimer: NodeJS.Timeout | null = null;

    constructor(options: ArchitectureSessionOptions) {
        this.load = options.load;
        this.watch = options.watch;
        this.emitUpdate = options.emitUpdate;
        this.emitError = options.emitError;
        this.debounceMs = options.debounceMs ?? 100;
    }

    async openFolder(folderPath: string): Promise<ParseResult> {
        await this.closeWatcher();
        this.activeFolder = folderPath;
        this.watcher = this.watch(join(folderPath, ARCHITECTURE_FILE), () => this.scheduleReload());
        return this.reloadNow();
    }

    async close(): Promise<void> {
        if (this.reloadTimer) clearTimeout(this.reloadTimer);
        this.reloadTimer = null;
        this.activeFolder = null;
        await this.closeWatcher();
    }

    private scheduleReload(): void {
        if (this.reloadTimer) clearTimeout(this.reloadTimer);
        this.reloadTimer = setTimeout(() => {
            this.reloadTimer = null;
            void this.reloadNow();
        }, this.debounceMs);
    }

    private async reloadNow(): Promise<ParseResult> {
        if (!this.activeFolder) {
            return {
                ok: false,
                errors: [
                    {
                        file: ARCHITECTURE_FILE,
                        message: 'no repository is open',
                    },
                ],
            };
        }
        const result = await this.load(this.activeFolder);
        if (result.ok) this.emitUpdate(result.model);
        else this.emitError(result.errors);
        return result;
    }

    private async closeWatcher(): Promise<void> {
        const watcher = this.watcher;
        this.watcher = null;
        if (watcher) await watcher.close();
    }
}
