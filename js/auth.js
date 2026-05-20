/* ============================================================
 * 台灣工程地景探索 — 個人檔案（簡化版）
 * 不做密碼登入，只記錄「目前在用的玩家是誰」：
 *   名稱、性別、年齡、加入時間、紀錄
 * 一個瀏覽器一個檔案，要換人就清掉重建。資料完全只存 localStorage。
 * ============================================================ */

const TWEG_PROFILE_KEY = 'tweg_profile';
const TWEG_LEGACY_HISTORY_KEY = 'tweg_history';     /* v1.0 全域紀錄 */
const TWEG_LEGACY_ACCOUNTS_KEY = 'tweg_accounts';   /* v1.1 多帳號版本 */
const TWEG_LEGACY_CURRENT_KEY = 'tweg_current';
const MAX_PROFILE_HISTORY = 50;

const TwegAuth = (function () {

  /* ---- 一次性遷移：v1.0 全域 / v1.1 多帳號 → v1.2 單一檔案 ---- */
  function migrateLegacy() {
    if (localStorage.getItem(TWEG_PROFILE_KEY)) return;       /* 已是新格式 */
    /* v1.1 多帳號：取目前登入者 */
    try {
      const accs = JSON.parse(localStorage.getItem(TWEG_LEGACY_ACCOUNTS_KEY) || '{}');
      const cur = localStorage.getItem(TWEG_LEGACY_CURRENT_KEY);
      if (cur && accs[cur]) {
        const a = accs[cur];
        const profile = {
          nick: a.nick || '玩家',
          age: a.age || null,
          gender: a.gender || '不提供',
          createdAt: a.createdAt || new Date().toISOString(),
          history: a.history || [],
        };
        localStorage.setItem(TWEG_PROFILE_KEY, JSON.stringify(profile));
        localStorage.removeItem(TWEG_LEGACY_ACCOUNTS_KEY);
        localStorage.removeItem(TWEG_LEGACY_CURRENT_KEY);
        return;
      }
    } catch (e) {}
  }
  migrateLegacy();

  function getProfile() {
    try { return JSON.parse(localStorage.getItem(TWEG_PROFILE_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function setProfile(p) {
    localStorage.setItem(TWEG_PROFILE_KEY, JSON.stringify(p));
  }
  function clearProfile() {
    localStorage.removeItem(TWEG_PROFILE_KEY);
  }

  function create({ nick, age, gender }) {
    nick = String(nick || '').trim();
    if (!nick) throw new Error('暱稱不能空白');
    if (nick.length > 20) throw new Error('暱稱請在 20 字以內');

    /* 把 v1.0 的全域 tweg_history 自動搬到新檔案 */
    let legacyHist = [];
    try { legacyHist = JSON.parse(localStorage.getItem(TWEG_LEGACY_HISTORY_KEY) || '[]'); }
    catch (e) {}

    const profile = {
      nick, age: (age === '' || age == null) ? null : Number(age),
      gender: gender || '不提供',
      createdAt: new Date().toISOString(),
      history: legacyHist,
    };
    setProfile(profile);
    if (legacyHist.length) localStorage.removeItem(TWEG_LEGACY_HISTORY_KEY);
    return profile;
  }

  function update({ nick, age, gender }) {
    const p = getProfile();
    if (!p) throw new Error('尚無個人檔案');
    if (nick != null) {
      nick = String(nick).trim();
      if (!nick) throw new Error('暱稱不能空白');
      if (nick.length > 20) throw new Error('暱稱請在 20 字以內');
      p.nick = nick;
    }
    if (age !== undefined) p.age = (age === '' || age == null) ? null : Number(age);
    if (gender) p.gender = gender;
    setProfile(p);
    return p;
  }

  function currentUser() { return getProfile(); }

  /* 對外舊 API 相容（保留名字讓其他頁不用改）*/
  function currentEmail() { return getProfile() ? (getProfile().nick || null) : null; }

  /* 整本資料匯出 / 匯入（給 Drive 備份用） */
  function exportAllData() {
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      profile: getProfile(),
    };
  }
  function importAllData(payload, mode = 'merge') {
    if (!payload) throw new Error('資料為空');
    /* 支援 v1（accounts）與 v2（profile） */
    let incoming = null;
    if (payload.profile) {
      incoming = payload.profile;
    } else if (payload.accounts) {
      const cur = payload.current && payload.accounts[payload.current];
      if (cur) incoming = {
        nick: cur.nick, age: cur.age, gender: cur.gender,
        createdAt: cur.createdAt, history: cur.history || [],
      };
      else {
        /* 取第一個帳號 */
        const k = Object.keys(payload.accounts)[0];
        if (k) {
          const a = payload.accounts[k];
          incoming = {
            nick: a.nick, age: a.age, gender: a.gender,
            createdAt: a.createdAt, history: a.history || [],
          };
        }
      }
    }
    if (!incoming) throw new Error('資料格式錯誤');

    if (mode === 'replace' || !getProfile()) {
      setProfile(incoming);
      return;
    }
    /* merge：合併紀錄、其他欄位以匯入版為主 */
    const cur = getProfile();
    const seen = new Set(cur.history.map(s => s.date));
    incoming.history.forEach(s => { if (!seen.has(s.date)) cur.history.unshift(s); });
    cur.history.sort((x, y) => (y.date || '').localeCompare(x.date || ''));
    if (cur.history.length > MAX_PROFILE_HISTORY) cur.history.length = MAX_PROFILE_HISTORY;
    setProfile(cur);
  }

  /* ---- 紀錄存取 ---- */
  function saveSessionForCurrent(session) {
    const p = getProfile();
    if (p) {
      p.history.unshift(session);
      if (p.history.length > MAX_PROFILE_HISTORY) p.history.length = MAX_PROFILE_HISTORY;
      setProfile(p);
      return { saved: 'user', nick: p.nick };
    }
    /* 沒檔案：仍寫到 legacy global，給未建檔的訪客 */
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem(TWEG_LEGACY_HISTORY_KEY) || '[]'); } catch (e) {}
    arr.unshift(session);
    if (arr.length > 20) arr.length = 20;
    localStorage.setItem(TWEG_LEGACY_HISTORY_KEY, JSON.stringify(arr));
    return { saved: 'guest' };
  }

  function getHistoryForCurrent() {
    const p = getProfile();
    if (p) return p.history || [];
    try { return JSON.parse(localStorage.getItem(TWEG_LEGACY_HISTORY_KEY) || '[]'); }
    catch (e) { return []; }
  }

  /* ---- 頂部導覽：個人檔案 chip ---- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function renderTopnavChip() {
    const nav = document.querySelector('.topnav');
    if (!nav) return;
    nav.querySelectorAll('.topnav-account').forEach(n => n.remove());
    const a = document.createElement('a');
    a.href = 'account.html';
    a.className = 'topnav-account';
    const p = getProfile();
    if (p) {
      a.innerHTML = `<span class="ac-ic">👤</span><span class="ac-n">${escapeHtml(p.nick)}</span>`;
      a.title = '我的檔案';
    } else {
      a.innerHTML = `<span class="ac-ic">📋</span><span class="ac-n">建立檔案</span>`;
      a.title = '建立個人檔案後紀錄可保存';
    }
    if (location.pathname.endsWith('account.html')) a.classList.add('active');
    nav.appendChild(a);
  }

  document.addEventListener('DOMContentLoaded', renderTopnavChip);

  return {
    /* 基本 */
    currentUser, currentEmail,
    create, update, clearProfile,
    /* 相容舊呼叫 */
    logout: clearProfile,
    deleteAccount: clearProfile,
    /* 紀錄 */
    saveSessionForCurrent, getHistoryForCurrent,
    /* 備份 */
    exportAllData, importAllData,
    /* UI */
    renderTopnavChip,
  };
})();
