/* ORBIT — fast drawing canvas (iPad Notes style)
   Speed: two layers. The base layer holds finished strokes and is only fully repainted on undo/erase/resize.
   While you draw, only the new segments of the current stroke are painted on the live layer. */
const DCOLORS = ['#1c1c1e', '#007aff', '#ff3b30', '#34c759', '#ff9500', '#af52de', '#ffcc00', '#8e8e93'];
const DWIDTHS = [2, 4, 8];

function paintPaper(x, W, H, paper) {
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  if (!paper || paper === 'plain') return;
  x.save(); x.strokeStyle = '#d9dde5'; x.fillStyle = '#c3c8d2'; x.lineWidth = 1;
  const g = 40;
  if (paper === 'lines') for (let y = g * 2; y < H; y += g) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
  if (paper === 'grid') { x.beginPath(); for (let y = g; y < H; y += g) { x.moveTo(0, y); x.lineTo(W, y); } for (let X = g; X < W; X += g) { x.moveTo(X, 0); x.lineTo(X, H); } x.stroke(); }
  if (paper === 'dots') for (let y = g; y < H; y += g) for (let X = g; X < W; X += g) x.fillRect(X - 1.5, y - 1.5, 3, 3);
  x.restore();
}
const penW = (s, p) => s.t === 'pencil' ? s.w * (0.35 + 0.6 * p) : s.w * (0.4 + 0.9 * p);
function segPen(x, s, i) { // draw segment i (from point i-1 to i) of a pen/pencil stroke
  const p = s.p, a = p[i - 1], b = p[i];
  const m0 = i > 1 ? [(p[i - 2][0] + a[0]) / 2, (p[i - 2][1] + a[1]) / 2] : a, m1 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  x.lineWidth = penW(s, (a[2] + b[2]) / 2);
  x.beginPath(); x.moveTo(m0[0], m0[1]); x.quadraticCurveTo(a[0], a[1], m1[0], m1[1]); x.stroke();
}
function styleFor(x, s) { x.strokeStyle = x.fillStyle = s.c; x.lineCap = 'round'; x.lineJoin = 'round'; x.globalAlpha = s.t === 'pencil' ? .78 : 1; }
function paintStroke(x, s) {
  x.save(); styleFor(x, s);
  const p = s.p;
  if (s.t === 'pen' || s.t === 'pencil') {
    if (p.length === 1) { x.beginPath(); x.arc(p[0][0], p[0][1], penW(s, p[0][2]) / 2, 0, 7); x.fill(); }
    for (let i = 1; i < p.length; i++) segPen(x, s, i);
    if (p.length > 1) { const a = p[p.length - 2], b = p[p.length - 1]; x.beginPath(); x.moveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); x.lineTo(b[0], b[1]); x.stroke(); }
  } else if (s.t === 'hl') {
    x.globalAlpha = .32; x.globalCompositeOperation = 'multiply'; x.lineWidth = s.w * 3.2;
    x.beginPath(); p.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.stroke();
  } else if (s.t === 'text') {
    x.font = `600 ${s.size}px -apple-system, system-ui, Roboto, sans-serif`; x.textBaseline = 'top';
    String(s.text).split('\n').forEach((ln, i) => x.fillText(ln, p[0][0], p[0][1] + i * s.size * 1.25));
  } else if (p.length > 1) {
    const [a, b] = p; x.lineWidth = s.w; x.beginPath();
    if (s.t === 'line' || s.t === 'arrow') { x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); }
    if (s.t === 'rect') { const X = Math.min(a[0], b[0]), Y = Math.min(a[1], b[1]), w = Math.abs(b[0] - a[0]), h = Math.abs(b[1] - a[1]); x.roundRect ? x.roundRect(X, Y, w, h, 10) : x.rect(X, Y, w, h); }
    if (s.t === 'ellipse') x.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2 || 1, Math.abs(b[1] - a[1]) / 2 || 1, 0, 0, 7);
    x.stroke();
    if (s.t === 'arrow') { const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = 14 + s.w * 2.5; x.beginPath(); x.moveTo(b[0], b[1]); x.lineTo(b[0] - L * Math.cos(ang - .45), b[1] - L * Math.sin(ang - .45)); x.moveTo(b[0], b[1]); x.lineTo(b[0] - L * Math.cos(ang + .45), b[1] - L * Math.sin(ang + .45)); x.stroke(); }
  }
  x.restore();
}
function samplePts(s) {
  const p = s.p;
  if (s.t === 'pen' || s.t === 'pencil' || s.t === 'hl') return p;
  if (s.t === 'text') { const lines = String(s.text).split('\n'), w = s.size * .6 * Math.max(...lines.map(l => l.length)), h = s.size * 1.25 * lines.length, out = []; for (let i = 0; i <= 6; i++) for (let j = 0; j <= 3; j++) out.push([p[0][0] + w * i / 6, p[0][1] + h * j / 3]); return out; }
  if (p.length < 2) return p;
  const [a, b] = p, out = [];
  if (s.t === 'line' || s.t === 'arrow') for (let i = 0; i <= 30; i++) out.push([a[0] + (b[0] - a[0]) * i / 30, a[1] + (b[1] - a[1]) * i / 30]);
  if (s.t === 'rect') { const c = [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]], [a[0], a[1]]]; for (let k = 0; k < 4; k++) for (let i = 0; i <= 15; i++) out.push([c[k][0] + (c[k + 1][0] - c[k][0]) * i / 15, c[k][1] + (c[k + 1][1] - c[k][1]) * i / 15]); }
  if (s.t === 'ellipse') { const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, rx = Math.abs(b[0] - a[0]) / 2, ry = Math.abs(b[1] - a[1]) / 2; for (let i = 0; i < 48; i++) out.push([cx + rx * Math.cos(i / 48 * 6.283), cy + ry * Math.sin(i / 48 * 6.283)]); }
  return out;
}
function bboxOf(s) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of samplePts(s)) { if (q[0] < x0) x0 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[0] > x1) x1 = q[0]; if (q[1] > y1) y1 = q[1]; } const pad = (s.t === 'hl' ? s.w * 1.6 : s.w) + 2; return [x0 - pad, y0 - pad, x1 + pad, y1 + pad]; }
function inPoly(pt, poly) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) inside = !inside; } return inside; }
/* hold-to-snap: turn a hand-drawn stroke into a clean line, circle or box */
function snapShape(s) {
  const p = s.p; if (p.length < 6) return null;
  const xs = p.map(q => q[0]), ys = p.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const diag = Math.hypot(x1 - x0, y1 - y0); if (diag < 20) return null;
  const a = p[0], b = p[p.length - 1], closed = Math.hypot(a[0] - b[0], a[1] - b[1]) < diag * .25;
  if (!closed) return { t: s.t === 'pencil' ? 'line' : 'line', c: s.c, w: Math.max(2, s.w), p: [a.slice(0, 2), b.slice(0, 2)] };
  const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].filter(c => p.some(q => Math.hypot(q[0] - c[0], q[1] - c[1]) < diag * .12)).length;
  return { t: corners >= 3 ? 'rect' : 'ellipse', c: s.c, w: Math.max(2, s.w), p: [[x0, y0], [x1, y1]] };
}

/* Open the drawing editor. data: {strokesId, bgId, paper, W, H}. onDone({pngId, strokesId, paper, W, H, w, h}) */
const LOWEND = (navigator.deviceMemory && navigator.deviceMemory <= 3) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || /SM-T5|SM-T3|SM-P5|Android [5-9]\b/.test(navigator.userAgent);
async function openDraw(data, onDone) {
  data = data || {};
  let strokes = [];
  if (data.strokesId) { try { const b = await fileGet(data.strokesId); if (b) strokes = JSON.parse(await b.text()); } catch (e) { } }
  let bg = null;
  if (data.bgId) { bg = new Image(); bg.src = await fileURL(data.bgId); await new Promise(r => { bg.onload = r; bg.onerror = r; }); }
  let W = data.W || (bg ? Math.min(1800, bg.naturalWidth) : 1600);
  let H = data.H || (bg ? Math.round(W * bg.naturalHeight / bg.naturalWidth) : 1100);
  let paper = data.paper || (bg ? 'plain' : 'grid');
  let tool = 'pen', shape = 'line', color = DCOLORS[0], width = 4, pencilOnly = false, dirty = false;
  const undo = [], redo = [], BB = new WeakMap();
  const bb = s => { let v = BB.get(s); if (!v) { v = bboxOf(s); BB.set(s, v); } return v; };

  const el = document.createElement('div');
  el.className = 'draw';
  const toolBtn = (k, ic, label) => `<button class="dtool ${k === tool ? 'on' : ''}" data-tool="${k}" aria-label="${label}">${I(ic)}<span>${label}</span></button>`;
  el.innerHTML = `<div class="dtop">
      <button id="dCancel">Cancel</button>
      <div class="dtop-mid"><button class="iconbtn" id="dUndo" aria-label="Undo">${I('undo')}</button><button class="iconbtn" id="dRedo" aria-label="Redo">${I('redo')}</button></div>
      <div class="dtop-r"><select id="dPaper" aria-label="Paper"><option value="plain">Plain</option><option value="lines">Lines</option><option value="grid">Grid</option><option value="dots">Dots</option></select>
      <button id="dMore">${I('plus')} Page</button><button id="dPencil" aria-pressed="false">${I('pencil')} Pencil only</button><button id="dDone" class="btn-blue">Done</button></div></div>
    <div class="dstage" id="dStage"><div class="dlayers" id="dLayers"><canvas id="dBase"></canvas><canvas id="dLive"></canvas><div class="dsel" id="dSel" hidden><button id="dSelDel" aria-label="Delete selection">${I('trash')}</button></div></div></div>
    <div class="dpalette" id="dPal">
      ${toolBtn('pen', 'pen', 'Pen')}${toolBtn('pencil', 'pencil', 'Pencil')}${toolBtn('hl', 'marker', 'Marker')}${toolBtn('eraser', 'eraser', 'Eraser')}${toolBtn('lasso', 'lasso', 'Lasso')}${toolBtn('shape', 'shapes', 'Shapes')}${toolBtn('text', 'textT', 'Text')}
      <span class="dsep"></span>
      <div class="dwidths">${DWIDTHS.map(w => `<button class="dw ${w === width ? 'on' : ''}" data-w="${w}" aria-label="Width ${w}"><i style="width:${4 + w * 1.6}px;height:${4 + w * 1.6}px"></i></button>`).join('')}</div>
      <span class="dsep"></span>
      <div class="dcolors">${DCOLORS.map((c, i) => `<button class="sw ${i ? '' : 'on'}" data-c="${c}" style="background:${c}" aria-label="colour ${c}"></button>`).join('')}<label class="sw custom" aria-label="Custom colour"><input type="color" id="dCustom" value="#5856d6"></label></div>
    </div>`;
  document.body.appendChild(el);
  document.body.style.overflow = 'hidden'; document.body.classList.add('drawing'); if (LOWEND) el.classList.add('lowend');
  const base = $('#dBase', el), live = $('#dLive', el), stage = $('#dStage', el), layers = $('#dLayers', el), selBox = $('#dSel', el);
  const bx = base.getContext('2d', { alpha: false });
  const lx = live.getContext('2d');
  $('#dPaper', el).value = paper; if (bg) $('#dMore', el).style.display = 'none';
  let scale = 1, dpr = 1, cur = null, drawn = 0, sel = null, holdT = null, lastMove = null, raf = 0;

  function size() {
    const cssW = Math.min(stage.clientWidth - 24, W); dpr = LOWEND ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    scale = cssW / W;
    for (const c of [base, live]) { c.style.width = cssW + 'px'; c.style.height = Math.round(H * scale) + 'px'; c.width = Math.round(cssW * dpr); c.height = Math.round(H * scale * dpr); }
    layers.style.width = cssW + 'px'; layers.style.height = Math.round(H * scale) + 'px';
    for (const x of [bx, lx]) x.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    renderBase();
  }
  function renderBase(skip) {
    paintPaper(bx, W, H, paper); if (bg) bx.drawImage(bg, 0, 0, W, H);
    for (const s of strokes) if (!skip || !skip.has(s)) paintStroke(bx, s);
  }
  const showLive = on => { live.style.display = on ? 'block' : 'none'; };
  const clearLive = () => { lx.save(); lx.setTransform(1, 0, 0, 1, 0, 0); lx.clearRect(0, 0, live.width, live.height); lx.restore(); };
  const snap = () => { undo.push(strokes.slice()); if (undo.length > 100) undo.shift(); redo.length = 0; dirty = true; };
  const pos = e => { const r = layers.getBoundingClientRect(); return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale, e.pointerType === 'pen' ? (e.pressure || .5) : .5]; };

  /* live painting — only what changed */
  function paintLive() {
    if (!cur) return;
    if (cur.t === 'pen' || cur.t === 'pencil') {
      bx.save(); styleFor(bx, cur);
      if (cur.p.length === 1 && drawn === 0) { bx.beginPath(); bx.arc(cur.p[0][0], cur.p[0][1], penW(cur, cur.p[0][2]) / 2, 0, 7); bx.fill(); drawn = 1; }
      for (let i = Math.max(1, drawn); i < cur.p.length; i++) segPen(bx, cur, i);
      drawn = cur.p.length; bx.restore();
    } else { showLive(true); clearLive(); paintStroke(lx, cur); }
  }
  function commit(s) { snap(); strokes.push(s); paintStroke(bx, s); clearLive(); showLive(false); }
  function commitPen(s) { // already painted on the base while drawing; just add the tail
    snap(); strokes.push(s);
    const p = s.p; if (p.length > 1) { bx.save(); styleFor(bx, s); const a = p[p.length - 2], b = p[p.length - 1]; bx.lineWidth = penW(s, b[2]); bx.beginPath(); bx.moveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); bx.lineTo(b[0], b[1]); bx.stroke(); bx.restore(); }
  }
  function eraseAt(pt) {
    const R = 12 / scale, hit = strokes.filter(s => { const b = bb(s); if (pt[0] < b[0] - R || pt[0] > b[2] + R || pt[1] < b[1] - R || pt[1] > b[3] + R) return false; return samplePts(s).some(q => Math.hypot(q[0] - pt[0], q[1] - pt[1]) < R + s.w / 2); });
    if (hit.length) { const h = new Set(hit); strokes = strokes.filter(s => !h.has(s)); renderBase(); }
    showLive(true); clearLive(); lx.save(); lx.strokeStyle = 'rgba(0,0,0,.35)'; lx.lineWidth = 1 / scale; lx.beginPath(); lx.arc(pt[0], pt[1], R, 0, 7); lx.stroke(); lx.restore();
  }
  /* lasso selection */
  function showSel() {
    if (!sel || !sel.items.length) { selBox.hidden = true; return; }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; sel.items.forEach(s => { const b = bboxOf(s); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); });
    sel.box = [x0, y0, x1, y1]; selBox.hidden = false;
    Object.assign(selBox.style, { left: x0 * scale + 'px', top: y0 * scale + 'px', width: (x1 - x0) * scale + 'px', height: (y1 - y0) * scale + 'px' });
  }
  function clearSel() { if (sel && sel.moving) return; if (!sel) return; sel = null; selBox.hidden = true; clearLive(); showLive(false); }

  let erasing = false, lassoPath = null, dragFrom = null;
  layers.addEventListener('pointerdown', e => {
    if (e.pointerType === 'pen' && !pencilOnly) { pencilOnly = true; $('#dPencil', el).classList.add('on'); layers.style.touchAction = 'pan-x pan-y'; toast('Stylus detected — fingers scroll, the pen draws'); }
    if (pencilOnly && e.pointerType === 'touch') return;
    e.preventDefault(); try { layers.setPointerCapture(e.pointerId); } catch (x) { }
    const pt = pos(e);
    if (sel && sel.box && tool === 'lasso' && pt[0] >= sel.box[0] && pt[0] <= sel.box[2] && pt[1] >= sel.box[1] && pt[1] <= sel.box[3]) {
      snap(); sel.items = sel.items.map(s => { const c = JSON.parse(JSON.stringify(s)); strokes[strokes.indexOf(s)] = c; return c; });
      dragFrom = pt; sel.moving = true; renderBase(new Set(sel.items)); showLive(true); clearLive(); sel.items.forEach(s => paintStroke(lx, s)); return;
    }
    if (sel) clearSel();
    if (tool === 'text') { textAt(e.clientX, e.clientY, pt); return; }
    if (tool === 'eraser') { snap(); erasing = true; eraseAt(pt); return; }
    if (tool === 'lasso') { lassoPath = [pt]; showLive(true); return; }
    const t = tool === 'shape' ? shape : tool;
    cur = { t, c: color, w: t === 'hl' ? width + 2 : width, p: (t === 'pen' || t === 'pencil' || t === 'hl') ? [pt] : [pt, pt.slice()] };
    drawn = 0; clearLive(); paintLive(); lastMove = pt; armHold();
  });
  layers.addEventListener('pointermove', e => {
    if (pencilOnly && e.pointerType === 'touch') return;
    if (erasing) { eraseAt(pos(e)); return; }
    if (dragFrom && sel) { const pt = pos(e), dx = pt[0] - dragFrom[0], dy = pt[1] - dragFrom[1]; dragFrom = pt; sel.items.forEach(s => { s.p.forEach(q => { q[0] += dx; q[1] += dy; }); BB.delete(s); }); clearLive(); sel.items.forEach(s => paintStroke(lx, s)); showSel(); return; }
    if (lassoPath) { lassoPath.push(pos(e)); clearLive(); lx.save(); lx.setLineDash([6 / scale, 6 / scale]); lx.strokeStyle = '#007aff'; lx.lineWidth = 1.5 / scale; lx.beginPath(); lassoPath.forEach((q, i) => i ? lx.lineTo(q[0], q[1]) : lx.moveTo(q[0], q[1])); lx.stroke(); lx.restore(); return; }
    if (!cur) return;
    let evs = e.getCoalescedEvents ? e.getCoalescedEvents() : []; if (!evs.length) evs = [e];
    if (cur.t === 'pen' || cur.t === 'pencil' || cur.t === 'hl') { for (const ev of evs) { const q = pos(ev), l = cur.p[cur.p.length - 1]; if (Math.hypot(q[0] - l[0], q[1] - l[1]) > .6) cur.p.push(q); } }
    else cur.p[1] = pos(e);
    const q = cur.p[cur.p.length - 1]; if (Math.hypot(q[0] - lastMove[0], q[1] - lastMove[1]) > 4 / scale) { lastMove = q; armHold(); }
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; paintLive(); });
  });
  function armHold() { clearTimeout(holdT); if (!cur || (cur.t !== 'pen' && cur.t !== 'pencil')) return; holdT = setTimeout(() => { if (!cur) return; const sh = snapShape(cur); if (sh) { cur = sh; drawn = 0; renderBase(); showLive(true); clearLive(); paintStroke(lx, cur); } }, 600); }
  const end = () => {
    clearTimeout(holdT);
    if (erasing) { erasing = false; clearLive(); showLive(false); return; }
    if (dragFrom && sel) { dragFrom = null; sel.moving = false; renderBase(); clearLive(); showLive(false); showSel(); return; }
    if (lassoPath) { const poly = lassoPath; lassoPath = null; clearLive(); if (poly.length > 3) { const items = strokes.filter(s => samplePts(s).some(q => inPoly(q, poly))); if (items.length) { sel = { items }; showSel(); } } showLive(false); return; }
    if (!cur) return;
    if (raf) { cancelAnimationFrame(raf); raf = 0; paintLive(); }
    const s = cur; cur = null; drawn = 0;
    if (s.t === 'pen' || s.t === 'pencil') commitPen(s); else commit(s);
  };
  layers.addEventListener('pointerup', end); layers.addEventListener('pointercancel', end);
  $('#dSelDel', el).onclick = () => { if (!sel) return; snap(); const h = new Set(sel.items); strokes = strokes.filter(s => !h.has(s)); sel = null; selBox.hidden = true; renderBase(); clearLive(); };

  function textAt(cx, cy, pt) {
    const inp = document.createElement('textarea');
    inp.className = 'dtext'; inp.rows = 1; inp.dir = 'auto'; inp.style.left = cx + 'px'; inp.style.top = (cy - 18) + 'px'; inp.style.color = color;
    document.body.appendChild(inp); setTimeout(() => inp.focus(), 30);
    const fin = () => { const t = inp.value.trim(); inp.remove(); if (t) commit({ t: 'text', c: color, w: width, size: 16 + width * 3, text: t, p: [pt] }); };
    inp.addEventListener('blur', fin);
    inp.addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); inp.blur(); } if (ev.key === 'Escape') { inp.value = ''; inp.blur(); } });
  }
  function setTool(t) { tool = t; $$('.dtool', el).forEach(b => b.classList.toggle('on', b.dataset.tool === t)); if (t !== 'lasso') clearSel(); }
  $('#dPal', el).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tool === 'shape') {
      setTool('shape');
      popover(b, `<div class="lbl">Shape</div>${[['line', 'Line'], ['arrow', 'Arrow'], ['rect', 'Box'], ['ellipse', 'Circle']].map(s => `<button data-sh="${s[0]}" class="${shape === s[0] ? 'sel' : ''}">${s[1]}</button>`).join('')}<div class="lbl">Tip: with the pen, hold at the end of a stroke to snap it into a clean shape.</div>`, (ev) => { const x = ev.target.closest('[data-sh]'); if (x) { shape = x.dataset.sh; closeMenu(); } });
      return;
    }
    if (b.dataset.tool) setTool(b.dataset.tool);
    if (b.dataset.w) { width = +b.dataset.w; $$('.dw', el).forEach(x => x.classList.toggle('on', x === b)); }
    if (b.dataset.c) { color = b.dataset.c; $$('.dcolors .sw', el).forEach(x => x.classList.toggle('on', x === b)); if (tool === 'eraser' || tool === 'lasso') setTool('pen'); }
  });
  $('#dCustom', el).oninput = e => { color = e.target.value; $$('.dcolors .sw', el).forEach(x => x.classList.toggle('on', x.classList.contains('custom'))); if (tool === 'eraser' || tool === 'lasso') setTool('pen'); };
  $('#dUndo', el).onclick = () => { if (!undo.length) return; redo.push(strokes.slice()); strokes = undo.pop(); clearSel(); renderBase(); };
  $('#dRedo', el).onclick = () => { if (!redo.length) return; undo.push(strokes.slice()); strokes = redo.pop(); clearSel(); renderBase(); };
  $('#dPaper', el).onchange = e => { paper = e.target.value; dirty = true; renderBase(); };
  $('#dMore', el).onclick = () => { H += 700; dirty = true; size(); stage.scrollTop = stage.scrollHeight; };
  $('#dPencil', el).onclick = () => { pencilOnly = !pencilOnly; $('#dPencil', el).classList.toggle('on', pencilOnly); layers.style.touchAction = pencilOnly ? 'pan-x pan-y' : 'none'; };
  showLive(false);
  let rt; const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(size, 60); }); ro.observe(stage); size();
  const keys = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); (e.shiftKey ? $('#dRedo', el) : $('#dUndo', el)).click(); } if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !e.target.closest('textarea')) $('#dSelDel', el).click(); };
  document.addEventListener('keydown', keys);
  const close = () => { ro.disconnect(); document.removeEventListener('keydown', keys); el.remove(); document.body.style.overflow = ''; document.body.classList.remove('drawing'); };
  $('#dCancel', el).onclick = () => { if (dirty && !el._sure) { el._sure = 1; toast('Tap Cancel again to discard changes'); return; } close(); };
  $('#dDone', el).onclick = async () => {
    const out = document.createElement('canvas'), k = Math.min(1, 2000 / W);
    out.width = Math.round(W * k); out.height = Math.round(H * k);
    const ox = out.getContext('2d'); ox.scale(k, k);
    paintPaper(ox, W, H, paper); if (bg) ox.drawImage(bg, 0, 0, W, H); strokes.forEach(s => paintStroke(ox, s));
    const png = await new Promise(r => out.toBlob(r, 'image/png'));
    const pngId = 'f_' + uid(), strokesId = 'f_' + uid();
    await filePut(pngId, png);
    await filePut(strokesId, new Blob([JSON.stringify(strokes)], { type: 'application/json' }));
    close();
    onDone && onDone({ pngId, strokesId, paper, W, H, w: out.width, h: out.height });
  };
}
