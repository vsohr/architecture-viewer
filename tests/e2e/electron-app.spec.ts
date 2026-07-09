import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type Bridge = {
    openRepo: (path: string) => Promise<string>;
    getRecentRepos: () => Promise<Array<{ path: string }>>;
};

const navigationArchitecture = `# Arch Viewer Test Architecture

Stable fixture used by E2E interaction tests.

\`\`\`arch
system: arch-viewer
name: Arch Viewer
nodes:
  - id: electron-platform
    kind: external
    name: Electron platform
    purpose: Provides native app services.
    tech: Electron 33
  - id: main
    kind: service
    name: Main process
    purpose: Owns repository loading and IPC.
    tech: TypeScript, Electron main
    primary: true
    children:
      - id: window
        kind: service
        name: Window host
        purpose: Creates and manages the BrowserWindow.
        tech: Electron BrowserWindow
      - id: ipc
        kind: service
        name: IPC router
        purpose: Routes renderer requests to main-process services.
        tech: ipcMain
  - id: preload
    kind: service
    name: Preload bridge
    purpose: Exposes the safe renderer bridge.
    tech: Electron contextBridge
  - id: renderer
    kind: ui
    name: Renderer UI
    purpose: Renders the architecture reading experience.
    tech: React 19, Vite
    children:
      - id: app
        kind: service
        name: App orchestrator
        purpose: Holds loaded model state and interaction state.
        tech: React hooks
      - id: canvas
        kind: ui
        name: Canvas stage
        purpose: Draws nodes, edges, hover thumbnails, and breadcrumbs.
        tech: React, SVG
  - id: architecture-file
    kind: datastore
    name: Repository ARCHITECTURE.md
    purpose: Source-of-truth architecture document.
edges:
  - from: main
    to: electron-platform
    kind: calls
  - from: renderer
    to: preload
    kind: calls
  - from: preload
    to: main
    kind: calls
  - from: main.window
    to: main.ipc
    kind: calls
  - from: renderer.app
    to: renderer.canvas
    kind: calls
\`\`\`

<!-- @comment author:codex target:preload date:2026-05-10 -->
<!-- The preload bridge is intentionally narrow. -->
`;

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

async function createNavigationRepo(): Promise<string> {
    return createArchitectureRepo(navigationArchitecture);
}

function currentNode(page: Page, nodeId: string) {
    return page.locator(`.stage.layer-current .arch-node[data-id="${nodeId}"]`);
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
        const repoPath = await createNavigationRepo();

        try {
            await openRepository(page, repoPath);

            await currentNode(page, 'main').click();
            await expect(page.locator('.detail-panel')).toBeVisible();
            await expect(page.locator('.detail-panel .dp-name')).toHaveText('Main process');

            await page.getByRole('button', { name: 'Copy context pack' }).click();
            await expect(page.locator('.toast')).toContainText('Context pack copied');

            await page.getByRole('button', { name: 'Open in editor' }).click();
            await expect(page.locator('.toast')).toContainText('Open in editor is not wired yet');

            await page.keyboard.press('Escape');
            await expect(page.locator('.detail-panel')).toHaveCount(0);
        } finally {
            await rm(repoPath, { recursive: true, force: true });
        }
    });

    test('drills in from node controls, breadcrumbs back out, and supports detail-panel drill', async () => {
        const repoPath = await createNavigationRepo();

        try {
            await openRepository(page, repoPath);

            await currentNode(page, 'main').locator('.node-drill').click();
            await expect(currentNode(page, 'window')).toBeVisible();
            await expect(page.locator('.breadcrumb').getByText('main')).toBeVisible();

            await page.getByRole('button', { name: 'back' }).click();
            await expect(currentNode(page, 'renderer')).toBeVisible();

            await page.keyboard.press('Escape');
            await expect(page.locator('.detail-panel')).toHaveCount(0);
            await currentNode(page, 'renderer').click();
            await expect(page.locator('.detail-panel .dp-name')).toHaveText('Renderer UI');
            await page.locator('.detail-panel').getByRole('button', { name: 'Drill in' }).click();
            await expect(currentNode(page, 'app')).toBeVisible();
        } finally {
            await rm(repoPath, { recursive: true, force: true });
        }
    });

    test('shows hover thumbnails for drillable nodes', async () => {
        const repoPath = await createNavigationRepo();

        try {
            await openRepository(page, repoPath);

            await currentNode(page, 'main').hover();
            await expect(page.locator('.hover-thumb')).toBeVisible();
            await expect(page.locator('.hover-thumb')).toContainText('drill in');
        } finally {
            await rm(repoPath, { recursive: true, force: true });
        }
    });

    test('opens the comments drawer and selects a comment target', async () => {
        const repoPath = await createNavigationRepo();

        try {
            await openRepository(page, repoPath);

            await page.getByTitle('Comments').click();
            await expect(page.locator('.comments-drawer')).toBeVisible();
            await expect(page.locator('.comments-drawer')).toContainText('preload bridge is intentionally narrow');

            await page.locator('.cm-card[data-anchor="preload"]').click();
            await expect(page.locator('.detail-panel .dp-name')).toHaveText('Preload bridge');

            await page.getByRole('button', { name: 'close' }).click();
            await expect(page.locator('.comments-drawer')).toHaveCount(0);
        } finally {
            await rm(repoPath, { recursive: true, force: true });
        }
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
        const repoPath = await createNavigationRepo();

        try {
            await openRepository(page, repoPath);

            await page.keyboard.press('Tab');
            await expect(page.locator('.detail-panel .dp-name')).toHaveText('Electron platform');

            await page.keyboard.press('ArrowRight');
            await expect(page.locator('.detail-panel .dp-name')).toHaveText('Main process');

            await page.keyboard.press('Enter');
            await expect(currentNode(page, 'window')).toBeVisible();

            await page.keyboard.press('Escape');
            await expect(currentNode(page, 'main')).toBeVisible();
        } finally {
            await rm(repoPath, { recursive: true, force: true });
        }
    });

    test('persists dragged node positions and pans the canvas with right-drag', async () => {
        const repoPath = await createNavigationRepo();

        try {
            await openRepository(page, repoPath);

            const node = currentNode(page, 'main');
            const box = await node.boundingBox();
            expect(box).not.toBeNull();

            await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
            await page.mouse.down();
            await page.mouse.move(box!.x + box!.width / 2 + 80, box!.y + box!.height / 2 + 40, { steps: 5 });
            await page.mouse.up();

            await expect
                .poll(() => page.evaluate(() => localStorage.getItem('archviewer.nodePos') ?? ''))
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
        } finally {
            await rm(repoPath, { recursive: true, force: true });
        }
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
