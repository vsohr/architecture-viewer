import {
    _electron as electron,
    expect,
    test,
    type ElectronApplication,
    type Page,
} from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function launchApp(userDataPath?: string): Promise<{ app: ElectronApplication; page: Page }> {
    const app = await electron.launch({
            args: [join(process.cwd(), 'out', 'main', 'index.js')],
            env: {
                ...process.env,
                ...(userDataPath ? { ARCH_VIEWER_USER_DATA_DIR: userDataPath } : {}),
            },
        });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    return { app, page };
}

async function getRecentRepos(page: Page): Promise<Array<{ path: string }>> {
    return page.evaluate(async () => {
        const bridge = (globalThis as unknown as {
            archViewer?: { getRecentRepos: () => Promise<Array<{ path: string }>> };
        }).archViewer;
        if (!bridge) throw new Error('preload bridge missing');
        return bridge.getRecentRepos();
    });
}

test.describe('Electron app', () => {
    let app: ElectronApplication;
    let page: Page;

    test.beforeEach(async () => {
        ({ app, page } = await launchApp());
    });

    test.afterEach(async () => {
        await app.close();
    });

    test('exposes the preload bridge', async () => {
        const bridgeKeys = await page.evaluate(() =>
            Object.keys(
                (globalThis as unknown as { archViewer?: Record<string, unknown> }).archViewer ??
                    {},
            ),
        );

        expect(bridgeKeys).toEqual(
            expect.arrayContaining([
                'openFolder',
                'openRepo',
                'getRecentRepos',
                'onModelUpdate',
                'onModelError',
            ]),
        );
    });

    test('loads the current repository architecture document', async () => {
        await page.evaluate(async (repoPath) => {
            const bridge = (globalThis as unknown as {
                archViewer?: { openRepo: (folderPath: string) => Promise<string> };
            }).archViewer;
            if (!bridge) throw new Error('preload bridge missing');
            await bridge.openRepo(repoPath);
        }, process.cwd());

        await expect(page.getByText('Main process')).toBeVisible();
        await expect(page.getByText('Renderer UI')).toBeVisible();
        await expect(page.getByText('Preload bridge')).toBeVisible();
    });
});

test('remembers recent repo paths across app launches', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'arch-viewer-e2e-'));
    let firstApp: ElectronApplication | null = null;
    let secondApp: ElectronApplication | null = null;

    try {
        const first = await launchApp(userDataPath);
        firstApp = first.app;
        await first.page.evaluate(async (repoPath) => {
            const bridge = (globalThis as unknown as {
                archViewer?: { openRepo: (folderPath: string) => Promise<string> };
            }).archViewer;
            if (!bridge) throw new Error('preload bridge missing');
            await bridge.openRepo(repoPath);
        }, process.cwd());
        await firstApp.close();
        firstApp = null;
        const stored = JSON.parse(await readFile(join(userDataPath, 'recent-repos.json'), 'utf8')) as Array<{
            path: string;
        }>;
        expect(stored.map((repo) => repo.path)).toContain(process.cwd());

        const second = await launchApp(userDataPath);
        secondApp = second.app;
        const recents = await getRecentRepos(second.page);

        expect(recents.map((repo) => repo.path)).toContain(process.cwd());
    } finally {
        if (firstApp) await firstApp.close();
        if (secondApp) await secondApp.close();
        await rm(userDataPath, { recursive: true, force: true });
    }
});
