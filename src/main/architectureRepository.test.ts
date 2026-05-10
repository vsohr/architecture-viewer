import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { loadArchitectureFromFolder } from './architectureRepository';

let tempDirs: string[] = [];

afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs = [];
});

async function makeRepo(contents?: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'arch-viewer-repo-'));
    tempDirs.push(dir);
    await mkdir(dir, { recursive: true });
    if (contents) await writeFile(join(dir, 'ARCHITECTURE.md'), contents, 'utf8');
    return dir;
}

describe('loadArchitectureFromFolder', () => {
    test('reads ARCHITECTURE.md from the selected folder', async () => {
        const repo = await makeRepo(`# Demo

\`\`\`arch
system: demo
nodes:
  - id: api
    kind: service
    purpose: Serves requests.
edges: []
\`\`\`
`);

        const result = await loadArchitectureFromFolder(repo);

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error(result.errors.map((e) => e.message).join('\n'));
        expect(result.model.id).toBe('demo');
    });

    test('returns a structured error when ARCHITECTURE.md is missing', async () => {
        const repo = await makeRepo();

        const result = await loadArchitectureFromFolder(repo);

        expect(result).toEqual({
            ok: false,
            errors: [
                {
                    file: 'ARCHITECTURE.md',
                    message: 'ARCHITECTURE.md was not found in the selected folder',
                    hint: 'Create ARCHITECTURE.md at the repository root, then open the folder again.',
                },
            ],
        });
    });
});
