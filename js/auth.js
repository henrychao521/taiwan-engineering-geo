/* ============================================================
 * 台灣工程地景探索 — 帳號系統
 * 純 localStorage：帳號、密碼（雜湊）、紀錄都只存在這個瀏覽器
 * 不上傳任何資料到外部伺服器；跨裝置請使用 Drive 備份／還原
 * ============================================================ */

const TWEG_ACCOUNTS_KEY = 'tweg_accounts';
const TWEG_CURRENT_KEY  = 'tweg_current';
const TWEG_LEGACY_HISTORY_KEY = 'tweg_history';   /* v1.0 全域紀錄 */
const MAX_USER_HISTORY = 50;

const TwegAuth = (function () {

  function getAccounts() {
    try { return JSON.parse(localStorage.getItem(TWEG_ACCOUNTS_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function setAccounts(accs) {
    localStorage.setItem(TWEG_ACCOUNTS_KEY, JSON.stringify(accs));
  }
  function currentEmail() {
    return localStorage.getItem(TWEG_CURRENT_KEY) || null;
  }
  function currentUser() {
    const email = currentEmail();
    if (!email) return null;
    return getAccounts()[email] || null;
  }

  /* 4 碼 PIN 雜湊：本機儲存，純粹防止 DevTools 直接看到明碼，
   * 因為攻擊面只有「同學在你電腦上開 DevTools」，PIN 強度本來就低 */
  async function hashPin(pin) {
    const enc = new TextEncoder().encode('tweg-v1|' + pin);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function normEmail(s) { return String(s || '').trim().toLowerCase(); }

  function isValidEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
  function isValidPin(s) { return /^\d{4}$/.test(s); }

  async function register({ email, pin, nick, age, gender }) {
    email = normEmail(email);
    if (!isValidEmail(email)) throw new Error('email 格式不正確');
    if (!isValidPin(pin)) throw new Error('密碼必須是 4 個數字');
    if (!nick || !nick.trim()) throw new Error('暱稱不能空白');
    const accs = getAccounts();
    if (accs[email]) throw new Error('此 email 已註冊過，請改用「登入」');
    const pinHash = await hashPin(pin);

    /* 把 v1.0 的全域 tweg_history 自動搬到新建帳號底下 */
    let legacy = [];
    try { legacy = JSON.parse(localStorage.getItem(TWEG_LEGACY_HISTORY_KEY) || '[]'); }
    catch (e) {}

    accs[email] = {
      email, nick: nick.trim(),
      age: (age === '' || age == null) ? null : Number(age),
      gender: gender || '不提供',
      pinHash,
      createdAt: new Date().toISOString(),
      history: legacy,
    };
    setAccounts(accs);
    localStorage.setItem(TWEG_CURRENT_KEY, email);
    if (legacy.length) localStorage.removeItem(TWEG_LEGACY_HISTORY_KEY);
    return accs[email];
  }

  async function login(email, pin) {
    email = normEmail(email);
    const accs = getAccounts();
    if (!accs[email]) throw new Error('找不到這個 email，可改用「註冊」');
    const pinHash = await hashPin(pin);
    if (accs[email].pinHash !== pinHash) throw new Error('密碼錯誤');
    localStorage.setItem(TWEG_CURRENT_KEY, email);
    return accs[email];
  }

  function logout() {
    localStorage.removeItem(TWEG_CURRENT_KEY);
  }

  async function changePin(oldPin, newPin) {
    const email = currentEmail();
    if (!email) throw new Error('尚未登入');
    if (!isValidPin(newPin)) throw new Error('新密碼必須是 4 個數字');
    const accs = getAccounts();
    if (!accs[email]) throw new Error('帳號不存在');
    if (accs[email].pinHash !== await hashPin(oldPin)) throw new Error('原密碼錯誤');
    accs[email].pinHash = await hashPin(newPin);
    setAccounts(accs);
  }

  function deleteAccount() {
    const email = currentEmail();
    if (!email) return;
    const accs = getAccounts();
    delete accs[email];
    setAccounts(accs);
    localStorage.removeItem(TWEG_CURRENT_KEY);
  }

  /* 將整本 accounts 連帳號＋紀錄打包，用於 Drive 備份 */
  function exportAllData() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      accounts: getAccounts(),
      current: currentEmail(),
    };
  }
  /* 從 Drive 取回的整本 accounts 寫回 localStorage */
  function importAllData(payload, mode = 'merge') {
    if (!payload || !payload.accounts) throw new Error('資料格式錯誤');
    if (mode === 'replace') {
      setAccounts(payload.accounts);
    } else {
      /* merge：以 email 為鍵，新檔 history 與既有 history 合併去重 */
      const cur = getAccounts();
      Object.keys(payload.accounts).forEach(email => {
        if (!cur[email]) cur[email] = payload.accounts[email];
        else {
          const a = payload.accounts[email];
          const seen = new Set(cur[email].history.map(s => s.date));
          a.history.forEach(s => { if (!seen.has(s.date)) cur[email].history.unshift(s); });
          cur[email].history.sort((x, y) => (y.date || '').localeCompare(x.date || ''));
          if (cur[email].history.length > MAX_USER_HISTORY) cur[email].history.length = MAX_USER_HISTORY;
        }
      });
      setAccounts(cur);
    }
  }

  /* 紀錄存取 ---------- */
  function saveSessionForCurrent(session) {
    const email = currentEmail();
    if (email) {
      const accs = getAccounts();
      if (accs[email]) {
        accs[email].history.unshift(session);
        if (accs[email].history.length > MAX_USER_HISTORY) accs[email].history.length = MAX_USER_HISTORY;
        setAccounts(accs);
        return { saved: 'user', email };
      }
    }
    /* 未登入：仍寫到 legacy global，舊功能不破 */
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem(TWEG_LEGACY_HISTORY_KEY) || '[]'); } catch (e) {}
    arr.unshift(session);
    if (arr.length > 20) arr.length = 20;
    localStorage.setItem(TWEG_LEGACY_HISTORY_KEY, JSON.stringify(arr));
    return { saved: 'guest' };
  }

  function getHistoryForCurrent() {
    const u = currentUser();
    if (u) return u.history || [];
    try { return JSON.parse(localStorage.getItem(TWEG_LEGACY_HISTORY_KEY) || '[]'); }
    catch (e) { return []; }
  }

  /* 頂部導覽：自動加上一個帳號 chip / 連結 ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function renderTopnavChip() {
    const nav = document.querySelector('.topnav');
    if (!nav) return;
    /* 移除舊的，避免 init 多次 */
    nav.querySelectorAll('.topnav-account').forEach(n => n.remove());
    const a = document.createElement('a');
    a.href = 'account.html';
    a.className = 'topnav-account';
    const u = currentUser();
    if (u) {
      a.innerHTML = `<span class="ac-ic">👤</span><span class="ac-n">${escapeHtml(u.nick)}</span>`;
      a.title = '我的帳號';
    } else {
      a.innerHTML = `<span class="ac-ic">📋</span><span class="ac-n">登入 / 註冊</span>`;
      a.title = '建立帳號可保存紀錄';
    }
    /* 標出當前頁 */
    if (location.pathname.endsWith('account.html')) a.classList.add('active');
    nav.appendChild(a);
  }

  document.addEventListener('DOMContentLoaded', renderTopnavChip);

  return {
    /* 基本 */
    getAccounts, currentUser, currentEmail,
    register, login, logout, changePin, deleteAccount,
    /* 紀錄 */
    saveSessionForCurrent, getHistoryForCurrent,
    /* 備份 */
    exportAllData, importAllData,
    /* UI */
    renderTopnavChip,
    /* helpers */
    isValidEmail, isValidPin,
  };
})();
