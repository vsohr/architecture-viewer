import { useState } from 'react';

export default function App() {
    const [folder, setFolder] = useState<string | null>(null);

    const handleOpen = async (): Promise<void> => {
        const picked = await window.archViewer.openFolder();
        if (picked) setFolder(picked);
    };

    return (
        <main className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-100">
            <div className="flex max-w-md flex-col items-center gap-6 text-center">
                <h1 className="text-2xl font-medium tracking-tight">Arch Viewer</h1>
                <p className="text-sm text-zinc-400">
                    {folder
                        ? `Watching ${folder}. Renderer not implemented yet.`
                        : 'Open a folder containing ARCHITECTURE.md to begin.'}
                </p>
                <button
                    type="button"
                    onClick={handleOpen}
                    className="rounded-md border border-zinc-700 bg-zinc-900/50 px-4 py-2 text-sm transition hover:bg-zinc-800"
                >
                    Open Folder
                </button>
            </div>
        </main>
    );
}
