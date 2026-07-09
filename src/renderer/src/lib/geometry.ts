import type { ArchNode, EdgeKind, Transform } from '../types';

// Fit a level's authored bounds inside the viewport, leaving a margin.
export function fitTransform(
    boundW: number,
    boundH: number,
    viewW: number,
    viewH: number,
    margin = 0.92,
): Transform {
    const s = Math.min(viewW / boundW, viewH / boundH) * margin;
    return {
        s,
        tx: (viewW - boundW * s) / 2,
        ty: (viewH - boundH * s) / 2,
    };
}

// Transform that scales a single node so it fills the viewport — the
// "cinematic" target frame at the end of an Apple-Maps drill-in.
export function nodeFillsTransform(
    node: ArchNode,
    viewW: number,
    viewH: number,
    margin = 0.95,
): Transform {
    const s = Math.min(viewW / node.w, viewH / node.h) * margin;
    return {
        s,
        tx: viewW / 2 - (node.x + node.w / 2) * s,
        ty: viewH / 2 - (node.y + node.h / 2) * s,
    };
}

export type Direction = 'l' | 'r' | 'u' | 'd';
export interface Anchor {
    x: number;
    y: number;
    dir: Direction;
}

// Pick the anchor on each node closest to the other along the dominant axis.
export function edgeAnchors(a: ArchNode, b: ArchNode): [Anchor, Anchor] {
    const ax = a.x + a.w / 2,
        ay = a.y + a.h / 2;
    const bx = b.x + b.w / 2,
        by = b.y + b.h / 2;

    const side = (node: ArchNode, otherCx: number, otherCy: number): Anchor => {
        const cx = node.x + node.w / 2,
            cy = node.y + node.h / 2;
        const ddx = otherCx - cx,
            ddy = otherCy - cy;
        if (Math.abs(ddx) * node.h > Math.abs(ddy) * node.w) {
            return ddx > 0
                ? { x: node.x + node.w, y: cy, dir: 'r' }
                : { x: node.x, y: cy, dir: 'l' };
        }
        return ddy > 0
            ? { x: cx, y: node.y + node.h, dir: 'd' }
            : { x: cx, y: node.y, dir: 'u' };
    };

    return [side(a, bx, by), side(b, ax, ay)];
}

// Smooth cubic between the two anchors; control points pulled in the
// exit direction so the curve leaves and enters nodes orthogonally.
export function edgePath(a: ArchNode, b: ArchNode): { d: string; s: Anchor; t: Anchor } {
    const [s, t] = edgeAnchors(a, b);
    const dx = t.x - s.x,
        dy = t.y - s.y;
    const k = Math.max(40, Math.min(180, Math.hypot(dx, dy) * 0.35));
    const cx1 = s.x + (s.dir === 'r' ? k : s.dir === 'l' ? -k : 0);
    const cy1 = s.y + (s.dir === 'd' ? k : s.dir === 'u' ? -k : 0);
    const cx2 = t.x + (t.dir === 'r' ? k : t.dir === 'l' ? -k : 0);
    const cy2 = t.y + (t.dir === 'd' ? k : t.dir === 'u' ? -k : 0);
    return { d: `M ${s.x} ${s.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${t.x} ${t.y}`, s, t };
}

export interface EdgeStyle {
    stroke: string;
    dash: string;
    head: 'arrow' | 'diamond' | 'none';
    weight: number;
    label?: string;
}

export const EDGE_STYLE: Record<EdgeKind, EdgeStyle> = {
    calls: { stroke: 'var(--edge-strong)', dash: '', head: 'arrow', weight: 1.4 },
    reads: { stroke: 'var(--edge-medium)', dash: '', head: 'arrow', weight: 1.2, label: 'r' },
    writes: { stroke: 'var(--edge-medium)', dash: '', head: 'arrow', weight: 1.2, label: 'w' },
    publishes: { stroke: 'var(--edge-pub)', dash: '6 4', head: 'arrow', weight: 1.2 },
    subscribes: { stroke: 'var(--edge-pub)', dash: '2 5', head: 'arrow', weight: 1.2 },
    depends_on: { stroke: 'var(--edge-faint)', dash: '1 4', head: 'none', weight: 1 },
    owns: { stroke: 'var(--edge-strong)', dash: '', head: 'diamond', weight: 1.4 },
};
