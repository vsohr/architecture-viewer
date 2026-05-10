// All the secondary surfaces. Each is summoned by an action — none
// are visible by default. The default canvas is just diagram + breadcrumb.

const { useState: _useS, useEffect: _useE, useRef: _useR, useMemo: _useM } = React;

// Detail panel — slides in from the right when a node is selected.
// Treats the user as a reader: generous type, no chrome, prose-first.
function DetailPanel({ node, comments, onClose, onOpenComments, onDrillIn, onCopyContext }) {
  if (!node) return null;
  const { kind, name, purpose, tech, hasChildren } = node;
  const cn = comments.filter(c => c.nodeId === node.id);
  return (
    <aside className="detail-panel" onClick={(e) => e.stopPropagation()}>
      <div className="dp-head">
        <span className="dp-kind"><KindGlyph kind={kind} size={11} /> {kind}</span>
        <button className="dp-close" onClick={onClose} title="Close (Tab)">esc</button>
      </div>
      <h1 className="dp-name">{name}</h1>
      {tech && <div className="dp-tech">{tech}</div>}
      <p className="dp-purpose">{purpose}</p>

      <div className="dp-actions">
        {hasChildren && (
          <button className="dp-btn primary" onClick={() => onDrillIn(node)}>
            Drill in <span className="kbd-inline">↵</span>
          </button>
        )}
        <button className="dp-btn" onClick={onCopyContext}>
          Copy context pack <span className="kbd-inline">⌘⇧C</span>
        </button>
        <button className="dp-btn ghost" onClick={() => alert("Open " + name + " in editor (stub)")}>
          Open in editor
        </button>
      </div>

      <div className="dp-section">
        <div className="dp-section-h">
          <span>Comments</span>
          <span className="dp-count">{cn.length}</span>
          {cn.length > 0 && (
            <button className="dp-link" onClick={onOpenComments}>open in margin →</button>
          )}
        </div>
        {cn.length === 0 ? (
          <div className="dp-empty">No comments anchored here.</div>
        ) : (
          cn.slice(0, 1).map(c => (
            <div key={c.id} className="dp-comment-preview">
              <div className="cm-meta"><span className="cm-author">@{c.author}</span> · <span className="cm-date">{c.date}</span></div>
              <div className="cm-body">{c.body}</div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

// Comments drawer with anchor lines connecting each comment back to its node.
// Lives on the right; lines bow out from each card to the anchored node's
// position on the canvas.
function CommentsDrawer({ open, comments, levelNodes, onClose, viewport, getNodeRect, onJumpNode }) {
  if (!open) return null;
  const cardW = 320;

  return (
    <>
      <aside className="comments-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="cd-head">
          <span className="cd-title">Comments</span>
          <span className="cd-count">{comments.length}</span>
          <button className="cd-close" onClick={onClose}>close</button>
        </div>
        <div className="cd-body">
          {comments.length === 0 && (
            <div className="cd-empty">No comments on this level.</div>
          )}
          {comments.map((c, i) => {
            const target = levelNodes.find(n => n.id === c.nodeId);
            return (
              <article key={c.id} className="cm-card" data-anchor={c.nodeId}
                       onClick={() => target && onJumpNode(target)}>
                <div className="cm-anchor-row">
                  <span className="cm-anchor-dot"></span>
                  <span className="cm-anchor-name">{target ? target.name : c.nodeId}</span>
                  <span className="cm-author">@{c.author}</span>
                  <span className="cm-date">{c.date}</span>
                </div>
                <div className="cm-body">{c.body}</div>
              </article>
            );
          })}
        </div>
        <div className="cd-foot">Anchored from <code>&lt;!-- @comment --&gt;</code> in <code>ARCHITECTURE.md</code></div>
      </aside>

      {/* Anchor lines — drawn in viewport space, from drawer cards to nodes */}
      <AnchorLines comments={comments} viewport={viewport} getNodeRect={getNodeRect} />
    </>
  );
}

function AnchorLines({ comments, viewport, getNodeRect }) {
  // Each card sits at a known y-offset in the drawer; we approximate the
  // start point with [data-anchor] DOM lookup.
  const [paths, setPaths] = _useS([]);
  _useE(() => {
    function recompute() {
      const out = [];
      comments.forEach(c => {
        const cardEl = document.querySelector(`.cm-card[data-anchor="${c.nodeId}"]`);
        const rect = getNodeRect && getNodeRect(c.nodeId);
        if (!cardEl || !rect) return;
        const cardR = cardEl.getBoundingClientRect();
        const sx = cardR.left - 2;
        const sy = cardR.top + 18;
        const tx = rect.right - 4;
        const ty = rect.top + rect.height / 2;
        // Curve: pull control points horizontally
        const dx = sx - tx;
        const cx1 = tx + Math.max(40, dx * 0.5);
        const cx2 = sx - Math.max(40, dx * 0.5);
        out.push({ id: c.id, d: `M ${tx} ${ty} C ${cx1} ${ty}, ${cx2} ${sy}, ${sx} ${sy}`, dot: { x: tx, y: ty } });
      });
      setPaths(out);
    }
    recompute();
    const id = setInterval(recompute, 80); // cheap; small N
    return () => clearInterval(id);
  }, [comments, getNodeRect]);
  return (
    <svg className="anchor-lines" width={viewport.w} height={viewport.h}>
      {paths.map(p => (
        <g key={p.id}>
          <path d={p.d} fill="none" stroke="var(--anchor-line)" strokeWidth="1" strokeDasharray="2 3" />
          <circle cx={p.dot.x} cy={p.dot.y} r="3" fill="var(--anchor-dot)" />
        </g>
      ))}
    </svg>
  );
}

// Validation error panel — bottom-docked, calm, structured.
function ValidationPanel({ errors, onDismiss, onCopy }) {
  if (!errors || errors.length === 0) return null;
  return (
    <div className="validation-panel" onClick={(e) => e.stopPropagation()}>
      <div className="vp-head">
        <span className="vp-marker"></span>
        <span className="vp-title">{errors.length} validation issue{errors.length === 1 ? "" : "s"} in <code>ARCHITECTURE.md</code></span>
        <button className="vp-action" onClick={onCopy}>Copy summary</button>
        <button className="vp-action ghost" onClick={onDismiss}>Dismiss</button>
      </div>
      <ul className="vp-list">
        {errors.map((e, i) => (
          <li key={i} className="vp-item">
            <span className="vp-loc"><code>{e.file}:{e.line}:{e.col}</code></span>
            <span className="vp-msg">{e.message}</span>
            {e.hint && <span className="vp-hint">{e.hint}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Empty state for first-run / no ARCHITECTURE.md.
function EmptyState({ onOpenFolder, onCreateStarter, onShowRecent }) {
  return (
    <div className="empty-state">
      <div className="es-mark">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
          <rect x="8" y="8" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.2"/>
          <rect x="34" y="8" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.2"/>
          <rect x="21" y="34" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M15 22v6h13M41 22v6H28" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
        </svg>
      </div>
      <h1 className="es-title">There's no <code>ARCHITECTURE.md</code> here yet.</h1>
      <p className="es-sub">Arch Viewer reads a single file at the root of your repo. You can write it by hand, or ask your model to.</p>
      <div className="es-actions">
        <button className="es-btn primary" onClick={onOpenFolder}>Open folder <span className="kbd-inline">⌘O</span></button>
        <button className="es-btn" onClick={onCreateStarter}>Create starter file</button>
        <button className="es-btn ghost" onClick={onShowRecent}>Recent <span className="kbd-inline">⌘P</span></button>
      </div>
      <div className="es-hint">A starter file ships with a prompt block — paste the file plus the prompt into Claude and you'll get a first pass back.</div>
    </div>
  );
}

// Recent repos / Cmd-P palette.
function CommandPalette({ open, onClose, onPick, recents }) {
  const [q, setQ] = _useS("");
  const inputRef = _useR();
  _useE(() => { if (open) setTimeout(() => inputRef.current && inputRef.current.focus(), 30); }, [open]);
  if (!open) return null;
  const filtered = recents.filter(r => (r.name + r.path).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="palette-scrim" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="pal-search">
          <span className="pal-prompt">⌘</span>
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="Open a repo by name or path…" />
          <span className="pal-esc">esc</span>
        </div>
        <div className="pal-section">Recent</div>
        <ul className="pal-list">
          {filtered.map((r, i) => (
            <li key={i} className="pal-item" onClick={() => onPick(r)}>
              <span className="pal-name">{r.name}</span>
              <span className="pal-path">{r.path}</span>
              <span className="pal-when">{r.when}</span>
            </li>
          ))}
          {filtered.length === 0 && <li className="pal-empty">No matches. <button className="pal-link">Browse for folder…</button></li>}
        </ul>
        <div className="pal-foot">
          <span><span className="kbd">↑</span><span className="kbd">↓</span> move</span>
          <span><span className="kbd">↵</span> open</span>
          <span><span className="kbd">⌘</span><span className="kbd">O</span> browse</span>
        </div>
      </div>
    </div>
  );
}

// Bottom-right contextual keyboard hint strip. Fades in on idle.
function KeyHints({ hints }) {
  if (!hints || hints.length === 0) return null;
  return (
    <div className="key-hints">
      {hints.map((h, i) => (
        <span key={i} className="kh-item">
          {h.keys.map((k, j) => <span key={j} className="kbd">{k}</span>)}
          <span className="kh-label">{h.label}</span>
        </span>
      ))}
    </div>
  );
}

// Top chrome — "barely exists". Just app mark + breadcrumb area + summon-buttons.
function Topbar({ onOpenPalette, onToggleComments, onToggleErrors, hasErrors, hasComments }) {
  return (
    <div className="topbar">
      <div className="tb-left">
        <div className="app-mark" title="Arch Viewer">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1.5" y="1.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.1"/>
            <rect x="8.5" y="1.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.1"/>
            <rect x="5"   y="8.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.1"/>
            <path d="M3.5 5.5v1.5h3.5M10.5 5.5v1.5H7" stroke="currentColor" strokeWidth=".9"/>
          </svg>
        </div>
      </div>
      <div className="tb-center" id="tb-center-slot"></div>
      <div className="tb-right">
        <button className={"tb-btn" + (hasComments ? "" : " is-empty")} onClick={onToggleComments} title="Comments">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3h9v6H6l-3 2.5V9H2z" stroke="currentColor" strokeWidth="1"/></svg>
          {hasComments && <span className="tb-dot"></span>}
        </button>
        <button className={"tb-btn" + (hasErrors ? " is-warn" : "")} onClick={onToggleErrors} title="Validation">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1.5L12 11H1z" stroke="currentColor" strokeWidth="1"/></svg>
          {hasErrors && <span className="tb-dot warn"></span>}
        </button>
        <button className="tb-btn" onClick={onOpenPalette} title="Open repo (⌘P)">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 4h4l1.5 1.5h5.5V11H1z" stroke="currentColor" strokeWidth="1"/></svg>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { DetailPanel, CommentsDrawer, ValidationPanel, EmptyState, CommandPalette, KeyHints, Topbar });
