/* ORBIT — editable study plans, Apple-style onboarding, erase all data */
const WDN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* ---------- templates (built from the original plans) ---------- */
function planTemplates() {
  const st = (title, detail, len, unit) => ({ id: 's' + uid(), title, detail: detail || '', len: len || 1, unit: unit || 'w' });
  return {
    nclex: { name: 'NCLEX-RN · 12-month plan', course: 'nclex', mode: 'sequence', steps: [
      st('Setup & baseline', '10–15 questions a day · read the NCLEX-RN test plan · baseline test', 6),
      ...NCLEX_P1.map((t, i) => st('Foundation · week ' + (i + 1), '15–25 untimed questions · ' + t, 1)),
      ...NCLEX_P2.map((t, i) => st('System review · week ' + (i + 1), '30–50 questions · ' + t, 1)),
      st('Question bank', '75 timed mixed questions a day · readiness test every 2 weeks', 10),
      st('Final readiness', '75–100 questions on weak topics · full simulations', 7)] },
    oph: { name: 'Ophthalmology · 12 weeks', course: 'oph', mode: 'sequence', steps: OPH.map(o => st(o[0], 'At work: ' + o[1], 1)) },
    hi: { name: 'Health Informatics & AI · 12 weeks', course: 'hi', mode: 'sequence', steps: HI.map(o => st(o[0], o[1], 1)) },
    eng: { name: 'English · weekly rhythm', course: 'eng', mode: 'weekday', steps: ENG.map(e => st(e[0], e[1], 1, 'd')) }
  };
}
function makePlan(key, start) { const t = planTemplates()[key]; return Object.assign({ id: 'pl' + uid(), start: start || today(), active: true, created: Date.now() }, JSON.parse(JSON.stringify(t))); }
const stepDays = s => (s.len || 1) * (s.unit === 'd' ? 1 : 7);
const planDays = pl => pl.steps.reduce((a, s) => a + stepDays(s), 0);
function planNow(pl, date) {
  date = date || today();
  if (!pl.steps.length) return { empty: true };
  if (pl.mode === 'weekday') { const k = fromYmd(date).getDay(); const s = pl.steps[k]; return s ? { i: k, step: s, label: WDN[k] } : { empty: true }; }
  const d0 = fromYmd(pl.start), t = fromYmd(date), gone = Math.round((t - d0) / DAY);
  if (gone < 0) return { before: true, inDays: -gone };
  let acc = 0;
  for (let i = 0; i < pl.steps.length; i++) { const n = stepDays(pl.steps[i]); if (gone < acc + n) return { i, step: pl.steps[i], label: `Step ${i + 1} of ${pl.steps.length}`, day: gone - acc + 1, of: n, pct: Math.round(gone / planDays(pl) * 100) }; acc += n; }
  return { done: true, pct: 100 };
}
function planEnd(pl) { if (pl.mode === 'weekday') return null; return addDays(pl.start, planDays(pl)); }
function todayPlanItems() {
  return S.plans.filter(p => p.active).map(p => ({ p, n: planNow(p) })).filter(x => x.n.step);
}

/* ---------- Plans view ---------- */
V.plan = () => {
  app.className = 'wide';
  app.innerHTML = `<div class="hhead"><div><h1>Plans</h1><p class="sub">Your study plans. Edit any step, change dates, pause or delete.</p></div><button class="btn-blue" id="plNew">${I('plus')} New plan</button></div>
    ${S.plans.length ? `<div class="plgrid">${S.plans.map(p => { const n = planNow(p), c = course(p.course), end = planEnd(p);
      return `<div class="plcard ${p.active ? '' : 'paused'}" style="--cc:${c ? c.color : 'var(--fill)'}">
        <div class="row" style="flex-wrap:nowrap;align-items:flex-start"><div style="flex:1 1 auto">${c ? tag(c.id) : ''}<h2 style="margin:6px 0 2px">${esc(p.name)}</h2><small class="muted">${p.mode === 'weekday' ? 'Repeats every week' : `${fromYmd(p.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} → ${fromYmd(end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${p.steps.length} steps`}${p.active ? '' : ' · paused'}</small></div></div>
        <div class="plnow">${n.step ? `<small class="muted">${esc(n.label)}${n.of > 1 ? ` · day ${n.day} of ${n.of}` : ''}</small><b>${esc(n.step.title)}</b><small>${esc(n.step.detail)}</small>` : n.before ? `<b>Starts in ${n.inDays} days</b>` : n.done ? '<b>Plan complete 🎉</b>' : '<b>No steps yet</b>'}</div>
        ${p.mode !== 'weekday' ? `<div class="bar"><i style="width:${n.pct || 0}%;background:var(--cc)"></i></div>` : ''}
        <div class="row" style="margin-top:12px"><button data-pe="${p.id}">${I('pencil')} Edit</button><button data-pp="${p.id}">${p.active ? 'Pause' : 'Resume'}</button><button class="iconbtn danger" data-pd="${p.id}" aria-label="Delete plan">${I('trash')}</button></div></div>`; }).join('')}</div>`
      : `<div class="empty">${I('map', 'big')}<p>No plans yet. Start from a template or build your own.</p></div>`}`;
  $('#plNew').onclick = newPlanSheet;
  $$('[data-pe]').forEach(b => b.onclick = () => editPlan(S.plans.find(p => p.id === b.dataset.pe)));
  $$('[data-pp]').forEach(b => b.onclick = () => { const p = S.plans.find(x => x.id === b.dataset.pp); p.active = !p.active; save(); V.plan(); });
  $$('[data-pd]').forEach(b => b.onclick = () => { if (!b.dataset.sure) { b.dataset.sure = 1; b.classList.add('confirm'); toast('Tap again to delete this plan'); return; } S.plans = S.plans.filter(p => p.id !== b.dataset.pd); save(); V.plan(); });
};
function newPlanSheet() {
  const T = planTemplates();
  sheet('New plan', `<div class="group">
      <div class="cell" data-tpl="" style="cursor:pointer">${I('plus')}<div class="grow"><b>Blank plan</b><br><small>Build your own steps</small></div></div>
      ${Object.entries(T).map(([k, t]) => `<div class="cell" data-tpl="${k}" style="cursor:pointer">${I('map')}<div class="grow"><b>${esc(t.name)}</b><br><small>${t.mode === 'weekday' ? '7 days, repeats weekly' : t.steps.length + ' steps'}</small></div></div>`).join('')}</div>`, sc => sc.querySelector('.group').onclick = e => {
    const r = e.target.closest('[data-tpl]'); if (!r) return; closeSheet();
    const k = r.dataset.tpl;
    const p = k ? makePlan(k) : { id: 'pl' + uid(), name: '', course: S.courses[0] ? S.courses[0].id : null, mode: 'sequence', start: today(), active: true, created: Date.now(), steps: [{ id: 's' + uid(), title: '', detail: '', len: 1, unit: 'w' }] };
    if (k && !course(p.course)) p.course = null;
    editPlan(p, true);
  });
}
function editPlan(p, isNew) {
  const P = JSON.parse(JSON.stringify(p));
  const stepsHTML = () => P.steps.map((s, i) => `<div class="plstep" data-i="${i}">
      <div class="plsn">${P.mode === 'weekday' ? WDN[i].slice(0, 3) : i + 1}</div>
      <div class="plsf"><input data-f="title" value="${esc(s.title)}" placeholder="Step title" dir="auto"><input data-f="detail" value="${esc(s.detail)}" placeholder="Details (optional)" dir="auto"></div>
      ${P.mode === 'weekday' ? '' : `<div class="plsl"><input data-f="len" type="number" min="1" value="${s.len}" aria-label="Length"><select data-f="unit" aria-label="Unit"><option value="d" ${s.unit === 'd' ? 'selected' : ''}>days</option><option value="w" ${s.unit !== 'd' ? 'selected' : ''}>weeks</option></select></div>
      <div class="plsa"><button class="iconbtn" data-mv="-1" aria-label="Move up">↑</button><button class="iconbtn" data-mv="1" aria-label="Move down">↓</button><button class="iconbtn danger" data-rm aria-label="Remove step">${I('trash')}</button></div>`}</div>`).join('');
  sheet(isNew ? 'New plan' : 'Edit plan', `
    <label for="peN">Plan name</label><input id="peN" value="${esc(P.name)}" placeholder="e.g. Pharmacology in 6 weeks" dir="auto">
    <div class="row"><div><label for="peC">Course</label><select id="peC"><option value="">None</option>${courseOpts(P.course)}</select></div>
      <div><label for="peS">Start date</label><input id="peS" type="date" value="${P.start}" ${P.mode === 'weekday' ? 'disabled' : ''}></div></div>
    <label>Type</label><div class="seg" id="peM"><button data-m="sequence" class="${P.mode !== 'weekday' ? 'on' : ''}">Step by step</button><button data-m="weekday" class="${P.mode === 'weekday' ? 'on' : ''}">Same every week</button></div>
    <label>Steps</label><div id="peSteps">${stepsHTML()}</div>
    ${P.mode === 'weekday' ? '' : '<button id="peAdd" style="width:100%;margin-top:8px">+ Add step</button>'}
    <button class="btn-blue big" id="peOk" style="margin-top:14px">${isNew ? 'Create plan' : 'Save plan'}</button>`, () => {
    const box = $('#peSteps');
    const pull = () => { $$('.plstep', box).forEach(r => { const s = P.steps[+r.dataset.i]; $$('[data-f]', r).forEach(inp => { s[inp.dataset.f] = inp.dataset.f === 'len' ? Math.max(1, +inp.value || 1) : inp.value; }); }); P.name = $('#peN').value; P.course = $('#peC').value || null; P.start = $('#peS').value || P.start; };
    const repaint = () => { box.innerHTML = stepsHTML(); };
    box.onclick = e => {
      const r = e.target.closest('.plstep'); if (!r) return; const i = +r.dataset.i;
      if (e.target.closest('[data-rm]')) { pull(); P.steps.splice(i, 1); repaint(); }
      const mv = e.target.closest('[data-mv]'); if (mv) { pull(); const j = i + +mv.dataset.mv; if (j >= 0 && j < P.steps.length) { [P.steps[i], P.steps[j]] = [P.steps[j], P.steps[i]]; repaint(); } }
    };
    const add = $('#peAdd'); if (add) add.onclick = () => { pull(); P.steps.push({ id: 's' + uid(), title: '', detail: '', len: 1, unit: 'w' }); repaint(); const last = box.lastElementChild; last && last.querySelector('input').focus(); };
    $('#peM').onclick = e => {
      const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === P.mode) return; pull();
      P.mode = b.dataset.m;
      if (P.mode === 'sequence') P.steps.forEach(x => { x.unit = 'w'; x.len = x.len || 1; });
      if (P.mode === 'weekday') { const old = P.steps; P.steps = WDN.map((d, k) => old[k] ? Object.assign(old[k], { len: 1, unit: 'd' }) : { id: 's' + uid(), title: '', detail: '', len: 1, unit: 'd' }); }
      closeSheet(); editPlan(P, isNew);
    };
    $('#peOk').onclick = () => {
      pull();
      if (!P.name.trim()) { toast('Give the plan a name'); return; }
      P.steps = P.steps.filter(s => s.title.trim() || P.mode === 'weekday');
      if (!P.steps.length) { toast('Add at least one step'); return; }
      const i = S.plans.findIndex(x => x.id === P.id); if (i >= 0) S.plans[i] = P; else S.plans.push(P);
      save(); closeSheet(); toast(isNew ? 'Plan created' : 'Plan saved'); if (view === 'plan') V.plan(); else if (view === 'today') V.today();
    };
  });
}

/* ---------- Erase all data ---------- */
async function eraseAll() {
  try { if (DBH) DBH.close(); } catch (e) { }
  await new Promise(r => { try { const q = indexedDB.deleteDatabase('studyos'); q.onsuccess = q.onerror = q.onblocked = () => r(); } catch (e) { r(); } });
  try { localStorage.removeItem('studyos_v1'); } catch (e) { }
  S = null; MEM.kv.clear(); MEM.files.clear();
  location.hash = ''; location.reload();
}
function eraseSheet() {
  sheet('Erase all data?', `<p>This deletes <b>everything</b> on this device: courses, notes, drawings, flashcards, questions, tasks, plans and settings. ORBIT will start fresh like a new app.</p>
    <p class="sub">Tip: export a backup first if you might want anything back.</p>
    <button id="erBk" style="width:100%;margin-top:10px">${I('restore')} Export a backup first</button>
    <label for="erT" style="margin-top:16px">Type ERASE to confirm</label><input id="erT" autocomplete="off" autocapitalize="characters">
    <button class="big danger" id="erGo" style="margin-top:12px;background:var(--bad);color:#fff" disabled>Erase everything</button>`, () => {
    $('#erBk').onclick = () => { closeSheet(); go('progress'); setTimeout(() => exportData(), 200); };
    $('#erT').oninput = e => $('#erGo').disabled = e.target.value.trim().toUpperCase() !== 'ERASE';
    $('#erGo').onclick = () => { $('#erGo').textContent = 'Erasing…'; eraseAll(); };
  });
}

/* ---------- Onboarding (first launch) ---------- */
function freshState() {
  return { v: 6, cards: [], inbox: [], errors: [], blocks: [], logs: {}, quizzes: [], courses: [], questions: [], pages: [], tasks: [], events: [], trash: [], plans: [],
    settings: { newPerDay: 12, maxRev: 60, start: today(), easy: false, theme: 'auto', expanded: {}, onboarded: false, name: '' } };
}
function onboarding() {
  const pick = { nclex: true, oph: true, eng: true, hi: true }; let starter = true, name = S.settings.name || '', theme = S.settings.theme || 'auto', step = 0;
  const el = document.createElement('div'); el.className = 'onb'; document.body.appendChild(el);
  const feats = [['book', 'Courses & lessons', 'Modules, a curriculum and progress for everything you learn.'], ['doc', 'Notes like Notion & Apple Notes', 'Pages in pages, Word-style writing, tables, images.'], ['pencil', 'Fast drawing', 'Diagrams and handwriting with pen, lasso and shapes.'], ['cards', 'Flashcards & quizzes', 'Spaced repetition, Quizlet-style tests and match.'], ['cal', 'Plans, tasks & calendar', 'Every day you know exactly what to study.']];
  const render = () => {
    const screens = [
      `<img src="icon-512.png" alt="" class="onblogo"><h1>Welcome to ORBIT</h1><p class="sub">Your offline learning system.</p>
       <div class="onbfeats">${feats.map(f => `<div class="onbf">${I(f[0])}<div><b>${f[1]}</b><small>${f[2]}</small></div></div>`).join('')}</div>`,
      `<h1>What should we call you?</h1><p class="sub">Used for your greeting on Home.</p><input id="obN" value="${esc(name)}" placeholder="Your name" dir="auto" style="margin-top:22px;font-size:20px;min-height:54px">`,
      `<h1>What are you learning?</h1><p class="sub">Pick courses to set up. You can add, rename or delete courses any time.</p>
       <div class="group" style="margin-top:18px">${DEFAULT_COURSES.map(c => `<label class="cell onbpick"><input type="checkbox" data-k="${c.id}" ${pick[c.id] ? 'checked' : ''}><span style="font-size:24px">${c.icon}</span><div class="grow"><b>${c.name}</b><br><small>${c.modules.length} modules + a study plan</small></div></label>`).join('')}</div>
       <label class="cell onbpick group" style="margin-top:12px"><input type="checkbox" id="obS" ${starter ? 'checked' : ''}><div class="grow"><b>Add starter content</b><br><small>Sample notes, flashcards and practice questions. Turn off to start completely empty.</small></div></label>`,
      `<h1>Appearance</h1><p class="sub">Change it later in Settings.</p><div class="onbtheme">${[['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']].map(t => `<button data-th="${t[0]}" class="${theme === t[0] ? 'on' : ''}"><span class="thprev ${t[0]}"></span>${t[1]}</button>`).join('')}</div>`
    ];
    el.innerHTML = `<div class="onbcard">${screens[step]}</div><div class="onbfoot"><div class="dots">${screens.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>
      <button class="btn-blue big" id="obNext">${step === screens.length - 1 ? 'Start using ORBIT' : 'Continue'}</button>${step ? '<button id="obBack" class="obback">Back</button>' : ''}</div>`;
    const n = $('#obN'); if (n) { setTimeout(() => n.focus(), 50); n.oninput = () => name = n.value; n.onkeydown = e => { if (e.key === 'Enter') $('#obNext').click(); }; }
    $$('[data-k]', el).forEach(c => c.onchange = () => pick[c.dataset.k] = c.checked);
    const s = $('#obS'); if (s) s.onchange = () => starter = s.checked;
    $$('[data-th]', el).forEach(b => b.onclick = () => { theme = b.dataset.th; S.settings.theme = theme; applyTheme(); render(); });
    const bk = $('#obBack'); if (bk) bk.onclick = () => { step--; render(); };
    $('#obNext').onclick = () => { if (step < screens.length - 1) { step++; render(); } else finish(); };
  };
  const finish = () => {
    S.settings.name = name.trim(); S.settings.theme = theme;
    const keys = DEFAULT_COURSES.map(c => c.id).filter(k => pick[k]);
    S.courses = makeCourses().filter(c => keys.includes(c.id));
    S.plans = keys.map(k => makePlan(k, today()));
    if (starter) {
      for (const k of keys) for (const [f, b] of (SEED[k] || [])) { const c = newCard(k, f, b, k === 'eng'); c.mod = guessModule(k, f + ' ' + b); S.cards.push(c); }
      S.questions = seedQuestions().filter(q => keys.includes(q.course));
      seedPages(); S.pages = S.pages.filter(p => !p.course || keys.includes(p.course));
    } else {
      S.pages = []; const p = newPage(null, 'My first note', '📝', [newBlock('p', { html: '' })]); S.settings.lastPage = p.id;
    }
    S.settings.onboarded = true; save(true);
    el.classList.add('out'); setTimeout(() => el.remove(), 300);
    go('today');
  };
  render();
}
