import yaml from 'js-yaml';
import { z } from 'zod';

const NODE_KINDS = ['service', 'ui', 'datastore', 'queue', 'library', 'external'] as const;
const EDGE_KINDS = [
    'calls',
    'reads',
    'writes',
    'publishes',
    'subscribes',
    'depends_on',
    'owns',
] as const;

export interface ValidationError {
    file: string;
    line?: number;
    col?: number;
    message: string;
    hint?: string;
}

export interface ArchNode {
    id: string;
    kind: (typeof NODE_KINDS)[number];
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
    kind: (typeof EDGE_KINDS)[number];
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

export interface ArchSystem {
    id: string;
    name: string;
    about: string;
    levels: Record<string, Level>;
    comments: Annotation[];
    sampleErrors: ValidationError[];
}

export type ParseResult =
    | { ok: true; model: ArchSystem }
    | { ok: false; errors: ValidationError[] };

interface RawNode {
    id: string;
    kind: (typeof NODE_KINDS)[number];
    purpose: string;
    name?: string;
    tech?: string;
    primary?: boolean;
    children?: RawNode[];
}

interface RawEdge {
    from: string;
    to: string;
    kind: (typeof EDGE_KINDS)[number];
    description?: string;
}

interface RawArchitecture {
    system: string;
    name?: string;
    about?: string;
    nodes: RawNode[];
    edges?: RawEdge[];
}

const rawNodeSchema: z.ZodType<RawNode> = z.lazy(() =>
    z.object({
        id: z.string().min(1),
        kind: z.enum(NODE_KINDS),
        purpose: z.string().min(1),
        name: z.string().min(1).optional(),
        tech: z.string().min(1).optional(),
        primary: z.boolean().optional(),
        children: z.array(rawNodeSchema).optional(),
    }),
);

const rawArchitectureSchema = z.object({
    system: z.string().min(1),
    name: z.string().min(1).optional(),
    about: z.string().min(1).optional(),
    nodes: z.array(rawNodeSchema).min(1),
    edges: z
        .array(
            z.object({
                from: z.string().min(1),
                to: z.string().min(1),
                kind: z.enum(EDGE_KINDS),
                description: z.string().min(1).optional(),
            }),
        )
        .optional(),
});

interface ArchFence {
    source: string;
    contentStartLine: number;
}

export function parseArchitectureMarkdown(
    markdown: string,
    file = 'ARCHITECTURE.md',
): ParseResult {
    const fence = extractArchFence(markdown);
    if (!fence) {
        return {
            ok: false,
            errors: [
                {
                    file,
                    message: 'missing fenced `arch` block',
                    hint: 'Add a ```arch YAML block to ARCHITECTURE.md.',
                },
            ],
        };
    }

    const loaded = parseYaml(fence, file);
    if (!loaded.ok) return loaded;

    const validated = rawArchitectureSchema.safeParse(loaded.value);
    if (!validated.success) {
        return {
            ok: false,
            errors: validated.error.issues.map((issue) =>
                zodIssueToValidationError(issue, fence, file),
            ),
        };
    }

    const raw = validated.data;
    const built = buildModel(raw, extractAbout(markdown, fence, raw), markdown, file);
    const edgeErrors = validateEdges(built.model, raw.edges ?? [], built.edgeLevelByKey, file);
    const commentErrors = built.commentErrors;
    const errors = [...edgeErrors, ...commentErrors];
    if (errors.length > 0) return { ok: false, errors };

    return { ok: true, model: built.model };
}

function extractArchFence(markdown: string): ArchFence | null {
    const match = /```arch[^\S\r\n]*(?:\r?\n)([\s\S]*?)(?:\r?\n)```/i.exec(markdown);
    if (!match) return null;
    const prefix = markdown.slice(0, match.index);
    return {
        source: match[1],
        contentStartLine: prefix.split(/\r?\n/).length + 1,
    };
}

function parseYaml(
    fence: ArchFence,
    file: string,
): { ok: true; value: unknown } | { ok: false; errors: ValidationError[] } {
    try {
        return { ok: true, value: yaml.load(fence.source) };
    } catch (error) {
        const mark = isYamlErrorWithMark(error) ? error.mark : null;
        return {
            ok: false,
            errors: [
                {
                    file,
                    line: mark ? fence.contentStartLine + mark.line : undefined,
                    col: mark ? mark.column + 1 : undefined,
                    message: error instanceof Error ? error.message.split('\n')[0] : 'invalid YAML',
                },
            ],
        };
    }
}

function isYamlErrorWithMark(error: unknown): error is { mark: { line: number; column: number } } {
    return (
        typeof error === 'object' &&
        error !== null &&
        'mark' in error &&
        typeof (error as { mark?: unknown }).mark === 'object'
    );
}

function zodIssueToValidationError(
    issue: z.ZodIssue,
    fence: ArchFence,
    file: string,
): ValidationError {
    const path = issue.path;
    const key = path.join('.');
    const badValue =
        issue.code === 'invalid_enum_value' ? String(issue.received) : undefined;
    const expected =
        issue.code === 'invalid_enum_value'
            ? issue.options.map((value) => String(value)).join(' | ')
            : undefined;
    const message =
        issue.code === 'invalid_enum_value'
            ? `${key}: Invalid enum value. Expected ${expected}, received ${badValue}`
            : `${key || 'document'}: ${issue.message}`;

    return {
        file,
        line: findYamlPathLine(fence.source, fence.contentStartLine, path),
        message,
        hint:
            issue.code === 'invalid_enum_value' && path.at(-1) === 'kind'
                ? enumHint(path)
                : undefined,
    };
}

function enumHint(path: (string | number)[]): string {
    const values = path[0] === 'edges' ? EDGE_KINDS : NODE_KINDS;
    return `Use one of: ${values.join(', ')}.`;
}

function findYamlPathLine(
    source: string,
    contentStartLine: number,
    path: (string | number)[],
): number | undefined {
    const [collection, itemIndex, field] = path;
    if (
        typeof collection !== 'string' ||
        typeof itemIndex !== 'number' ||
        typeof field !== 'string'
    ) {
        return undefined;
    }

    const lines = source.split(/\r?\n/);
    let inCollection = false;
    let index = -1;
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (!inCollection && line.trim() === `${collection}:`) {
            inCollection = true;
            continue;
        }
        if (!inCollection) continue;
        if (/^\S/.test(line) && !line.startsWith(`${collection}:`)) break;
        if (/^\s*-\s/.test(line)) index += 1;
        if (index === itemIndex && new RegExp(`^\\s+${escapeRegExp(field)}:`).test(line)) {
            return contentStartLine + i;
        }
    }
    return undefined;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface BuildResult {
    model: ArchSystem;
    edgeLevelByKey: Map<string, string>;
    commentErrors: ValidationError[];
}

function buildModel(
    raw: RawArchitecture,
    about: string,
    markdown: string,
    file: string,
): BuildResult {
    const levels: Record<string, Level> = {};
    const nodeLevelByFullId = new Map<string, { levelId: string; nodeId: string }>();
    const edgeLevelByKey = new Map<string, string>();
    const rootId = raw.system;

    const visitLevel = (
        levelId: string,
        sourceNodes: RawNode[],
        parentLabel?: string,
        fullPrefix = '',
    ): void => {
        const levelEdges = (raw.edges ?? [])
            .map((edge) => normalizeEdgeForLevel(edge, sourceNodes, fullPrefix))
            .filter((edge): edge is ArchEdge => edge !== null);
        const nodes = layoutNodes(sourceNodes, levelEdges);
        levels[levelId] = {
            bounds: boundsForNodes(nodes),
            parentLabel,
            nodes,
            edges: levelEdges,
        };

        sourceNodes.forEach((node) => {
            const fullId = fullPrefix ? `${fullPrefix}.${node.id}` : node.id;
            nodeLevelByFullId.set(fullId, { levelId, nodeId: node.id });
            if (node.children && node.children.length > 0) {
                visitLevel(`${levelId}.${node.id}`, node.children, node.name ?? node.id, fullId);
            }
        });
        (raw.edges ?? []).forEach((edge) => {
            if (normalizeEdgeForLevel(edge, sourceNodes, fullPrefix)) {
                edgeLevelByKey.set(edgeKey(edge), levelId);
            }
        });
    };

    visitLevel(rootId, raw.nodes);

    const commentsResult = extractComments(markdown, file, nodeLevelByFullId);
    const model: ArchSystem = {
        id: rootId,
        name: raw.name ?? raw.system,
        about,
        levels,
        comments: commentsResult.comments,
        sampleErrors: [],
    };
    return { model, edgeLevelByKey, commentErrors: commentsResult.errors };
}

function normalizeEdgeForLevel(
    edge: RawEdge,
    sourceNodes: RawNode[],
    fullPrefix: string,
): ArchEdge | null {
    const endpointByInput = new Map<string, string>();
    sourceNodes.forEach((node) => {
        endpointByInput.set(node.id, node.id);
        endpointByInput.set(fullPrefix ? `${fullPrefix}.${node.id}` : node.id, node.id);
    });

    const from = endpointByInput.get(edge.from);
    const to = endpointByInput.get(edge.to);
    if (!from || !to) return null;
    return {
        from,
        to,
        kind: edge.kind,
        description: edge.description,
    };
}

function layoutNodes(sourceNodes: RawNode[], edges: ArchEdge[]): ArchNode[] {
    const columnById = computeColumns(sourceNodes.map((node) => node.id), edges);
    const rowsByColumn = new Map<number, RawNode[]>();
    sourceNodes.forEach((node) => {
        const column = columnById.get(node.id) ?? 0;
        rowsByColumn.set(column, [...(rowsByColumn.get(column) ?? []), node]);
    });

    return sourceNodes.map((node) => {
        const column = columnById.get(node.id) ?? 0;
        const row = rowsByColumn.get(column)?.findIndex((candidate) => candidate.id === node.id) ?? 0;
        const size = nodeSize(node.kind);
        return {
            id: node.id,
            kind: node.kind,
            name: node.name ?? node.id,
            purpose: node.purpose,
            tech: node.tech,
            x: 80 + column * 280,
            y: 80 + row * 170,
            w: size.w,
            h: size.h,
            hasChildren: node.children && node.children.length > 0 ? true : undefined,
            primary: node.primary,
        };
    });
}

function computeColumns(nodeIds: string[], edges: Pick<ArchEdge, 'from' | 'to'>[]): Map<string, number> {
    const nodeSet = new Set(nodeIds);
    const incoming = new Map<string, number>();
    const outgoing = new Map<string, string[]>();
    nodeIds.forEach((id) => {
        incoming.set(id, 0);
        outgoing.set(id, []);
    });
    edges.forEach((edge) => {
        if (!nodeSet.has(edge.from) || !nodeSet.has(edge.to)) return;
        outgoing.get(edge.from)?.push(edge.to);
        incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    });

    const queue = nodeIds.filter((id) => (incoming.get(id) ?? 0) === 0);
    const columns = new Map<string, number>(queue.map((id) => [id, 0]));
    while (queue.length > 0) {
        const current = queue.shift() as string;
        const nextColumn = (columns.get(current) ?? 0) + 1;
        for (const target of outgoing.get(current) ?? []) {
            columns.set(target, Math.max(columns.get(target) ?? 0, nextColumn));
            incoming.set(target, (incoming.get(target) ?? 0) - 1);
            if ((incoming.get(target) ?? 0) === 0) queue.push(target);
        }
    }

    nodeIds.forEach((id, index) => {
        if (!columns.has(id)) columns.set(id, index % 3);
    });
    return columns;
}

function nodeSize(kind: RawNode['kind']): { w: number; h: number } {
    if (kind === 'datastore' || kind === 'ui') return { w: 196, h: 100 };
    if (kind === 'library') return { w: 176, h: 72 };
    return { w: 196, h: 84 };
}

function boundsForNodes(nodes: ArchNode[]): { w: number; h: number } {
    const right = Math.max(...nodes.map((node) => node.x + node.w), 760);
    const bottom = Math.max(...nodes.map((node) => node.y + node.h), 420);
    return { w: right + 80, h: bottom + 80 };
}

function validateEdges(
    model: ArchSystem,
    rawEdges: RawEdge[],
    edgeLevelByKey: Map<string, string>,
    file: string,
): ValidationError[] {
    const errors: ValidationError[] = [];
    rawEdges.forEach((edge) => {
        if (edgeLevelByKey.has(edgeKey(edge))) return;
        const fromLevel = levelContainingNode(model, edge.from);
        const toLevel = levelContainingNode(model, edge.to);
        const undeclared = fromLevel ? edge.to : edge.from;
        const levelId = fromLevel ?? toLevel ?? model.id;
        errors.push({
            file,
            message: `edge \`${edge.from} -> ${edge.to}\` references undeclared node \`${undeclared}\` in level \`${levelId}\``,
            hint: 'Add the node to that level, or update the edge endpoint.',
        });
    });
    return errors;
}

function edgeKey(edge: Pick<RawEdge, 'from' | 'to' | 'kind'>): string {
    return `${edge.from}\u0000${edge.to}\u0000${edge.kind}`;
}

function levelContainingNode(model: ArchSystem, nodeId: string): string | null {
    for (const [levelId, level] of Object.entries(model.levels)) {
        if (level.nodes.some((node) => node.id === nodeId)) return levelId;
    }
    return null;
}

function extractAbout(markdown: string, fence: ArchFence, raw: RawArchitecture): string {
    if (raw.about) return raw.about;
    const beforeFence = markdown.split(fence.source)[0].replace(/```arch\s*$/i, '');
    const lines = beforeFence
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'));
    return lines.join('\n\n');
}

function extractComments(
    markdown: string,
    file: string,
    nodeLevelByFullId: Map<string, { levelId: string; nodeId: string }>,
): { comments: Annotation[]; errors: ValidationError[] } {
    const comments: Annotation[] = [];
    const errors: ValidationError[] = [];
    const blocks = [...markdown.matchAll(/<!--([\s\S]*?)-->/g)].map((match) => ({
        body: match[1].trim(),
        line: markdown.slice(0, match.index).split(/\r?\n/).length,
    }));

    for (let i = 0; i < blocks.length; i += 1) {
        const directive = parseCommentDirective(blocks[i].body);
        if (!directive) continue;
        const bodyBlock = blocks[i + 1];
        const target = resolveCommentTarget(directive.target, nodeLevelByFullId);
        if (!target) {
            errors.push({
                file,
                line: blocks[i].line,
                message: `comment target \`${directive.target}\` does not match a declared node`,
                hint: 'Use a node id from the level being annotated, or a full dotted child path.',
            });
            continue;
        }
        comments.push({
            id: `c${comments.length + 1}`,
            levelId: target.levelId,
            nodeId: target.nodeId,
            author: directive.author,
            date: directive.date,
            body: bodyBlock && !bodyBlock.body.startsWith('@comment') ? bodyBlock.body : '',
        });
    }

    return { comments, errors };
}

function parseCommentDirective(
    body: string,
): { author: string; target: string; date: string } | null {
    if (!body.startsWith('@comment')) return null;
    const author = /\bauthor:([^\s]+)/.exec(body)?.[1];
    const target = /\btarget:([^\s]+)/.exec(body)?.[1];
    const date = /\bdate:([0-9]{4}-[0-9]{2}-[0-9]{2})/.exec(body)?.[1] ??
        /\s([0-9]{4}-[0-9]{2}-[0-9]{2})\s*$/.exec(body)?.[1];
    if (!author || !target || !date) return null;
    return { author, target, date };
}

function resolveCommentTarget(
    target: string,
    nodeLevelByFullId: Map<string, { levelId: string; nodeId: string }>,
): { levelId: string; nodeId: string } | null {
    const exact = nodeLevelByFullId.get(target);
    if (exact) return exact;

    const matches = [...nodeLevelByFullId.entries()].filter(
        ([fullId, targetNode]) => fullId.endsWith(`.${target}`) || targetNode.nodeId === target,
    );
    if (matches.length === 1) return matches[0][1];
    return null;
}
