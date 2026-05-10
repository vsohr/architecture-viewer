import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArchitectureMarkdown, type ParseResult } from './architectureParser';

export const ARCHITECTURE_FILE = 'ARCHITECTURE.md';

export async function loadArchitectureFromFolder(folderPath: string): Promise<ParseResult> {
    const filePath = join(folderPath, ARCHITECTURE_FILE);
    let markdown: string;
    try {
        markdown = await readFile(filePath, 'utf8');
    } catch {
        return {
            ok: false,
            errors: [
                {
                    file: ARCHITECTURE_FILE,
                    message: 'ARCHITECTURE.md was not found in the selected folder',
                    hint: 'Create ARCHITECTURE.md at the repository root, then open the folder again.',
                },
            ],
        };
    }

    return parseArchitectureMarkdown(markdown, ARCHITECTURE_FILE);
}
