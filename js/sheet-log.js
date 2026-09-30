/* ============================================================
 * sheet-log.js — 教學平台作答紀錄 → 老師的 Google 試算表（規格 v1，2026-09-30）
 * 四個平台（livingtech／pc13110／twgeo／dojo）各放一份，內容相同；設定放各平台的 sheet-config.js。
 *
 *   SheetLog.init({platform, endpoint, token})   endpoint 空字串＝完全不送、不顯示任何告知
 *   SheetLog.enabled()                           有設定 endpoint 才是 true
 *   SheetLog.newSid()                            一次作答一個 32 碼小寫 16 進位編號
 *   SheetLog.send({sid, page, kind, items, meta})
 *   SheetLog.hash(core) → Promise<8 碼指紋>       同 EMT build.py q_hash（type/stem/options/answer/items）
 *   SheetLog.optCode(i)                          原始資料順序的選項代號 A–F
 *   SheetLog.mountInline(el)                     在對話框等處另放一份班級座號元件（和右下角同步）
 *   告知文字：頁面放 <p data-sheetlog-notice hidden></p> 指定位置；沒有就自動加在頁尾 <footer>。
 *
 * 送出：POST、Content-Type text/plain、mode no-cors（不觸發 CORS 預檢，回應讀不到，沒有網路錯誤就當送達）。
 * 先進 localStorage 佇列（上限 50）再依序送；失敗或離線時留到下次開頁／online 事件補送；
 * localStorage 不能用時直接送一次。
 * 班級座號：學生自己在頁面右下角填（選填），存 sessionStorage，關分頁就清掉，避免共用電腦串到下一位。
 * ============================================================ */
(function (global) {
  'use strict';

  var CFG = { platform: '', endpoint: '', token: '' };
  var QMAX = 50, flushing = false, direct = Promise.resolve(), inited = false;
  var ID_KEY = 'sheetlog-identity';
  var CLASS_RE = /^(?!-)[0-9A-Za-z㐀-鿿\-]{1,10}$/;
  var SEAT_RE = /^[0-9]{1,4}$/;
  var Q_RE = /^[A-Za-z0-9_.:-]{1,40}$/;
  var PAGE_RE = /^[A-Za-z0-9_./-]{1,80}$/;
  var TYPES = ['single', 'tf', 'order', 'scenario', 'match', 'code', 'game', 'other'];
  var KINDS = ['quiz', 'game', 'exercise', 'worksheet'];
  var NOTICE = '完成測驗後，各題對錯與所選答案會送給老師，用來分析題目品質；若你填了班級座號，也會一起送出。';

  function qKey() { return 'sheetlog-queue-' + CFG.platform; }

  function newSid() {
    var b = new Uint8Array(16), h = '', i;
    try { (global.crypto || global.msCrypto).getRandomValues(b); }
    catch (e) { for (i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); }
    for (i = 0; i < b.length; i++) h += ('0' + b[i].toString(16)).slice(-2);
    return h;
  }

  /* ---------- 佇列 ---------- */
  function qRead() {
    try {
      var a = JSON.parse(global.localStorage.getItem(qKey()) || '[]');
      return Array.isArray(a) ? a.filter(function (x) { return typeof x === 'string'; }) : [];
    } catch (e) { return []; }
  }
  function qWrite(a) {
    try {
      if (a.length) global.localStorage.setItem(qKey(), JSON.stringify(a.slice(-QMAX)));
      else global.localStorage.removeItem(qKey());
    } catch (e) { /* 無痕視窗等情況存不了就算了 */ }
  }
  function post(body) {
    try {
      return global.fetch(CFG.endpoint, { method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' }, body: body });
    } catch (e) { return Promise.reject(e); }
  }
  function flush() {
    if (!CFG.endpoint || flushing || !global.fetch) return;
    var q = qRead();
    if (!q.length) return;
    flushing = true;
    var body = q[0];
    post(body).then(function () {
      qWrite(qRead().filter(function (x) { return x !== body; }));
      flushing = false; flush();
    }, function () { flushing = false; });
  }
  function enqueue(body) {
    var q = qRead();
    q.push(body); qWrite(q);
    if (qRead().indexOf(body) < 0) {   // 存不了佇列時直接依序送一次
      direct = direct.then(function () { return post(body); }).then(null, function () {});
      return;
    }
    flush();
  }

  /* ---------- 班級座號（sessionStorage） ---------- */
  function toHalf(t) {
    return String(t || '').replace(/[０-９Ａ-Ｚａ-ｚ－]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
    }).trim();
  }
  function getIdentity() {
    try {
      var o = JSON.parse(global.sessionStorage.getItem(ID_KEY) || 'null');
      if (o && CLASS_RE.test(o['class']) && SEAT_RE.test(o.seat)) return { 'class': o['class'], seat: o.seat };
    } catch (e) { /* 讀不到當作沒填 */ }
    return null;
  }
  function setIdentity(cls, seat) {
    try {
      if (cls && seat) global.sessionStorage.setItem(ID_KEY, JSON.stringify({ 'class': cls, seat: seat }));
      else global.sessionStorage.removeItem(ID_KEY);
    } catch (e) { /* 存不了就只在這次頁面有效 */ }
  }

  /* ---------- 題目指紋：和 Python json.dumps(sort_keys=True, ensure_ascii=False) 相同的序列化 ---------- */
  function pyJson(v) {
    if (v === null || v === undefined) return 'null';
    if (Array.isArray(v)) return '[' + v.map(pyJson).join(', ') + ']';
    if (typeof v === 'object') {
      return '{' + Object.keys(v).sort().map(function (k) {
        return JSON.stringify(k) + ': ' + pyJson(v[k]);
      }).join(', ') + '}';
    }
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return JSON.stringify(v);
  }
  function hash(core) {
    var c = {};
    ['type', 'stem', 'options', 'answer', 'items'].forEach(function (k) {
      c[k] = (core && core[k] !== undefined) ? core[k] : null;
    });
    try {
      var data = new TextEncoder().encode(pyJson(c));
      return global.crypto.subtle.digest('SHA-1', data).then(function (buf) {
        var b = new Uint8Array(buf), h = '';
        for (var i = 0; i < 4; i++) h += ('0' + b[i].toString(16)).slice(-2);
        return h;
      }, function () { return ''; });
    } catch (e) { return Promise.resolve(''); }   // 非安全環境（http 非 localhost）算不出來就留空
  }
  function optCode(i) { return 'ABCDEF'.charAt(i) || ''; }

  /* ---------- 送出 ---------- */
  function clip(s, n) { return String(s == null ? '' : s).slice(0, n); }
  function cleanItem(it) {
    if (!it || !Q_RE.test(String(it.q || ''))) return null;
    var o = {
      q: String(it.q),
      h: /^[0-9a-f]{8}$/.test(it.h || '') ? it.h : '',
      t: TYPES.indexOf(it.t) >= 0 ? it.t : 'other',
      ok: it.ok ? 1 : 0,
      a: clip(it.a, 40),
      k: clip(it.k, 40),
    };
    var tries = parseInt(it.tries, 10);
    if (tries >= 1) o.tries = Math.min(99, tries);
    return o;
  }
  function send(rec) {
    if (!CFG.endpoint || !rec) return false;
    var items = (rec.items || []).map(cleanItem).filter(Boolean).slice(0, 40);
    if (!items.length) return false;
    var page = String(rec.page || '');
    if (!PAGE_RE.test(page)) page = 'unknown';
    var body = {
      v: 1, platform: CFG.platform, token: CFG.token || '',
      sid: /^[0-9a-f]{32}$/.test(rec.sid || '') ? rec.sid : newSid(),
      page: page,
      kind: KINDS.indexOf(rec.kind) >= 0 ? rec.kind : 'quiz',
      'class': '', seat: '',
      items: items,
    };
    var id = getIdentity();   // 只有學生自己在頁面上填了才帶入
    if (id) { body['class'] = id['class']; body.seat = id.seat; }
    if (rec.meta) {
      var m = {};
      ['score', 'max', 'sec'].forEach(function (k) {
        var n = Number(rec.meta[k]);
        if (rec.meta[k] !== undefined && rec.meta[k] !== null && isFinite(n)) m[k] = Math.round(n * 100) / 100;
      });
      if (Object.keys(m).length) body.meta = m;
    }
    enqueue(JSON.stringify(body));
    return true;
  }

  /* ---------- 小元件：右下角「📝 填班級座號（選填）」＋告知文字 ----------
   * 浮動元件 z-index 900：低於平台自己的全螢幕對話框（通常 ≥1000），對話框開著時不會互相遮蓋；
   * 對話框裡要讓學生填，就用 SheetLog.mountInline(容器) 在對話框內放一份同功能的元件（內容同步）。 */
  var CSS =
    '.sl-wrap{position:fixed;right:12px;bottom:12px;z-index:900;font:14px/1.5 system-ui,-apple-system,"Noto Sans TC",sans-serif;max-width:calc(100vw - 24px)}' +
    '.sl-inline{font:14px/1.5 system-ui,-apple-system,"Noto Sans TC",sans-serif;margin:8px 0;text-align:left}' +
    '.sl-btn{display:block;margin-left:auto;background:#fff;color:#1f2937;border:1px solid #9ca3af;border-radius:999px;padding:6px 12px;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.15);font:inherit;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.sl-inline .sl-btn{margin:6px 0 0;box-shadow:none;width:auto;padding:3px 10px;font-size:13px}' +
    '.sl-panel{background:#fff;color:#1f2937;border:1px solid #9ca3af;border-radius:10px;padding:12px;margin-bottom:8px;width:280px;max-width:100%;box-sizing:border-box;box-shadow:0 4px 14px rgba(0,0,0,.2)}' +
    '.sl-inline .sl-panel{margin:8px 0 0;box-shadow:none;width:100%;max-width:340px}' +
    '.sl-panel[hidden]{display:none}' +
    '.sl-row{display:flex;gap:8px;margin:8px 0}' +
    '.sl-row label{flex:1;display:flex;flex-direction:column;font-size:13px;min-width:0}' +
    '.sl-row input{font:inherit;padding:4px 6px;border:1px solid #9ca3af;border-radius:6px;min-width:0;width:100%;box-sizing:border-box;background:#fff;color:#1f2937}' +
    '.sl-acts{display:flex;gap:8px}' +
    '.sl-acts button{flex:1;font:inherit;padding:5px 0;border-radius:6px;border:1px solid #9ca3af;background:#f3f4f6;color:#1f2937;cursor:pointer;margin:0}' +
    '.sl-acts .sl-save{background:#2563eb;border-color:#2563eb;color:#fff}' +
    '.sl-note{font-size:12.5px;color:#4b5563;margin:0}' +
    '.sl-msg{font-size:12.5px;color:#b91c1c;margin:6px 0 0}' +
    '.sl-msg:empty{display:none}' +
    '.sl-foot{font-size:13px;opacity:.85;margin:8px 0 0;padding-bottom:44px}' +
    '@media print{.sl-wrap,.sl-inline{display:none}}';

  var views = [];   // 所有元件（浮動＋對話框內），填完一起更新顯示
  function refreshAll() {
    var id = getIdentity();
    views = views.filter(function (v) { return v.root.isConnected; });
    views.forEach(function (v) {
      v.btn.textContent = id ? '📝 班級座號：' + id['class'] + ' 班 ' + id.seat + ' 號（修改）' : '📝 填班級座號（選填）';
    });
  }
  function injectCss() {
    if (document.getElementById('sl-css')) return;
    var st = document.createElement('style');
    st.id = 'sl-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }
  function build(root, floating) {
    var panel =
      '<div class="sl-panel"' + (floating ? ' id="sl-panel"' : '') + ' hidden role="group" aria-label="填班級座號（選填）">' +
        '<p class="sl-note">' + NOTICE + '</p>' +
        '<div class="sl-row">' +
          '<label>班級<input class="sl-class"' + (floating ? ' id="sl-class"' : '') + ' maxlength="10" autocomplete="off" placeholder="例：301"></label>' +
          '<label>座號<input class="sl-seat"' + (floating ? ' id="sl-seat"' : '') + ' maxlength="4" inputmode="numeric" autocomplete="off" placeholder="例：12"></label>' +
        '</div>' +
        '<div class="sl-acts"><button type="button" class="sl-save"' + (floating ? ' id="sl-save"' : '') + '>儲存</button>' +
          '<button type="button" class="sl-clear">清除</button><button type="button" class="sl-close">關閉</button></div>' +
        '<p class="sl-msg"></p>' +
        '<p class="sl-note">只存在這個分頁，關掉分頁就會清除。不填也可以作答（匿名）。</p>' +
      '</div>';
    var btn = '<button type="button" class="sl-btn"' + (floating ? ' id="sl-btn"' : '') + ' aria-expanded="false"></button>';
    root.innerHTML = floating ? panel + btn : btn + panel;   // 浮動元件面板往上長，對話框內往下長
    var q = function (c) { return root.querySelector('.' + c); };
    var v = { root: root, btn: q('sl-btn') };
    function open(on) {
      q('sl-panel').hidden = !on;
      v.btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on) {
        var id = getIdentity();
        q('sl-class').value = id ? id['class'] : '';
        q('sl-seat').value = id ? id.seat : '';
        q('sl-msg').textContent = '';
      }
    }
    function msg(t) { q('sl-msg').textContent = t; }
    v.btn.addEventListener('click', function () { open(q('sl-panel').hidden); });
    q('sl-close').addEventListener('click', function () { open(false); });
    q('sl-clear').addEventListener('click', function () { setIdentity('', ''); refreshAll(); open(false); });
    q('sl-save').addEventListener('click', function () {
      var cls = toHalf(q('sl-class').value), seat = toHalf(q('sl-seat').value);
      if (!cls && !seat) { setIdentity('', ''); refreshAll(); open(false); return; }
      if (!cls || !seat) return msg('班級與座號要一起填（或都不填）。');
      if (!CLASS_RE.test(cls)) return msg('班級只能填中文、英文字母、數字或 -（不可用 - 開頭），最多 10 個字。');
      if (!SEAT_RE.test(seat)) return msg('座號請填 1 到 4 位數字。');
      setIdentity(cls, seat); refreshAll(); open(false);
    });
    views.push(v);
    refreshAll();
  }
  function mountInline(container) {
    if (!CFG.endpoint || !container) return;
    injectCss();
    var box = document.createElement('div');
    box.className = 'sl-inline';
    container.appendChild(box);
    build(box, false);
  }

  /* 告知文字：頁面有 [data-sheetlog-notice] 就填進去，沒有就加在最後一個 <footer> 裡（再沒有就加在 body 最後） */
  function placeNotice() {
    var slots = document.querySelectorAll('[data-sheetlog-notice]');
    if (slots.length) {
      Array.prototype.forEach.call(slots, function (el) { el.textContent = '📝 ' + NOTICE; el.hidden = false; });
      return;
    }
    var fs = document.getElementsByTagName('footer');
    var p = document.createElement('p');
    p.className = 'sl-foot'; p.id = 'sl-foot';
    p.textContent = '📝 ' + NOTICE + '班級座號可在右下角填寫（選填）。';
    (fs.length ? fs[fs.length - 1] : document.body).appendChild(p);
  }

  function mountWidget() {
    if (!CFG.endpoint || !global.document || document.getElementById('sl-wrap')) return;
    injectCss();
    var w = document.createElement('div');
    w.id = 'sl-wrap'; w.className = 'sl-wrap';
    document.body.appendChild(w);
    build(w, true);
    placeNotice();
  }

  function init(cfg) {
    cfg = cfg || {};
    CFG.platform = String(cfg.platform || '');
    CFG.endpoint = typeof cfg.endpoint === 'string' ? cfg.endpoint.trim() : '';
    CFG.token = typeof cfg.token === 'string' ? cfg.token : '';
    if (!CFG.endpoint) return;
    if (!inited) {
      inited = true;
      global.addEventListener('online', flush);
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountWidget);
      else mountWidget();
    }
    flush();
  }

  global.SheetLog = {
    init: init, send: send, newSid: newSid, hash: hash, optCode: optCode,
    enabled: function () { return !!CFG.endpoint; },
    notice: NOTICE,
    identity: getIdentity, flush: flush, mountInline: mountInline,
  };
  if (global.SHEET_CONFIG) init(global.SHEET_CONFIG);
})(window);
