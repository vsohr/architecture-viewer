import type { ArchSystem, RecentRepo } from '../types';

// Traderank — fictional algorithmic trading system used as the
// example architecture rendered by Arch Viewer. Stand-in until the
// parser/validator phase replaces this with parsed ARCHITECTURE.md.
export const TRADERANK: ArchSystem = {
    id: 'traderank',
    name: 'traderank',
    about:
        'A continuous-time trading system. Ingests market data, scores instruments against a rolling alpha model, and routes target positions through a risk-checked executor to the broker. Operators watch from a single console; everything else is autonomous.',
    levels: {
        traderank: {
            bounds: { w: 1480, h: 760 },
            nodes: [
                { id: 'pricefeed', kind: 'external', name: 'polygon.io', purpose: 'Real-time market data feed (REST + websocket).', x: 60, y: 60, w: 196, h: 84 },
                { id: 'ingest', kind: 'service', name: 'ingest', purpose: 'Normalizes ticks from the upstream feed and fans them out.', tech: 'Rust · tokio', x: 320, y: 60, w: 196, h: 84 },
                { id: 'tickdb', kind: 'datastore', name: 'tickdb', purpose: 'Time-series store for raw and normalized ticks.', tech: 'InfluxDB 2.x', x: 320, y: 264, w: 196, h: 100 },
                { id: 'signals', kind: 'service', name: 'signals', purpose: 'Generates ranked trade signals from features and the alpha model.', tech: 'Python · ray', x: 580, y: 60, w: 196, h: 84, hasChildren: true },
                { id: 'eventbus', kind: 'queue', name: 'eventbus', purpose: 'Pub/sub bus carrying ticks, signals, and order events.', tech: 'NATS JetStream', x: 580, y: 264, w: 456, h: 84 },
                { id: 'orchestrator', kind: 'service', name: 'orchestrator', purpose: 'Decision loop. Consumes signals, sizes positions, runs risk checks, and dispatches orders.', tech: 'Rust · tokio', x: 840, y: 60, w: 196, h: 84, hasChildren: true, primary: true },
                { id: 'portfolio', kind: 'service', name: 'portfolio', purpose: 'Tracks open positions, realized P&L, and exposure limits.', tech: 'Go', x: 1100, y: 60, w: 196, h: 84 },
                { id: 'positiondb', kind: 'datastore', name: 'positiondb', purpose: 'Source of truth for positions, fills, and account state.', tech: 'Postgres 16', x: 1100, y: 264, w: 196, h: 100 },
                { id: 'broker', kind: 'external', name: 'alpaca', purpose: 'Brokerage execution + account API.', x: 1280, y: 60, w: 156, h: 84 },
                { id: 'console', kind: 'ui', name: 'console', purpose: 'Operator dashboard. Live positions, signal heat-map, kill-switch.', tech: 'React · Tauri', x: 840, y: 480, w: 196, h: 100 },
            ],
            edges: [
                { from: 'pricefeed', to: 'ingest', kind: 'calls' },
                { from: 'ingest', to: 'tickdb', kind: 'writes' },
                { from: 'ingest', to: 'eventbus', kind: 'publishes' },
                { from: 'signals', to: 'tickdb', kind: 'reads' },
                { from: 'signals', to: 'eventbus', kind: 'publishes' },
                { from: 'orchestrator', to: 'eventbus', kind: 'subscribes' },
                { from: 'orchestrator', to: 'portfolio', kind: 'calls' },
                { from: 'orchestrator', to: 'broker', kind: 'calls' },
                { from: 'portfolio', to: 'positiondb', kind: 'writes' },
                { from: 'console', to: 'orchestrator', kind: 'calls' },
                { from: 'console', to: 'positiondb', kind: 'reads' },
            ],
        },
        'traderank.orchestrator': {
            bounds: { w: 1280, h: 580 },
            parentLabel: 'orchestrator',
            nodes: [
                { id: 'router', kind: 'service', name: 'router', purpose: 'Routes inbound signal events to the appropriate decision strategy.', tech: 'Rust', x: 80, y: 220, w: 196, h: 84 },
                { id: 'risk', kind: 'service', name: 'risk', purpose: 'Pre-trade risk checks: exposure, drawdown, blacklist, kill-switch.', tech: 'Rust', x: 360, y: 80, w: 196, h: 84 },
                { id: 'sizer', kind: 'service', name: 'sizer', purpose: 'Translates target weights into share counts given current account equity.', tech: 'Rust', x: 360, y: 360, w: 196, h: 84 },
                { id: 'limits', kind: 'library', name: 'limits', purpose: 'Shared limit-calculation primitives. Pure functions, no I/O.', tech: 'Rust crate', x: 640, y: 220, w: 176, h: 72 },
                { id: 'executor', kind: 'service', name: 'executor', purpose: 'Owns the broker session. Submits, tracks, and reconciles orders.', tech: 'Rust', x: 900, y: 220, w: 196, h: 84, primary: true },
            ],
            edges: [
                { from: 'router', to: 'risk', kind: 'calls' },
                { from: 'router', to: 'sizer', kind: 'calls' },
                { from: 'risk', to: 'limits', kind: 'depends_on' },
                { from: 'sizer', to: 'limits', kind: 'depends_on' },
                { from: 'risk', to: 'executor', kind: 'calls' },
                { from: 'sizer', to: 'executor', kind: 'calls' },
            ],
        },
        'traderank.signals': {
            bounds: { w: 1180, h: 460 },
            parentLabel: 'signals',
            nodes: [
                { id: 'features', kind: 'service', name: 'features', purpose: 'Streaming feature engineering. Rolling windows, normalized.', tech: 'Python · ray', x: 80, y: 180, w: 196, h: 84 },
                { id: 'featlib', kind: 'library', name: 'featlib', purpose: 'Feature definitions shared between training and live.', tech: 'Python pkg', x: 80, y: 320, w: 176, h: 72 },
                { id: 'alpha', kind: 'service', name: 'alpha', purpose: 'Loads the latest alpha model and scores instruments.', tech: 'Python · torch', x: 380, y: 180, w: 196, h: 84 },
                { id: 'ranker', kind: 'service', name: 'ranker', purpose: 'Ranks scored instruments into a target set with hysteresis.', tech: 'Python', x: 680, y: 180, w: 196, h: 84, primary: true },
                { id: 'modelhub', kind: 'external', name: 'modelhub', purpose: 'S3-backed model artifact registry.', x: 380, y: 40, w: 196, h: 64 },
            ],
            edges: [
                { from: 'features', to: 'featlib', kind: 'depends_on' },
                { from: 'features', to: 'alpha', kind: 'calls' },
                { from: 'alpha', to: 'modelhub', kind: 'reads' },
                { from: 'alpha', to: 'ranker', kind: 'calls' },
            ],
        },
    },
    comments: [
        {
            id: 'c1',
            levelId: 'traderank',
            nodeId: 'orchestrator',
            author: 'vlad',
            date: '2026-04-22',
            body: "Subscribes to ticks but uses its own 50ms clock for the decision cadence. Don't trust event timing for ordering — use the seq number on the envelope.",
        },
        {
            id: 'c2',
            levelId: 'traderank',
            nodeId: 'tickdb',
            author: 'vlad',
            date: '2026-03-08',
            body: 'InfluxDB 2.x. 90 days hot, then archived to S3 glacier. Compaction Sundays 02:00 UTC — expect query latency spikes.',
        },
        {
            id: 'c3',
            levelId: 'traderank',
            nodeId: 'broker',
            author: 'miriam',
            date: '2026-04-30',
            body: "Alpaca only in main. There's a half-finished IBKR adapter in main:exec gated by a feature flag we forgot we had. Clean up before audit.",
        },
        {
            id: 'c4',
            levelId: 'traderank.orchestrator',
            nodeId: 'executor',
            author: 'vlad',
            date: '2026-04-22',
            body: "The only place that touches the broker session. If you're tempted to call Alpaca from anywhere else — don't. There's a reason this funnel exists.",
        },
        {
            id: 'c5',
            levelId: 'traderank.orchestrator',
            nodeId: 'limits',
            author: 'miriam',
            date: '2026-02-14',
            body: "Pure crate, no I/O, no clock. If a test needs the wall-clock, you're in the wrong file.",
        },
    ],
    sampleErrors: [
        {
            file: 'ARCHITECTURE.md',
            line: 47,
            col: 12,
            message:
                'edge `orchestrator.legacy_executor → broker` references undeclared node `orchestrator.legacy_executor`',
            hint: 'Was this renamed to `executor`? Add the node, or update the edge.',
        },
        {
            file: 'ARCHITECTURE.md',
            line: 62,
            col: 9,
            message: 'node `signals` declares `kind: model` — not in the closed vocabulary',
            hint: 'Use one of: service, ui, datastore, queue, library, external.',
        },
    ],
};

export const RECENT_REPOS: RecentRepo[] = [
    { name: 'traderank', path: '~/code/traderank', when: 'now' },
    { name: 'ledger-monorepo', path: '~/work/ledger', when: 'yesterday' },
    { name: 'claude-skills', path: '~/code/claude-skills', when: '3d ago' },
    { name: 'om-design', path: '~/work/om-design', when: '1w ago' },
    { name: 'harness', path: '~/personal/harness', when: '2w ago' },
];
