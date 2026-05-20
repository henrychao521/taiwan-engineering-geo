/* ============================================================
 * 台灣工程地景探索 — 主要遊戲邏輯
 * 三種模式：工程地景（200 景點 / 四主題）、精選地景、Mapillary 即時
 * 深度模式：揭曉後追問 2 題（主題分類、設施類型）
 * 結果存到 localStorage 給學習單與教師端使用
 * ============================================================ */

const TOKEN_KEY = 'tweg_mapillary_token';
const HISTORY_KEY = 'tweg_history';
const DEEP_KEY = 'tweg_deep_mode';
const MAX_HISTORY = 20;

const $ = id => document.getElementById(id);

/* ---------- 猜測地圖：Leaflet + CartoDB Voyager ---------- */
const TW_VIEW = [23.7, 120.95], TW_ZOOM = 7;
const lmap = L.map('map', {
  minZoom: 6, zoomControl: true, attributionControl: true,
  maxBounds: [[20.4, 117.4], [26.9, 123.6]], maxBoundsViscosity: 0.85,
}).setView(TW_VIEW, TW_ZOOM);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  subdomains: 'abcd', maxZoom: 16, attribution: '© OpenStreetMap, © CARTO',
}).addTo(lmap);
const GUESS_ICON = L.divIcon({ className: '', iconSize: [22, 22],
  html: '<div class="gm gm-guess">你</div>' });
const ACTUAL_ICON = L.divIcon({ className: '', iconSize: [22, 22],
  html: '<div class="gm gm-actual">✓</div>' });
let guessMarker = null, actualMarker = null, distLine = null;
function clearMap() {
  [guessMarker, actualMarker, distLine].forEach(o => o && lmap.removeLayer(o));
  guessMarker = actualMarker = distLine = null;
  lmap.setView(TW_VIEW, TW_ZOOM);
  lmap.invalidateSize();
}

/* ---------- 衛星空照：Esri World Imagery 瓦片
 * 改用瓦片端點（256x256 預渲染、CDN 快取、可重複使用），
 * 取代以往 export 端點（每次伺服器即時合成單張 JPEG，無快取） */
const ZOOM_NAMES = ['街廓', '近', '中', '遠', '最遠'];
const SAT_ZOOMS  = [17, 16, 15, 13, 12];   /* 對應五段視野的 Leaflet zoom */
const SAT_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
let satMap = null, satLayer = null;
function initSatMap() {
  if (satMap) return satMap;
  satMap = L.map('satMap', {
    zoomControl: false, attributionControl: true,
    minZoom: 10, maxZoom: 19,
    inertia: false, worldCopyJump: false, fadeAnimation: true,
  }).setView([23.7, 120.95], 13);
  satLayer = L.tileLayer(SAT_TILE_URL, {
    maxZoom: 19, tileSize: 256, keepBuffer: 2, updateWhenZooming: false,
    attribution: 'Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN',
  }).addTo(satMap);
  /* 補一個十字標記（揭曉前看不到，揭曉時才打開 — 由 applyZoom 控制） */
  return satMap;
}
function showSatMap() {
  $('photo').style.display = 'none';
  $('photoMsg').classList.add('hidden');
  $('satMap').classList.add('on');
  initSatMap();
  /* 容器寬高在 display:none → block 後才正確，需告訴 Leaflet 重算 */
  setTimeout(() => satMap && satMap.invalidateSize(), 30);
}
function hideSatMap() { $('satMap').classList.remove('on'); }

/* 預載指定座標附近的瓦片（背景靜默載入，僅為了暖快取）
 * 範圍：以中心點為中心的 3x3 = 9 個瓦片，預設為「遠」視野 z=13 */
function prefetchSatTiles(lat, lon, z) {
  const n = Math.pow(2, z);
  const xc = (lon + 180) / 360 * n;
  const latRad = lat * Math.PI / 180;
  const yc = (1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n;
  const cx = Math.floor(xc), cy = Math.floor(yc);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= n || y >= n) continue;
      const url = SAT_TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
      const img = new Image();
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = url;
    }
  }
}

function distKm(a, b) {
  const R = 6371, t = Math.PI / 180;
  const dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t;
  const h = Math.sin(dLa / 2) ** 2 +
    Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

let mode, rounds, idx, total, guess, actual, state, current, roundCount, zoomIdx, engTheme;
let deepMode = false;
let sessionRounds = [];   /* 收集本局每題的紀錄 */

/* 工程地景：依目前視野等級，把衛星迷你地圖切到對應 Leaflet zoom */
function applyZoom() {
  zoomIdx = Math.max(0, Math.min(SAT_ZOOMS.length - 1, zoomIdx));
  $('zoomOut').disabled = zoomIdx >= SAT_ZOOMS.length - 1;
  $('zoomIn').disabled = zoomIdx <= 0;
  $('zoomLabel').textContent = '視野：' + ZOOM_NAMES[zoomIdx] + '（➖ 拉遠看地理位置、➕ 拉近看工程結構）';
  showSatMap();
  satMap.setView([current.lat, current.lon], SAT_ZOOMS[zoomIdx], { animate: true });
}

/* ---------- Mapillary ---------- */
async function fetchMapillaryShot() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  for (let attempt = 0; attempt < 9; attempt++) {
    const seed = SEEDS[(Math.random() * SEEDS.length) | 0];
    const cx = seed[0] + (Math.random() - 0.5) * 0.045;
    const cy = seed[1] + (Math.random() - 0.5) * 0.045;
    let half = 0.0045;
    for (let shrink = 0; shrink < 3; shrink++) {
      const bbox = [cx - half, cy - half, cx + half, cy + half].map(n => n.toFixed(5)).join(',');
      const url = 'https://graph.mapillary.com/images?access_token=' + encodeURIComponent(token) +
        '&fields=id,computed_geometry,thumb_1024_url&bbox=' + bbox + '&limit=8';
      let j;
      try { j = await (await fetch(url)).json(); }
      catch (e) { return { error: 'network' }; }
      if (j.error) {
        if (/reduce/i.test(j.error.message || '')) { half *= 0.5; continue; }
        return { error: 'auth' };
      }
      const list = (j.data || []).filter(d => d.thumb_1024_url && d.computed_geometry);
      if (list.length) {
        const p = list[(Math.random() * list.length) | 0];
        const c = p.computed_geometry.coordinates;
        return { url: p.thumb_1024_url, lon: c[0], lat: c[1], id: p.id };
      }
      break;
    }
  }
  return null;
}

async function fetchMapillaryAt(lat, lon) {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const rnd = a => a[(Math.random() * a.length) | 0];
  for (const half of [0.0013, 0.0027, 0.005]) {
    const bbox = [lon - half, lat - half, lon + half, lat + half]
      .map(n => n.toFixed(6)).join(',');
    const url = 'https://graph.mapillary.com/images?access_token=' + encodeURIComponent(token) +
      '&fields=id,thumb_1024_url,thumb_2048_url,camera_type&bbox=' + bbox + '&limit=25';
    let j;
    try { j = await (await fetch(url)).json(); }
    catch (e) { return null; }
    if (j.error) return null;
    const list = (j.data || []).filter(d => d.thumb_1024_url);
    if (!list.length) continue;
    const panos = list.filter(d => /spher|equirect|pano/i.test(d.camera_type || ''));
    if (panos.length) {
      const p = rnd(panos);
      return { url: p.thumb_2048_url || p.thumb_1024_url, pano: true };
    }
    return { url: rnd(list).thumb_1024_url, pano: false };
  }
  return null;
}

/* ---------- 360° 環景檢視器（three.js 動態載入） ---------- */
const pano = {
  THREE: null, renderer: null, raf: 0, active: false,
  lon: 0, lat: 0, down: false, _geo: null, _tex: null, _mat: null, scene: null, camera: null,
  async show(url) {
    if (!this.THREE) this.THREE = await import('../vendor/three/three.module.min.js');
    const T = this.THREE, cv = $('pano'), box = cv.parentElement;
    const w = box.clientWidth || 640, h = box.clientHeight || 480;
    if (!this.renderer) {
      const gl = cv.getContext('webgl2', { antialias: true });
      this.renderer = new T.WebGLRenderer({ canvas: cv, context: gl, antialias: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    }
    this.renderer.setSize(w, h, false);
    this._clean();
    const loader = new T.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const tex = await new Promise((res, rej) => loader.load(url, res, undefined, rej));
    if ('colorSpace' in tex) tex.colorSpace = T.SRGBColorSpace;
    const geo = new T.SphereGeometry(500, 60, 40); geo.scale(-1, 1, 1);
    const mat = new T.MeshBasicMaterial({ map: tex });
    this.scene = new T.Scene();
    this.scene.add(new T.Mesh(geo, mat));
    this.camera = new T.PerspectiveCamera(74, w / h, 1, 1100);
    this._geo = geo; this._tex = tex; this._mat = mat;
    this.lon = 0; this.lat = 0; this.active = true;
    if (!this.raf) this._loop();
  },
  _loop() {
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      if (!this.active || !this.scene) return;
      this.lat = Math.max(-85, Math.min(85, this.lat));
      const phi = (90 - this.lat) * Math.PI / 180, th = this.lon * Math.PI / 180;
      this.camera.lookAt(
        Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(tick);
  },
  zoom(d) {
    if (!this.camera) return;
    this.camera.fov = Math.max(35, Math.min(90, this.camera.fov + d));
    this.camera.updateProjectionMatrix();
  },
  _clean() {
    if (this._geo) this._geo.dispose();
    if (this._tex) this._tex.dispose();
    if (this._mat) this._mat.dispose();
    this._geo = this._tex = this._mat = this.scene = null;
  },
  stop() {
    this.active = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this._clean();
  },
};

/* ---------- 地區／設施類型提示（不洩漏景點名） ---------- */
function regionHint(lat, lon) {
  if (lat > 25.9) return '馬祖列島';
  if (lon < 119.0) return '金門';
  if (lon < 120.0 && lat < 24.0) return '澎湖群島';
  if (lon > 121.4 && lat < 22.85) return '台東外海離島（蘭嶼／綠島）';
  if (lat >= 24.5) return '北台灣（桃竹苗以北、含宜蘭）';
  if (lon >= 121.0) return '東台灣（花蓮、台東）';
  if (lat >= 23.6) return '中台灣（苗中彰投雲）';
  return '南台灣（嘉南高屏）';
}

const FACILITY_TYPES = [
  [/攔河堰|水庫|壩|堰/, '水利設施（水庫／攔河堰）'],
  [/橋/,                '橋樑'],
  [/隧道/,              '隧道'],
  [/發電|電廠|風場|風力|光電|地熱|機組|核三|核能/, '發電／能源設施'],
  [/高鐵|捷運|輕軌|車站|火車站|機廠|林鐵|五分車|纜車/, '軌道／纜車運輸'],
  [/機場|航廈|塔台|空橋/, '航空設施'],
  [/港|碼頭/,            '港灣設施'],
  [/圖書館|美術館|博物館|歌劇院|文化中心|藝術中心|考古館|天文/, '文化／教育場館'],
  [/大樓|總部|大廈|101|塔|i-Tower/, '高樓建築'],
  [/科學園區|工業區|科技園區|產業園區|園區|廠/, '產業園區／廠房'],
  [/公園|濕地|步道|觀景|景觀台|遊客中心|樂園|市集/, '景觀／遊憩設施'],
  [/收費站|門架/,        '公路設施'],
];
function typeHint(name) {
  for (const [re, label] of FACILITY_TYPES) if (re.test(name)) return label;
  return '其他工程地景';
}

/* ---------- 主流程 ---------- */
function startGame(m, theme) {
  mode = m;
  idx = 0; total = 0;
  sessionRounds = [];
  $('score').textContent = 0;
  $('overlay').classList.add('hidden');
  deepMode = (localStorage.getItem(DEEP_KEY) === '1');
  $('deepHud').style.display = deepMode ? 'flex' : 'none';

  if (m === 'engineering') {
    roundCount = 10;
    engTheme = theme || 0;
    const pool = engTheme
      ? SITES.slice((engTheme - 1) * 50, engTheme * 50)
      : SITES;
    $('modeLabel').textContent = '🏗 工程地景'
      + (engTheme ? '・' + ENG_THEMES[engTheme - 1] : '');
    rounds = pool.slice().sort(() => Math.random() - 0.5).slice(0, roundCount)
      .map(s => ({ name: s[0], lat: s[1], lon: s[2], ch: s[3], tip: s[4], idx: SITES.indexOf(s) }));
  } else if (m === 'trial') {
    /* 試玩 20 題：跨全部 200 景點，不要求登入、不保存到帳號紀錄 */
    roundCount = 20;
    engTheme = 0;
    $('modeLabel').textContent = '🎮 試玩 20 題';
    rounds = SITES.slice().sort(() => Math.random() - 0.5).slice(0, roundCount)
      .map(s => ({ name: s[0], lat: s[1], lon: s[2], ch: s[3], tip: s[4], idx: SITES.indexOf(s) }));
  } else if (m === 'curated') {
    roundCount = 5;
    $('modeLabel').textContent = '📷 精選地景';
    rounds = LOCS.slice().sort(() => Math.random() - 0.5).slice(0, roundCount);
  } else {
    roundCount = 5;
    $('modeLabel').textContent = '🛰 Mapillary 即時';
  }
  $('roundTotal').textContent = roundCount;
  loadRound();
}

async function loadRound() {
  guess = null; actual = null;
  clearMap();
  $('round').textContent = idx + 1;
  $('actBtn').disabled = true;
  $('actBtn').textContent = '確認猜測';
  $('photo').onerror = null;
  $('zoombar').classList.remove('on');
  $('photoClue').classList.remove('on');
  $('followupBox').innerHTML = '';
  pano.stop();
  $('pano').classList.remove('on');
  $('panoBadge').classList.add('hidden');
  hideSatMap();
  $('refs').classList.remove('on');
  $('refs').innerHTML = '';

  if (mode === 'curated') {
    const loc = rounds[idx];
    current = { src: 'img/' + loc.img, lat: loc.lat, lon: loc.lon, name: loc.name, blurb: loc.blurb, by: loc.by };
    setPhoto(current.src, '📷 ' + loc.by + '・Wikimedia Commons');
    $('result').textContent = '點地圖選一個位置';
    state = 'guess';
  } else if ((mode === 'engineering' || mode === 'trial')) {
    const s = rounds[idx];
    current = { lat: s.lat, lon: s.lon, name: s.name, blurb: s.tip, ch: s.ch, idx: s.idx };
    $('photo').onerror = () => {
      if (state !== 'guess') return;
      state = 'error';
      showMsg('⚠ 影像載入失敗');
      $('result').innerHTML = '影像載入失敗，按下方「重試」再試一次。';
      $('actBtn').textContent = '重試'; $('actBtn').disabled = false;
    };
    $('photoClue').innerHTML =
      '📍 <b>地區</b>：' + regionHint(s.lat, s.lon) + '<br>' +
      '🏗 <b>設施類型</b>：' + typeHint(s.name) + '<br>' +
      '🔍 <b>觀察重點</b>：' + s.tip;
    $('photoClue').classList.add('on');
    state = 'loading';
    let shot = null;
    if (localStorage.getItem(TOKEN_KEY)) {
      showMsg('🔍 搜尋實景影像中…');
      $('result').textContent = '搜尋實景影像中，請稍候…';
      shot = await fetchMapillaryAt(s.lat, s.lon);
    }
    if (shot && shot.url && shot.pano) {
      current.imgType = 'pano';
      $('zoombar').classList.remove('on');
      try {
        $('photoMsg').classList.add('hidden');
        $('photo').style.display = 'none';
        $('pano').classList.add('on');
        await pano.show(shot.url);
        $('panoBadge').classList.remove('hidden');
        $('photoCap').textContent = '📷 Mapillary 360° 環景・CC BY-SA';
        $('result').textContent = '拖曳畫面環視四周（滾輪可縮放），再到地圖上點出位置。';
      } catch (e) {
        pano.stop();
        $('pano').classList.remove('on');
        $('panoBadge').classList.add('hidden');
        current.imgType = 'mapillary';
        setPhoto(shot.url, '📷 Mapillary 實景影像・CC BY-SA');
        $('result').textContent = '看實景照，在地圖上點出這個工程地點的位置。';
      }
    } else if (shot && shot.url) {
      current.imgType = 'mapillary';
      $('zoombar').classList.remove('on');
      setPhoto(shot.url, '📷 Mapillary 實景影像・CC BY-SA');
      $('result').textContent = '看實景照，在地圖上點出這個工程地點的位置。';
    } else {
      current.imgType = 'sat';
      $('photoCap').textContent = '🛰 衛星空照圖・Esri / Maxar / Earthstar Geographics';
      $('zoombar').classList.add('on');
      zoomIdx = 3;
      applyZoom();
      $('result').textContent = '用下方「拉遠／拉近」觀察地形，再到地圖上點出位置。';
    }
    state = 'guess';
  } else {
    state = 'loading';
    showMsg('🛰 連線 Mapillary，載入街景中…');
    $('result').textContent = '取得街景中，請稍候…';
    const shot = await fetchMapillaryShot();
    if (!shot || shot.error) {
      state = 'error';
      showMsg(shot && shot.error === 'auth' ? '⚠ Mapillary token 無效'
        : shot && shot.error === 'network' ? '⚠ 網路連線失敗'
        : '⚠ 這次沒抓到街景');
      $('result').innerHTML = '取得街景失敗，按下方「重試」再試一次。';
      $('actBtn').textContent = '重試'; $('actBtn').disabled = false;
      return;
    }
    current = { src: shot.url, lat: shot.lat, lon: shot.lon, name: null, by: 'Mapillary 街景・CC BY-SA' };
    setPhoto(current.src, '📷 Mapillary 街景・CC BY-SA');
    $('result').textContent = '點地圖選一個位置';
    state = 'guess';
  }
}

function setPhoto(src, cap) {
  const img = $('photo');
  $('photoMsg').classList.add('hidden');
  img.style.display = 'block';
  img.src = src;
  $('photoCap').textContent = cap;
}
function showMsg(text) {
  $('photo').style.display = 'none';
  const m = $('photoMsg');
  m.textContent = text; m.classList.remove('hidden');
  $('photoCap').textContent = '';
}

lmap.on('click', e => {
  if (state !== 'guess') return;
  guess = { lat: e.latlng.lat, lon: e.latlng.lng };
  if (guessMarker) guessMarker.setLatLng(e.latlng);
  else guessMarker = L.marker(e.latlng, { icon: GUESS_ICON }).addTo(lmap);
  $('actBtn').disabled = false;
  $('result').textContent = '按「確認猜測」送出。';
});

/* ---------- 揭曉的延伸學習卡片 ---------- */
function showRefs(siteIdx) {
  const box = $('refs');
  box.innerHTML = '';
  const cards = [];
  if (typeof WIKI_REFS !== 'undefined' && WIKI_REFS[siteIdx]) {
    cards.push(
      `<a class="ref-card" href="${WIKI_REFS[siteIdx]}" target="_blank" rel="noopener">` +
      `<img src="refs/wiki/wiki-${siteIdx}.jpg" alt="維基百科條目截圖" loading="lazy">` +
      `<span>📖 維基百科</span></a>`);
  }
  if (!cards.length) return;
  box.innerHTML = '<div class="refs-h">📚 延伸學習（點圖前往該網站）</div>' + cards.join('');
  box.classList.add('on');
}

/* ---------- 深度模式：追問題目產生 ---------- */
function shuffle(arr) { return arr.slice().sort(() => Math.random() - 0.5); }

function makeFollowups(site) {
  const out = [];
  /* Q1：主題分類 —— 一定可問 */
  if (typeof ENG_THEMES !== 'undefined' && site.idx >= 0) {
    const correct = Math.floor(site.idx / 50);
    out.push({
      q: '🧩 這座工程地景在台灣工程地景中，被歸類在哪一個主題模組？',
      options: shuffle(ENG_THEMES.map((t, i) => ({ label: t, ok: i === correct }))),
      explain: `這座工程歸類於主題 ${correct + 1}「${ENG_THEMES[correct]}」。同主題的 50 個景點，反映同一類工程議題在台灣的代表性個案。`,
      kind: 'theme',
    });
  }
  /* Q2：設施類型 —— 名稱可辨識時才問 */
  const typeLabel = typeHint(site.name);
  if (typeLabel !== '其他工程地景') {
    const allTypes = FACILITY_TYPES.map(([, label]) => label);
    const distractors = shuffle(allTypes.filter(t => t !== typeLabel)).slice(0, 3);
    const options = shuffle([typeLabel, ...distractors].map(t => ({ label: t, ok: t === typeLabel })));
    out.push({
      q: '🏗 從規模與功能來看，這座工程主要屬於哪一類設施？',
      options,
      explain: `從名稱與外觀可辨識為「${typeLabel}」。對於同類設施，可以注意它常用的結構形式、機構方式與感測／控制系統，這通常就是學習重點。`,
      kind: 'type',
    });
  }
  return out;
}

let activeFollowups = [];
let fuIndex = 0;

function renderFollowup(round) {
  const box = $('followupBox');
  if (fuIndex >= activeFollowups.length) {
    box.innerHTML = '';
    return;
  }
  const fu = activeFollowups[fuIndex];
  box.innerHTML = `
    <div class="followup">
      <div class="fu-q">${fu.q}</div>
      <div class="fu-opts" id="fuOpts"></div>
    </div>`;
  const opts = $('fuOpts');
  fu.options.forEach((opt, i) => {
    const b = document.createElement('button');
    b.className = 'fu-opt';
    b.textContent = String.fromCharCode(65 + i) + '. ' + opt.label;
    b.addEventListener('click', () => answerFollowup(round, fu, opt, b));
    opts.appendChild(b);
  });
}

function answerFollowup(round, fu, opt, btn) {
  /* 鎖定所有選項 */
  const all = $('fuOpts').querySelectorAll('.fu-opt');
  all.forEach(b => {
    const text = b.textContent.replace(/^[A-Z]\.\s*/, '');
    const o = fu.options.find(o => o.label === text);
    if (o && o.ok) b.classList.add('ok');
    b.disabled = true;
    b.style.cursor = 'default';
  });
  if (!opt.ok) btn.classList.add('bad');

  /* 紀錄追問結果 */
  round.followups = round.followups || {};
  round.followups[fu.kind] = !!opt.ok;
  if (opt.ok) {
    total += 300;
    $('score').textContent = total;
  }

  /* 顯示解釋 */
  const exp = document.createElement('div');
  exp.className = 'fu-explain';
  exp.innerHTML = (opt.ok ? '✅ 答對 (+300)。' : '❌ 答錯。') + fu.explain;
  $('followupBox').querySelector('.followup').appendChild(exp);

  fuIndex++;
  if (fuIndex < activeFollowups.length) {
    setTimeout(() => renderFollowup(round), 700);
  }
}

/* ---------- 確認猜測／揭曉／下一題 ---------- */
function confirmGuess() {
  actual = { lat: current.lat, lon: current.lon };
  const d = distKm(guess, actual);
  const pts = Math.round(1000 * Math.exp(-d / 55));
  total += pts;
  state = 'reveal';
  $('score').textContent = total;

  /* 紀錄本題 */
  const rec = {
    idx: current.idx == null ? -1 : current.idx,
    name: current.name || 'Mapillary 即時街景',
    lat: current.lat, lon: current.lon, ch: current.ch || 0,
    tip: current.blurb || '',
    type: current.name ? typeHint(current.name) : '即時街景',
    guess: { ...guess },
    distance: d, score: pts,
    imgType: current.imgType || 'photo',
  };
  sessionRounds.push(rec);

  let head;
  if ((mode === 'engineering' || mode === 'trial')) {
    if (current.imgType === 'sat') { zoomIdx = 1; applyZoom(); }
    const chTxt = current.ch ? `第${'一二三四五'[current.ch - 1]}章 ｜ ` : '';
    head = `正解：<span class="rn">${current.name}</span><br>` +
      `<span style="color:var(--c-primary);font-weight:700">${chTxt}</span>${current.blurb}<br>`;
  } else if (current.name) {
    head = `正解：<span class="rn">${current.name}</span><br>${current.blurb}<br>`;
  } else {
    head = `📍 這是 Mapillary 上的一個實際街景點。<br>`;
  }
  $('result').innerHTML = head +
    `距離 <b>${d < 1 ? '<1' : Math.round(d)}</b> 公里・本題 <b>${pts}</b> 分`;
  if ((mode === 'engineering' || mode === 'trial')) showRefs(current.idx);

  actualMarker = L.marker([actual.lat, actual.lon], { icon: ACTUAL_ICON }).addTo(lmap);
  distLine = L.polyline([[guess.lat, guess.lon], [actual.lat, actual.lon]],
    { color: '#D97706', weight: 3, dashArray: '6 5' }).addTo(lmap);
  lmap.fitBounds(distLine.getBounds(), { padding: [36, 36], maxZoom: 12 });

  /* 深度模式：渲染追問 */
  if (deepMode && (mode === 'engineering' || mode === 'trial')) {
    activeFollowups = makeFollowups(current);
    fuIndex = 0;
    if (activeFollowups.length) renderFollowup(rec);
  } else {
    activeFollowups = []; fuIndex = 0; $('followupBox').innerHTML = '';
  }

  $('actBtn').textContent = idx < roundCount - 1 ? '下一題 ▶' : '看成績';

  /* 預載下一題的衛星瓦片：揭曉後到使用者按下一題之間，背景靜默暖快取，
   * 等真正切過去時瓦片多半已在瀏覽器快取裡 */
  if ((mode === 'engineering' || mode === 'trial') && idx < roundCount - 1) {
    const next = rounds[idx + 1];
    if (next) prefetchSatTiles(next.lat, next.lon, SAT_ZOOMS[3]);
  }
}

function nextRound() {
  idx++;
  (idx >= roundCount) ? endGame() : loadRound();
}

function endGame() {
  state = 'over';
  pano.stop();
  const max = roundCount * 1000;
  const rank = total >= max * 0.84 ? '🏆 工程地景達人'
    : total >= max * 0.6 ? '🌟 在地通'
    : total >= max * 0.36 ? '🙂 還不錯'
    : '💪 再接再厲';
  const session = saveSession();

  /* 不同儲存結果決定下方提示文字 */
  let savedNote;
  if (session._savedTo === 'trial') {
    savedNote = `<p style="color:var(--c-amber);font-weight:700">⚠ 試玩模式不保存紀錄。<a href="account.html" style="color:var(--c-primary)">建立帳號</a>，下一局起就能存到你的紀錄。</p>`;
  } else if (session._savedTo === 'user') {
    savedNote = `<p>✅ 已存到你的帳號紀錄，可以到「<a href="account.html">我的帳號</a>」或「<a href="worksheet.html">學習單</a>」查看。</p>`;
  } else {
    savedNote = `<p>已存到這個瀏覽器（訪客模式）。<a href="account.html">建立帳號</a>後紀錄可保留更久、可備份到 Drive。</p>`;
  }

  $('ovBox').innerHTML =
    `<h1>挑戰結束！</h1>` +
    `<div class="big mono">${total}</div>` +
    `<div class="max">/ 滿分 ${max}${deepMode ? ' +追問加分' : ''}</div>` +
    `<div class="rank-badge">${rank}</div>` +
    savedNote +
    `<div style="margin:14px 0">
       <div class="mono" style="font-size:11px;color:var(--c-muted);margin-bottom:4px">成績碼（複製給老師）</div>
       <input id="codeOut" readonly value="${session.code}">
     </div>` +
    `<button id="goWS" class="btn btn-primary">📝 整理成學習單</button>` +
    `<button id="againBtn" class="btn btn-ghost" style="margin-top:8px">重新選擇模式</button>`;
  $('overlay').classList.remove('hidden');
  $('goWS').addEventListener('click', () => location.href = 'worksheet.html');
  $('againBtn').addEventListener('click', showStart);
  setTimeout(() => { const c = $('codeOut'); if (c) { c.focus(); c.select(); } }, 50);
}

/* ---------- 結果儲存 ---------- */
function saveSession() {
  const session = {
    date: new Date().toISOString(),
    mode, theme: engTheme || 0,
    deepMode,
    totalScore: total,
    maxScore: roundCount * 1000 + (deepMode ? roundCount * 2 * 300 : 0),
    rounds: sessionRounds,
  };
  session.code = encodeCode(session);

  /* 試玩模式不寫入帳號紀錄；其他模式優先寫入登入者帳號，未登入則 fall back 到 legacy 全域陣列 */
  if (mode !== 'trial' && typeof TwegAuth !== 'undefined') {
    const r = TwegAuth.saveSessionForCurrent(session);
    session._savedTo = r.saved;
    session._savedEmail = r.email || null;
  } else if (mode !== 'trial') {
    /* TwegAuth 沒載入時的舊路徑（防呆） */
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (e) {}
    arr.unshift(session);
    if (arr.length > MAX_HISTORY) arr.length = MAX_HISTORY;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
    session._savedTo = 'guest';
  } else {
    session._savedTo = 'trial';
  }
  return session;
}

function encodeCode(s) {
  /* 將整局成績打包成 base64（含每題索引 / 距離 / 追問結果），讓老師端可以還原統計 */
  const compact = {
    d: s.date.slice(0, 16).replace('T', ' '),
    m: (s.mode === 'engineering' || s.mode === 'trial') ? 'E' : (s.mode === 'curated' ? 'C' : 'M'),
    t: s.theme, s: s.totalScore, k: s.deepMode ? 1 : 0,
    r: s.rounds.map(r => [
      r.idx,
      Math.round(r.distance * 10),
      r.score,
      r.followups ? ((r.followups.theme ? 1 : 0) + (r.followups.type ? 2 : 0)) : 0,
    ]),
  };
  try {
    const json = JSON.stringify(compact);
    return 'TWEG:' + btoa(unescape(encodeURIComponent(json)));
  } catch (e) {
    return 'TWEG:?';
  }
}

/* ---------- 事件 ---------- */
$('actBtn').addEventListener('click', () => {
  if (state === 'guess') confirmGuess();
  else if (state === 'reveal') {
    /* 若深度模式還有追問未答完，禁止前進 */
    if (deepMode && fuIndex < activeFollowups.length) {
      $('result').innerHTML += '<br><span style="color:var(--c-amber);font-weight:700">⚠ 請先回答下方追問</span>';
      return;
    }
    nextRound();
  }
  else if (state === 'error') loadRound();
});
$('zoomOut').addEventListener('click', () => {
  if ((mode === 'engineering' || mode === 'trial') && (state === 'guess' || state === 'reveal')) { zoomIdx++; applyZoom(); }
});
$('zoomIn').addEventListener('click', () => {
  if ((mode === 'engineering' || mode === 'trial') && (state === 'guess' || state === 'reveal')) { zoomIdx--; applyZoom(); }
});
$('restartBtn').addEventListener('click', showStart);

/* 360° 環景：拖曳轉動視角、滾輪縮放 */
(function panoControls() {
  const cv = $('pano');
  let px = 0, py = 0;
  cv.addEventListener('pointerdown', e => {
    if (!pano.active) return;
    pano.down = true; px = e.clientX; py = e.clientY;
    cv.classList.add('drag'); cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    if (!pano.down) return;
    pano.lon -= (e.clientX - px) * 0.16;
    pano.lat += (e.clientY - py) * 0.16;
    px = e.clientX; py = e.clientY;
  });
  const release = () => { pano.down = false; cv.classList.remove('drag'); };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);
  cv.addEventListener('wheel', e => {
    if (!pano.active) return;
    e.preventDefault();
    pano.zoom(e.deltaY > 0 ? 5 : -5);
  }, { passive: false });
})();

/* ---------- 開始畫面 / token 設定 / 深度模式開關 ---------- */
function showStart() {
  pano.stop();
  $('overlay').classList.remove('hidden');
  const isDeep = localStorage.getItem(DEEP_KEY) === '1';
  const hasToken = !!localStorage.getItem(TOKEN_KEY);
  const u = (typeof TwegAuth !== 'undefined') ? TwegAuth.currentUser() : null;
  const userLine = u
    ? `<div class="ov-userline logged-in">👤 已登入：<b>${u.nick}</b>，每局結束會自動存到你的紀錄。<a href="account.html">我的帳號</a></div>`
    : `<div class="ov-userline">📋 訪客模式 — 紀錄只暫存在這個瀏覽器。<a href="account.html">登入 / 註冊</a> 後可長期保存。</div>`;

  $('ovBox').innerHTML =
    `<h1>準備出發</h1>` +
    `<p>看影像、在地圖上點出位置。可從 20 題試玩開始，或直接挑戰課程地景。</p>` +
    userLine +
    `<button id="mTrial" class="ov-trial">
      <span class="t1">🎮 試玩 20 題</span>
      <span class="t2">不需登入、跨全部 200 景點、不會保存（適合第一次來）</span>
    </button>` +
    `<div class="ov-deep">
      <input type="checkbox" id="deepChk" ${isDeep ? 'checked' : ''}>
      <label for="deepChk"><b>啟用深度模式</b>
        <small>揭曉後追問 2 題（主題分類、設施類型），答對每題 +300 分。建議熟悉操作後啟用。</small></label>
    </div>` +
    `<div class="ov-divider">完整模式（成績可記錄）</div>` +
    `<div class="ov-modes">
      <button id="mEng"><span class="t1">🏗 工程地景挑戰</span>
        <span class="t2">200 個課程工程景點・四主題可選・每局 10 題</span></button>
      <button id="mCurated" class="alt"><span class="t1">📷 精選地景（暖身）</span>
        <span class="t2">10 個經典台灣地景照・每局 5 題</span></button>
      <button id="mMapi" class="alt"><span class="t1">🛰 Mapillary 即時街景</span>
        <span class="t2">${hasToken ? '已設定 token・台灣各地隨機街景' : '需要免費 token・點此設定'}</span></button>
    </div>`;
  $('mTrial').addEventListener('click', () => startGame('trial'));
  $('deepChk').addEventListener('change', e => {
    localStorage.setItem(DEEP_KEY, e.target.checked ? '1' : '0');
  });
  $('mEng').addEventListener('click', showEngThemes);
  $('mCurated').addEventListener('click', () => startGame('curated'));
  $('mMapi').addEventListener('click', () => {
    localStorage.getItem(TOKEN_KEY) ? startGame('mapillary') : showTokenSetup();
  });
}

function showEngThemes() {
  const marks = ['①', '②', '③', '④'];
  $('ovBox').innerHTML =
    `<h1>工程地景挑戰</h1>` +
    `<p>挑選主題範圍，每局隨機 10 題：</p>` +
    `<div class="ov-modes">
      <button id="thAll"><span class="t1">🌐 全部主題</span><span class="t2">200 個工程景點，廣度練習</span></button>` +
    ENG_THEMES.map((t, i) =>
      `<button id="th${i}" class="alt"><span class="t1">${marks[i]} ${t}</span><span class="t2">50 景點・聚焦練習</span></button>`).join('') +
    `</div>` +
    `<button id="thBack" class="btn btn-ghost" style="margin-top:14px;width:100%">← 返回</button>`;
  $('thAll').addEventListener('click', () => startGame('engineering', 0));
  ENG_THEMES.forEach((t, i) =>
    $('th' + i).addEventListener('click', () => startGame('engineering', i + 1)));
  $('thBack').addEventListener('click', showStart);
}

function showTokenSetup() {
  $('ovBox').innerHTML =
    `<h1>Mapillary 設定</h1>` +
    `<p>即時街景與工程地景的實景模式需要一組免費的 Mapillary token。</p>` +
    `<p class="lead">到 <a href="https://www.mapillary.com/dashboard/developers" target="_blank">mapillary.com</a> ` +
    `→ Developers → 註冊應用程式（權限只開 READ），取得 <code>MLY|…</code> 開頭的 token，貼在下方：</p>` +
    `<input id="tokIn" placeholder="MLY|...|..." autocomplete="off">` +
    `<button id="tokSave" class="btn btn-primary" style="margin-top:12px">儲存並開始</button>` +
    `<button id="tokBack" class="btn btn-ghost" style="margin-top:8px">← 返回</button>`;
  $('tokSave').addEventListener('click', () => {
    const v = $('tokIn').value.trim();
    if (!v.startsWith('MLY')) { $('tokIn').style.borderColor = 'var(--c-red)'; return; }
    localStorage.setItem(TOKEN_KEY, v);
    startGame('mapillary');
  });
  $('tokBack').addEventListener('click', showStart);
}

showStart();
