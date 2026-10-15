/* Grease consumption (workbook "استهلاك الشحم.xlsm") as a Maintenance sub-tab of the NCM Hub.
   The server reads the workbook every 5 minutes and puts its rows in the encrypted hub data
   (D.grease = {tabs: [{title, rows}], edit}); this file only draws them, in English. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const n = v => { const x = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, '')); return isNaN(x) ? null : x; };
  const f = (v, d = 1) => { const x = n(v); return x === null ? esc(v || '-') : x.toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d}); };
  const plant = s => String(s || '').replace(/^محطة\s*/, 'Plant ').replace(/^الإجمالي$/, 'Total');
  const DRUM = {'برميل كامل': 'Full drum', 'تلات تربع برميل': '¾ drum', 'تلتين برميل': '⅔ drum', 'نص برميل': '½ drum',
                'تلت برميل': '⅓ drum', 'ربع برميل': '¼ drum', 'فاضي': 'Empty'};
  const drum = s => DRUM[String(s || '').trim()] || esc(s);
  // summary labels (matched by their beginning, the sheet text is long)
  const LABELS = [['عدد المحطات', 'Plants'], ['وزن البرميل', 'Full drum weight'], ['معدل الشحم لكل 5', 'Grease per 5 trucks'],
    ['معدل الشحم لكل عربية', 'Grease per truck'], ['تاريخ آخر يوم', 'Last recorded day'], ['بداية شهر', 'Report month start'],
    ['مدة التوقع', 'Forecast period'], ['إجمالي الرصيد الحالي', 'Current balance (kg)'], ['الرصيد الحالي بالبرامي', 'Current balance (drums)'],
    ['استهلاك آخر يوم', 'Last day consumption (kg)'], ['استهلاك الشهر', 'Month consumption (kg)'], ['متوسط الاستهلاك اليومي', 'Average per day (kg)'],
    ['مدة كفاية', 'Days of cover'], ['الرصيد المتوقع', 'Forecast balance (kg)']];
  const UNITS = {'محطة': 'plants', 'كجم': 'kg', 'كجم/عربية': 'kg / truck', 'يوم': 'days'};
  const lab = s => { s = String(s || '').trim(); const m = LABELS.find(([a]) => s.startsWith(a)); return m ? m[1] : s; };
  const tabOf = (g, word) => (g.tabs || []).find(t => t.title.includes(word)) || {rows: []};
  const hdr = (rows, first) => rows.findIndex(r => String(r[0] || '').trim() === first);

  function summary(g) {
    const rows = tabOf(g, 'ملخص').rows;
    const params = [], results = [];
    rows.forEach(r => {
      if (r[0] && r[1] !== undefined && r[1] !== '' && !String(r[0]).startsWith('المحطة') && LABELS.some(([a]) => String(r[0]).startsWith(a)))
        params.push([lab(r[0]), r[1], UNITS[String(r[2] || '').trim()] || r[2] || '']);
      if (r[4] && r[5] !== undefined && r[5] !== '') results.push([lab(r[4]), r[5]]);
    });
    const hi = hdr(rows, 'المحطة');
    const cols = ['Plant', 'Opening (kg)', 'Received (kg)', 'Trucks', 'Consumption (kg)', 'Balance (kg)', 'Drum left', '≈', 'Days logged',
      'Trucks / day', 'kg / day', 'Days of cover', 'Forecast (kg)'];
    const prow = hi >= 0 ? rows.slice(hi + 1).filter(r => /^محطة|^الإجمالي/.test(String(r[0] || ''))) : [];
    const res = k => (results.find(r => r[0] === k) || [])[1];
    let h = '<div class="nm-kpis">' +
      `<div class="nm-k"><b>${f(res('Current balance (kg)'), 1)}</b><span>Balance kg</span></div>` +
      `<div class="nm-k"><b>${f(res('Current balance (drums)'), 2)}</b><span>Balance in drums</span></div>` +
      `<div class="nm-k"><b>${f(res('Month consumption (kg)'), 1)}</b><span>Used this month kg</span></div>` +
      `<div class="nm-k"><b>${f(res('Average per day (kg)'), 1)}</b><span>Average kg / day</span></div>` +
      `<div class="nm-k"><b>${f(res('Days of cover'), 0)}</b><span>Days of cover</span></div></div>`;
    h += '<div class="nm-tw" style="min-height:0"><table><tr>' + cols.map((c, i) => `<th${i && i !== 7 ? ' style="text-align:right"' : ''}>${c}</th>`).join('') + '</tr>' +
      prow.map(r => '<tr' + (/الإجمالي/.test(r[0]) ? ' style="font-weight:700"' : '') + '>' + cols.map((c, i) => {
        if (i === 0) return `<td>${esc(plant(r[0]))}</td>`;
        if (i === 6) return `<td style="text-align:right">${f((n(r[6]) || 0) * 100, 0)}%</td>`;
        if (i === 7) return `<td>${drum(r[7])}</td>`;
        return `<td style="text-align:right">${f(r[i], [3, 8].includes(i) ? 0 : 1)}</td>`;
      }).join('') + '</tr>').join('') + '</table></div>';
    h += '<div class="nm-f" style="margin-top:14px;flex-wrap:wrap;gap:16px">' + params.map(p =>
      `<span style="font-size:12.5px"><b>${esc(p[0])}:</b> ${esc(typeof p[1] === 'number' ? f(p[1], p[1] % 1 ? 2 : 0) : p[1])} ${esc(p[2])}</span>`).join('') + '</div>';
    return h;
  }

  function daily(body, g) {
    const rows = tabOf(g, 'يومية').rows;
    const alert = n((rows.find(r => String(r[0] || '').startsWith('حد تنبيه')) || [])[1]) || 0;
    const hi = hdr(rows, 'التاريخ');
    const items = rows.slice(hi + 1).filter(r => /^\d{4}-\d{2}-\d{2}/.test(String(r[0] || '')) && r[2] !== '' && r[2] !== undefined)
      .map(r => ({d: String(r[0]).slice(0, 10), p: plant(r[1]), t: r[2], in: r[3], open: r[4], use: r[5], close: r[6], cover: r[7]})).reverse();
    const plants = [...new Set(items.map(x => x.p))].sort();
    const months = [...new Set(items.map(x => x.d.slice(0, 7)))].sort().reverse();
    const st = {p: '', m: ''};
    body.innerHTML = `<div class="nm-f" data-a="pl">${['', ...plants].map(p => `<button class="nm-chip${p ? '' : ' on'}" data-p="${esc(p)}">${p ? esc(p) : 'All plants'}</button>`).join('')}</div>
      <div class="nm-f"><select data-a="m"><option value="">All months</option>${months.map(m => `<option>${m}</option>`).join('')}</select>
      <span style="font-size:12px;opacity:.7">Balance alert below ${f(alert, 0)} kg</span></div><div class="nm-tw" data-a="tw"></div>`;
    const $ = s => body.querySelector(s);
    function draw() {
      const list = items.filter(x => (!st.p || x.p === st.p) && (!st.m || x.d.startsWith(st.m)));
      $('[data-a=tw]').innerHTML = list.length ? '<table><tr><th>Date</th><th>Plant</th><th style="text-align:right">Trucks loaded</th><th style="text-align:right">Received (kg)</th>' +
        '<th style="text-align:right">Opening (kg)</th><th style="text-align:right">Used (kg)</th><th style="text-align:right">Closing (kg)</th><th style="text-align:right">Days of cover</th></tr>' +
        list.map(x => `<tr><td>${x.d}</td><td>${esc(x.p)}</td><td style="text-align:right">${f(x.t, 0)}</td><td style="text-align:right">${f(x.in, 1)}</td>` +
          `<td style="text-align:right">${f(x.open, 1)}</td><td style="text-align:right">${f(x.use, 1)}</td>` +
          `<td style="text-align:right${n(x.close) !== null && n(x.close) < alert ? ';color:#c0352b;font-weight:700' : ''}">${f(x.close, 1)}</td>` +
          `<td style="text-align:right">${f(x.cover, 0)}</td></tr>`).join('') + '</table>' : '<div class="nm-msg">No entries.</div>';
    }
    $('[data-a=pl]').querySelectorAll('.nm-chip').forEach(b => b.onclick = () => {
      $('[data-a=pl]').querySelectorAll('.nm-chip').forEach(x => x.classList.toggle('on', x === b)); st.p = b.dataset.p; draw(); });
    $('[data-a=m]').onchange = e => { st.m = e.target.value; draw(); };
    draw();
  }

  function opening(g) {
    const rows = tabOf(g, 'رصيد أول').rows;
    const hi = hdr(rows, 'الشهر');
    if (hi < 0) return '<div class="nm-msg">No data.</div>';
    const head = rows[hi].map(c => c === 'الشهر' ? 'Month' : c === 'الإجمالي' ? 'Total' : plant(c));
    const list = rows.slice(hi + 1).filter(r => r.slice(1).some(v => v !== '' && v !== undefined));
    return '<div class="nm-tw" style="min-height:0"><table><tr>' + head.map((c, i) => `<th${i ? ' style="text-align:right"' : ''}>${esc(c)}</th>`).join('') + '</tr>' +
      list.map(r => '<tr>' + head.map((_, i) => i ? `<td style="text-align:right">${f(r[i], 1)}</td>` : `<td>${esc(String(r[0]).slice(0, 7))}</td>`).join('') + '</tr>').join('') +
      '</table></div>';
  }

  window.ncmGrease = function (body, g) {
    if (!g || !g.tabs) { body.innerHTML = `<div class="nm-msg">The grease file could not be read${g && g.error ? ' (' + esc(g.error) + ')' : ''}.</div>`; return; }
    const views = {summary: 'Summary', daily: 'Daily log', opening: 'Opening balance'};
    const show = k => {
      body.innerHTML = '<div class="nm-f" data-a="gv">' + Object.entries(views).map(([v, l]) => `<button class="nm-chip${v === k ? ' on' : ''}" data-v="${v}">${l}</button>`).join('') + '</div><div data-a="gb"></div>' +
        '<div class="nm-foot">From "استهلاك الشحم.xlsm" on Google Drive · updated every 5 minutes</div>';
      body.querySelectorAll('[data-v]').forEach(b => b.onclick = () => show(b.dataset.v));
      const gb = body.querySelector('[data-a=gb]');
      if (k === 'daily') daily(gb, g); else gb.innerHTML = k === 'opening' ? opening(g) : summary(g);
    };
    show('summary');
  };
})();
