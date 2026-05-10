// Main app — state machine, keyboard, transition orchestration.

const { useState: _uS, useEffect: _uE, useRef: _uR, useMemo: _uM, useCallback: _uC, useLayoutEffect: _uL } = React;

const T = window.TRADERANK;

const RECENT_REPOS = [
  { name: "traderank",     path: "~/code/traderank",                  when: "now" },
  { name: "ledger-monorepo",path: "~/work/ledger",                     when: "yesterday" },
  { name: "claude-skills", path: "~/code/claude-skills",              when: "3d ago" },
  { name: "om-design",     path: "~/work/om-design",                  when: "1w ago" },
  { name: "harness",       path: "~/personal/harness",                when: "2w ago" }
];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "transitionStyle": "appleMaps",
  "density": "spacious",
  "commentMode": "drawer",
  "themeAccent": "violet",
  "showLegend": false,
  "edgeLabels": "on-hover"
}/*EDITMODE-END*/;

const ACCENT_PRESETS = {
  violet: { h: 270, name: "violet" },
  amber:  { h: 50,  name: "amber" },
  cyan:   { h: 195, name: "cyan" },
  rose:   { h: 12,  name: "rose" }
};

function App() {
  // Edit/tweaks state — useTweaks returns [values, setTweak]
  const _tweaksHook = window.useTweaks ? window.useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, () => {}];
  const t = _tweaksHook[0];
  const setTweak = _tweaksHook[1];

  _uE(() => {
    document.documentElement.style.setProperty("--accent-h", ACCENT_PRESETS[t.themeAccent].h);
    document.documentElement.dataset.density = t.density;
    document.documentElement.dataset.transition = t.transitionStyle;
  }, [t.themeAccent, t.density, t.transitionStyle]);

  // App-mode state
  const [mode, setMode] = _uS("loaded"); // 'empty' | 'loaded'
  const [paletteOpen, setPaletteOpen] = _uS(false);
  const [commentsOpen, setCommentsOpen] = _uS(false);
  const [errorsOpen, setErrorsOpen] = _uS(false);
  const [showHints, setShowHints] = _uS(true);

  // Diagram state
  const [pathIds, setPathIds] = _uS(["traderank"]); // breadcrumb path
  const [selectedId, setSelectedId] = _uS(null);
  const [hoverId, setHoverId] = _uS(null);
  const [hoverAnchor, setHoverAnchor] = _uS(null);

  // Transition state
  const [transition, setTransition] = _uS(null); // {phase, fromLevelId, toLevelId, clickedNode}
  const [viewport, setViewport] = _uS({ w: 1200, h: 800 });
  const canvasRef = _uR();

  // Node position overrides — persisted across reloads, scoped per level/node.
  // Stored as { "<levelId>::<nodeId>": { x, y } }.
  const [nodeOverrides, setNodeOverrides] = _uS(() => {
    try { return JSON.parse(localStorage.getItem("archviewer.nodePos") || "{}"); }
    catch { return {}; }
  });
  _uE(() => {
    try { localStorage.setItem("archviewer.nodePos", JSON.stringify(nodeOverrides)); } catch {}
  }, [nodeOverrides]);
  const setNodePos = _uC((levelId, nodeId, x, y) => {
    setNodeOverrides(prev => ({ ...prev, [levelId + "::" + nodeId]: { x, y } }));
  }, []);
  const resetNodePositions = _uC(() => {
    setNodeOverrides({});
  }, []);

  // Apply overrides to a level's nodes.
  const applyOverrides = _uC((levelId) => {
    const lvl = T.levels[levelId];
    if (!lvl) return null;
    const has = Object.keys(nodeOverrides).some(k => k.startsWith(levelId + "::"));
    if (!has) return lvl;
    return {
      ...lvl,
      nodes: lvl.nodes.map(n => {
        const o = nodeOverrides[levelId + "::" + n.id];
        return o ? { ...n, x: o.x, y: o.y } : n;
      })
    };
  }, [nodeOverrides]);

  // Per-level pan offset — right-click-drag on the canvas to pan around when
  // the diagram exceeds the viewport. Held in memory, per level.
  const [panByLevel, setPanByLevel] = _uS({});

  _uL(() => {
    function measure() {
      if (!canvasRef.current) return;
      const r = canvasRef.current.getBoundingClientRect();
      setViewport({ w: r.width, h: r.height });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const currentLevelId = pathIds.join(".");
  const currentLevel = applyOverrides(currentLevelId);
  const baseFitT = currentLevel ? fitTransform(currentLevel.bounds.w, currentLevel.bounds.h, viewport.w, viewport.h) : null;
  const pan = panByLevel[currentLevelId] || { x: 0, y: 0 };
  const fitT = baseFitT ? { ...baseFitT, tx: baseFitT.tx + pan.x, ty: baseFitT.ty + pan.y } : null;
  const setPan = (levelId, x, y) => setPanByLevel(prev => ({ ...prev, [levelId]: { x, y } }));
  const resetPan = () => setPanByLevel(prev => ({ ...prev, [currentLevelId]: { x: 0, y: 0 } }));

  // Right-click + drag on canvas host to pan.
  const startPan = (e) => {
    if (e.button !== 2) return;
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const origin = pan;
    document.body.style.cursor = "grabbing";
    const onMove = (ev) => {
      setPan(currentLevelId, origin.x + (ev.clientX - startX), origin.y + (ev.clientY - startY));
    };
    const swallowMenu = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      // Detach context-menu suppressor on next tick
      setTimeout(() => document.removeEventListener("contextmenu", swallowMenu, true), 0);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("contextmenu", swallowMenu, true);
  };
  const levelComments = T.comments.filter(c => c.levelId === currentLevelId);
  const selectedNode = currentLevel && selectedId
    ? currentLevel.nodes.find(n => n.id === selectedId)
    : null;

  const drillIn = _uC((node) => {
    if (!node || !node.hasChildren) return;
    const newPath = [...pathIds, node.id];
    const newId = newPath.join(".");
    if (!T.levels[newId]) return;
    setTransition({
      phase: "in",
      from: currentLevelId,
      to: newId,
      clickedNode: node,
      ts: Date.now()
    });
    setHoverId(null); setHoverAnchor(null); setSelectedId(null);
    // After animation duration, swap path and clear transition.
    setTimeout(() => {
      setPathIds(newPath);
      setTransition(null);
    }, 620);
  }, [pathIds, currentLevelId]);

  const drillOut = _uC(() => {
    if (pathIds.length <= 1) return;
    const newPath = pathIds.slice(0, -1);
    const newId = newPath.join(".");
    const exitingNodeId = pathIds[pathIds.length - 1];
    const parentLevel = T.levels[newId];
    const exitingNode = parentLevel ? parentLevel.nodes.find(n => n.id === exitingNodeId) : null;
    setTransition({
      phase: "out",
      from: currentLevelId,
      to: newId,
      clickedNode: exitingNode,
      ts: Date.now()
    });
    setSelectedId(null);
    setTimeout(() => {
      setPathIds(newPath);
      setSelectedId(exitingNodeId);
      setTransition(null);
    }, 620);
  }, [pathIds, currentLevelId]);

  const jumpTo = _uC((depth) => {
    if (depth >= pathIds.length) return;
    const newPath = pathIds.slice(0, depth + 1);
    setPathIds(newPath);
    setSelectedId(null);
  }, [pathIds]);

  // Keyboard
  _uE(() => {
    function handler(e) {
      // ignore in inputs
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (e.metaKey || e.ctrlKey) {
        if (e.key.toLowerCase() === "p") { e.preventDefault(); setPaletteOpen(true); return; }
        if (e.key.toLowerCase() === "o") { e.preventDefault(); setPaletteOpen(true); return; }
        if (e.shiftKey && e.key.toLowerCase() === "c") { e.preventDefault(); flashToast("Context pack copied to clipboard"); return; }
      }
      if (e.key === "Escape") {
        if (paletteOpen) { setPaletteOpen(false); return; }
        if (commentsOpen) { setCommentsOpen(false); return; }
        if (selectedId) { setSelectedId(null); return; }
        if (pathIds.length > 1) { drillOut(); return; }
      }
      if (e.key === "Enter") {
        if (selectedNode && selectedNode.hasChildren) { drillIn(selectedNode); return; }
      }
      if (e.key === "Tab") {
        e.preventDefault();
        if (selectedId) setSelectedId(null);
        else if (currentLevel && currentLevel.nodes[0]) setSelectedId(currentLevel.nodes[0].id);
      }
      if (e.key === "ArrowLeft" || e.key === "h") {
        if (selectedId) cycleSel(-1); else if (pathIds.length > 1) drillOut();
      }
      if (e.key === "ArrowRight" || e.key === "l") {
        if (selectedNode && selectedNode.hasChildren) drillIn(selectedNode);
        else cycleSel(1);
      }
      if (e.key === "ArrowUp" || e.key === "k") cycleSel(-1);
      if (e.key === "ArrowDown" || e.key === "j") cycleSel(1);
      if (e.key === "/") { e.preventDefault(); setPaletteOpen(true); }
    }
    function cycleSel(dir) {
      if (!currentLevel) return;
      const ns = currentLevel.nodes;
      if (!selectedId) { setSelectedId(ns[0].id); return; }
      const idx = ns.findIndex(n => n.id === selectedId);
      const nx = (idx + dir + ns.length) % ns.length;
      setSelectedId(ns[nx].id);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, selectedNode, currentLevel, pathIds, commentsOpen, paletteOpen, drillIn, drillOut]);

  // Toast
  const [toast, setToast] = _uS(null);
  function flashToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  // Compute stage transforms for the current transition.
  const stageTransforms = _uM(() => {
    if (!fitT) return { current: null };
    if (!transition) return { current: { ...fitT, transitionMs: 0 } };
    const fromLevel = applyOverrides(transition.from);
    const toLevel = applyOverrides(transition.to);
    const fromFit = fitTransform(fromLevel.bounds.w, fromLevel.bounds.h, viewport.w, viewport.h);
    const toFit = fitTransform(toLevel.bounds.w, toLevel.bounds.h, viewport.w, viewport.h);
    if (transition.phase === "in") {
      // outgoing parent zooms toward clicked node filling viewport
      const out = nodeFillsTransform(transition.clickedNode, viewport.w, viewport.h, 1.05);
      return {
        from: { transform: out, transitionMs: 620, opacity: 0 },
        to:   { transform: { s: toFit.s * 0.78, tx: toFit.tx + toFit.s*0.11*toLevel.bounds.w, ty: toFit.ty + toFit.s*0.11*toLevel.bounds.h }, transitionMs: 0, opacity: 0, _initial: true }
      };
    } else if (transition.phase === "out") {
      // outgoing child shrinks back into the parent's location
      // figure where parent's clickedNode is in the parent canvas, then where THAT lands in screen space at parent fit.
      const node = transition.clickedNode;
      // Scale so child bounds fit into the node's screen rect.
      const screenNW = node.w * toFit.s;
      const screenNH = node.h * toFit.s;
      const childFromLevel = applyOverrides(transition.from);
      const sChild = Math.min(screenNW / childFromLevel.bounds.w, screenNH / childFromLevel.bounds.h) * 0.9;
      const cx = toFit.tx + (node.x + node.w/2) * toFit.s;
      const cy = toFit.ty + (node.y + node.h/2) * toFit.s;
      return {
        from: { transform: { s: sChild, tx: cx - childFromLevel.bounds.w*sChild/2, ty: cy - childFromLevel.bounds.h*sChild/2 }, transitionMs: 620, opacity: 0 },
        to:   { transform: { s: toFit.s * 1.18, tx: toFit.tx - toFit.s*0.09*toLevel.bounds.w, ty: toFit.ty - toFit.s*0.09*toLevel.bounds.h }, transitionMs: 0, opacity: 0, _initial: true }
      };
    }
    return { current: { ...fitT, transitionMs: 0 } };
  }, [transition, fitT, viewport]);

  // Two-stage rendering during transition
  const [incomingArmed, setIncomingArmed] = _uS(false);
  _uE(() => {
    if (!transition) { setIncomingArmed(false); return; }
    setIncomingArmed(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setIncomingArmed(true)));
  }, [transition]);

  // For anchor lines: convert canvas-coord rect → viewport-coord rect.
  const getNodeRect = _uC((nodeId) => {
    if (!currentLevel || !fitT || !canvasRef.current) return null;
    const n = currentLevel.nodes.find(x => x.id === nodeId);
    if (!n) return null;
    const cr = canvasRef.current.getBoundingClientRect();
    return {
      left: cr.left + fitT.tx + n.x * fitT.s,
      top: cr.top + fitT.ty + n.y * fitT.s,
      right: cr.left + fitT.tx + (n.x + n.w) * fitT.s,
      bottom: cr.top + fitT.ty + (n.y + n.h) * fitT.s,
      width: n.w * fitT.s,
      height: n.h * fitT.s
    };
  }, [currentLevel, fitT]);

  // Hover anchor for thumbnail
  function handleNodeEnter(node) {
    setHoverId(node.id);
    if (node.hasChildren && canvasRef.current) {
      const cr = canvasRef.current.getBoundingClientRect();
      setHoverAnchor({
        left: cr.left + fitT.tx + node.x * fitT.s,
        top: cr.top + fitT.ty + node.y * fitT.s,
        width: node.w * fitT.s,
        height: node.h * fitT.s
      });
    }
  }
  function handleNodeLeave() { setHoverId(null); setHoverAnchor(null); }

  // Contextual hints
  const hints = _uM(() => {
    if (mode === "empty") return [];
    if (paletteOpen || commentsOpen) return [];
    if (selectedId) {
      const out = [{ keys: ["esc"], label: "deselect" }, { keys: ["tab"], label: "panel" }];
      if (selectedNode && selectedNode.hasChildren) out.unshift({ keys: ["↵"], label: "drill in" });
      return out;
    }
    if (pathIds.length > 1) return [
      { keys: ["esc"], label: "ascend" },
      { keys: ["/"], label: "find" },
      { keys: ["⌘P"], label: "open" }
    ];
    return [
      { keys: ["⏎"], label: "drill" },
      { keys: ["/"], label: "find" },
      { keys: ["⌘P"], label: "open" }
    ];
  }, [mode, selectedId, selectedNode, pathIds, paletteOpen, commentsOpen]);

  return (
    <div className="app" data-screen-label="Arch Viewer">
      <Topbar
        onOpenPalette={() => setPaletteOpen(true)}
        onToggleComments={() => setCommentsOpen(o => !o)}
        onToggleErrors={() => setErrorsOpen(o => !o)}
        hasErrors={errorsOpen}
        hasComments={levelComments.length > 0}
      />

      {mode === "loaded" && currentLevel && (
        <Breadcrumb pathIds={pathIds} system={T} onJump={jumpTo} onBack={drillOut} />
      )}

      <div className="canvas-host" ref={canvasRef}
           onClick={() => setSelectedId(null)}
           onMouseDown={startPan}
           onContextMenu={(e) => e.preventDefault()}>
        {mode === "empty" && (
          <EmptyState
            onOpenFolder={() => { setPaletteOpen(true); }}
            onCreateStarter={() => { setMode("loaded"); flashToast("Wrote ARCHITECTURE.md (starter)"); }}
            onShowRecent={() => setPaletteOpen(true)}
          />
        )}

        {mode === "loaded" && currentLevel && (
          <>
            {/* Outgoing (during transition) */}
            {transition && (
              <Stage
                key={"from-" + transition.ts}
                level={applyOverrides(transition.from)}
                selectedId={null}
                hoverPreviewId={null}
                dimAll={false}
                hasFocus={false}
                onNodeClick={() => {}}
                onNodeEnter={() => {}}
                onNodeLeave={() => {}}
                transform={stageTransforms.from.transform}
                transitionMs={stageTransforms.from.transitionMs}
                layerName="outgoing"
              />
            )}
            {/* Incoming-during-transition OR steady-state */}
            <Stage
              key={"to-" + (transition ? transition.ts + "-in" : currentLevelId)}
              level={transition ? applyOverrides(transition.to) : currentLevel}
              selectedId={transition ? null : selectedId}
              hoverPreviewId={transition ? null : hoverId}
              dimAll={!!transition}
              hasFocus={!transition}
              onNodeClick={(n) => { setSelectedId(n.id); }}
              onNodeEnter={handleNodeEnter}
              onNodeLeave={handleNodeLeave}
              onDrillIn={drillIn}
              onNodeDragMove={(n, x, y) => setNodePos(currentLevelId, n.id, x, y)}
              onNodeDragEnd={(n, x, y) => setNodePos(currentLevelId, n.id, x, y)}
              transform={
                transition
                  ? (incomingArmed
                      ? fitTransform(applyOverrides(transition.to).bounds.w, applyOverrides(transition.to).bounds.h, viewport.w, viewport.h)
                      : stageTransforms.to.transform)
                  : fitT
              }
              transitionMs={transition ? (incomingArmed ? 620 : 0) : 0}
              layerName={transition ? "incoming" : "current"}
            />
          </>
        )}

        {/* Hover thumbnail */}
        {!transition && hoverId && hoverAnchor && currentLevel && (() => {
          const n = currentLevel.nodes.find(x => x.id === hoverId);
          if (!n || !n.hasChildren) return null;
          const childKey = currentLevelId + "." + n.id;
          if (!T.levels[childKey]) return null;
          return <HoverThumbnail levels={T.levels} parentId={childKey} anchorRect={hoverAnchor} />;
        })()}

        {/* Detail panel */}
        {!transition && selectedNode && (
          <DetailPanel
            node={selectedNode}
            comments={levelComments}
            onClose={() => setSelectedId(null)}
            onOpenComments={() => setCommentsOpen(true)}
            onDrillIn={drillIn}
            onCopyContext={() => flashToast("Context pack copied")}
          />
        )}

        {/* Comments drawer */}
        {!transition && (
          <CommentsDrawer
            open={commentsOpen && t.commentMode === "drawer"}
            comments={levelComments}
            levelNodes={currentLevel ? currentLevel.nodes : []}
            onClose={() => setCommentsOpen(false)}
            viewport={viewport}
            getNodeRect={getNodeRect}
            onJumpNode={(n) => { setSelectedId(n.id); }}
          />
        )}

        {/* Validation panel */}
        <ValidationPanel
          errors={errorsOpen ? T.sampleErrors : null}
          onDismiss={() => setErrorsOpen(false)}
          onCopy={() => flashToast("Validation summary copied")}
        />

        {/* Keyboard hints */}
        {showHints && !transition && <KeyHints hints={hints} />}

        {/* Toast */}
        {toast && <div className="toast">{toast}</div>}
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onPick={(r) => { setPaletteOpen(false); setMode("loaded"); flashToast("Opened " + r.name); }}
        recents={RECENT_REPOS}
      />

      {/* Tweaks panel */}
      {window.TweaksPanel && (
        <window.TweaksPanel title="Tweaks">
          <window.TweakSection title="Theme">
            <window.TweakRadio label="Accent" value={t.themeAccent} options={[
              { value: "violet", label: "violet" },
              { value: "amber",  label: "amber" },
              { value: "cyan",   label: "cyan" }
            ]} onChange={(v) => setTweak("themeAccent", v)} />
            <window.TweakRadio label="Density" value={t.density} options={[
              { value: "spacious", label: "spacious" },
              { value: "compact",  label: "compact" }
            ]} onChange={(v) => setTweak("density", v)} />
          </window.TweakSection>
          <window.TweakSection title="Drill-down transition">
            <window.TweakRadio label="Style" value={t.transitionStyle} options={[
              { value: "appleMaps", label: "Apple Maps" },
              { value: "pushPop",   label: "Push / pop" },
              { value: "matchMove", label: "Match-move" }
            ]} onChange={(v) => setTweak("transitionStyle", v)} />
          </window.TweakSection>
          <window.TweakSection title="Comments">
            <window.TweakRadio label="Mode" value={t.commentMode} options={[
              { value: "drawer",    label: "drawer" },
              { value: "marginalia",label: "margin" },
              { value: "off",       label: "off" }
            ]} onChange={(v) => setTweak("commentMode", v)} />
          </window.TweakSection>
          <window.TweakSection title="Demo states">
            <window.TweakButton label="Show empty / first-run" onClick={() => setMode(m => m === "empty" ? "loaded" : "empty")} />
            <window.TweakButton label="Show validation errors" onClick={() => setErrorsOpen(o => !o)} />
            <window.TweakButton label="Open command palette" onClick={() => setPaletteOpen(true)} />
            <window.TweakButton label="Reset view" onClick={() => { setPathIds(["traderank"]); setSelectedId(null); setCommentsOpen(false); setErrorsOpen(false); }} />
            <window.TweakButton label="Reset node positions" onClick={resetNodePositions} />
            <window.TweakButton label="Recenter view" onClick={resetPan} />
          </window.TweakSection>
        </window.TweaksPanel>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
