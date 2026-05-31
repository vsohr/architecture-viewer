import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type Bridge = {
    openRepo: (path: string) => Promise<string>;
    getRecentRepos: () => Promise<Array<{ path: string }>>;
};

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

async function getBridgeKeys(page: Page): Promise<string[]> {
    return page.evaluate(() => Object.keys((globalThis as unknown as { archViewer?: Bridge }).archViewer ?? {}));
}

async function getRecentRepos(page: Page): Promise<Array<{ path: string }>> {
    return page.evaluate(async () => {
        const bridge = (globalThis as unknown as { archViewer?: Bridge }).archViewer;
        if (!bridge) {
            throw new Error('preload bridge missing');
        }
        return bridge.getRecentRepos();
    });
}

async function openRepository(
    page: Page,
    repoPath = process.cwd(),
    options: { waitForModel?: boolean } = {},
): Promise<void> {
    const result = await page.evaluate(async (path) => {
        const bridge = (globalThis as unknown as { archViewer?: Bridge }).archViewer;
        if (!bridge) {
            throw new Error('preload bridge missing');
        }
        return bridge.openRepo(path);
    }, repoPath);

    expect(result).toBe(repoPath);
    if (options.waitForModel ?? true) {
        await expect(page.locator('.arch-node').first()).toBeVisible();
    }
}

async function createArchitectureRepo(markdown: string): Promise<string> {
    const repoPath = await mkdtemp(join(tmpdir(), 'arch-viewer-repo-'));
    await writeFile(join(repoPath, 'ARCHITECTURE.md'), markdown, 'utf8');
    return repoPath;
}

test.describe('Electron app navigation and UI paths', () => {
    let app: ElectronApplication;
    let page: Page;
    let userDataPath: string;

    test.beforeEach(async () => {
        userDataPath = await mkdtemp(join(tmpdir(), 'arch-viewer-user-data-'));
        ({ app, page } = await launchApp(userDataPath));
    });

    test.afterEach(async () => {
        await app.close();
        await rm(userDataPath, { recursive: true, force: true });
    });

    test('exposes the preload bridge', async () => {
        await expect.poll(() => getBridgeKeys(page)).toEqual(
            expect.arrayContaining(['openRepo', 'getRecentRepos', 'onModelUpdate', 'onModelError']),
        );
    });

    test('renders the empty state and non-native empty-state actions', async () => {
        await expect(page.getByRole('heading', { name: "There's no ARCHITECTURE.md here yet." })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Open folder' })).toBeVisible();

        await page.getByRole('button', { name: 'Create starter file' }).click();
        await expect(page.locator('.toast')).toContainText('Starter template is not wired yet');

        await page.getByRole('button', { name: 'Recent' }).click();
        await expect(page.locator('.palette')).toBeVisible();
        await expect(page.locator('.pal-search input')).toBeFocused();

        await page.keyboard.press('Escape');
        await expect(page.locator('.palette')).toHaveCount(0);
    });

    test('loads the current repository architecture document', async () => {
        await openRepository(page);

        await expect(page.getByText('Main process')).toBeVisible();
        await expect(page.getByText('Renderer UI')).toBeVisible();
        await expect(page.getByText('Preload bridge')).toBeVisible();
    });

    test('opens and filters the command palette from toolbar and keyboard shortcuts', async () => {
        await openRepository(page);

        await page.getByTitle('Open repo (⌘P)').click();
        await expect(page.locator('.palette')).toBeVisible();
        await page.locator('.pal-search input').fill('architecture-viewer');
        await expect(page.locator('.pal-item')).toContainText(process.cwd());

        await page.keyboard.press('Escape');
        await expect(page.locator('.palette')).toHaveCount(0);

        await page.keyboard.press('Control+P');
        await expect(page.locator('.palette')).toBeVisible();
        await page.keyboard.press('Escape');

        await page.keyboard.press('/');
        await expect(page.locator('.palette')).toBeVisible();
        await page.locator('.pal-search input').fill('no-such-repo');
        await expect(page.getByRole('button', { name: 'Browse for folder…' })).toBeVisible();
    });

    test('opens node details, runs detail buttons, and closes with escape', async () => {
        await openRepository(page);

        await page.locator('.arch-node[data-id="main"]').click();
        await expect(page.locator('.detail-panel')).toBeVisible();
        await expect(page.locator('.detail-panel .dp-name')).toHaveText('Main process');

        await page.getByRole('button', { name: 'Copy context pack' }).click();
        await expect(page.locator('.toast')).toContainText('Context pack copied');

        await page.getByRole('button', { name: 'Open in editor' }).click();
        await expect(page.locator('.toast')).toContainText('Open in editor is not wired yet');

        await page.keyboard.press('Escape');
        await expect(page.locator('.detail-panel')).toHaveCount(0);
    });

    test('drills in from node controls, breadcrumbs back out, and supports detail-panel drill', async () => {
        await openRepository(page);

        await page.locator('.arch-node[data-id="main"] .node-drill').click();
        await expect(page.locator('.arch-node[data-id="window"]')).toBeVisible();
        await expect(page.locator('.breadcrumb').getByText('main')).toBeVisible();

        await page.getByRole('button', { name: 'back' }).click();
        await expect(page.locator('.arch-node[data-id="renderer"]')).toBeVisible();

        await page.locator('.arch-node[data-id="renderer"]').click();
        // Drill in from the detail panel's primary action (scoped to the panel
        // to keep the target unambiguous as the UI grows).
        await page.locator('.detail-panel').getByRole('button', { name: 'Drill in' }).click();
        await expect(page.locator('.arch-node[data-id="app"]')).toBeVisible();
    });

    test('shows hover thumbnails for drillable nodes', async () => {
        await openRepository(page);

        await page.locator('.arch-node[data-id="main"]').hover();
        await expect(page.locator('.hover-thumb')).toBeVisible();
        await expect(page.locator('.hover-thumb')).toContainText('drill in');
    });

    test('opens the comments drawer and selects a comment target', async () => {
        await openRepository(page);

        await page.getByTitle('Comments').click();
        await expect(page.locator('.comments-drawer')).toBeVisible();
        await expect(page.locator('.comments-drawer')).toContainText('preload bridge is intentionally narrow');

        await page.locator('.cm-card[data-anchor="preload"]').click();
        await expect(page.locator('.detail-panel .dp-name')).toHaveText('Preload bridge');

        await page.getByRole('button', { name: 'close' }).click();
        await expect(page.locator('.comments-drawer')).toHaveCount(0);
    });

    test('surfaces validation errors and supports validation panel actions', async () => {
        const repoPath = await createArchitectureRepo(`
# Broken architecture

\`\`\`arch
system: broken
nodes:
  - id: api
    name: API
    kind: service
    purpose: Invalid because service is not part of the DSL enum.
edges:
  - from: api
    to: missing
    label: calls
\`\`\`
`);

        try {
            await openRepository(page, repoPath, { waitForModel: false });

            await expect(page.locator('.validation-panel')).toBeVisible();
            await expect(page.locator('.validation-panel')).toContainText('validation issue');

            await page.getByRole('button', { name: 'Copy summary' }).click();
            await expect(page.locator('.toast')).toContainText('Validation summary copied');

            await page.getByRole('button', { name: 'Dismiss' }).click();
            await expect(page.locator('.validation-panel')).toHaveCount(0);

            await page.getByTitle('Validation').click();
            await expect(page.locator('.validation-panel')).toBeVisible();
        } finally {
            await rm(repoPath, { recursive: true, force: true });
        }
    });

    test('supports keyboard selection, cycling, drill in, and drill out', async () => {
        await openRepository(page);

        await page.keyboard.press('Tab');
        await expect(page.locator('.detail-panel .dp-name')).toHaveText('Electron platform');

        await page.keyboard.press('ArrowRight');
        await expect(page.locator('.detail-panel .dp-name')).toHaveText('Main process');

        await page.keyboard.press('Enter');
        await expect(page.locator('.arch-node[data-id="window"]')).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(page.locator('.arch-node[data-id="main"]')).toBeVisible();
    });

    test('persists dragged node positions and pans the canvas with right-drag', async () => {
        await openRepository(page);

        const node = page.locator('.arch-node[data-id="main"]');
        const box = await node.boundingBox();
        expect(box).not.toBeNull();

        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
        await page.mouse.down();
        await page.mouse.move(box!.x + box!.width / 2 + 80, box!.y + box!.height / 2 + 40, { steps: 5 });
        await page.mouse.up();

        await expect
            .poll(() =>
                page.evaluate(() => localStorage.getItem('archviewer.nodePos') ?? ''),
            )
            .toContain('arch-viewer::main');

        const stage = page.locator('.stage.layer-current');
        const before = await stage.evaluate((element) =>
            (globalThis as unknown as { getComputedStyle: (element: unknown) => { transform: string } })
                .getComputedStyle(element).transform,
        );
        const host = await page.locator('.canvas-host').boundingBox();
        expect(host).not.toBeNull();

        await page.mouse.move(host!.x + host!.width / 2, host!.y + host!.height / 2);
        await page.mouse.down({ button: 'right' });
        await page.mouse.move(host!.x + host!.width / 2 + 90, host!.y + host!.height / 2 + 60, { steps: 5 });
        await page.mouse.up({ button: 'right' });

        await expect
            .poll(() =>
                stage.evaluate((element) =>
                    (
                        globalThis as unknown as {
                            getComputedStyle: (element: unknown) => { transform: string };
                        }
                    ).getComputedStyle(element).transform,
                ),
            )
            .not.toBe(before);
    });
});

test('remembers recent repo paths across app launches', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'arch-viewer-user-data-'));
    let firstApp: ElectronApplication | undefined;
    let secondApp: ElectronApplication | undefined;

    try {
        const first = await launchApp(userDataPath);
        firstApp = first.app;
        await openRepository(first.page);
        await firstApp.close();
        firstApp = undefined;

        const second = await launchApp(userDataPath);
        secondApp = second.app;

        const recentRepos = await getRecentRepos(second.page);
        expect(recentRepos[0]?.path).toBe(process.cwd());

        const persisted = JSON.parse(await readFile(join(userDataPath, 'recent-repos.json'), 'utf8')) as {
            path: string;
        }[];
        expect(persisted[0]?.path).toBe(process.cwd());
    } finally {
        await firstApp?.close();
        await secondApp?.close();
        await rm(userDataPath, { recursive: true, force: true });
    }
});
