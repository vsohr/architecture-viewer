import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { listRecentRepos, recordRecentRepo } from './recentRepos';

let tempDirs: string[] = [];

afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs = [];
});

async function makeTempUserData(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'arch-viewer-recents-'));
    tempDirs.push(dir);
    return dir;
}

describe('recent repos', () => {
    test('records opened repositories with newest first and de-duplicates by path', async () => {
        const userData = await makeTempUserData();

        await recordRecentRepo(userData, 'C:\\repo\\alpha');
        await recordRecentRepo(userData, 'C:\\repo\\beta');
        await recordRecentRepo(userData, 'C:\\repo\\alpha');

        expect(await listRecentRepos(userData)).toEqual([
            {
                name: 'alpha',
                path: 'C:\\repo\\alpha',
                when: 'now',
            },
            {
                name: 'beta',
                path: 'C:\\repo\\beta',
                when: 'now',
            },
        ]);
    });

    test('returns an empty list when the persistence file is missing or corrupt', async () => {
        const userData = await makeTempUserData();

        expect(await listRecentRepos(userData)).toEqual([]);
    });
});
