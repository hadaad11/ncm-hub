/* NCM cement tracking view - reads the shared Google Sheet "متابعة تعتيق السايلوهات" (CSV export)
   and shows its 4 visible tabs, in English:
     Cement Aging      (daily discharge per plant silo)
     Cement Balance    (tons in each silo, totals by cement type)
     Filling Priority  (which silo to fill / use first)
     Aging Tracker     (daily start recommendation per plant + silo detail)
   Used by the NCM Hub page and the NCM PLANTS program.  Usage: ncmCement(hostElement) */
(function () {
  'use strict';
  const SHEET = 'https://docs.google.com/spreadsheets/d/192z2uxvUZ78AyFc64b9g5133M_1hqr32YfW5oDpz4C0';
  const TABS = {
    aging: {gid: '1475633403', label: 'Cement Aging'},
    balance: {gid: '1471367277', label: 'Cement Balance'},
    priority: {gid: '1865244793', label: 'Filling Priority'},
    tracker: {gid: '517376104', label: 'Aging Tracker'}
  };
  const csvUrl = gid => SHEET + '/export?format=csv&gid=' + gid;
  const editUrl = gid => SHEET + '/edit?gid=' + gid + '#gid=' + gid;
  const PLANT = {'LIBHERE 1': 'L1', 'LIBHERE 2': 'L2', 'VURMAK 3': 'V3', 'VURMAK 4': 'V4', 'VURMAK 5': 'V5',
                 'LIEBHERR 1': 'L1', 'LIEBHERR 2': 'L2'};
  const COLORS = {L1: '#006ca8', L2: '#24a854', V3: '#0b8a8a', V4: '#5c6b7a', V5: '#1c4f7c'};

  const CSS = `
.nc{font-family:inherit;color:inherit}
.nc *{box-sizing:border-box}
.nc-top{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px}
.nc-top h3{margin:0;font-size:17px;flex:1;min-width:180px}
.nc-btn{display:inline-flex;align-items:center;gap:6px;background:#006ca8;color:#fff!important;border:0;border-radius:9px;padding:8px 14px;font-weight:600;font-size:13px;text-decoration:none;cursor:pointer}
.nc-btn.ghost{background:transparent;color:inherit!important;border:1px solid rgba(128,128,128,.35)}
.nc-tabs{display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid rgba(128,128,128,.25);margin-bottom:14px}
.nc-tab{background:none;border:0;border-bottom:3px solid transparent;padding:9px 14px;font:inherit;font-weight:700;font-size:14px;color:inherit;opacity:.6;cursor:pointer}
.nc-tab.on{opacity:1;border-bottom-color:#006ca8;color:#006ca8}
.nc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:14px}
.nc-k:nth-child(even){border-top-color:#24a854}
.nc-k{border:1px solid rgba(128,128,128,.25);border-top:3px solid #006ca8;border-radius:12px;padding:11px 13px;background:rgba(128,128,128,.06)}
.nc-k b{display:block;font-size:21px;font-variant-numeric:tabular-nums}
.nc-k span{font-size:11.5px;opacity:.7}
.nc-f{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
.nc-chip{border:1px solid rgba(128,128,128,.35);background:transparent;color:inherit;border-radius:999px;padding:5px 12px;font-size:12.5px;cursor:pointer;font-weight:600}
.nc-chip.on{background:#006ca8;border-color:#006ca8;color:#fff}
.nc-f select{padding:7px 10px;border:1px solid rgba(128,128,128,.35);border-radius:9px;background:transparent;color:inherit;font:inherit;font-size:13px}
.nc-f select option{color:#000}
.nc h4{font-size:12.5px;text-transform:uppercase;letter-spacing:.5px;opacity:.65;margin:18px 0 8px}
.nc-tw{overflow:auto;border:1px solid rgba(128,128,128,.25);border-radius:12px;max-height:calc(100vh - 340px);min-height:180px}
.nc table{width:100%;border-collapse:collapse;font-size:13.5px}
.nc th{position:sticky;top:0;background:#006ca8;color:#fff;text-align:left;padding:9px 12px;font-size:12px;white-space:nowrap;z-index:1}
.nc th.num,.nc td.num{text-align:right;font-variant-numeric:tabular-nums}
.nc td{padding:8px 12px;border-bottom:1px solid rgba(128,128,128,.18);white-space:nowrap}
.nc tr:nth-child(even) td{background:rgba(128,128,128,.05)}
.nc tfoot td{font-weight:700;background:rgba(128,128,128,.10)}
.nc .pl{display:inline-block;min-width:34px;text-align:center;border-radius:6px;padding:2px 7px;font-weight:700;font-size:12px;color:#fff}
.nc .st{display:inline-block;border-radius:999px;padding:2px 10px;font-weight:700;font-size:12px}
.nc .st.go{background:#dcfce7;color:#166534}.nc .st.wait{background:#fef3c7;color:#92400e}.nc .st.info{background:#e0f2fe;color:#075985}
.nc .zero{opacity:.35}
.nc-msg{padding:28px;text-align:center;opacity:.7}
.nc-foot{font-size:12px;opacity:.65;margin-top:8px}`;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const num = v => { const x = parseFloat(String(v == null ? '' : v).replace(/[^\d.\-]/g, '')); return isNaN(x) ? null : x; };
  const fmt = (v, d = 1) => { const x = num(v); return x === null ? '-' : x.toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d}); };
  const code = p => PLANT[String(p || '').trim().toUpperCase()] || String(p || '').trim();
  const plant = p => { const c = code(p); return `<span class="pl" style="background:${COLORS[c] || '#64748b'}">${esc(c || '-')}</span>`; };
  // Sheet statuses are Arabic; show them in English.
  function status(s) {
    s = String(s || '').trim();
    if (!s) return '';
    if (s.includes('ابدأ')) return '<span class="st go">Start pouring here</span>';
    const m = s.match(/أقل من\s*(\d+)/);
    if (m) return `<span class="st wait">Aging &lt; ${m[1]} days</span>`;
    const a = s.match(/تعتيق\s*([\d\-–]+)\s*يوم/);
    if (a) return `<span class="st wait">Aging ${esc(a[1])} days</span>`;
    return `<span class="st info">${esc(s)}</span>`;
  }
  // Dates arrive as 2026/07/01, 22-Sep-26 or 05-09-26: normalise to YYYY-MM-DD where possible.
  const MON = {jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12};
  function day(s) {
    s = String(s || '').trim(); let m;
    const p2 = n => String(n).padStart(2, '0'), y4 = y => (String(y).length === 2 ? '20' + y : y);
    if ((m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/))) return m[1] + '-' + p2(m[2]) + '-' + p2(m[3]);
    if ((m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/)) && MON[m[2].toLowerCase()]) return y4(m[3]) + '-' + p2(MON[m[2].toLowerCase()]) + '-' + p2(m[1]);
    if ((m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/))) return y4(m[3]) + '-' + p2(m[2]) + '-' + p2(m[1]);
    return s;
  }
  const localDay = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

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
  const chips = (attr, list, all, cur) => ['', ...list].map(p =>
    `<button class="nc-chip${p === cur ? ' on' : ''}" data-${attr}="${esc(p)}">${p ? esc(p) : all}</button>`).join('');

  /* ---------- Cement Aging: daily discharge per plant silo ---------- */
  function agingView(body, rows) {
    const hi = rows.findIndex(r => r[0] === 'Date');
    if (hi < 2) { body.innerHTML = '<div class="nc-msg">Unexpected sheet layout.</div>'; return; }
    const plantRow = rows.findIndex(r => r.slice(1).some(c => /LIBHERE|VURMAK|LIEBHERR/i.test(c)));
    const typeRow = plantRow + 1;
    const cols = [];              // {i, plant, silo, type}
    let cur = '';
    for (let i = 1; i < rows[hi].length; i++) {
      if (rows[plantRow][i]) cur = code(rows[plantRow][i]);
      if (rows[hi][i]) cols.push({i, plant: cur, silo: rows[hi][i], type: rows[typeRow] ? (rows[typeRow][i] || '') : ''});
    }
    const today = localDay();
    const data = rows.slice(hi + 1).map(r => ({d: day(r[0]), v: cols.map(c => num(r[c.i]) || 0)}))
      .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.d) && x.d <= today);
    const plants = [...new Set(cols.map(c => c.plant))];
    const months = [...new Set(data.map(x => x.d.slice(0, 7)))].sort().reverse();
    const st = {plant: '', month: months[0] || ''};
    body.innerHTML = `<div class="nc-kpis" data-a="kpis"></div>
      <div class="nc-f" data-a="pl">${chips('p', plants, 'All plants', '')}</div>
      <div class="nc-f"><select data-a="m">${months.map(m => `<option value="${m}">${m}</option>`).join('')}<option value="">All months</option></select></div>
      <div class="nc-tw" data-a="tw"></div><div class="nc-foot">Tons of cement discharged into each silo · from Google Sheets</div>`;
    const $ = s => body.querySelector(s);
    function draw() {
      const list = data.filter(x => !st.month || x.d.startsWith(st.month)).reverse();
      const cs = cols.map((c, k) => ({...c, k})).filter(c => !st.plant || c.plant === st.plant);
      // all plants: one column per plant (sum of its silos); one plant: one column per silo
      const groups = st.plant ? cs.map(c => ({label: 'Silo ' + c.silo + (c.type ? ' · ' + c.type : ''), ks: [c.k]}))
        : plants.map(p => ({label: p, ks: cs.filter(c => c.plant === p).map(c => c.k)}));
      const sumRow = x => groups.map(g => g.ks.reduce((a, k) => a + x.v[k], 0));
      const tot = groups.map(() => 0); let grand = 0;
      const body_ = list.map(x => { const s = sumRow(x); s.forEach((v, i) => tot[i] += v); const t = s.reduce((a, b) => a + b, 0); grand += t;
        return `<tr><td>${esc(x.d)}</td>${s.map(v => `<td class="num${v ? '' : ' zero'}">${fmt(v, 2)}</td>`).join('')}<td class="num"><b>${fmt(t, 2)}</b></td></tr>`; }).join('');
      $('[data-a=kpis]').innerHTML = `<div class="nc-k"><b>${fmt(grand, 1)}</b><span>Tons discharged${st.month ? ' · ' + st.month : ''}</span></div>` +
        `<div class="nc-k"><b>${list.filter(x => sumRow(x).some(v => v)).length}</b><span>Days with discharge</span></div>` +
        `<div class="nc-k"><b>${esc((list.find(x => sumRow(x).some(v => v)) || {}).d || '-')}</b><span>Last discharge</span></div>`;
      $('[data-a=tw]').innerHTML = list.length ? `<table><tr><th>Date</th>${groups.map(g => `<th class="num">${esc(g.label)}</th>`).join('')}<th class="num">Total</th></tr>${body_}` +
        `<tfoot><tr><td>Total</td>${tot.map(v => `<td class="num">${fmt(v, 2)}</td>`).join('')}<td class="num">${fmt(grand, 2)}</td></tr></tfoot></table>`
        : '<div class="nc-msg">No data for this month.</div>';
    }
    $('[data-a=pl]').querySelectorAll('.nc-chip').forEach(b => b.onclick = () => {
      $('[data-a=pl]').querySelectorAll('.nc-chip').forEach(x => x.classList.toggle('on', x === b)); st.plant = b.dataset.p; draw(); });
    $('[data-a=m]').onchange = e => { st.month = e.target.value; draw(); };
    draw();
  }

  /* ---------- Cement Balance: silo tons per plant ---------- */
  function balanceView(body, rows) {
    const items = []; let cur = '';
    for (const r of rows) {
      const c = r[2] || '';
      if (/^[LV]\d$/i.test(c) && !r[3]) { cur = c.toUpperCase(); continue; }
      if (/^S\d+$/i.test(c) && cur) items.push({plant: cur, silo: c.toUpperCase(), type: r[3] || '', t: num(r[4]) || 0});
    }
    const types = [...new Set(items.map(x => x.type).filter(Boolean))];
    const byType = types.map(t => ({t, v: items.filter(x => x.type === t).reduce((a, x) => a + x.t, 0)}));
    const plants = [...new Set(items.map(x => x.plant))];
    let h = `<div class="nc-kpis">${byType.map(x => `<div class="nc-k"><b>${fmt(x.v, 1)}</b><span>${esc(x.t)} tons · all plants</span></div>`).join('')}</div>`;
    h += `<h4>Tons per plant</h4><div class="nc-tw" style="min-height:0"><table><tr><th>Plant</th>${types.map(t => `<th class="num">${esc(t)}</th>`).join('')}<th class="num">Total</th></tr>` +
      plants.map(p => { const v = types.map(t => items.filter(x => x.plant === p && x.type === t).reduce((a, x) => a + x.t, 0));
        return `<tr><td>${plant(p)}</td>${v.map(x => `<td class="num${x ? '' : ' zero'}">${fmt(x, 2)}</td>`).join('')}<td class="num"><b>${fmt(v.reduce((a, b) => a + b, 0), 2)}</b></td></tr>`; }).join('') +
      `<tfoot><tr><td>Total</td>${byType.map(x => `<td class="num">${fmt(x.v, 2)}</td>`).join('')}<td class="num">${fmt(byType.reduce((a, x) => a + x.v, 0), 2)}</td></tr></tfoot></table></div>`;
    h += `<h4>Silos</h4><div class="nc-tw"><table><tr><th>Plant</th><th>Silo</th><th>Cement</th><th class="num">Tons</th></tr>` +
      items.map(x => `<tr><td>${plant(x.plant)}</td><td>${esc(x.silo)}</td><td>${esc(x.type)}</td><td class="num${x.t ? '' : ' zero'}">${fmt(x.t, 2)}</td></tr>`).join('') + '</table></div>';
    body.innerHTML = h + '<div class="nc-foot">Current cement in each silo · from Google Sheets</div>';
  }

  /* ---------- Filling Priority ---------- */
  function priorityView(body, rows) {
    const hi = rows.findIndex(r => r[0] === 'المحطة');
    const items = rows.slice(hi + 1).filter(r => r[0] && r[1])
      .map(r => ({plant: r[0], silo: r[1], reason: r[2], last: day(r[3]), days: num(r[4]), bal: num(r[5])}));
    body.innerHTML = `<div class="nc-kpis"><div class="nc-k"><b>${items.length}</b><span>Silos in the list</span></div>` +
      `<div class="nc-k"><b>${esc((items[0] || {}).plant ? code(items[0].plant) + ' · silo ' + items[0].silo : '-')}</b><span>First in priority</span></div></div>` +
      `<div class="nc-tw"><table><tr><th>#</th><th>Plant</th><th>Silo</th><th>Reason</th><th>Last filled</th><th class="num">Aging days</th><th class="num">Balance (t)</th></tr>` +
      items.map((x, i) => `<tr><td>${i + 1}</td><td>${plant(x.plant)}</td><td>${esc(x.silo)}</td><td>${status(x.reason)}</td><td>${esc(x.last)}</td>` +
        `<td class="num">${x.days == null ? '-' : x.days}</td><td class="num">${fmt(x.bal, 1)}</td></tr>`).join('') +
      '</table></div><div class="nc-foot">Order from the sheet · from Google Sheets</div>';
  }

  /* ---------- Aging Tracker: daily start per plant + silo detail ---------- */
  function trackerView(body, rows) {
    const date = (rows.find(r => r[0] === 'التاريخ الحالي') || [])[1] || '';
    const limit = (rows.find(r => (r[0] || '').startsWith('حد التنبيه')) || [])[1] || '';
    const heads = rows.map((r, i) => r[0] === 'المحطة' ? i : -1).filter(i => i >= 0);
    const split = rows.findIndex(r => (r[0] || '').startsWith('تفصيل'));
    const rec = heads.length ? rows.slice(heads[0] + 1, split > heads[0] ? split : undefined).filter(r => r[0] && r[1]) : [];
    const det = heads[1] ? rows.slice(heads[1] + 1).filter(r => r[0] && r[1]) : [];
    const tons = s => fmt(num(s), 1);
    let h = `<div class="nc-kpis"><div class="nc-k"><b>${esc(day(date) || '-')}</b><span>Sheet date</span></div>` +
      `<div class="nc-k"><b>${esc(limit || '-')}</b><span>Alert limit (days)</span></div></div>`;
    h += `<h4>Daily start recommendation</h4><div class="nc-tw" style="min-height:0"><table><tr><th>Plant</th><th>Start from silo</th><th>Last filled</th><th class="num">Aging days</th><th>Status</th><th class="num">Balance (t)</th></tr>` +
      rec.map(r => `<tr><td>${plant(r[0])}</td><td><b>${esc(r[1])}</b></td><td>${esc(day(r[2]))}</td><td class="num">${esc(r[3])}</td><td>${status(r[4])}</td><td class="num">${tons(r[5])}</td></tr>`).join('') + '</table></div>';
    h += `<h4>Silo detail</h4><div class="nc-tw"><table><tr><th>Plant</th><th>Silo</th><th>Last filled</th><th class="num">Aging days</th><th>Status</th><th class="num">Balance (t)</th></tr>` +
      det.map(r => `<tr><td>${plant(r[0])}</td><td>${esc(r[1])}</td><td>${esc(day(r[2]))}</td><td class="num">${esc(r[3])}</td><td>${status(r[4])}</td><td class="num">${tons(r[5])}</td></tr>`).join('') + '</table></div>';
    body.innerHTML = h + '<div class="nc-foot">Start pouring from the oldest silo · from Google Sheets</div>';
  }

  const VIEWS = {aging: agingView, balance: balanceView, priority: priorityView, tracker: trackerView};

  window.ncmCement = async function (host, tab) {
    if (!document.getElementById('nc-css')) {
      const s = document.createElement('style'); s.id = 'nc-css'; s.textContent = CSS; document.head.appendChild(s);
    }
    tab = TABS[tab] ? tab : (host.dataset.ncTab || 'aging');
    host.dataset.ncTab = tab;
    host.innerHTML = `<div class="nc">
      <div class="nc-top"><h3>Cement Silo Tracking</h3>
        <a class="nc-btn" target="_blank" rel="noopener" href="${editUrl(TABS[tab].gid)}">Open the sheet ↗</a>
        <button class="nc-btn ghost" data-a="reload">↻ Refresh</button></div>
      <div class="nc-tabs">${Object.entries(TABS).map(([k, t]) => `<button class="nc-tab${k === tab ? ' on' : ''}" data-t="${k}">${t.label}</button>`).join('')}</div>
      <div data-a="body"><div class="nc-msg">Loading…</div></div></div>`;
    host.querySelectorAll('.nc-tab').forEach(b => b.onclick = () => window.ncmCement(host, b.dataset.t));
    host.querySelector('[data-a=reload]').onclick = () => window.ncmCement(host, tab);
    const body = host.querySelector('[data-a=body]');
    try { VIEWS[tab](body, await load(TABS[tab].gid)); }
    catch (e) { body.innerHTML = `<div class="nc-msg">Could not load the sheet. <a class="nc-btn" target="_blank" rel="noopener" href="${editUrl(TABS[tab].gid)}">Open the sheet ↗</a></div>`; }
  };
})();
