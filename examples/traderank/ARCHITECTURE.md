# Traderank Architecture

A continuous-time trading system. It ingests market data, scores instruments against a rolling alpha model, and routes target positions through a risk-checked executor to the broker. Operators watch from a single console; everything else is autonomous.

```arch
system: traderank
nodes:
  - id: pricefeed
    kind: external
    name: polygon.io
    purpose: Real-time market data feed over REST and websocket APIs.
  - id: ingest
    kind: service
    purpose: Normalizes ticks from the upstream feed and fans them out.
    tech: Rust, tokio
  - id: tickdb
    kind: datastore
    purpose: Time-series store for raw and normalized ticks.
    tech: InfluxDB 2.x
  - id: signals
    kind: service
    purpose: Generates ranked trade signals from features and the alpha model.
    tech: Python, ray
    children:
      - id: features
        kind: service
        purpose: Streaming feature engineering with rolling windows and normalization.
        tech: Python, ray
      - id: featlib
        kind: library
        purpose: Feature definitions shared between training and live scoring.
        tech: Python package
      - id: alpha
        kind: service
        purpose: Loads the latest alpha model and scores instruments.
        tech: Python, torch
      - id: ranker
        kind: service
        purpose: Ranks scored instruments into a target set with hysteresis.
        tech: Python
        primary: true
      - id: modelhub
        kind: external
        purpose: S3-backed model artifact registry.
  - id: eventbus
    kind: queue
    purpose: Pub/sub bus carrying ticks, signals, and order events.
    tech: NATS JetStream
  - id: orchestrator
    kind: service
    purpose: Decision loop. Consumes signals, sizes positions, runs risk checks, and dispatches orders.
    tech: Rust, tokio
    primary: true
    children:
      - id: router
        kind: service
        purpose: Routes inbound signal events to the appropriate decision strategy.
        tech: Rust
      - id: risk
        kind: service
        purpose: Pre-trade risk checks for exposure, drawdown, blacklist, and kill-switch state.
        tech: Rust
      - id: sizer
        kind: service
        purpose: Translates target weights into share counts given current account equity.
        tech: Rust
      - id: limits
        kind: library
        purpose: Shared limit-calculation primitives. Pure functions, no I/O.
        tech: Rust crate
      - id: executor
        kind: service
        purpose: Owns the broker session. Submits, tracks, and reconciles orders.
        tech: Rust
        primary: true
  - id: portfolio
    kind: service
    purpose: Tracks open positions, realized P&L, and exposure limits.
    tech: Go
  - id: positiondb
    kind: datastore
    purpose: Source of truth for positions, fills, and account state.
    tech: Postgres 16
  - id: broker
    kind: external
    name: alpaca
    purpose: Brokerage execution and account API.
  - id: console
    kind: ui
    purpose: Operator dashboard with live positions, signal heat-map, and kill-switch controls.
    tech: React, Tauri
edges:
  - from: pricefeed
    to: ingest
    kind: calls
  - from: ingest
    to: tickdb
    kind: writes
  - from: ingest
    to: eventbus
    kind: publishes
  - from: signals
    to: tickdb
    kind: reads
  - from: signals
    to: eventbus
    kind: publishes
  - from: orchestrator
    to: eventbus
    kind: subscribes
  - from: orchestrator
    to: portfolio
    kind: calls
  - from: orchestrator
    to: broker
    kind: calls
  - from: portfolio
    to: positiondb
    kind: writes
  - from: console
    to: orchestrator
    kind: calls
  - from: console
    to: positiondb
    kind: reads
  - from: signals.features
    to: signals.featlib
    kind: depends_on
  - from: signals.features
    to: signals.alpha
    kind: calls
  - from: signals.alpha
    to: signals.modelhub
    kind: reads
  - from: signals.alpha
    to: signals.ranker
    kind: calls
  - from: orchestrator.router
    to: orchestrator.risk
    kind: calls
  - from: orchestrator.router
    to: orchestrator.sizer
    kind: calls
  - from: orchestrator.risk
    to: orchestrator.limits
    kind: depends_on
  - from: orchestrator.sizer
    to: orchestrator.limits
    kind: depends_on
  - from: orchestrator.risk
    to: orchestrator.executor
    kind: calls
  - from: orchestrator.sizer
    to: orchestrator.executor
    kind: calls
```

<!-- @comment author:vadim target:orchestrator date:2026-04-22 -->
<!-- Subscribes to ticks but uses its own 50ms clock for the decision cadence. Do not trust event timing for ordering; use the sequence number on the envelope. -->

<!-- @comment author:vadim target:tickdb date:2026-03-08 -->
<!-- InfluxDB keeps 90 days hot, then archives to S3 glacier. Compaction runs Sundays 02:00 UTC, so expect query latency spikes. -->

<!-- @comment author:miriam target:broker date:2026-04-30 -->
<!-- Alpaca only in main. There is a half-finished IBKR adapter gated by a feature flag that needs cleanup before audit. -->

<!-- @comment author:vadim target:orchestrator.executor date:2026-04-22 -->
<!-- The only place that touches the broker session. If you are tempted to call Alpaca from anywhere else, this funnel exists for a reason. -->

<!-- @comment author:miriam target:orchestrator.limits date:2026-02-14 -->
<!-- Pure crate, no I/O, no clock. If a test needs the wall clock, it belongs somewhere else. -->
