/* NCM maintenance log view - reads the shared Google Sheet (CSV export) and draws
   a clean, filterable table. Used by the NCM Hub page and the NCM PLANTS program.
   Usage: ncmMaint(hostElement) */
(function () {
  'use strict';
  const SHEET = 'https://docs.google.com/spreadsheets/d/1xrmjnlPOJG7SzjT9lYIkJhaIDJEGFDENoPuQJgxvy30';
  const GID = '134919722';
  const CSV = SHEET + '/export?format=csv&gid=' + GID;
  const EDIT = SHEET + '/edit?gid=' + GID + '#gid=' + GID;

  const CSS = `
.nm{direction:rtl;font-family:inherit;color:inherit}
.nm *{box-sizing:border-box}
.nm-top{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:14px}
.nm-top h3{margin:0;font-size:17px;flex:1;min-width:180px}
.nm-btn{display:inline-flex;align-items:center;gap:6px;background:#2457d6;color:#fff!important;border:0;border-radius:9px;padding:8px 14px;font-weight:600;font-size:13px;text-decoration:none;cursor:pointer}
.nm-btn.ghost{background:transparent;color:inherit!important;border:1px solid rgba(128,128,128,.35)}
.nm-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:14px}
.nm-k{border:1px solid rgba(128,128,128,.25);border-radius:12px;padding:11px 13px;background:rgba(128,128,128,.06)}
.nm-k b{display:block;font-size:21px;font-variant-numeric:tabular-nums}
.nm-k span{font-size:11.5px;opacity:.7}
.nm-f{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
.nm-chip{border:1px solid rgba(128,128,128,.35);background:transparent;color:inherit;border-radius:999px;padding:5px 12px;font-size:12.5px;cursor:pointer;font-weight:600}
.nm-chip.on{background:#2457d6;border-color:#2457d6;color:#fff}
.nm-f input,.nm-f select{flex:1;min-width:150px;padding:7px 10px;border:1px solid rgba(128,128,128,.35);border-radius:9px;background:transparent;color:inherit;font:inherit;font-size:13px}
.nm-f select{flex:0 0 auto;min-width:130px}
.nm-f select option{color:#000}
.nm-tw{overflow:auto;border:1px solid rgba(128,128,128,.25);border-radius:12px;max-height:calc(100vh - 330px);min-height:240px}
.nm table{width:100%;border-collapse:collapse;font-size:13.5px}
.nm th{position:sticky;top:0;background:#2457d6;color:#fff;text-align:right;padding:9px 12px;font-size:12px;white-space:nowrap;z-index:1}
.nm td{padding:9px 12px;border-bottom:1px solid rgba(128,128,128,.18);vertical-align:top}
.nm tr:nth-child(even) td{background:rgba(128,128,128,.05)}
.nm td.d{white-space:nowrap;font-variant-numeric:tabular-nums;opacity:.85}
.nm td.w{min-width:240px;line-height:1.5}
.nm td.n{opacity:.75;font-size:12.5px;min-width:160px}
.nm .pl{display:inline-block;min-width:34px;text-align:center;border-radius:6px;padding:2px 7px;font-weight:700;font-size:12px;color:#fff}
.nm-msg{padding:28px;text-align:center;opacity:.7}
.nm-foot{font-size:12px;opacity:.65;margin-top:8px}`;
  const COLORS = {L1: '#2457d6', L2: '#0e7490', V3: '#7c3aed', V4: '#c2410c', V5: '#15803d'};

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

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

  function toItems(rows) {
    const h = rows.findIndex(r => r.some(c => c.trim() === 'التاريخ'));
    if (h < 0) return [];
    const head = rows[h].map(c => c.trim());
    const ix = name => head.indexOf(name);
    const iD = ix('التاريخ'), iP = ix('المحطة'), iO = ix('اسم المشغل'),
          iW = head.findIndex(c => c.startsWith('الأعمال')), iN = ix('ملاحظات');
    // Dates are typed by hand (2026-10-06, 2026.10.8, 2026/10/8): normalise to YYYY-MM-DD.
    const day = s => {
      const m = String(s || '').trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
      return m ? m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0') : String(s || '').trim();
    };
    return rows.slice(h + 1).map(r => ({
      date: day(r[iD]), plant: (r[iP] || '').trim(), op: (r[iO] || '').trim(),
      work: (r[iW] || '').trim(), note: iN >= 0 ? (r[iN] || '').trim() : ''
    })).filter(x => x.work || x.op);
  }

  window.ncmMaint = async function (host) {
    if (!document.getElementById('nm-css')) {
      const s = document.createElement('style'); s.id = 'nm-css'; s.textContent = CSS; document.head.appendChild(s);
    }
    host.innerHTML = '<div class="nm"><div class="nm-msg">جاري تحميل سجل الصيانة…</div></div>';
    let items;
    try {
      const r = await fetch(CSV + '&t=' + Date.now(), {cache: 'no-store'});
      if (!r.ok) throw new Error(r.status);
      items = toItems(parseCSV(await r.text()));
    } catch (e) {
      host.innerHTML = '<div class="nm"><div class="nm-msg">تعذر تحميل الشيت. <a class="nm-btn" target="_blank" rel="noopener" href="' + EDIT + '">افتح الشيت ↗</a></div></div>';
      return;
    }
    items.sort((a, b) => b.date.localeCompare(a.date));
    const plants = [...new Set(items.map(x => x.plant).filter(Boolean))].sort();
    const months = [...new Set(items.map(x => x.date.slice(0, 7)).filter(m => /^\d{4}-\d{2}$/.test(m)))].sort().reverse();
    const st = {plant: '', month: '', q: ''};
    const thisMonth = new Date().toISOString().slice(0, 7);

    host.innerHTML = `<div class="nm">
      <div class="nm-top"><h3>🔧 سجل أعمال الصيانة</h3>
        <a class="nm-btn" target="_blank" rel="noopener" href="${EDIT}">＋ إضافة / تعديل في الشيت</a>
        <button class="nm-btn ghost" data-a="reload">↻ تحديث</button></div>
      <div class="nm-kpis" data-a="kpis"></div>
      <div class="nm-f"><button class="nm-chip on" data-p="">كل المحطات</button>${plants.map(p => `<button class="nm-chip" data-p="${esc(p)}">${esc(p)}</button>`).join('')}</div>
      <div class="nm-f"><input type="search" placeholder="بحث في الأعمال أو اسم المشغل…" data-a="q">
        <select data-a="m"><option value="">كل الشهور</option>${months.map(m => `<option value="${m}">${m}</option>`).join('')}</select></div>
      <div class="nm-tw" data-a="tw"></div>
      <div class="nm-foot" data-a="foot"></div></div>`;
    const $ = s => host.querySelector(s);

    function draw() {
      const q = st.q.toLowerCase();
      const list = items.filter(x => (!st.plant || x.plant === st.plant) && (!st.month || x.date.startsWith(st.month)) &&
        (!q || (x.work + ' ' + x.op + ' ' + x.note).toLowerCase().includes(q)));
      const base = items.filter(x => !st.plant || x.plant === st.plant);
      $('[data-a=kpis]').innerHTML =
        `<div class="nm-k"><b>${base.length}</b><span>إجمالي الأعمال</span></div>` +
        `<div class="nm-k"><b>${base.filter(x => x.date.startsWith(thisMonth)).length}</b><span>هذا الشهر</span></div>` +
        `<div class="nm-k"><b>${esc((base[0] || {}).date || '-')}</b><span>آخر عمل</span></div>` +
        `<div class="nm-k"><b>${new Set(base.map(x => x.op).filter(Boolean)).size}</b><span>عدد الفنيين</span></div>`;
      $('[data-a=tw]').innerHTML = list.length ? '<table><tr><th>التاريخ</th><th>المحطة</th><th>اسم المشغل</th><th>الأعمال التي تمت</th><th>ملاحظات</th></tr>' +
        list.map(x => `<tr><td class="d">${esc(x.date)}</td><td><span class="pl" style="background:${COLORS[x.plant] || '#64748b'}">${esc(x.plant || '-')}</span></td>` +
          `<td>${esc(x.op)}</td><td class="w">${esc(x.work)}</td><td class="n">${esc(x.note)}</td></tr>`).join('') + '</table>'
        : '<div class="nm-msg">لا توجد أعمال مطابقة.</div>';
      $('[data-a=foot]').textContent = list.length + ' عمل معروض · البيانات من Google Sheets';
    }
    host.querySelectorAll('.nm-chip').forEach(b => b.onclick = () => {
      host.querySelectorAll('.nm-chip').forEach(x => x.classList.toggle('on', x === b)); st.plant = b.dataset.p; draw();
    });
    $('[data-a=q]').oninput = e => { st.q = e.target.value.trim(); draw(); };
    $('[data-a=m]').onchange = e => { st.month = e.target.value; draw(); };
    $('[data-a=reload]').onclick = () => window.ncmMaint(host);
    draw();
  };
})();
