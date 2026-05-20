/* ============================================================
 * 學習單頁：把 localStorage 中最近一次的 探索結果 帶入學習單表格
 * 也支援空白版（給沒玩過或要手寫的情境）、選擇歷史紀錄、列印
 * ============================================================ */

const HISTORY_KEY = 'tweg_history';
const $ = id => document.getElementById(id);

const THEMES_FOR_WS = (typeof ENG_THEMES !== 'undefined') ? ENG_THEMES : [
  '結構力學與土木工程', '參數化設計與現代建築',
  '機電整合與自動化機構', '新興科技與綠色能源',
];
const THEME_SHORT = ['結構/土木', '參數/建築', '機電/自動', '新科技/綠能'];

function loadHistory() {
  /* 優先讀登入帳號的紀錄；未登入則 fall back 到 legacy 全域紀錄 */
  if (typeof TwegAuth !== 'undefined') {
    const list = TwegAuth.getHistoryForCurrent();
    if (list && list.length) return list;
  }
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch (e) { return []; }
}

function fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function renderRecords(session) {
  const body = $('recBody');
  body.innerHTML = '';
  if (!session) {
    /* 空白 10 列 */
    for (let i = 0; i < 10; i++) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td>` + `<td>&nbsp;</td>`.repeat(7);
      body.appendChild(tr);
    }
    $('codeStamp').textContent = 'CODE: —';
    return;
  }
  session.rounds.forEach((r, i) => {
    const theme = r.idx >= 0 && r.idx < 200 ? THEME_SHORT[Math.floor(r.idx / 50)] : '—';
    const ch = r.ch ? `第${'一二三四五'[r.ch - 1]}章` : '—';
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${i + 1}</td>` +
      `<td><b>${escapeHtml(r.name)}</b></td>` +
      `<td>${theme}</td>` +
      `<td>${escapeHtml(r.type || '—')}</td>` +
      `<td>${ch}</td>` +
      `<td style="font-size:12px;line-height:1.55">${escapeHtml(r.tip || '')}</td>` +
      `<td style="text-align:right;font-family:var(--f-mono)">${r.distance < 1 ? '<1' : Math.round(r.distance)}</td>` +
      `<td style="text-align:right;font-family:var(--f-mono);font-weight:700;color:var(--c-primary)">${r.score}</td>`;
    body.appendChild(tr);
  });
  /* 不足 10 列補齊 */
  for (let i = session.rounds.length; i < 10; i++) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i + 1}</td>` + `<td>&nbsp;</td>`.repeat(7);
    body.appendChild(tr);
  }
  $('codeStamp').textContent = 'CODE: ' + (session.code || '—');
  /* 日期欄位 */
  $('metaDate').textContent = fmtDateTime(session.date);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function updateInfo(history, sessionIdx) {
  const info = $('wsInfo');
  const u = (typeof TwegAuth !== 'undefined') ? TwegAuth.currentUser() : null;
  const userPrefix = u ? `<b>👤 ${u.nick}</b>　·　` : '';
  if (!history.length) {
    info.innerHTML = userPrefix + '尚未有探索紀錄。可先進入「開始探索」完成一局，或繼續使用空白版列印。';
    info.style.color = 'var(--c-muted)';
    return;
  }
  const s = history[sessionIdx];
  if (!s) { info.textContent = '—'; return; }
  const themeName = (s.mode === 'engineering' || s.mode === 'trial')
    ? (s.mode === 'trial'
        ? '試玩 20 題'
        : (s.theme ? `工程地景・${THEMES_FOR_WS[s.theme - 1]}` : '工程地景・全部主題'))
    : (s.mode === 'curated' ? '精選地景' : 'Mapillary 即時');
  info.innerHTML = userPrefix + `已載入：${fmtDateTime(s.date)}　·　${themeName}　·　總分 <b style="color:var(--c-primary)">${s.totalScore}</b>${s.deepMode ? '　·　深度模式' : ''}`;
  info.style.color = 'var(--c-ink-soft)';
}

function renderSessionSelect(history) {
  const sel = $('sessionSel');
  sel.innerHTML = '';
  history.forEach((s, i) => {
    const themeName = s.mode === 'engineering'
      ? (s.theme ? THEMES_FOR_WS[s.theme - 1] : '全部主題')
      : (s.mode === 'curated' ? '精選地景' : 'Mapillary');
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${fmtDateTime(s.date)}・${themeName}・${s.totalScore} 分`;
    sel.appendChild(opt);
  });
}

function applyCurrent() {
  const history = loadHistory();
  const ver = $('versionSel').value;
  const sel = $('sessionSel');
  if (ver === 'blank') {
    sel.style.display = 'none';
    renderRecords(null);
    $('wsInfo').textContent = '空白版：所有欄位由學生手寫填入。';
    $('wsInfo').style.color = 'var(--c-amber)';
    $('metaDate').textContent = ' ';
    return;
  }
  if (!history.length) {
    sel.style.display = 'none';
    renderRecords(null);
    updateInfo([], 0);
    return;
  }
  if (history.length > 1) {
    renderSessionSelect(history);
    sel.style.display = '';
    sel.value = sel.value || '0';
  } else {
    sel.style.display = 'none';
  }
  const i = Math.min(parseInt(sel.value || '0', 10), history.length - 1);
  renderRecords(history[i]);
  updateInfo(history, i);
}

$('versionSel').addEventListener('change', applyCurrent);
$('sessionSel').addEventListener('change', applyCurrent);
$('printBtn').addEventListener('click', () => window.print());

/* 截圖／教學 demo：?demo=1 時自動建立示範檔案 + 紀錄 */
if (new URLSearchParams(location.search).get('demo') &&
    typeof TwegAuth !== 'undefined' && !TwegAuth.currentUser()) {
  TwegAuth.create({ nick: '小明', age: 16, gender: '男' });
  const p = TwegAuth.currentUser();
  p.createdAt = '2026-05-19T08:00:00.000Z';
  p.history = [{
    date: '2026-05-20T14:21:00.000Z', mode: 'engineering', theme: 0, deepMode: false,
    totalScore: 6850, maxScore: 10000,
    rounds: [
      { idx: 0, name: '西螺大橋', lat: 23.8113, lon: 120.4606, ch: 3,
        tip: '桁架結構分析（Truss）、靜定與靜不定結構判斷、拉壓桿件受力與材料降伏強度分析。', type: '橋樑', distance: 2.4, score: 957 },
      { idx: 5, name: '翡翠水庫大壩', lat: 24.908, lon: 121.5734, ch: 0,
        tip: '三心雙向彎曲變厚度混凝土拱壩。', type: '水利設施（水庫／攔河堰）', distance: 5.1, score: 911 },
      { idx: 50, name: '台中國家歌劇院', lat: 24.1624, lon: 120.6413, ch: 2,
        tip: '連續曲面殼體結構（Sound Cave）。', type: '文化／教育場館', distance: 0.6, score: 989 },
      { idx: 100, name: '高雄大港橋', lat: 22.6168, lon: 120.2536, ch: 3,
        tip: '水平旋轉機構。馬達驅動大齒輪系。', type: '橋樑', distance: 18, score: 720 },
      { idx: 156, name: '苗栗海洋竹南離岸風場', lat: 24.6855, lon: 120.8011, ch: 0,
        tip: '海洋工程水下基礎。', type: '發電／能源設施', distance: 22, score: 670 },
      { idx: 4, name: '台北101大樓', lat: 25.0339, lon: 121.5644, ch: 0,
        tip: '巨型構架與調諧質量阻尼器（TMD）。', type: '高樓建築', distance: 1.2, score: 978 },
      { idx: 154, name: '台積電竹科 12 廠', lat: 24.7732, lon: 121.0125, ch: 0,
        tip: '先進製程研發中心。', type: '產業園區／廠房', distance: 35, score: 530 },
      { idx: 18, name: '蘇花改觀音隧道', lat: 24.3751, lon: 121.785, ch: 0,
        tip: '長隧道開挖工程。', type: '隧道', distance: 6.8, score: 880 },
      { idx: 32, name: '大漢溪新月橋', lat: 25.0298, lon: 121.4503, ch: 0,
        tip: '雙跨不對稱鋼拱橋。', type: '橋樑', distance: 14, score: 770 },
      { idx: 100, name: '高雄大港橋', lat: 22.6168, lon: 120.2536, ch: 3,
        tip: '水平旋轉機構。', type: '橋樑', distance: 10, score: 445 },
    ],
  }];
  localStorage.setItem('tweg_profile', JSON.stringify(p));
}

/* 已登入時自動帶入暱稱到「姓名」欄 */
if (typeof TwegAuth !== 'undefined') {
  const u = TwegAuth.currentUser();
  if (u && u.nick) $('metaName').textContent = u.nick;
}

applyCurrent();
