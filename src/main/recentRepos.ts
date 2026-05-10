import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, normalize } from 'node:path';

export interface RecentRepo {
    name: string;
    path: string;
    when: string;
}

const RECENT_REPOS_FILE = 'recent-repos.json';
const MAX_RECENTS = 12;

export async function listRecentRepos(userDataPath: string): Promise<RecentRepo[]> {
    try {
        const raw = await readFile(recentReposPath(userDataPath), 'utf8');
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isRecentRepo);
    } catch {
        return [];
    }
}

export async function recordRecentRepo(
    userDataPath: string,
    repoPath: string,
): Promise<RecentRepo[]> {
    const normalizedPath = normalize(repoPath);
    const existing = await listRecentRepos(userDataPath);
    const next = [
        {
            name: basename(normalizedPath),
            path: normalizedPath,
            when: 'now',
        },
        ...existing.filter((repo) => normalize(repo.path) !== normalizedPath),
    ].slice(0, MAX_RECENTS);

    await mkdir(userDataPath, { recursive: true });
    await writeFile(recentReposPath(userDataPath), JSON.stringify(next, null, 2), 'utf8');
    return next;
}

function recentReposPath(userDataPath: string): string {
    return join(userDataPath, RECENT_REPOS_FILE);
}

function isRecentRepo(value: unknown): value is RecentRepo {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as RecentRepo;
    return (
        typeof candidate.name === 'string' &&
        typeof candidate.path === 'string' &&
        typeof candidate.when === 'string'
    );
}
