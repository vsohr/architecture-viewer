import type { ArchEdge, ArchNode, EdgeKind, NodeKind } from '../types';
import { edgePath, EDGE_STYLE } from '../lib/geometry';

// A small kind-glyph drawn next to the node's meta label. The shape
// teaches the visual encoding without needing a separate legend.
export function KindGlyph({ kind, size = 10 }: { kind: NodeKind; size?: number }) {
    const s = size;
    if (kind === 'datastore') {
        return (
            <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
                <ellipse cx="6" cy="3" rx="4" ry="1.4" stroke="currentColor" strokeWidth="1" />
                <path
                    d="M2 3v6c0 .77 1.79 1.4 4 1.4s4-.63 4-1.4V3"
                    stroke="currentColor"
                    strokeWidth="1"
                />
            </svg>
        );
    }
    if (kind === 'queue') {
        return (
            <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
                <rect x="1" y="3" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1" />
                <path d="M4 3v6M7 3v6" stroke="currentColor" strokeWidth="1" />
            </svg>
        );
    }
    if (kind === 'ui') {
        return (
            <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
                <rect x="1" y="2" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1" />
                <path d="M1 4.5h10" stroke="currentColor" strokeWidth="1" />
                <circle cx="2.6" cy="3.25" r=".4" fill="currentColor" />
                <circle cx="3.9" cy="3.25" r=".4" fill="currentColor" />
                <circle cx="5.2" cy="3.25" r=".4" fill="currentColor" />
            </svg>
        );
    }
    if (kind === 'library') {
        return (
            <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
                <path d="M3 2h7M3 6h7M3 10h7" stroke="currentColor" strokeWidth="1" />
                <path d="M2 1.5v9" stroke="currentColor" strokeWidth="1.4" />
            </svg>
        );
    }
    if (kind === 'external') {
        return (
            <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
                <path d="M4 2h6v6" stroke="currentColor" strokeWidth="1" />
                <path d="M9.5 2.5L4 8" stroke="currentColor" strokeWidth="1" />
                <path d="M2 5v5h5" stroke="currentColor" strokeWidth="1" />
            </svg>
        );
    }
    return (
        <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
            <rect x="1.5" y="1.5" width="9" height="9" rx="2.2" stroke="currentColor" strokeWidth="1" />
            <circle cx="6" cy="6" r="1.2" fill="currentColor" />
        </svg>
    );
}

export interface NodeCardProps {
    node: ArchNode;
    selected?: boolean;
    hovered?: boolean;
    dim?: boolean;
    layer?: 'live' | 'outgoing' | 'incoming' | 'current';
    fitScale?: number;
    onClick?: (node: ArchNode) => void;
    onHover?: (node: ArchNode) => void;
    onUnhover?: (node: ArchNode) => void;
    onDrillIn?: (node: ArchNode) => void;
    onDragMove?: (node: ArchNode, x: number, y: number) => void;
    onDragEnd?: (node: ArchNode, x: number, y: number) => void;
}

// One node, absolutely positioned in canvas coords. Container handles
// the zoom transform on a parent stage element.
export function NodeCard({
    node,
    selected,
    hovered,
    dim,
    layer = 'live',
    fitScale,
    onClick,
    onHover,
    onUnhover,
    onDrillIn,
    onDragMove,
    onDragEnd,
}: NodeCardProps) {
    const startDrag = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        if ((e.target as HTMLElement).closest('.node-drill')) return;
        if (!fitScale) return;
        e.stopPropagation();
        const startX = e.clientX,
            startY = e.clientY;
        const originX = node.x,
            originY = node.y;
        let moved = false;

        const onMove = (ev: MouseEvent) => {
            const dx = (ev.clientX - startX) / fitScale;
            const dy = (ev.clientY - startY) / fitScale;
            if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 3) {
                moved = true;
                document.body.style.cursor = 'grabbing';
            }
            if (moved && onDragMove) onDragMove(node, originX + dx, originY + dy);
        };
        const onUp = (ev: MouseEvent) => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.cursor = '';
            if (moved) {
                const dx = (ev.clientX - startX) / fitScale;
                const dy = (ev.clientY - startY) / fitScale;
                if (onDragEnd) onDragEnd(node, originX + dx, originY + dy);
            } else if (onClick) {
                onClick(node);
            }
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    const { kind, name, x, y, w, h, hasChildren, primary, tech } = node;
    const isCylinder = kind === 'datastore';
    const isQueue = kind === 'queue';
    const isExternal = kind === 'external';
    const isLibrary = kind === 'library';
    const isUi = kind === 'ui';

    const className =
        'arch-node ' +
        `kind-${kind}` +
        (selected ? ' is-selected' : '') +
        (hovered ? ' is-hovered' : '') +
        (dim ? ' is-dim' : '') +
        (primary ? ' is-primary' : '') +
        (hasChildren ? ' has-children' : '');

    return (
        <div
            className={className}
            data-id={node.id}
            data-layer={layer}
            style={{ left: x, top: y, width: w, height: h }}
            onMouseDown={startDrag}
            onDoubleClick={(e) => {
                if (hasChildren && onDrillIn) {
                    e.stopPropagation();
                    onDrillIn(node);
                }
            }}
            onMouseEnter={() => onHover && onHover(node)}
            onMouseLeave={() => onUnhover && onUnhover(node)}
        >
            {isCylinder && (
                <svg className="cylinder-bg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
                    <path
                        d={`M0 8 L0 ${h - 10} Q0 ${h} ${w / 2} ${h} Q${w} ${h} ${w} ${h - 10} L${w} 8`}
                        className="cyl-body"
                    />
                    <ellipse cx={w / 2} cy={8} rx={w / 2} ry="5.5" className="cyl-top" />
                </svg>
            )}
            {isQueue && (
                <div className="queue-segments">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            )}
            {isUi && (
                <div className="ui-chrome">
                    <i></i>
                    <i></i>
                    <i></i>
                </div>
            )}
            {isLibrary && <div className="lib-rule"></div>}

            <div className="node-meta">
                <span className="node-kind">
                    <KindGlyph kind={kind} /> {kind}
                </span>
                {hasChildren && (
                    <button
                        className="node-drill"
                        title="Drill in (Enter, or double-click)"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onDrillIn) onDrillIn(node);
                        }}
                    >
                        <span className="nd-label">drill</span>
                        <span className="nd-arrow">↗</span>
                    </button>
                )}
            </div>
            <div className="node-name">{name}</div>
            {tech && <div className="node-tech">{tech}</div>}

            {isExternal && <div className="ext-corner">↗</div>}
        </div>
    );
}

export interface EdgeLineProps {
    a: ArchNode;
    b: ArchNode;
    kind: EdgeKind;
    dim?: boolean;
    hl?: boolean;
}

export function EdgeLine({ a, b, kind, dim, hl }: EdgeLineProps) {
    const { d, s, t } = edgePath(a, b);
    const st = EDGE_STYLE[kind];
    const cls = 'arch-edge edge-' + kind + (dim ? ' is-dim' : '') + (hl ? ' is-hl' : '');
    const ang = Math.atan2(t.y - s.y, t.x - s.x);
    const headSize = st.head === 'diamond' ? 6 : 5;
    const headLen = st.head === 'diamond' ? headSize * 1.4 : headSize * 1.7;
    return (
        <g className={cls}>
            <path
                d={d}
                fill="none"
                stroke={st.stroke}
                strokeWidth={st.weight}
                strokeDasharray={st.dash}
                strokeLinecap="round"
            />
            {st.head === 'arrow' && (
                <polygon
                    points={`-${headLen},-${headSize} 0,0 -${headLen},${headSize}`}
                    transform={`translate(${t.x} ${t.y}) rotate(${(ang * 180) / Math.PI})`}
                    fill={st.stroke}
                />
            )}
            {st.head === 'diamond' && (
                <polygon
                    points={`-${headLen},-${headSize} 0,0 -${headLen},${headSize} -${headLen * 2},0`}
                    transform={`translate(${t.x} ${t.y}) rotate(${(ang * 180) / Math.PI})`}
                    fill={st.stroke}
                />
            )}
            {st.label && (
                <text
                    x={(s.x + t.x) / 2}
                    y={(s.y + t.y) / 2 - 4}
                    textAnchor="middle"
                    className="edge-label"
                >
                    {st.label}
                </text>
            )}
        </g>
    );
}

export type { ArchEdge, ArchNode };
