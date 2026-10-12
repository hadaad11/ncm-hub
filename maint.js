/* NCM maintenance log view - reads the shared Google Sheet (CSV export) and draws
   clean, filterable tables with two sub-tabs like the sheet:
   "أعمال الصيانة" (work done) and "قطع الغيار الناقصة" (missing spare parts).
   Used by the NCM Hub page and the NCM PLANTS program.
   Usage: ncmMaint(hostElement) */
(function () {
  'use strict';
  const SHEET = 'https://docs.google.com/spreadsheets/d/1xrmjnlPOJG7SzjT9lYIkJhaIDJEGFDENoPuQJgxvy30';
  const TABS = {
    work: {gid: '134919722', label: '🔧 Maintenance Work'},
    parts: {gid: '1265130294', label: '📦 Missing Spare Parts'}
  };
  const csvUrl = gid => SHEET + '/export?format=csv&gid=' + gid;
  const editUrl = gid => SHEET + '/edit?gid=' + gid + '#gid=' + gid;

  const CSS = `
.nm{direction:ltr;font-family:inherit;color:inherit}
.nm *{box-sizing:border-box}
.nm-top{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px}
.nm-top h3{margin:0;font-size:17px;flex:1;min-width:180px}
.nm-btn{display:inline-flex;align-items:center;gap:6px;background:#2457d6;color:#fff!important;border:0;border-radius:9px;padding:8px 14px;font-weight:600;font-size:13px;text-decoration:none;cursor:pointer}
.nm-btn.ghost{background:transparent;color:inherit!important;border:1px solid rgba(128,128,128,.35)}
.nm-tabs{display:flex;gap:6px;border-bottom:1px solid rgba(128,128,128,.25);margin-bottom:14px}
.nm-tab{background:none;border:0;border-bottom:3px solid transparent;padding:9px 14px;font:inherit;font-weight:700;font-size:14px;color:inherit;opacity:.6;cursor:pointer}
.nm-tab.on{opacity:1;border-bottom-color:#2457d6;color:#2457d6}
.nm-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:14px}
.nm-k{border:1px solid rgba(128,128,128,.25);border-radius:12px;padding:11px 13px;background:rgba(128,128,128,.06)}
.nm-k b{display:block;font-size:21px;font-variant-numeric:tabular-nums}
.nm-k span{font-size:11.5px;opacity:.7}
.nm-k.bad b{color:#c0352b}.nm-k.warn b{color:#c2410c}
.nm-f{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
.nm-chip{border:1px solid rgba(128,128,128,.35);background:transparent;color:inherit;border-radius:999px;padding:5px 12px;font-size:12.5px;cursor:pointer;font-weight:600}
.nm-chip.on{background:#2457d6;border-color:#2457d6;color:#fff}
.nm-f input,.nm-f select{flex:1;min-width:150px;padding:7px 10px;border:1px solid rgba(128,128,128,.35);border-radius:9px;background:transparent;color:inherit;font:inherit;font-size:13px}
.nm-f select{flex:0 0 auto;min-width:130px}
.nm-f select option{color:#000}
.nm-tw{overflow:auto;border:1px solid rgba(128,128,128,.25);border-radius:12px;max-height:calc(100vh - 360px);min-height:240px}
.nm table{width:100%;border-collapse:collapse;font-size:13.5px}
.nm th{position:sticky;top:0;background:#2457d6;color:#fff;text-align:left;padding:9px 12px;font-size:12px;white-space:nowrap;z-index:1}
.nm td{padding:9px 12px;border-bottom:1px solid rgba(128,128,128,.18);vertical-align:top}
.nm tr:nth-child(even) td{background:rgba(128,128,128,.05)}
.nm td.d{white-space:nowrap;font-variant-numeric:tabular-nums;opacity:.85}
.nm td.w{min-width:240px;line-height:1.5}
.nm td.n{opacity:.75;font-size:12.5px;min-width:160px}
.nm td.q{white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:700}
.nm .pl{display:inline-block;min-width:34px;text-align:center;border-radius:6px;padding:2px 7px;font-weight:700;font-size:12px;color:#fff;white-space:nowrap}
.nm .pr{display:inline-block;border-radius:999px;padding:2px 10px;font-weight:700;font-size:12px;white-space:nowrap}
.nm-msg{padding:28px;text-align:center;opacity:.7}
.nm-foot{font-size:12px;opacity:.65;margin-top:8px}`;
  const COLORS = {L1: '#2457d6', L2: '#0e7490', V3: '#7c3aed', V4: '#c2410c', V5: '#15803d'};
  const PRIO = {'عاجل': {o: 0, en: 'Urgent', bg: '#fde2e1', fg: '#b42318'}, 'عالي': {o: 1, en: 'High', bg: '#ffedd5', fg: '#c2410c'},
                'متوسط': {o: 2, en: 'Medium', bg: '#fef9c3', fg: '#854d0e'}, 'منخفض': {o: 3, en: 'Low', bg: '#e0f2fe', fg: '#075985'}};
  const prioEn = p => (PRIO[p] || {}).en || p;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const plant = p => `<span class="pl" style="background:${COLORS[p] || '#64748b'}">${esc(p || '-')}</span>`;
  const prio = p => { const s = PRIO[p] || {bg: 'rgba(128,128,128,.15)', fg: 'inherit'}; return `<span class="pr" style="background:${s.bg};color:${s.fg}">${esc(prioEn(p) || '-')}</span>`; };
  // Dates are typed by hand (2026-10-06, 2026.10.8, 2026/10/8): normalise to YYYY-MM-DD.
  const day = s => {
    const m = String(s || '').trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    return m ? m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0') : String(s || '').trim();
  };

  function parseCSV(t) {
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r') cur += c;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  // Rows under the header row that contains `key`, as objects keyed by header text.
  function table(rows, key) {
    const h = rows.findIndex(r => r.some(c => c.trim() === key));
    if (h < 0) return [];
    const head = rows[h].map(c => c.trim());
    return rows.slice(h + 1).map(r => { const o = {}; head.forEach((k, i) => { if (k) o[k] = (r[i] || '').trim(); }); return o; });
  }
  const col = (o, prefix) => { for (const k in o) if (k.startsWith(prefix)) return o[k]; return ''; };

  async function load(gid) {
    const r = await fetch(csvUrl(gid) + '&t=' + Date.now(), {cache: 'no-store'});
    if (!r.ok) throw new Error(r.status);
    return parseCSV(await r.text());
  }

  /* ---------- work done ---------- */
  function workView(body, rows) {
    const items = table(rows, 'التاريخ').map(o => ({date: day(o['التاريخ']), plant: o['المحطة'] || '', op: o['اسم المشغل'] || '',
      work: col(o, 'الأعمال'), note: o['ملاحظات'] || ''})).filter(x => x.work || x.op);
    items.sort((a, b) => b.date.localeCompare(a.date));
    const plants = [...new Set(items.map(x => x.plant).filter(Boolean))].sort();
    const months = [...new Set(items.map(x => x.date.slice(0, 7)).filter(m => /^\d{4}-\d{2}$/.test(m)))].sort().reverse();
    const thisMonth = new Date().toISOString().slice(0, 7);
    const st = {plant: '', month: '', q: ''};
    body.innerHTML = `<div class="nm-kpis" data-a="kpis"></div>
      <div class="nm-f">${['', ...plants].map(p => `<button class="nm-chip${p ? '' : ' on'}" data-p="${esc(p)}">${p ? esc(p) : 'All plants'}</button>`).join('')}</div>
      <div class="nm-f"><input type="search" placeholder="Search work or technician…" data-a="q">
        <select data-a="m"><option value="">All months</option>${months.map(m => `<option value="${m}">${m}</option>`).join('')}</select></div>
      <div class="nm-tw" data-a="tw"></div><div class="nm-foot" data-a="foot"></div>`;
    const $ = s => body.querySelector(s);
    function draw() {
      const q = st.q.toLowerCase();
      const list = items.filter(x => (!st.plant || x.plant === st.plant) && (!st.month || x.date.startsWith(st.month)) &&
        (!q || (x.work + ' ' + x.op + ' ' + x.note).toLowerCase().includes(q)));
      const base = items.filter(x => !st.plant || x.plant === st.plant);
      $('[data-a=kpis]').innerHTML =
        `<div class="nm-k"><b>${base.length}</b><span>Total jobs</span></div>` +
        `<div class="nm-k"><b>${base.filter(x => x.date.startsWith(thisMonth)).length}</b><span>This month</span></div>` +
        `<div class="nm-k"><b>${esc((base[0] || {}).date || '-')}</b><span>Last job</span></div>` +
        `<div class="nm-k"><b>${new Set(base.map(x => x.op).filter(Boolean)).size}</b><span>Technicians</span></div>`;
      $('[data-a=tw]').innerHTML = list.length ? '<table><tr><th>Date</th><th>Plant</th><th>Technician</th><th>Work done</th><th>Notes</th></tr>' +
        list.map(x => `<tr><td class="d">${esc(x.date)}</td><td>${plant(x.plant)}</td><td>${esc(x.op)}</td><td class="w">${esc(x.work)}</td><td class="n">${esc(x.note)}</td></tr>`).join('') + '</table>'
        : '<div class="nm-msg">No matching jobs.</div>';
      $('[data-a=foot]').textContent = list.length + ' jobs shown · from Google Sheets';
    }
    body.querySelectorAll('.nm-chip').forEach(b => b.onclick = () => {
      body.querySelectorAll('.nm-chip').forEach(x => x.classList.toggle('on', x === b)); st.plant = b.dataset.p; draw();
    });
    $('[data-a=q]').oninput = e => { st.q = e.target.value.trim(); draw(); };
    $('[data-a=m]').onchange = e => { st.month = e.target.value; draw(); };
    draw();
  }

  /* ---------- missing spare parts ---------- */
  function partsView(body, rows) {
    const items = table(rows, 'اسم قطعة الغيار').map(o => ({date: day(o['تاريخ الطلب']), plant: o['المحطة'] || '', sys: col(o, 'الجزء'),
      part: o['اسم قطعة الغيار'] || '', unit: o['الوحدة'] || '', qty: o['الكمية المطلوبة'] || '', prio: o['الأولوية'] || ''})).filter(x => x.part);
    const po = p => (PRIO[p] || {o: 9}).o;
    items.sort((a, b) => po(a.prio) - po(b.prio) || a.date.localeCompare(b.date));
    const plants = [...new Set(items.map(x => x.plant).filter(Boolean))].sort();
    const prios = [...new Set(items.map(x => x.prio).filter(Boolean))].sort((a, b) => po(a) - po(b));
    const st = {plant: '', prio: '', q: ''};
    body.innerHTML = `<div class="nm-kpis" data-a="kpis"></div>
      <div class="nm-f" data-a="pl">${['', ...plants].map(p => `<button class="nm-chip${p ? '' : ' on'}" data-p="${esc(p)}">${p ? esc(p) : 'All plants'}</button>`).join('')}</div>
      <div class="nm-f" data-a="pr">${['', ...prios].map(p => `<button class="nm-chip${p ? '' : ' on'}" data-r="${esc(p)}">${p ? esc(prioEn(p)) : 'All priorities'}</button>`).join('')}</div>
      <div class="nm-f"><input type="search" placeholder="Search part or system…" data-a="q"></div>
      <div class="nm-tw" data-a="tw"></div><div class="nm-foot" data-a="foot"></div>`;
    const $ = s => body.querySelector(s);
    function draw() {
      const q = st.q.toLowerCase();
      const base = items.filter(x => !st.plant || x.plant === st.plant);
      const list = base.filter(x => (!st.prio || x.prio === st.prio) && (!q || (x.part + ' ' + x.sys).toLowerCase().includes(q)));
      const n = p => base.filter(x => x.prio === p).length;
      $('[data-a=kpis]').innerHTML =
        `<div class="nm-k"><b>${base.length}</b><span>Missing parts</span></div>` +
        `<div class="nm-k bad"><b>${n('عاجل')}</b><span>Urgent</span></div>` +
        `<div class="nm-k warn"><b>${n('عالي')}</b><span>High</span></div>` +
        `<div class="nm-k"><b>${new Set(base.map(x => x.plant).filter(Boolean)).size}</b><span>Plants with shortages</span></div>`;
      $('[data-a=tw]').innerHTML = list.length ? '<table><tr><th>Priority</th><th>Plant</th><th>Part / system</th><th>Spare part</th><th>Qty</th><th>Requested</th></tr>' +
        list.map(x => `<tr><td>${prio(x.prio)}</td><td>${plant(x.plant)}</td><td>${esc(x.sys)}</td><td class="w">${esc(x.part)}</td>` +
          `<td class="q">${esc(x.qty)} ${esc({'عدد': 'pcs', 'متر': 'm', 'كجم': 'kg', 'لتر': 'L'}[x.unit] || x.unit)}</td><td class="d">${esc(x.date)}</td></tr>`).join('') + '</table>'
        : '<div class="nm-msg">No matching parts.</div>';
      $('[data-a=foot]').textContent = list.length + ' parts shown · urgent first, then oldest · from Google Sheets';
    }
    $('[data-a=pl]').querySelectorAll('.nm-chip').forEach(b => b.onclick = () => {
      $('[data-a=pl]').querySelectorAll('.nm-chip').forEach(x => x.classList.toggle('on', x === b)); st.plant = b.dataset.p; draw();
    });
    $('[data-a=pr]').querySelectorAll('.nm-chip').forEach(b => b.onclick = () => {
      $('[data-a=pr]').querySelectorAll('.nm-chip').forEach(x => x.classList.toggle('on', x === b)); st.prio = b.dataset.r; draw();
    });
    $('[data-a=q]').oninput = e => { st.q = e.target.value.trim(); draw(); };
    draw();
  }

  /* ---------- shell ---------- */
  window.ncmMaint = async function (host, tab) {
    if (!document.getElementById('nm-css')) {
      const s = document.createElement('style'); s.id = 'nm-css'; s.textContent = CSS; document.head.appendChild(s);
    }
    tab = TABS[tab] ? tab : (host.dataset.nmTab || 'work');
    host.dataset.nmTab = tab;
    host.innerHTML = `<div class="nm">
      <div class="nm-top"><h3>Plant Maintenance & Spare Parts</h3>
        <a class="nm-btn" target="_blank" rel="noopener" href="${editUrl(TABS[tab].gid)}">Open the sheet ↗</a>
        <button class="nm-btn ghost" data-a="reload">↻ Refresh</button></div>
      <div class="nm-tabs">${Object.entries(TABS).map(([k, t]) => `<button class="nm-tab${k === tab ? ' on' : ''}" data-t="${k}">${t.label}</button>`).join('')}</div>
      <div data-a="body"><div class="nm-msg">Loading…</div></div></div>`;
    host.querySelectorAll('.nm-tab').forEach(b => b.onclick = () => window.ncmMaint(host, b.dataset.t));
    host.querySelector('[data-a=reload]').onclick = () => window.ncmMaint(host, tab);
    const body = host.querySelector('[data-a=body]');
    try {
      const rows = await load(TABS[tab].gid);
      (tab === 'parts' ? partsView : workView)(body, rows);
    } catch (e) {
      body.innerHTML = `<div class="nm-msg">Could not load the sheet. <a class="nm-btn" target="_blank" rel="noopener" href="${editUrl(TABS[tab].gid)}">Open the sheet ↗</a></div>`;
    }
  };
})();
