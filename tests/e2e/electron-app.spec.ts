import {
    _electron as electron,
    expect,
    test,
    type ElectronApplication,
    type Page,
} from '@playwright/test';
import { join } from 'node:path';

test.describe('Electron app', () => {
    let app: ElectronApplication;
    let page: Page;

    test.beforeEach(async () => {
        app = await electron.launch({
            args: [join(process.cwd(), 'out', 'main', 'index.js')],
        });
        page = await app.firstWindow();
        await page.waitForLoadState('domcontentloaded');
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
