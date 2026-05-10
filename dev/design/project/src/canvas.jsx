// Canvas — renders one level of the diagram and handles the
// "Apple Maps zoom" drill-down transition.
//
// Scaling: every level has authored coordinates inside its own bounds
// rect. The stage element holds those at natural size and is scaled
// with CSS transform to fit the visible canvas.
//
// Transition: when the user drills into a node-with-children, two
// stages overlap during a ~620ms transition. The outgoing parent
// scales up so the clicked node fills the viewport, fading out. The
// incoming child enters at a slightly compressed scale and settles
// to fit, fading in. Drill-out plays the same motion in reverse.

const { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } = React;

function fitTransform(boundW, boundH, viewW, viewH, margin = 0.92) {
  const s = Math.min(viewW / boundW, viewH / boundH) * margin;
  return {
    s,
    tx: (viewW - boundW * s) / 2,
    ty: (viewH - boundH * s) / 2
  };
}

function nodeFillsTransform(node, viewW, viewH, margin = 0.95) {
  const s = Math.min(viewW / node.w, viewH / node.h) * margin;
  return {
    s,
    tx: viewW / 2 - (node.x + node.w / 2) * s,
    ty: viewH / 2 - (node.y + node.h / 2) * s
  };
}

// One level's contents, positioned inside an absolutely-sized stage.
function Stage({ level, selectedId, hoverPreviewId, dimAll, onNodeClick, onNodeEnter, onNodeLeave, onDrillIn, onNodeDragMove, onNodeDragEnd, transform, transitionMs, layerName, hasFocus }) {
  const { bounds, nodes, edges } = level;
  const { s, tx, ty } = transform;
  const nodeById = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);

  return (
    <div
      className={"stage layer-" + layerName}
      style={{
        width: bounds.w,
        height: bounds.h,
        transform: `translate3d(${tx}px, ${ty}px, 0) scale(${s})`,
        transition: transitionMs ? `transform ${transitionMs}ms cubic-bezier(.65,0,.2,1), opacity ${transitionMs}ms ease` : "none"
      }}
    >
      <svg className="stage-edges" width={bounds.w} height={bounds.h} viewBox={`0 0 ${bounds.w} ${bounds.h}`}>
        {edges.map((e, i) => {
          const a = nodeById[e.from], b = nodeById[e.to];
          if (!a || !b) return null;
          const dim = dimAll || (selectedId && selectedId !== a.id && selectedId !== b.id);
          const hl = selectedId && (selectedId === a.id || selectedId === b.id);
          return <ArchEdge key={i} a={a} b={b} kind={e.kind} dim={dim} hl={hl} />;
        })}
      </svg>
      {nodes.map(n => (
        <ArchNode
          key={n.id}
          node={n}
          selected={hasFocus && selectedId === n.id}
          hovered={hasFocus && hoverPreviewId === n.id}
          dim={dimAll || (selectedId && selectedId !== n.id && hasFocus)}
          onClick={onNodeClick}
          onHover={onNodeEnter}
          onUnhover={onNodeLeave}
          onDrillIn={onDrillIn}
          onDragMove={onNodeDragMove}
          onDragEnd={onNodeDragEnd}
          fitScale={transform.s}
          layer={layerName}
        />
      ))}
    </div>
  );
}

// Hover thumbnail: draws a tiny preview of a node's children when the
// user hovers a node-with-children. Anchored to the node's rect.
function HoverThumbnail({ levels, parentId, anchorRect }) {
  const childLevel = levels[parentId];
  if (!childLevel) return null;
  const { bounds, nodes, edges } = childLevel;
  const W = 220, H = 140;
  const sx = (W - 16) / bounds.w, sy = (H - 16) / bounds.h;
  const s = Math.min(sx, sy);
  const ox = (W - bounds.w * s) / 2;
  const oy = (H - bounds.h * s) / 2;
  const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));

  // Position thumbnail above-right of anchor.
  const top = anchorRect.top - H - 12;
  const left = anchorRect.left + anchorRect.width - W;

  return (
    <div className="hover-thumb" style={{ top: Math.max(20, top), left: Math.max(20, left), width: W, height: H }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <g transform={`translate(${ox} ${oy}) scale(${s})`}>
          {edges.map((e, i) => {
            const a = nodeById[e.from], b = nodeById[e.to];
            if (!a || !b) return null;
            const { d } = edgePath(a, b);
            return <path key={i} d={d} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth={1 / s} />;
          })}
          {nodes.map(n => (
            <rect key={n.id} x={n.x} y={n.y} width={n.w} height={n.h} rx="6"
                  fill={n.kind === "external" ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.10)"}
                  stroke="rgba(255,255,255,.35)"
                  strokeWidth={1 / s}
                  strokeDasharray={n.kind === "external" ? `${4/s} ${3/s}` : ""} />
          ))}
        </g>
      </svg>
      <div className="hover-thumb-label">
        <span className="ht-kbd">↵</span> drill in · <span className="ht-name">{nodes.length} node{nodes.length === 1 ? "" : "s"}</span>
      </div>
    </div>
  );
}

// The breadcrumb: URL-bar pill. Monospace path. Up-arrow climbs.
function Breadcrumb({ pathIds, system, onJump, onBack }) {
  const segs = pathIds;
  const drilled = segs.length > 1;
  return (
    <div className="breadcrumb-wrap">
      <div className="breadcrumb-row">
        {drilled && (
          <button className="bc-back" onClick={onBack} title="Back (Esc)">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M7 2L3 5.5L7 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>back</span>
          </button>
        )}
        <div className="breadcrumb">
          <span className="bc-scheme">arch://</span>
          <span className="bc-host">{system.name}</span>
          {segs.slice(1).map((s, i) => (
            <React.Fragment key={i}>
              <span className="bc-sep">/</span>
              <button className="bc-seg" onClick={() => onJump(i + 1)}>{s}</button>
            </React.Fragment>
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

Object.assign(window, { Stage, HoverThumbnail, Breadcrumb, fitTransform, nodeFillsTransform });
