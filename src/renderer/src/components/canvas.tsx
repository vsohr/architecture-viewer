import { useMemo } from 'react';
import type { ArchNode, ArchSystem, Level, Transform } from '../types';
import { edgePath } from '../lib/geometry';
import { EdgeLine, NodeCard } from './nodes';

export interface StageProps {
    level: Level;
    selectedId: string | null;
    hoverPreviewId: string | null;
    dimAll: boolean;
    hasFocus: boolean;
    transform: Transform;
    transitionMs: number;
    layerName: 'outgoing' | 'incoming' | 'current';
    onNodeClick: (n: ArchNode) => void;
    onNodeEnter: (n: ArchNode) => void;
    onNodeLeave: (n: ArchNode) => void;
    onDrillIn?: (n: ArchNode) => void;
    onNodeDragMove?: (n: ArchNode, x: number, y: number) => void;
    onNodeDragEnd?: (n: ArchNode, x: number, y: number) => void;
}

// One level rendered inside a transform-scaled stage.
export function Stage({
    level,
    selectedId,
    hoverPreviewId,
    dimAll,
    hasFocus,
    transform,
    transitionMs,
    layerName,
    onNodeClick,
    onNodeEnter,
    onNodeLeave,
    onDrillIn,
    onNodeDragMove,
    onNodeDragEnd,
}: StageProps) {
    const { bounds, nodes, edges } = level;
    const { s, tx, ty } = transform;
    const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

    return (
        <div
            className={'stage layer-' + layerName}
            style={{
                width: bounds.w,
                height: bounds.h,
                transform: `translate3d(${tx}px, ${ty}px, 0) scale(${s})`,
                transition: transitionMs
                    ? `transform ${transitionMs}ms cubic-bezier(.65,0,.2,1), opacity ${transitionMs}ms ease`
                    : 'none',
            }}
        >
            <svg
                className="stage-edges"
                width={bounds.w}
                height={bounds.h}
                viewBox={`0 0 ${bounds.w} ${bounds.h}`}
            >
                {edges.map((e, i) => {
                    const a = nodeById[e.from];
                    const b = nodeById[e.to];
                    if (!a || !b) return null;
                    const dim = dimAll || (selectedId !== null && selectedId !== a.id && selectedId !== b.id);
                    const hl = selectedId !== null && (selectedId === a.id || selectedId === b.id);
                    return <EdgeLine key={i} a={a} b={b} kind={e.kind} dim={dim} hl={hl} />;
                })}
            </svg>
            {nodes.map((n) => (
                <NodeCard
                    key={n.id}
                    node={n}
                    selected={hasFocus && selectedId === n.id}
                    hovered={hasFocus && hoverPreviewId === n.id}
                    dim={dimAll || (selectedId !== null && selectedId !== n.id && hasFocus)}
                    layer={layerName}
                    fitScale={transform.s}
                    onClick={onNodeClick}
                    onHover={onNodeEnter}
                    onUnhover={onNodeLeave}
                    onDrillIn={onDrillIn}
                    onDragMove={onNodeDragMove}
                    onDragEnd={onNodeDragEnd}
                />
            ))}
        </div>
    );
}

export interface HoverThumbnailProps {
    levels: Record<string, Level>;
    parentId: string;
    anchorRect: { left: number; top: number; width: number; height: number };
}

// Tiny preview of a parent's children — rendered above-right of the
// hovered node, fixed-positioned in viewport coords.
export function HoverThumbnail({ levels, parentId, anchorRect }: HoverThumbnailProps) {
    const childLevel = levels[parentId];
    if (!childLevel) return null;
    const { bounds, nodes, edges } = childLevel;
    const W = 220,
        H = 140;
    const sx = (W - 16) / bounds.w,
        sy = (H - 16) / bounds.h;
    const s = Math.min(sx, sy);
    const ox = (W - bounds.w * s) / 2;
    const oy = (H - bounds.h * s) / 2;
    const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));

    const top = anchorRect.top - H - 12;
    const left = anchorRect.left + anchorRect.width - W;

    return (
        <div
            className="hover-thumb"
            style={{
                top: Math.max(20, top),
                left: Math.max(20, left),
                width: W,
                height: H,
            }}
        >
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
                <g transform={`translate(${ox} ${oy}) scale(${s})`}>
                    {edges.map((e, i) => {
                        const a = nodeById[e.from];
                        const b = nodeById[e.to];
                        if (!a || !b) return null;
                        const { d } = edgePath(a, b);
                        return (
                            <path
                                key={i}
                                d={d}
                                fill="none"
                                stroke="rgba(255,255,255,.25)"
                                strokeWidth={1 / s}
                            />
                        );
                    })}
                    {nodes.map((n) => (
                        <rect
                            key={n.id}
                            x={n.x}
                            y={n.y}
                            width={n.w}
                            height={n.h}
                            rx="6"
                            fill={n.kind === 'external' ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.10)'}
                            stroke="rgba(255,255,255,.35)"
                            strokeWidth={1 / s}
                            strokeDasharray={n.kind === 'external' ? `${4 / s} ${3 / s}` : ''}
                        />
                    ))}
                </g>
            </svg>
            <div className="hover-thumb-label">
                <span className="ht-kbd">↵</span> drill in ·{' '}
                <span className="ht-name">
                    {nodes.length} node{nodes.length === 1 ? '' : 's'}
                </span>
            </div>
        </div>
    );
}

export interface BreadcrumbProps {
    pathIds: string[];
    system: ArchSystem;
    onJump: (depth: number) => void;
    onBack: () => void;
}

export function Breadcrumb({ pathIds, system, onJump, onBack }: BreadcrumbProps) {
    const segs = pathIds;
    const drilled = segs.length > 1;
    return (
        <div className="breadcrumb-wrap">
            <div className="breadcrumb-row">
                {drilled && (
                    <button className="bc-back" onClick={onBack} title="Back (Esc)">
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                            <path
                                d="M7 2L3 5.5L7 9"
                                stroke="currentColor"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        <span>back</span>
                    </button>
                )}
                <div className="breadcrumb">
                    <span className="bc-scheme">arch://</span>
                    <span className="bc-host">{system.name}</span>
                    {segs.slice(1).map((s, i) => (
                        <span key={i}>
                            <span className="bc-sep">/</span>
                            <button className="bc-seg" onClick={() => onJump(i + 1)}>
                                {s}
                            </button>
                        </span>
                    ))}
                    <span className="bc-caret">▸</span>
                </div>
            </div>
            {drilled && (
                <div className="bc-hints">
                    <span className="kbd">esc</span> ascend · <span className="kbd">↑</span> top
                </div>
            )}
        </div>
    );
}
