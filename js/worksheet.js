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
  /* 只顯示短指紋（前 12 碼），完整成績碼仍在結算頁可複製 */
  const shortCode = session.code
    ? session.code.replace(/^TWEG:/, '').slice(0, 12)
    : '—';
  $('codeStamp').textContent = '紀錄 #' + shortCode;
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
  const userPrefix = u ? `<b>👤 ${escapeHtml(u.nick)}</b>　·　` : '';
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
      : (s.mode === 'trial' ? '試玩 20 題'
      : (s.mode === 'curated' ? '精選地景' : 'Mapillary'));
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

  /* 套用 / 清除 teacher mode */
  document.body.classList.toggle('teacher-mode', ver === 'teacher');
  clearTeacherAnswers();
  $('teacherCommentBlock').style.display = (ver === 'teacher') ? '' : 'none';
  $('hSelfAssess').style.display = (ver === 'teacher') ? 'none' : '';
  $('selfAssessTable').style.display = (ver === 'teacher') ? 'none' : '';
  $('extColHead').textContent = (ver === 'teacher') ? '參考填答' : '我的整理';

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
    if (ver === 'teacher') {
      $('wsInfo').innerHTML = '<span style="color:var(--c-amber)">⚠ 尚無探索紀錄，教師版需要學生先完成一局才能產生對應的參考答案。</span>';
    }
    return;
  }
  if (history.length > 1) {
    // 記住目前選取再重建下拉——否則使用者每選一筆舊紀錄都會被重設回最新一局
    const keep = sel.value;
    if (sel.options.length !== history.length) renderSessionSelect(history);
    sel.style.display = '';
    sel.value = (keep !== '' && parseInt(keep, 10) < history.length) ? keep : '0';
  } else {
    sel.style.display = 'none';
  }
  const i = Math.min(parseInt(sel.value || '0', 10), history.length - 1);
  const session = history[i];
  renderRecords(session);
  updateInfo(history, i);

  if (ver === 'teacher') {
    insertTeacherBanner(session);
    renderTeacherAnswers(session);
  }
}

/* ---------- 教師版 helpers ---------- */
const EXT_BLANK = {
  name: '&nbsp;<br>&nbsp;',
  concept: '&nbsp;<br>&nbsp;<br>&nbsp;',
  constraints: '&nbsp;<br>&nbsp;<br>&nbsp;',
  redesign: '&nbsp;<br>&nbsp;<br>&nbsp;<br>&nbsp;',
};
function clearTeacherAnswers() {
  document.querySelectorAll('.ws-answer, .ws-banner').forEach(n => n.remove());
  /* 延伸探究表格也清回空白 */
  document.querySelectorAll('#extTable [data-ext]').forEach(td => {
    const key = td.getAttribute('data-ext');
    if (EXT_BLANK[key] != null) td.innerHTML = EXT_BLANK[key];
  });
}

function insertTeacherBanner(s) {
  const sheet = $('sheet');
  const meta = sheet.querySelector('.ws-meta');
  if (!meta) return;
  const banner = document.createElement('div');
  banner.className = 'ws-banner';
  const themeName = (s.mode === 'engineering')
    ? (s.theme ? THEMES_FOR_WS[s.theme - 1] : '工程地景・全部主題')
    : (s.mode === 'curated' ? '精選地景' : (s.mode === 'trial' ? '試玩 20 題' : 'Mapillary'));
  const shortCode = (s.code || '').replace(/^TWEG:/, '').slice(0, 12);
  banner.innerHTML = `📚 <b>教師版（含參考答案）</b>　·　模式：${escapeHtml(themeName)}　·　總分 ${s.totalScore}　·　紀錄 <code>#${escapeHtml(shortCode)}</code>`;
  meta.parentNode.insertBefore(banner, meta.nextSibling);
}

function regionHintWS(lat, lon) {
  if (lat > 25.9) return '馬祖列島';
  if (lon < 119.0) return '金門';
  if (lon < 120.0 && lat < 24.0) return '澎湖群島';
  if (lon > 121.4 && lat < 22.85) return '台東外海離島';
  if (lat >= 24.5) return '北台灣';
  if (lon >= 121.0) return '東台灣';
  if (lat >= 23.6) return '中台灣';
  return '南台灣';
}

function geoCueOf(name) {
  if (/橋/.test(name)) return { cue: '水文／跨越', why: '橫跨河川或港區，位置由水體與兩岸地形決定，跨距與形式（桁架、拱、斜張、預力箱型）受河寬與通航要求影響。' };
  if (/水庫|壩|堰/.test(name)) return { cue: '水文／集水區', why: '位置由集水區地形決定，壩高、壩型與洩洪量隨地勢、地質與下游城市需水量設計。' };
  if (/隧道/.test(name)) return { cue: '山地／地質', why: '山地阻隔下的最短路徑，岩層強度、湧水量、斷層帶決定鑽掘工法（TBM／NATM）與支撐方式。' };
  if (/風場|風力|風機/.test(name)) return { cue: '海岸／季風', why: '台灣海峽的東北季風與離岸風能，使彰化／苗栗外海成為離岸風機聚集處。' };
  if (/光電|太陽能|地熱/.test(name)) return { cue: '日照／地熱', why: '依日照、土地與資源（如地熱井溫度）選址，鹽田、水庫水面、地熱噴氣孔附近最常見。' };
  if (/港|碼頭|燈塔/.test(name)) return { cue: '海岸／港灣', why: '海岸線、水深、波浪方向影響港區布局與防波堤設計；鹽害與颱風決定材料選擇。' };
  if (/高鐵|捷運|車站|機廠|火車站/.test(name)) return { cue: '城市紋理／人口', why: '由人口密度、聯外動線與都市計畫決定站位；高架／地下化視市區條件而定。' };
  if (/機場|航廈|塔台/.test(name)) return { cue: '空域／用地', why: '需要大面積平坦土地、無高樓障礙物，並考量風向、噪音管制與聯外運輸。' };
  if (/101|大樓|塔|i-Tower/.test(name)) return { cue: '都市核心', why: '位於都市核心，承載風與地震載重，常配置 TMD 阻尼器、巨型構架等抗震／抗風技術。' };
  if (/科學園區|工業區|科技園區|園區|廠/.test(name)) return { cue: '產業聚落', why: '依地質穩定度、水電與人才聚集選址，群聚效應形成竹科／中科／南科。' };
  return { cue: '綜合', why: '位置由地理、人文與工程需求共同決定。' };
}

function buildAnswers(session) {
  const rounds = session?.rounds || [];
  if (!rounds.length) return null;

  /* Q1：本局最低分景點 */
  const worst = rounds.slice().sort((a, b) => (a.score || 0) - (b.score || 0))[0];
  const w_geo = geoCueOf(worst.name);
  const q1 = `<p><b>示範挑選：</b>「${escapeHtml(worst.name)}」（本局得分 <b>${worst.score}</b> 分，距離正解 ${worst.distance < 1 ? '&lt;1' : Math.round(worst.distance)} 公里，屬「${escapeHtml(worst.type || '工程地景')}」）。</p>
<p><b>為什麼出現在這個位置：</b>位於${regionHintWS(worst.lat, worst.lon)}。${escapeHtml(w_geo.why)}<br>對應教材知識點：${escapeHtml(worst.tip || '—')}</p>
<p><b>評分要點：</b>能說出「地理位置 → 工程需求 → 技術選擇」三層關聯即可給分。</p>`;

  /* Q2：本局最高分景點 */
  const best = rounds.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  const facet = /橋|大樓|塔|建築|車站|歌劇院|球場|博物館|圖書館/.test(best.name) ? '結構'
              : /旋轉|纜車|閘門|月台|捷運|鐵|軌|機廠|機台/.test(best.name) ? '機構'
              : '結構或控制';
  const q2 = `<p><b>示範挑選：</b>「${escapeHtml(best.name)}」（本局最高分 <b>${best.score}</b> 分）。建議從「<b>${facet}</b>」面向切入。</p>
<p><b>設計巧思：</b>${escapeHtml(best.tip || '—')}</p>
<p><b>評分要點：</b>能具體指出某一項「形式選擇」或「機構配置」如何回應功能需求；不要求專業術語完全正確，但要看到「為什麼這樣設計」的思考。</p>`;

  /* Q3：四主題平均得分率 */
  const themeScores = [[], [], [], []];
  rounds.forEach(r => {
    if (r.idx >= 0 && r.idx < 200) themeScores[Math.floor(r.idx / 50)].push(r.score || 0);
  });
  const stats = themeScores.map((arr, i) => ({
    name: THEMES_FOR_WS[i],
    avg: arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null,
    n: arr.length,
  })).filter(t => t.avg !== null);
  stats.sort((a, b) => a.avg - b.avg);
  const wk = stats[0];
  let q3;
  if (wk) {
    const ranks = stats.map(t => `${t.name} ${Math.round(t.avg)}（${t.n}題）`).join('、');
    const reason = wk.name.includes('綠能') || wk.name.includes('新興')
      ? '這類技術較新、學生較少接觸（如離岸風機、地熱、半導體製程），缺乏視覺記憶。'
      : wk.name.includes('機電')
      ? '機構與感測類設施在課堂上較少實際操作，學生對其形貌不熟。'
      : wk.name.includes('參數化')
      ? '當代建築多有強烈造型語言，但學生若沒看過實照，僅從衛星空照圖難以辨識。'
      : '結構工程地景（橋、水庫、隧道）數量多、分布廣，學生對外型較相似的地景容易混淆。';
    q3 = `<p><b>本局四主題平均得分（由低到高）：</b>${escapeHtml(ranks)}</p>
<p><b>最弱主題：</b>「${escapeHtml(wk.name)}」（平均 <b>${Math.round(wk.avg)}</b> 分，共 ${wk.n} 題）。${escapeHtml(reason)}</p>
<p><b>評分要點：</b>能指出哪一個主題分數最低、嘗試自我分析原因即可給分。</p>`;
  } else {
    q3 = `<p>本局未抽到工程地景主題題目（可能為精選地景或試玩模式），此題可不答或從整體得分趨勢談感受。</p>`;
  }

  /* Q4：兩個有明顯地理影響的景點 */
  const geoTagged = rounds.map(r => ({ ...r, _geo: geoCueOf(r.name) }));
  const picked = [];
  const seenCue = new Set();
  geoTagged.forEach(r => {
    if (r._geo.cue !== '綜合' && !seenCue.has(r._geo.cue) && picked.length < 2) {
      picked.push(r); seenCue.add(r._geo.cue);
    }
  });
  while (picked.length < 2 && geoTagged.length > picked.length) {
    const r = geoTagged.find(x => !picked.includes(x));
    if (!r) break;
    picked.push(r);
  }
  const q4 = `<p><b>示範挑選兩座：</b></p>
${picked.map((r, i) => `<p>${i + 1}. <b>${escapeHtml(r.name)}</b>（${escapeHtml(regionHintWS(r.lat, r.lon))}・地理線索：${escapeHtml(r._geo.cue)}）<br>${escapeHtml(r._geo.why)}</p>`).join('')}
<p><b>評分要點：</b>能舉出明確的「地理特徵 → 限制條件 → 設計回應」鏈條即可，例如「東北季風強 → 離岸風機抓得到能量／結構需抗強風」、「河寬與通航 → 斜張橋跨距與主梁高度」。</p>`;

  return { q1, q2, q3, q4 };
}

function renderTeacherAnswers(session) {
  const answers = buildAnswers(session);
  if (!answers) return;
  ['1', '2', '3', '4'].forEach(n => {
    const block = document.querySelector(`.q-block[data-q="${n}"]`);
    if (!block) return;
    const ans = document.createElement('div');
    ans.className = 'ws-answer';
    ans.innerHTML = `<div class="ws-answer-h">📚 參考答案 / 評分要點</div>${answers['q' + n]}`;
    block.appendChild(ans);
  });

  /* 延伸探究：挑教材最豐富（tip 最長）的景點當示範填答 */
  const candidates = (session.rounds || []).filter(r => (r.tip || '').length > 30);
  const pick = candidates.sort((a, b) => (b.tip || '').length - (a.tip || '').length)[0] || (session.rounds || [])[0];
  if (!pick) return;
  const g = geoCueOf(pick.name);
  const ext = {
    name: `${pick.name}（${regionHintWS(pick.lat, pick.lon)}・座標 ${pick.lat.toFixed(3)}, ${pick.lon.toFixed(3)}）`,
    concept: pick.tip || '—',
    constraints: `示例：${g.why} 此外可能受到颱風、地震、海鹽害、地層下陷、用地取得等限制。`,
    redesign: '示例：可採結構健康監測（SHM）感測器、低碳混凝土、加裝阻尼器或被動式抗震裝置，或改用模組化施工縮短工期、降低交通衝擊。',
  };
  document.querySelectorAll('#extTable [data-ext]').forEach(td => {
    const key = td.getAttribute('data-ext');
    td.innerHTML = `<div style="color:#14532D;line-height:1.7;font-size:12.5px">${escapeHtml(ext[key])}</div>`;
  });
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

/* 截圖／教學 demo：?teacher=1 自動切到教師版 */
if (new URLSearchParams(location.search).get('teacher')) {
  $('versionSel').value = 'teacher';
}

applyCurrent();
