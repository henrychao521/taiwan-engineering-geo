/* ============================================================
 * 教師端：解碼學生貼上的成績碼，做班級統計
 * 全在瀏覽器執行；不發送任何網路請求
 * ============================================================ */

const $ = id => document.getElementById(id);
const HISTORY_KEY = 'tweg_history';

const THEMES = (typeof ENG_THEMES !== 'undefined') ? ENG_THEMES : [
  '結構力學與土木工程', '參數化設計與現代建築',
  '機電整合與自動化機構', '新興科技與綠色能源',
];

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function decodeOne(raw) {
  /* 容許「姓名: TWEG:xxxx」格式 */
  let nick = null, code = raw.trim();
  const m = code.match(/^(.+?)\s*[:：]\s*(TWEG:[A-Za-z0-9+/=]+)/);
  if (m) { nick = m[1].trim(); code = m[2].trim(); }
  if (!code.startsWith('TWEG:')) return null;
  const b64 = code.slice(5);
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    const obj = JSON.parse(json);
    return { nick, raw: obj };
  } catch (e) { return null; }
}

function siteName(idx) {
  if (typeof SITES === 'undefined' || idx < 0 || idx >= SITES.length) return '—';
  return SITES[idx][0];
}
function siteTheme(idx) {
  if (idx < 0 || idx >= 200) return -1;
  return Math.floor(idx / 50);
}

function makeBar(name, value, maxValue, displayText) {
  const pct = maxValue ? Math.round(value / maxValue * 100) : 0;
  const txt = displayText != null ? displayText : (Number.isInteger(value) ? value : value.toFixed(1));
  return `<div class="bar-row">
    <div class="name" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
    <div class="bar"><div style="width:${pct}%"></div></div>
    <div class="v">${escapeHtml(String(txt))}</div>
  </div>`;
}

function parseInput() {
  const raw = $('codeInput').value;
  const lines = raw.split(/\n/).map(s => s.trim()).filter(s => s);
  const decoded = [];
  let invalid = 0;
  lines.forEach((l, i) => {
    const d = decodeOne(l);
    if (!d) { invalid++; return; }
    if (!d.nick) d.nick = '學生' + (decoded.length + 1);
    decoded.push(d);
  });
  const msg = $('parseMsg');
  if (!decoded.length) {
    msg.innerHTML = '<span style="color:var(--c-red)">⚠ 未解析到有效的成績碼。請確認每一行包含「TWEG:」開頭的整段碼。</span>';
    renderEmpty();
    return;
  }
  msg.innerHTML = `<span style="color:var(--c-green)">✅ 成功解析 <b>${decoded.length}</b> 筆${invalid ? `（其中 ${invalid} 行無法解碼）` : ''}。</span>`;
  renderStats(decoded);
}

function renderEmpty() {
  $('stN').textContent = '0';
  $('stAvg').textContent = $('stMax').textContent = $('stMin').textContent = '—';
  $('scoreBars').innerHTML = '<div class="tc-empty">貼上成績碼後顯示</div>';
  $('themeBars').innerHTML = '<div class="tc-empty">貼上成績碼後顯示</div>';
  $('hardSites').innerHTML = '<div class="tc-empty">貼上成績碼後顯示</div>';
  $('topPlayers').innerHTML = '<div class="tc-empty">貼上成績碼後顯示</div>';
}

function renderStats(decoded) {
  const n = decoded.length;
  const scores = decoded.map(d => d.raw.s || 0);
  const avg = scores.reduce((a, b) => a + b, 0) / n;
  const max = Math.max(...scores), min = Math.min(...scores);

  $('stN').textContent = n;
  $('stAvg').textContent = Math.round(avg);
  $('stMax').textContent = max;
  $('stMin').textContent = min;

  /* ① 分數條（每位學生） */
  const sorted = decoded.slice().sort((a, b) => (b.raw.s || 0) - (a.raw.s || 0));
  $('scoreBars').innerHTML =
    '<div class="bar-list">' +
    sorted.map(d => makeBar(d.nick, d.raw.s || 0, 13000)).join('') +
    '</div>';

  /* ② 主題表現（平均得分率） */
  const themeStats = [0, 1, 2, 3].map(() => ({ sum: 0, max: 0 }));
  decoded.forEach(d => {
    (d.raw.r || []).forEach(r => {
      const idx = r[0], score = r[2] || 0;
      const t = siteTheme(idx);
      if (t < 0) return;
      themeStats[t].sum += score;
      themeStats[t].max += 1000;
    });
  });
  $('themeBars').innerHTML =
    '<div class="bar-list">' +
    themeStats.map((s, i) => {
      const pct = s.max ? Math.round(s.sum / s.max * 100) : 0;
      return makeBar(`${i + 1}. ${THEMES[i]}`, pct, 100, pct + '%');
    }).join('') +
    '</div>' +
    '<div style="font-size:12px;color:var(--c-muted);margin-top:8px">數字為該主題所有題目的「平均得分率（%）」，比例越低代表全班在該主題越不熟。</div>';

  /* ③ 最常被猜錯的工程地景：依平均得分由低到高，至少出現 2 次 */
  const siteAgg = new Map();
  decoded.forEach(d => {
    (d.raw.r || []).forEach(r => {
      const idx = r[0]; const score = r[2] || 0;
      if (idx < 0 || idx >= 200) return;
      const cur = siteAgg.get(idx) || { sum: 0, n: 0 };
      cur.sum += score; cur.n += 1;
      siteAgg.set(idx, cur);
    });
  });
  const hard = [...siteAgg.entries()]
    .filter(([, v]) => v.n >= 2)
    .map(([idx, v]) => ({ idx, avg: v.sum / v.n, n: v.n }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 10);
  if (!hard.length) {
    $('hardSites').innerHTML = '<div class="tc-empty">需要至少 2 位學生提交，且共同遇過同一景點才能統計。</div>';
  } else {
    $('hardSites').innerHTML =
      '<div class="bar-list">' +
      hard.map(h =>
        `<div class="bar-row">
          <div class="name" title="${escapeHtml(siteName(h.idx))}">${escapeHtml(siteName(h.idx))}</div>
          <div class="bar"><div style="width:${Math.round(h.avg / 1000 * 100)}%;background:linear-gradient(90deg,#B91C1C,#D97706)"></div></div>
          <div class="v">平均 ${Math.round(h.avg)} (${h.n}人)</div>
        </div>`).join('') +
      '</div>';
  }

  /* ④ 表現最好的學生 Top 10 */
  $('topPlayers').innerHTML =
    '<div class="bar-list">' +
    sorted.slice(0, 10).map((d, i) =>
      `<div class="bar-row">
        <div class="name"><b style="color:var(--c-amber);margin-right:4px">${i + 1}</b>${escapeHtml(d.nick)}</div>
        <div class="bar"><div style="width:${Math.round((d.raw.s || 0) / Math.max(max, 1) * 100)}%"></div></div>
        <div class="v">${d.raw.s || 0} 分</div>
      </div>`).join('') +
    '</div>';
}

function renderOwnHistory() {
  let h = [];
  if (typeof TwegAuth !== 'undefined') {
    h = TwegAuth.getHistoryForCurrent() || [];
  }
  if (!h.length) {
    try { h = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (e) {}
  }
  const box = $('ownHistory');
  if (!h.length) {
    box.innerHTML = '<div class="tc-empty" style="padding:16px;font-size:13px">這台瀏覽器目前沒有探索紀錄。</div>';
    return;
  }
  box.innerHTML = '<div class="bar-list">' +
    h.slice(0, 6).map(s => {
      const d = new Date(s.date);
      const ds = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const themeName = s.mode === 'engineering'
        ? (s.theme ? THEMES[s.theme - 1] : '全部主題')
        : (s.mode === 'curated' ? '精選地景' : 'Mapillary');
      const max = (s.rounds.length || 0) * 1000;
      return `<div class="bar-row">
        <div class="name">${escapeHtml(ds)} · ${escapeHtml(themeName)}</div>
        <div class="bar"><div style="width:${max ? Math.round((s.totalScore / max) * 100) : 0}%"></div></div>
        <div class="v">${s.totalScore} 分</div>
      </div>`;
    }).join('') + '</div>';
}

$('parseBtn').addEventListener('click', parseInput);
$('clearBtn').addEventListener('click', () => {
  $('codeInput').value = ''; $('parseMsg').textContent = ''; renderEmpty();
});
$('codeInput').addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') parseInput();
});

/* 載入示例：產生 3 個假的成績碼方便老師試用 */
$('demoBtn').addEventListener('click', () => {
  const demo = makeDemoCodes();
  $('codeInput').value = demo;
  parseInput();
});
function makeDemoCodes() {
  const names = ['小明', '阿凱', '雅婷'];
  const lines = names.map((nick, i) => {
    /* 隨機從 200 個景點挑 10 個 */
    const idxs = [];
    while (idxs.length < 10) {
      const r = Math.floor(Math.random() * 200);
      if (!idxs.includes(r)) idxs.push(r);
    }
    const rounds = idxs.map(idx => {
      const dist = Math.random() * (i === 0 ? 30 : i === 1 ? 60 : 110); /* 三位水準遞減 */
      const score = Math.round(1000 * Math.exp(-dist / 55));
      return [idx, Math.round(dist * 10), score, 0];
    });
    const totalScore = rounds.reduce((a, r) => a + r[2], 0);
    const obj = {
      d: new Date().toISOString().slice(0, 16).replace('T', ' '),
      m: 'E', t: 0, s: totalScore, k: 0, r: rounds,
    };
    const code = 'TWEG:' + btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
    return `${nick}: ${code}`;
  });
  return lines.join('\n');
}

renderEmpty();
renderOwnHistory();
