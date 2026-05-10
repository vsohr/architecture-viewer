import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ArchitectureSession, type WatchHandle } from './architectureSession';
import type { ArchSystem, ParseResult, ValidationError } from './architectureParser';

const model: ArchSystem = {
    id: 'demo',
    name: 'demo',
    about: '',
    levels: {
        demo: {
            bounds: { w: 760, h: 420 },
            nodes: [],
            edges: [],
        },
    },
    comments: [],
    sampleErrors: [],
};

const errors: ValidationError[] = [
    {
        file: 'ARCHITECTURE.md',
        message: 'bad architecture',
    },
];

describe('ArchitectureSession', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    test('loads a folder immediately and emits model updates', async () => {
        const emitUpdate = vi.fn();
        const emitError = vi.fn();
        const close = vi.fn();
        const session = new ArchitectureSession({
            load: async (): Promise<ParseResult> => ({ ok: true, model }),
            watch: (): WatchHandle => ({ close }),
            emitUpdate,
            emitError,
            debounceMs: 25,
        });

        await session.openFolder('C:\\repo\\demo');

        expect(emitUpdate).toHaveBeenCalledWith(model);
        expect(emitError).not.toHaveBeenCalled();
    });

    test('debounces watcher reloads and emits structured errors', async () => {
        const emitUpdate = vi.fn();
        const emitError = vi.fn();
        let onChange: (() => void) | undefined;
        const load = vi
            .fn(async (folderPath: string): Promise<ParseResult> => {
                void folderPath;
                return { ok: true, model };
            })
            .mockResolvedValueOnce({ ok: true, model })
            .mockResolvedValueOnce({ ok: false, errors });
        const session = new ArchitectureSession({
            load,
            watch: (_filePath, cb): WatchHandle => {
                onChange = cb;
                return { close: vi.fn() };
            },
            emitUpdate,
            emitError,
            debounceMs: 25,
        });

        await session.openFolder('C:\\repo\\demo');
        if (onChange) onChange();
        if (onChange) onChange();
        await vi.advanceTimersByTimeAsync(25);

        expect(emitError).toHaveBeenCalledWith(errors);
        expect(emitUpdate).toHaveBeenCalledTimes(1);
    });
});
