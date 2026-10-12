/* NCM manpower view - reads the shared Google Sheet "Man_Power_Professional" (CSV export)
   and shows its 4 tabs: Summary, Workers (day / night shift), Full List, Exclusion.
   Used by the NCM Hub page and the NCM PLANTS program.  Usage: ncmManpower(hostElement) */
(function () {
  'use strict';
  const SHEET = 'https://docs.google.com/spreadsheets/d/1ddXiUN4VN5DKdL9Nik1TMOm0iysUOUCrNS-9l44tuPs';
  const TABS = {
    summary: {gid: '1414147289', label: 'Summary'},
    workers: {gid: '240418661', label: 'Workers'},
    full: {gid: '1608387094', label: 'Full List'},
    excl: {gid: '1357920945', label: 'Exclusion'}
  };
  const csvUrl = gid => SHEET + '/export?format=csv&gid=' + gid;
  const editUrl = gid => SHEET + '/edit?gid=' + gid + '#gid=' + gid;

  const CSS = `
.np{font-family:inherit;color:inherit}
.np *{box-sizing:border-box}
.np-top{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px}
.np-top h3{margin:0;font-size:17px;flex:1;min-width:180px}
.np-btn{display:inline-flex;align-items:center;gap:6px;background:#2457d6;color:#fff!important;border:0;border-radius:9px;padding:8px 14px;font-weight:600;font-size:13px;text-decoration:none;cursor:pointer}
.np-btn.ghost{background:transparent;color:inherit!important;border:1px solid rgba(128,128,128,.35)}
.np-tabs{display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid rgba(128,128,128,.25);margin-bottom:14px}
.np-tab{background:none;border:0;border-bottom:3px solid transparent;padding:9px 14px;font:inherit;font-weight:700;font-size:14px;color:inherit;opacity:.6;cursor:pointer}
.np-tab.on{opacity:1;border-bottom-color:#2457d6;color:#2457d6}
.np-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:14px}
.np-k{border:1px solid rgba(128,128,128,.25);border-radius:12px;padding:11px 13px;background:rgba(128,128,128,.06)}
.np-k b{display:block;font-size:21px;font-variant-numeric:tabular-nums}
.np-k span{font-size:11.5px;opacity:.7}
.np-f{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
.np-f input,.np-f select{padding:7px 10px;border:1px solid rgba(128,128,128,.35);border-radius:9px;background:transparent;color:inherit;font:inherit;font-size:13px}
.np-f input{flex:1;min-width:170px}
.np-f select option{color:#000}
.np h4{font-size:12.5px;text-transform:uppercase;letter-spacing:.5px;opacity:.65;margin:16px 0 8px}
.np-tw{overflow:auto;border:1px solid rgba(128,128,128,.25);border-radius:12px;max-height:calc(100vh - 340px);min-height:180px}
.np table{width:100%;border-collapse:collapse;font-size:13.5px}
.np th{position:sticky;top:0;background:#2457d6;color:#fff;text-align:left;padding:9px 12px;font-size:12px;white-space:nowrap;z-index:1}
.np th.num,.np td.num{text-align:right;font-variant-numeric:tabular-nums}
.np td{padding:8px 12px;border-bottom:1px solid rgba(128,128,128,.18);white-space:nowrap}
.np tr:nth-child(even) td{background:rgba(128,128,128,.05)}
.np tr.dep td{background:rgba(36,87,214,.08);font-weight:700}
.np tfoot td{font-weight:700;background:rgba(128,128,128,.10)}
.np .bar{display:inline-block;height:7px;border-radius:4px;background:#2457d6;vertical-align:middle;margin-right:8px}
.np .ty{display:inline-block;border-radius:999px;padding:2px 9px;font-size:12px;font-weight:700}
.np .ty.w{background:#e0f2fe;color:#075985}.np .ty.b{background:#ede9fe;color:#5b21b6}
.np .two{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px}
.np a.ph{color:inherit;text-decoration:none;font-variant-numeric:tabular-nums}
.np-msg{padding:28px;text-align:center;opacity:.7}
.np-foot{font-size:12px;opacity:.65;margin-top:8px}`;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const int = v => { const x = parseInt(String(v == null ? '' : v).replace(/[^\d\-]/g, ''), 10); return isNaN(x) ? null : x; };
  const nm = s => String(s || '').replace(/\s+/g, ' ').trim();
  // "white Collar" and "White Collar" are the same type
  const tcase = s => nm(s).toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
  const phone = p => { p = String(p || '').replace(/[^\d+]/g, ''); return /^0*$/.test(p) ? '' : `<a class="ph" href="tel:${esc(p)}">${esc(p)}</a>`; };
  const type = t => { t = String(t || '').trim(); return t ? `<span class="ty ${/white/i.test(t) ? 'w' : 'b'}">${esc(t)}</span>` : ''; };

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
    return rows.map(r => r.map(c => c.trim()));
  }
  async function load(gid) {
    const r = await fetch(csvUrl(gid) + '&t=' + Date.now(), {cache: 'no-store'});
    if (!r.ok) throw new Error(r.status);
    return parseCSV(await r.text());
  }
  const opts = list => list.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');

  /* ---------- Summary: headcount by department / job title ---------- */
  function summaryView(body, rows) {
    const hi = rows.findIndex(r => (r[0] || '').toUpperCase() === 'DEPARTMENT');
    const items = []; let dep = ''; let total = null;
    for (const r of rows.slice(hi + 1)) {
      if ((r[1] || '').toLowerCase() === 'total') { total = int(r[2]); continue; }
      if (r[0]) dep = r[0];
      if (r[1]) items.push({dep, job: r[1], n: int(r[2]) || 0});
    }
    const deps = [...new Set(items.map(x => x.dep))];
    const byDep = deps.map(d => ({d, n: items.filter(x => x.dep === d).reduce((a, x) => a + x.n, 0)}));
    const sum = items.reduce((a, x) => a + x.n, 0), max = Math.max(1, ...byDep.map(x => x.n));
    let h = `<div class="np-kpis"><div class="np-k"><b>${total ?? sum}</b><span>Total headcount</span></div>` +
      `<div class="np-k"><b>${deps.length}</b><span>Departments</span></div><div class="np-k"><b>${items.length}</b><span>Job titles</span></div></div>`;
    h += `<h4>By department</h4><div class="np-tw" style="min-height:0"><table><tr><th>Department</th><th class="num">Headcount</th></tr>` +
      byDep.map(x => `<tr><td>${esc(x.d)}</td><td class="num"><span class="bar" style="width:${Math.round(x.n / max * 120)}px"></span>${x.n}</td></tr>`).join('') +
      `<tfoot><tr><td>Total</td><td class="num">${sum}</td></tr></tfoot></table></div>`;
    h += `<h4>By job title</h4><div class="np-tw"><table><tr><th>Department</th><th>Job title</th><th class="num">Headcount</th></tr>` +
      deps.map(d => `<tr class="dep"><td colspan="2">${esc(d)}</td><td class="num">${byDep.find(x => x.d === d).n}</td></tr>` +
        items.filter(x => x.dep === d).map(x => `<tr><td></td><td>${esc(x.job)}</td><td class="num">${x.n}</td></tr>`).join('')).join('') + '</table></div>';
    body.innerHTML = h + '<div class="np-foot">From the sheet\'s Summary tab · Google Sheets</div>';
  }

  /* ---------- Workers: day shift / night shift ---------- */
  function workersView(body, rows) {
    const day = [], night = [];
    for (const r of rows) {
      if (int(r[1]) !== null && r[2]) day.push({c: int(r[1]), n: nm(r[2]), p: r[3] || ''});
      if (int(r[6]) !== null && r[7]) night.push({c: int(r[6]), n: nm(r[7]), p: r[8] || ''});
    }
    body.innerHTML = `<div class="np-kpis"><div class="np-k"><b>${day.length}</b><span>Day shift</span></div>` +
      `<div class="np-k"><b>${night.length}</b><span>Night shift</span></div><div class="np-k"><b>${day.length + night.length}</b><span>Total workers</span></div></div>` +
      `<div class="np-f"><input type="search" placeholder="Search name, code or plant…" data-a="q"></div><div class="two" data-a="lists"></div>` +
      '<div class="np-foot">From the sheet\'s Workers tab · Google Sheets</div>';
    const list = (title, xs) => `<div><h4>${title} · ${xs.length}</h4><div class="np-tw"><table><tr><th>#</th><th>Code</th><th>Name</th><th>Plant / role</th></tr>` +
      xs.map((x, i) => `<tr><td>${i + 1}</td><td>${x.c}</td><td>${esc(x.n)}</td><td>${esc(x.p)}</td></tr>`).join('') + '</table></div></div>';
    const draw = q => {
      const f = xs => xs.filter(x => !q || (x.n + ' ' + x.c + ' ' + x.p).toLowerCase().includes(q));
      body.querySelector('[data-a=lists]').innerHTML = list('☀️ Day shift', f(day)) + list('🌙 Night shift', f(night));
    };
    body.querySelector('[data-a=q]').oninput = e => draw(e.target.value.trim().toLowerCase());
    draw('');
  }

  /* ---------- Full List / Exclusion ---------- */
  function staffView(body, rows, excl) {
    const hi = rows.findIndex(r => (r[1] || '').toLowerCase() === 'code');
    const items = rows.slice(hi + 1).filter(r => int(r[1]) !== null && r[2])
      .map(r => ({c: int(r[1]), n: nm(r[2]), t: r[3] || '', d: r[4] || '', h: r[5] || '', x: excl ? (r[6] || '') : tcase(r[6]), ph: r[7] || ''}));
    const deps = [...new Set(items.map(x => x.d).filter(Boolean))].sort();
    const types = excl ? [] : [...new Set(items.map(x => x.x).filter(Boolean))].sort();
    const st = {q: '', d: '', ty: ''};
    body.innerHTML = `<div class="np-kpis" data-a="kpis"></div>
      <div class="np-f"><input type="search" placeholder="Search name, code, job or phone…" data-a="q">
        <select data-a="d"><option value="">All departments</option>${opts(deps)}</select>
        ${excl ? '' : `<select data-a="t"><option value="">All types</option>${opts(types)}</select>`}</div>
      <div class="np-tw" data-a="tw"></div><div class="np-foot" data-a="foot"></div>`;
    const $ = s => body.querySelector(s);
    function draw() {
      const list = items.filter(x => (!st.d || x.d === st.d) && (!st.ty || x.x === st.ty) &&
        (!st.q || (x.n + ' ' + x.c + ' ' + x.t + ' ' + x.ph).toLowerCase().includes(st.q)));
      $('[data-a=kpis]').innerHTML = excl
        ? `<div class="np-k"><b>${items.length}</b><span>Left the company</span></div><div class="np-k"><b>${list.length}</b><span>Shown</span></div>`
        : `<div class="np-k"><b>${items.length}</b><span>Employees</span></div>` +
          types.map(t => `<div class="np-k"><b>${items.filter(x => x.x === t).length}</b><span>${esc(t)}</span></div>`).join('') +
          `<div class="np-k"><b>${deps.length}</b><span>Departments</span></div>`;
      $('[data-a=tw]').innerHTML = list.length ? `<table><tr><th>Code</th><th>Name</th><th>Job title</th><th>Department</th><th>Hiring date</th><th>${excl ? 'End date' : 'Type'}</th><th>Telephone</th></tr>` +
        list.map(x => `<tr><td>${x.c}</td><td>${esc(x.n)}</td><td>${esc(x.t)}</td><td>${esc(x.d)}</td><td>${esc(x.h)}</td><td>${excl ? esc(x.x) : type(x.x)}</td><td>${phone(x.ph)}</td></tr>`).join('') + '</table>'
        : '<div class="np-msg">No matching employees.</div>';
      $('[data-a=foot]').textContent = list.length + ' shown · from the sheet\'s ' + (excl ? 'Exclusion' : 'Full List') + ' tab · Google Sheets';
    }
    $('[data-a=q]').oninput = e => { st.q = e.target.value.trim().toLowerCase(); draw(); };
    $('[data-a=d]').onchange = e => { st.d = e.target.value; draw(); };
    if (!excl) $('[data-a=t]').onchange = e => { st.ty = e.target.value; draw(); };
    draw();
  }

  const VIEWS = {summary: summaryView, workers: workersView, full: (b, r) => staffView(b, r, false), excl: (b, r) => staffView(b, r, true)};

  window.ncmManpower = async function (host, tab) {
    if (!document.getElementById('np-css')) {
      const s = document.createElement('style'); s.id = 'np-css'; s.textContent = CSS; document.head.appendChild(s);
    }
    tab = TABS[tab] ? tab : (host.dataset.npTab || 'summary');
    host.dataset.npTab = tab;
    host.innerHTML = `<div class="np">
      <div class="np-top"><h3>Manpower</h3>
        <a class="np-btn" target="_blank" rel="noopener" href="${editUrl(TABS[tab].gid)}">Open the sheet ↗</a>
        <button class="np-btn ghost" data-a="reload">↻ Refresh</button></div>
      <div class="np-tabs">${Object.entries(TABS).map(([k, t]) => `<button class="np-tab${k === tab ? ' on' : ''}" data-t="${k}">${t.label}</button>`).join('')}</div>
      <div data-a="body"><div class="np-msg">Loading…</div></div></div>`;
    host.querySelectorAll('.np-tab').forEach(b => b.onclick = () => window.ncmManpower(host, b.dataset.t));
    host.querySelector('[data-a=reload]').onclick = () => window.ncmManpower(host, tab);
    const body = host.querySelector('[data-a=body]');
    try { VIEWS[tab](body, await load(TABS[tab].gid)); }
    catch (e) { body.innerHTML = `<div class="np-msg">Could not load the sheet. <a class="np-btn" target="_blank" rel="noopener" href="${editUrl(TABS[tab].gid)}">Open the sheet ↗</a></div>`; }
  };
})();
