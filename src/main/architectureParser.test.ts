import { describe, expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArchitectureMarkdown } from './architectureParser';

const validMarkdown = `# Traderank Architecture

A continuous-time trading system.

\`\`\`arch
system: traderank
nodes:
  - id: ingest
    kind: service
    purpose: Normalizes upstream market data.
    tech: Rust
  - id: eventbus
    kind: queue
    purpose: Carries ticks and trading events.
  - id: orchestrator
    kind: service
    purpose: Sizes positions and dispatches orders.
    children:
      - id: risk
        kind: service
        purpose: Applies exposure and drawdown limits.
      - id: executor
        kind: service
        purpose: Owns the broker session.
edges:
  - from: ingest
    to: eventbus
    kind: publishes
  - from: orchestrator
    to: eventbus
    kind: subscribes
  - from: risk
    to: executor
    kind: calls
\`\`\`

<!-- @comment author:vadim target:orchestrator date:2026-05-10 -->
<!-- Decision loop owns risk checks and execution handoff. -->

<!-- @comment author:miriam target:orchestrator.executor 2026-05-11 -->
<!-- Keep all broker access here. -->
`;

describe('parseArchitectureMarkdown', () => {
    test('parses an arch fence into renderer levels and comments', () => {
        const result = parseArchitectureMarkdown(validMarkdown, 'ARCHITECTURE.md');

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error(result.errors.map((e) => e.message).join('\n'));

        expect(result.model.id).toBe('traderank');
        expect(result.model.about).toBe('A continuous-time trading system.');
        expect(result.model.levels.traderank.nodes.map((n) => n.id)).toEqual([
            'ingest',
            'eventbus',
            'orchestrator',
        ]);
        expect(result.model.levels.traderank.nodes.find((n) => n.id === 'orchestrator')?.hasChildren).toBe(true);
        expect(result.model.levels['traderank.orchestrator'].nodes.map((n) => n.id)).toEqual([
            'risk',
            'executor',
        ]);
        expect(result.model.levels['traderank.orchestrator'].edges).toEqual([
            { from: 'risk', to: 'executor', kind: 'calls' },
        ]);
        expect(result.model.comments).toEqual([
            {
                id: 'c1',
                levelId: 'traderank',
                nodeId: 'orchestrator',
                author: 'vadim',
                date: '2026-05-10',
                body: 'Decision loop owns risk checks and execution handoff.',
            },
            {
                id: 'c2',
                levelId: 'traderank.orchestrator',
                nodeId: 'executor',
                author: 'miriam',
                date: '2026-05-11',
                body: 'Keep all broker access here.',
            },
        ]);
    });

    test('returns structured errors for invalid YAML and schema violations', () => {
        const result = parseArchitectureMarkdown(
            `# Bad

\`\`\`arch
system: bad
nodes:
  - id: api
    kind: model
    purpose: Serves requests.
edges: []
\`\`\`
`,
            'ARCHITECTURE.md',
        );

        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('expected validation errors');

        expect(result.errors).toEqual([
            {
                file: 'ARCHITECTURE.md',
                line: 7,
                message: 'nodes.0.kind: Invalid enum value. Expected service | ui | datastore | queue | library | external, received model',
                hint: 'Use one of: service, ui, datastore, queue, library, external.',
            },
        ]);
    });

    test('reports edges that reference nodes outside their rendered level', () => {
        const result = parseArchitectureMarkdown(
            `# Bad edge

\`\`\`arch
system: badedge
nodes:
  - id: api
    kind: service
    purpose: Serves requests.
edges:
  - from: api
    to: missing
    kind: calls
\`\`\`
`,
            'ARCHITECTURE.md',
        );

        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('expected validation errors');

        expect(result.errors).toEqual([
            {
                file: 'ARCHITECTURE.md',
                message: 'edge `api -> missing` references undeclared node `missing` in level `badedge`',
                hint: 'Add the node to that level, or update the edge endpoint.',
            },
        ]);
    });

    test('normalizes dotted child edge endpoints to local renderer node ids', () => {
        const result = parseArchitectureMarkdown(
            `# Dotted child edges

\`\`\`arch
system: dotted
nodes:
  - id: orchestrator
    kind: service
    purpose: Coordinates trading decisions.
    children:
      - id: risk
        kind: service
        purpose: Applies limits.
      - id: executor
        kind: service
        purpose: Sends orders.
edges:
  - from: orchestrator.risk
    to: orchestrator.executor
    kind: calls
\`\`\`
`,
            'ARCHITECTURE.md',
        );

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error(result.errors.map((e) => e.message).join('\n'));

        expect(result.model.levels['dotted.orchestrator'].edges).toEqual([
            { from: 'risk', to: 'executor', kind: 'calls' },
        ]);
    });

    test('parses the tracked Traderank example', async () => {
        const markdown = await readFile(
            join(process.cwd(), 'examples', 'traderank', 'ARCHITECTURE.md'),
            'utf8',
        );

        const result = parseArchitectureMarkdown(markdown, 'ARCHITECTURE.md');

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error(result.errors.map((e) => e.message).join('\n'));
        expect(Object.keys(result.model.levels)).toEqual([
            'traderank',
            'traderank.signals',
            'traderank.orchestrator',
        ]);
        expect(result.model.comments).toHaveLength(5);
    });
});
