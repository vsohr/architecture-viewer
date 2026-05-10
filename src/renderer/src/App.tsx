import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import type {
    ArchNode,
    ArchSystem,
    KeyHint,
    Level,
    NodeRect,
    RecentRepo,
    Transform,
    ValidationError,
} from './types';
import { fitTransform, nodeFillsTransform } from './lib/geometry';
import { Breadcrumb, HoverThumbnail, Stage } from './components/canvas';
import {
    CommandPalette,
    CommentsDrawer,
    DetailPanel,
    EmptyState,
    KeyHints,
    Topbar,
    ValidationPanel,
} from './components/panels';

type Mode = 'empty' | 'loaded';

interface TransitionState {
    phase: 'in' | 'out';
    from: string;
    to: string;
    clickedNode: ArchNode;
    ts: number;
}

interface NodeOverride {
    x: number;
    y: number;
}

const TRANSITION_MS = 620;
const NODE_POS_KEY = 'archviewer.nodePos';

function loadNodeOverrides(): Record<string, NodeOverride> {
    try {
        const raw = localStorage.getItem(NODE_POS_KEY);
        return raw ? (JSON.parse(raw) as Record<string, NodeOverride>) : {};
    } catch {
        return {};
    }
}

export default function App() {
    // Variant is locked: appleMaps · spacious · violet · drawer.
    // CSS defaults provide spacious + violet; comments mode + transition
    // are wired below.

    const [mode, setMode] = useState<Mode>('empty');
    const [model, setModel] = useState<ArchSystem | null>(null);
    const [recentRepos, setRecentRepos] = useState<RecentRepo[]>([]);
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [errorsOpen, setErrorsOpen] = useState(false);

    const [pathIds, setPathIds] = useState<string[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [hoverId, setHoverId] = useState<string | null>(null);
    const [hoverAnchor, setHoverAnchor] = useState<{
        left: number;
        top: number;
        width: number;
        height: number;
    } | null>(null);

    const [transition, setTransition] = useState<TransitionState | null>(null);
    const [viewport, setViewport] = useState({ w: 1200, h: 800 });
    const canvasRef = useRef<HTMLDivElement>(null);

    // Per-node position overrides — persisted to localStorage so a
    // user's hand-laid layout survives reload.
    const [nodeOverrides, setNodeOverrides] = useState<Record<string, NodeOverride>>(
        loadNodeOverrides,
    );
    useEffect(() => {
        try {
            localStorage.setItem(NODE_POS_KEY, JSON.stringify(nodeOverrides));
        } catch {
            /* ignore quota */
        }
    }, [nodeOverrides]);

    const setNodePos = useCallback((levelId: string, nodeId: string, x: number, y: number) => {
        setNodeOverrides((prev) => ({ ...prev, [`${levelId}::${nodeId}`]: { x, y } }));
    }, []);

    const applyOverrides = useCallback(
        (levelId: string): Level | null => {
            if (!model) return null;
            const lvl = model.levels[levelId];
            if (!lvl) return null;
            const prefix = levelId + '::';
            const has = Object.keys(nodeOverrides).some((k) => k.startsWith(prefix));
            if (!has) return lvl;
            return {
                ...lvl,
                nodes: lvl.nodes.map((n) => {
                    const o = nodeOverrides[prefix + n.id];
                    return o ? { ...n, x: o.x, y: o.y } : n;
                }),
            };
        },
        [model, nodeOverrides],
    );

    const [panByLevel, setPanByLevel] = useState<Record<string, { x: number; y: number }>>({});

    useLayoutEffect(() => {
        function measure() {
            if (!canvasRef.current) return;
            const r = canvasRef.current.getBoundingClientRect();
            setViewport({ w: r.width, h: r.height });
        }
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);

    const currentLevelId = pathIds.join('.');
    const currentLevel = applyOverrides(currentLevelId);
    const baseFitT: Transform | null = currentLevel
        ? fitTransform(currentLevel.bounds.w, currentLevel.bounds.h, viewport.w, viewport.h)
        : null;
    const pan = panByLevel[currentLevelId] ?? { x: 0, y: 0 };
    const fitT: Transform | null = baseFitT
        ? { ...baseFitT, tx: baseFitT.tx + pan.x, ty: baseFitT.ty + pan.y }
        : null;

    const setPan = useCallback((levelId: string, x: number, y: number) => {
        setPanByLevel((prev) => ({ ...prev, [levelId]: { x, y } }));
    }, []);

    // Right-click + drag on canvas host to pan the current level.
    const startPan = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (e.button !== 2) return;
            e.preventDefault();
            const startX = e.clientX,
                startY = e.clientY;
            const origin = pan;
            document.body.style.cursor = 'grabbing';
            const onMove = (ev: MouseEvent) => {
                setPan(
                    currentLevelId,
                    origin.x + (ev.clientX - startX),
                    origin.y + (ev.clientY - startY),
                );
            };
            const swallowMenu = (ev: Event) => {
                ev.preventDefault();
                ev.stopPropagation();
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.body.style.cursor = '';
                window.setTimeout(
                    () => document.removeEventListener('contextmenu', swallowMenu, true),
                    0,
                );
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.addEventListener('contextmenu', swallowMenu, true);
        },
        [pan, currentLevelId, setPan],
    );

    const levelComments = useMemo(
        () => (model ? model.comments.filter((c) => c.levelId === currentLevelId) : []),
        [currentLevelId, model],
    );

    const selectedNode =
        currentLevel && selectedId
            ? (currentLevel.nodes.find((n) => n.id === selectedId) ?? null)
            : null;

    const drillIn = useCallback(
        (node: ArchNode | null | undefined) => {
            if (!node || !node.hasChildren) return;
            const newPath = [...pathIds, node.id];
            const newId = newPath.join('.');
            if (!model?.levels[newId]) return;
            setTransition({
                phase: 'in',
                from: currentLevelId,
                to: newId,
                clickedNode: node,
                ts: Date.now(),
            });
            setHoverId(null);
            setHoverAnchor(null);
            setSelectedId(null);
            window.setTimeout(() => {
                setPathIds(newPath);
                setTransition(null);
            }, TRANSITION_MS);
        },
        [pathIds, currentLevelId, model],
    );

    const drillOut = useCallback(() => {
        if (pathIds.length <= 1) return;
        const newPath = pathIds.slice(0, -1);
        const newId = newPath.join('.');
        const exitingNodeId = pathIds[pathIds.length - 1];
        const parentLevel = model?.levels[newId];
        const exitingNode = parentLevel
            ? parentLevel.nodes.find((n) => n.id === exitingNodeId)
            : null;
        if (!exitingNode) return;
        setTransition({
            phase: 'out',
            from: currentLevelId,
            to: newId,
            clickedNode: exitingNode,
            ts: Date.now(),
        });
        setSelectedId(null);
        window.setTimeout(() => {
            setPathIds(newPath);
            setSelectedId(exitingNodeId);
            setTransition(null);
        }, TRANSITION_MS);
    }, [pathIds, currentLevelId, model]);

    const jumpTo = useCallback(
        (depth: number) => {
            if (depth >= pathIds.length) return;
            setPathIds(pathIds.slice(0, depth + 1));
            setSelectedId(null);
        },
        [pathIds],
    );

    const cycleSel = useCallback(
        (dir: number) => {
            if (!currentLevel) return;
            const ns = currentLevel.nodes;
            if (ns.length === 0) return;
            if (!selectedId) {
                setSelectedId(ns[0].id);
                return;
            }
            const idx = ns.findIndex((n) => n.id === selectedId);
            const nx = (idx + dir + ns.length) % ns.length;
            setSelectedId(ns[nx].id);
        },
        [currentLevel, selectedId],
    );

    const [toast, setToast] = useState<string | null>(null);
    const flashToast = useCallback((msg: string) => {
        setToast(msg);
        window.setTimeout(() => setToast(null), 1800);
    }, []);

    const handleOpenFolder = useCallback(async () => {
        const picked = await window.archViewer.openFolder();
        if (picked) {
            setRecentRepos(await loadRecentRepos());
            flashToast(`Opened ${picked}`);
        }
    }, [flashToast]);

    useEffect(() => {
        let mounted = true;
        void loadRecentRepos().then((repos) => {
            if (mounted) setRecentRepos(repos);
        });

        const offUpdate = window.archViewer.onModelUpdate((incoming) => {
            const next = incoming as ArchSystem;
            setModel(next);
            setPathIds((prev) => (next.levels[prev.join('.')] ? prev : [next.id]));
            setSelectedId(null);
            setHoverId(null);
            setHoverAnchor(null);
            setValidationErrors([]);
            setErrorsOpen(false);
            setMode('loaded');
        });

        const offError = window.archViewer.onModelError((incoming) => {
            const errors = Array.isArray(incoming) ? (incoming as ValidationError[]) : [];
            setValidationErrors(errors);
            setErrorsOpen(errors.length > 0);
        });

        return () => {
            mounted = false;
            offUpdate();
            offError();
        };
    }, []);

    useEffect(() => {
        function handler(e: KeyboardEvent) {
            const t = e.target as HTMLElement | null;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
            if (e.metaKey || e.ctrlKey) {
                if (e.key.toLowerCase() === 'p') {
                    e.preventDefault();
                    setPaletteOpen(true);
                    return;
                }
                if (e.key.toLowerCase() === 'o') {
                    e.preventDefault();
                    setPaletteOpen(true);
                    return;
                }
                if (e.shiftKey && e.key.toLowerCase() === 'c') {
                    e.preventDefault();
                    flashToast('Context pack copied to clipboard');
                    return;
                }
            }
            if (e.key === 'Escape') {
                if (paletteOpen) {
                    setPaletteOpen(false);
                    return;
                }
                if (commentsOpen) {
                    setCommentsOpen(false);
                    return;
                }
                if (selectedId) {
                    setSelectedId(null);
                    return;
                }
                if (pathIds.length > 1) {
                    drillOut();
                    return;
                }
            }
            if (e.key === 'Enter') {
                if (selectedNode && selectedNode.hasChildren) {
                    drillIn(selectedNode);
                    return;
                }
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                if (selectedId) setSelectedId(null);
                else if (currentLevel && currentLevel.nodes[0])
                    setSelectedId(currentLevel.nodes[0].id);
            }
            if (e.key === 'ArrowLeft' || e.key === 'h') {
                if (selectedId) cycleSel(-1);
                else if (pathIds.length > 1) drillOut();
            }
            if (e.key === 'ArrowRight' || e.key === 'l') {
                if (selectedNode && selectedNode.hasChildren) drillIn(selectedNode);
                else cycleSel(1);
            }
            if (e.key === 'ArrowUp' || e.key === 'k') cycleSel(-1);
            if (e.key === 'ArrowDown' || e.key === 'j') cycleSel(1);
            if (e.key === '/') {
                e.preventDefault();
                setPaletteOpen(true);
            }
        }
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [
        selectedId,
        selectedNode,
        currentLevel,
        pathIds,
        commentsOpen,
        paletteOpen,
        drillIn,
        drillOut,
        cycleSel,
        flashToast,
    ]);

    // Stage transforms during a transition. Two stages overlap; the
    // outgoing parent zooms toward the clicked node (Apple-Maps); the
    // incoming child enters at a slightly compressed scale and settles
    // to fit. Drill-out plays it in reverse.
    const stageTransforms = useMemo(() => {
        if (!fitT || !transition) return null;
        const fromLevel = applyOverrides(transition.from);
        const toLevel = applyOverrides(transition.to);
        if (!fromLevel || !toLevel) return null;
        const toFit = fitTransform(toLevel.bounds.w, toLevel.bounds.h, viewport.w, viewport.h);

        if (transition.phase === 'in') {
            const out = nodeFillsTransform(transition.clickedNode, viewport.w, viewport.h, 1.05);
            return {
                from: { transform: out, transitionMs: TRANSITION_MS },
                to: {
                    transform: {
                        s: toFit.s * 0.78,
                        tx: toFit.tx + toFit.s * 0.11 * toLevel.bounds.w,
                        ty: toFit.ty + toFit.s * 0.11 * toLevel.bounds.h,
                    } satisfies Transform,
                    transitionMs: 0,
                },
            };
        }

        const node = transition.clickedNode;
        const screenNW = node.w * toFit.s;
        const screenNH = node.h * toFit.s;
        const sChild =
            Math.min(screenNW / fromLevel.bounds.w, screenNH / fromLevel.bounds.h) * 0.9;
        const cx = toFit.tx + (node.x + node.w / 2) * toFit.s;
        const cy = toFit.ty + (node.y + node.h / 2) * toFit.s;
        return {
            from: {
                transform: {
                    s: sChild,
                    tx: cx - (fromLevel.bounds.w * sChild) / 2,
                    ty: cy - (fromLevel.bounds.h * sChild) / 2,
                } satisfies Transform,
                transitionMs: TRANSITION_MS,
            },
            to: {
                transform: {
                    s: toFit.s * 1.18,
                    tx: toFit.tx - toFit.s * 0.09 * toLevel.bounds.w,
                    ty: toFit.ty - toFit.s * 0.09 * toLevel.bounds.h,
                } satisfies Transform,
                transitionMs: 0,
            },
        };
    }, [transition, fitT, viewport, applyOverrides]);

    // Arm the incoming layer one double-rAF after mount so the CSS
    // transition kicks off cleanly from the initial transform.
    const [incomingArmed, setIncomingArmed] = useState(false);
    useEffect(() => {
        if (!transition) {
            setIncomingArmed(false);
            return;
        }
        setIncomingArmed(false);
        let r2 = 0;
        const r1 = requestAnimationFrame(() => {
            r2 = requestAnimationFrame(() => setIncomingArmed(true));
        });
        return () => {
            cancelAnimationFrame(r1);
            if (r2) cancelAnimationFrame(r2);
        };
    }, [transition]);

    // Convert a node's canvas-coord rect into viewport-coord pixels so
    // the comments drawer can draw anchor lines back to the node.
    const getNodeRect = useCallback(
        (nodeId: string): NodeRect | null => {
            if (!currentLevel || !fitT || !canvasRef.current) return null;
            const n = currentLevel.nodes.find((x) => x.id === nodeId);
            if (!n) return null;
            const cr = canvasRef.current.getBoundingClientRect();
            return {
                left: cr.left + fitT.tx + n.x * fitT.s,
                top: cr.top + fitT.ty + n.y * fitT.s,
                right: cr.left + fitT.tx + (n.x + n.w) * fitT.s,
                bottom: cr.top + fitT.ty + (n.y + n.h) * fitT.s,
                width: n.w * fitT.s,
                height: n.h * fitT.s,
            };
        },
        [currentLevel, fitT],
    );

    const handleNodeEnter = useCallback(
        (node: ArchNode) => {
            setHoverId(node.id);
            if (node.hasChildren && canvasRef.current && fitT) {
                const cr = canvasRef.current.getBoundingClientRect();
                setHoverAnchor({
                    left: cr.left + fitT.tx + node.x * fitT.s,
                    top: cr.top + fitT.ty + node.y * fitT.s,
                    width: node.w * fitT.s,
                    height: node.h * fitT.s,
                });
            }
        },
        [fitT],
    );

    const handleNodeLeave = useCallback(() => {
        setHoverId(null);
        setHoverAnchor(null);
    }, []);

    const hints = useMemo<KeyHint[]>(() => {
        if (mode === 'empty') return [];
        if (paletteOpen || commentsOpen) return [];
        if (selectedId) {
            const out: KeyHint[] = [
                { keys: ['esc'], label: 'deselect' },
                { keys: ['tab'], label: 'panel' },
            ];
            if (selectedNode && selectedNode.hasChildren)
                out.unshift({ keys: ['↵'], label: 'drill in' });
            return out;
        }
        if (pathIds.length > 1)
            return [
                { keys: ['esc'], label: 'ascend' },
                { keys: ['/'], label: 'find' },
                { keys: ['⌘P'], label: 'open' },
            ];
        return [
            { keys: ['⏎'], label: 'drill' },
            { keys: ['/'], label: 'find' },
            { keys: ['⌘P'], label: 'open' },
        ];
    }, [mode, selectedId, selectedNode, pathIds, paletteOpen, commentsOpen]);

    const handlePalettePick = useCallback(
        async (r: RecentRepo) => {
            setPaletteOpen(false);
            await window.archViewer.openRepo(r.path);
            setRecentRepos(await loadRecentRepos());
            flashToast(`Opened ${r.name}`);
        },
        [flashToast],
    );

    const fromLevelForRender = transition ? applyOverrides(transition.from) : null;
    const toLevelForRender = transition ? applyOverrides(transition.to) : null;
    const incomingFitT =
        transition && toLevelForRender
            ? fitTransform(toLevelForRender.bounds.w, toLevelForRender.bounds.h, viewport.w, viewport.h)
            : null;

    return (
        <div className="app">
            <Topbar
                onOpenPalette={() => setPaletteOpen(true)}
                onToggleComments={() => setCommentsOpen((o) => !o)}
                onToggleErrors={() => setErrorsOpen((o) => !o)}
                hasErrors={validationErrors.length > 0}
                hasComments={levelComments.length > 0}
            />

            {mode === 'loaded' && currentLevel && model && (
                <Breadcrumb
                    pathIds={pathIds}
                    system={model}
                    onJump={jumpTo}
                    onBack={drillOut}
                />
            )}

            <div
                className="canvas-host"
                ref={canvasRef}
                onClick={() => setSelectedId(null)}
                onMouseDown={startPan}
                onContextMenu={(e) => e.preventDefault()}
            >
                {mode === 'empty' && (
                    <EmptyState
                        onOpenFolder={handleOpenFolder}
                        onCreateStarter={() => flashToast('Starter template is not wired yet')}
                        onShowRecent={() => setPaletteOpen(true)}
                    />
                )}

                {mode === 'loaded' && currentLevel && (
                    <>
                        {transition && fromLevelForRender && stageTransforms && (
                            <Stage
                                key={'from-' + transition.ts}
                                level={fromLevelForRender}
                                selectedId={null}
                                hoverPreviewId={null}
                                dimAll={false}
                                hasFocus={false}
                                onNodeClick={() => {}}
                                onNodeEnter={() => {}}
                                onNodeLeave={() => {}}
                                transform={stageTransforms.from.transform}
                                transitionMs={stageTransforms.from.transitionMs}
                                layerName="outgoing"
                            />
                        )}

                        <Stage
                            key={'to-' + (transition ? transition.ts + '-in' : currentLevelId)}
                            level={
                                transition && toLevelForRender ? toLevelForRender : currentLevel
                            }
                            selectedId={transition ? null : selectedId}
                            hoverPreviewId={transition ? null : hoverId}
                            dimAll={!!transition}
                            hasFocus={!transition}
                            onNodeClick={(n) => setSelectedId(n.id)}
                            onNodeEnter={handleNodeEnter}
                            onNodeLeave={handleNodeLeave}
                            onDrillIn={drillIn}
                            onNodeDragMove={(n, x, y) => setNodePos(currentLevelId, n.id, x, y)}
                            onNodeDragEnd={(n, x, y) => setNodePos(currentLevelId, n.id, x, y)}
                            transform={
                                transition && stageTransforms && incomingFitT
                                    ? incomingArmed
                                        ? incomingFitT
                                        : stageTransforms.to.transform
                                    : (fitT as Transform)
                            }
                            transitionMs={transition ? (incomingArmed ? TRANSITION_MS : 0) : 0}
                            layerName={transition ? 'incoming' : 'current'}
                        />
                    </>
                )}

                {!transition &&
                    hoverId &&
                    hoverAnchor &&
                    currentLevel &&
                    (() => {
                        const n = currentLevel.nodes.find((x) => x.id === hoverId);
                        if (!n || !n.hasChildren) return null;
                        const childKey = currentLevelId + '.' + n.id;
                        if (!model?.levels[childKey]) return null;
                        return (
                            <HoverThumbnail
                                levels={model.levels}
                                parentId={childKey}
                                anchorRect={hoverAnchor}
                            />
                        );
                    })()}

                {!transition && selectedNode && (
                    <DetailPanel
                        node={selectedNode}
                        comments={levelComments}
                        onClose={() => setSelectedId(null)}
                        onOpenComments={() => setCommentsOpen(true)}
                        onDrillIn={drillIn}
                        onCopyContext={() => flashToast('Context pack copied')}
                    />
                )}

                {!transition && (
                    <CommentsDrawer
                        open={commentsOpen}
                        comments={levelComments}
                        levelNodes={currentLevel ? currentLevel.nodes : []}
                        onClose={() => setCommentsOpen(false)}
                        viewport={viewport}
                        getNodeRect={getNodeRect}
                        onJumpNode={(n) => setSelectedId(n.id)}
                    />
                )}

                <ValidationPanel
                    errors={errorsOpen ? validationErrors : null}
                    onDismiss={() => setErrorsOpen(false)}
                    onCopy={() => flashToast('Validation summary copied')}
                />

                {!transition && <KeyHints hints={hints} />}

                {toast && <div className="toast">{toast}</div>}
            </div>

            <CommandPalette
                open={paletteOpen}
                onClose={() => setPaletteOpen(false)}
                onPick={handlePalettePick}
                onBrowse={handleOpenFolder}
                recents={recentRepos}
            />
        </div>
    );
}

async function loadRecentRepos(): Promise<RecentRepo[]> {
    const repos = await window.archViewer.getRecentRepos();
    return Array.isArray(repos) ? (repos as RecentRepo[]) : [];
}
