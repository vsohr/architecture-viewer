export type NodeKind = 'service' | 'ui' | 'datastore' | 'queue' | 'library' | 'external';

export type EdgeKind =
    | 'calls'
    | 'reads'
    | 'writes'
    | 'publishes'
    | 'subscribes'
    | 'depends_on'
    | 'owns';

export interface ArchNode {
    id: string;
    kind: NodeKind;
    name: string;
    purpose: string;
    tech?: string;
    x: number;
    y: number;
    w: number;
    h: number;
    hasChildren?: boolean;
    primary?: boolean;
}

export interface ArchEdge {
    from: string;
    to: string;
    kind: EdgeKind;
    description?: string;
}

export interface Level {
    bounds: { w: number; h: number };
    parentLabel?: string;
    nodes: ArchNode[];
    edges: ArchEdge[];
}

export interface Annotation {
    id: string;
    levelId: string;
    nodeId: string;
    author: string;
    date: string;
    body: string;
}

export interface ValidationError {
    file: string;
    line?: number;
    col?: number;
    message: string;
    hint?: string;
}

export interface ArchSystem {
    id: string;
    name: string;
    about: string;
    levels: Record<string, Level>;
    comments: Annotation[];
    sampleErrors: ValidationError[];
}

export interface RecentRepo {
    name: string;
    path: string;
    when: string;
}

export interface Transform {
    s: number;
    tx: number;
    ty: number;
}

export interface NodeRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}

export interface KeyHint {
    keys: string[];
    label: string;
}
