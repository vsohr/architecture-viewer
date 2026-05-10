// Node + edge renderers for the Arch Viewer canvas.
//
// Visual encoding intent (per UX brief):
//   shape and weight first; color second.
// Each kind has a distinct silhouette readable at a thumbnail scale.
//   service    → rounded rectangle (canonical "thing that runs")
//   ui         → rectangle with a top "browser" stripe (three dots)
//   datastore  → cylinder (top ellipse + body, classic db glyph)
//   queue      → wide rectangle with vertical segments (a pipeline)
//   library    → thin pill with a left rule (linked code, not a runtime)
//   external   → dashed border, faded fill (lives outside the system)

const KIND_LABEL = {
  service: "service",
  ui: "ui",
  datastore: "datastore",
  queue: "queue",
  library: "library",
  external: "external"
};

// A small cluster of dots — used as the kind glyph for services
// and as a lightweight visual mark.
function KindGlyph({ kind, size = 10 }) {
  const s = size;
  if (kind === "datastore") {
    return (
      <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
        <ellipse cx="6" cy="3" rx="4" ry="1.4" stroke="currentColor" strokeWidth="1" />
        <path d="M2 3v6c0 .77 1.79 1.4 4 1.4s4-.63 4-1.4V3" stroke="currentColor" strokeWidth="1" />
      </svg>
    );
  }
  if (kind === "queue") {
    return (
      <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
        <rect x="1" y="3" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1" />
        <path d="M4 3v6M7 3v6" stroke="currentColor" strokeWidth="1" />
      </svg>
    );
  }
  if (kind === "ui") {
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
  if (kind === "library") {
    return (
      <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
        <path d="M3 2h7M3 6h7M3 10h7" stroke="currentColor" strokeWidth="1" />
        <path d="M2 1.5v9" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  if (kind === "external") {
    return (
      <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
        <path d="M4 2h6v6" stroke="currentColor" strokeWidth="1" />
        <path d="M9.5 2.5L4 8" stroke="currentColor" strokeWidth="1" />
        <path d="M2 5v5h5" stroke="currentColor" strokeWidth="1" />
      </svg>
    );
  }
  // service default
  return (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
      <rect x="1.5" y="1.5" width="9" height="9" rx="2.2" stroke="currentColor" strokeWidth="1" />
      <circle cx="6" cy="6" r="1.2" fill="currentColor" />
    </svg>
  );
}

// One node, rendered as an absolutely-positioned div on the canvas.
// Receives canvas coords; the canvas element handles the zoom transform.
function ArchNode({ node, selected, hovered, dim, onClick, onHover, onUnhover, onDrillIn, onDragMove, onDragEnd, fitScale, layer = "live" }) {
  const [drag, setDrag] = React.useState(null); // { startX, startY, originX, originY, moved }
  const startDrag = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".node-drill")) return;
    if (!fitScale) return;
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const originX = node.x, originY = node.y;
    let moved = false;
    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / fitScale;
      const dy = (ev.clientY - startY) / fitScale;
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 3) {
        moved = true;
        document.body.style.cursor = "grabbing";
      }
      if (moved) onDragMove && onDragMove(node, originX + dx, originY + dy);
    };
    const onUp = (ev) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      if (moved) {
        const dx = (ev.clientX - startX) / fitScale;
        const dy = (ev.clientY - startY) / fitScale;
        onDragEnd && onDragEnd(node, originX + dx, originY + dy);
      } else {
        // treat as click
        onClick && onClick(node);
      }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };
  const { kind, name, x, y, w, h, hasChildren, primary, tech } = node;

  // Cylinder needs SVG; everything else is a div with a border treatment.
  const isCylinder = kind === "datastore";
  const isQueue = kind === "queue";
  const isExternal = kind === "external";
  const isLibrary = kind === "library";
  const isUi = kind === "ui";

  const baseClass =
    "arch-node " +
    `kind-${kind}` +
    (selected ? " is-selected" : "") +
    (hovered ? " is-hovered" : "") +
    (dim ? " is-dim" : "") +
    (primary ? " is-primary" : "") +
    (hasChildren ? " has-children" : "");

  return (
    <div
      className={baseClass}
      data-id={node.id}
      data-layer={layer}
      style={{ left: x, top: y, width: w, height: h }}
      onMouseDown={startDrag}
      onDoubleClick={(e) => {
        if (hasChildren && onDrillIn) { e.stopPropagation(); onDrillIn(node); }
      }}
      onMouseEnter={() => onHover && onHover(node)}
      onMouseLeave={() => onUnhover && onUnhover(node)}
    >
      {isCylinder && (
        <svg className="cylinder-bg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
          <path d={`M0 8 L0 ${h - 10} Q0 ${h} ${w / 2} ${h} Q${w} ${h} ${w} ${h - 10} L${w} 8`} className="cyl-body" />
          <ellipse cx={w / 2} cy={8} rx={w / 2} ry="5.5" className="cyl-top" />
        </svg>
      )}
      {isQueue && (
        <div className="queue-segments">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
      )}
      {isUi && <div className="ui-chrome"><i></i><i></i><i></i></div>}
      {isLibrary && <div className="lib-rule"></div>}

      <div className="node-meta">
        <span className="node-kind"><KindGlyph kind={kind} /> {KIND_LABEL[kind]}</span>
        {hasChildren && (
          <button
            className="node-drill"
            title="Drill in (Enter, or double-click)"
            onClick={(e) => { e.stopPropagation(); onDrillIn && onDrillIn(node); }}
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

// Edge rendering. Each edge is a single SVG path between two anchor
// points. We pick the anchor on the side of each node closest to the
// other node so paths leave from the natural edge.
function edgeAnchors(a, b) {
  const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2, by = b.y + b.h / 2;
  const dx = bx - ax, dy = by - ay;
  // Pick a side per node based on dominant axis.
  function side(node, otherCx, otherCy) {
    const cx = node.x + node.w / 2, cy = node.y + node.h / 2;
    const ddx = otherCx - cx, ddy = otherCy - cy;
    if (Math.abs(ddx) * node.h > Math.abs(ddy) * node.w) {
      // exits left/right
      return ddx > 0
        ? { x: node.x + node.w, y: cy, dir: "r" }
        : { x: node.x,           y: cy, dir: "l" };
    }
    return ddy > 0
      ? { x: cx, y: node.y + node.h, dir: "d" }
      : { x: cx, y: node.y,          dir: "u" };
  }
  return [side(a, bx, by), side(b, ax, ay)];
}

function edgePath(a, b) {
  const [s, t] = edgeAnchors(a, b);
  const dx = t.x - s.x, dy = t.y - s.y;
  // Smooth cubic with control points pulled in the exit direction.
  const k = Math.max(40, Math.min(180, Math.hypot(dx, dy) * 0.35));
  const cx1 = s.x + (s.dir === "r" ? k : s.dir === "l" ? -k : 0);
  const cy1 = s.y + (s.dir === "d" ? k : s.dir === "u" ? -k : 0);
  const cx2 = t.x + (t.dir === "r" ? k : t.dir === "l" ? -k : 0);
  const cy2 = t.y + (t.dir === "d" ? k : t.dir === "u" ? -k : 0);
  return { d: `M ${s.x} ${s.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${t.x} ${t.y}`, s, t };
}

// Edge style by kind. Matches engineering brief vocabulary.
const EDGE_STYLE = {
  calls:       { stroke: "var(--edge-strong)",  dash: "",        head: "arrow",   weight: 1.4 },
  reads:       { stroke: "var(--edge-medium)",  dash: "",        head: "arrow",   weight: 1.2, label: "r" },
  writes:      { stroke: "var(--edge-medium)",  dash: "",        head: "arrow",   weight: 1.2, label: "w" },
  publishes:   { stroke: "var(--edge-pub)",     dash: "6 4",     head: "arrow",   weight: 1.2 },
  subscribes:  { stroke: "var(--edge-pub)",     dash: "2 5",     head: "arrow",   weight: 1.2 },
  depends_on:  { stroke: "var(--edge-faint)",   dash: "1 4",     head: "none",    weight: 1   },
  owns:        { stroke: "var(--edge-strong)",  dash: "",        head: "diamond", weight: 1.4 }
};

function ArchEdge({ a, b, kind, dim, hl }) {
  const { d, s, t } = edgePath(a, b);
  const st = EDGE_STYLE[kind] || EDGE_STYLE.calls;
  const cls = "arch-edge edge-" + kind + (dim ? " is-dim" : "") + (hl ? " is-hl" : "");
  // Head: anchor at endpoint, oriented along the curve's tangent at t.
  // Polygon is drawn with its TIP at (0,0) and wings trailing back so the
  // tip lands exactly on the node boundary instead of poking inside.
  const ang = Math.atan2(t.y - s.y, t.x - s.x);
  const headSize = st.head === "diamond" ? 6 : 5;
  const headLen = st.head === "diamond" ? headSize * 1.4 : headSize * 1.7;
  return (
    <g className={cls}>
      <path d={d} fill="none" stroke={st.stroke} strokeWidth={st.weight} strokeDasharray={st.dash} strokeLinecap="round" />
      {st.head === "arrow" && (
        <polygon
          points={`-${headLen},-${headSize} 0,0 -${headLen},${headSize}`}
          transform={`translate(${t.x} ${t.y}) rotate(${(ang * 180) / Math.PI})`}
          fill={st.stroke}
        />
      )}
      {st.head === "diamond" && (
        <polygon
          points={`-${headLen},-${headSize} 0,0 -${headLen},${headSize} -${headLen * 2},0`}
          transform={`translate(${t.x} ${t.y}) rotate(${(ang * 180) / Math.PI})`}
          fill={st.stroke}
        />
      )}
      {st.label && (
        <text x={(s.x + t.x) / 2} y={(s.y + t.y) / 2 - 4}
              textAnchor="middle" className="edge-label">{st.label}</text>
      )}
    </g>
  );
}

Object.assign(window, { ArchNode, ArchEdge, edgePath, edgeAnchors, EDGE_STYLE, KindGlyph });
