/* ============================================================
 * 我的帳號頁：登入 / 註冊 / 個人資料 / 紀錄 / Drive 備份
 * ============================================================ */

const $ = id => document.getElementById(id);

const THEMES_AC = (typeof ENG_THEMES !== 'undefined') ? ENG_THEMES : [
  '結構力學與土木工程', '參數化設計與現代建築',
  '機電整合與自動化機構', '新興科技與綠色能源',
];

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function refreshUI() {
  const u = TwegAuth.currentUser();
  if (u) showProfile(u); else showAuth();
  TwegAuth.renderTopnavChip();
}

/* ---------- 未登入：登入 / 註冊 ---------- */
function showAuth() {
  $('authSec').style.display = '';
  $('profileSec').style.display = 'none';
  /* tab 切換 */
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.onclick = () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.auth-tab').forEach(b => b.classList.toggle('active', b === btn));
      $('loginForm').classList.toggle('on', tab === 'login');
      $('registerForm').classList.toggle('on', tab === 'register');
    };
  });
  $('loginForm').onsubmit = handleLogin;
  $('registerForm').onsubmit = handleRegister;
}

async function handleLogin(e) {
  e.preventDefault();
  const msg = $('loginMsg');
  msg.textContent = '';
  try {
    await TwegAuth.login($('loginEmail').value, $('loginPin').value);
    refreshUI();
  } catch (err) {
    msg.innerHTML = `<span style="color:var(--c-red)">⚠ ${escapeHtml(err.message)}</span>`;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const msg = $('regMsg');
  msg.textContent = '';
  const pin = $('regPin').value, pin2 = $('regPin2').value;
  if (pin !== pin2) {
    msg.innerHTML = '<span style="color:var(--c-red)">⚠ 兩次密碼不一致</span>';
    return;
  }
  try {
    await TwegAuth.register({
      email: $('regEmail').value,
      pin,
      nick: $('regNick').value,
      age: $('regAge').value,
      gender: $('regGender').value,
    });
    refreshUI();
  } catch (err) {
    msg.innerHTML = `<span style="color:var(--c-red)">⚠ ${escapeHtml(err.message)}</span>`;
  }
}

/* ---------- 已登入：個人資料 + 紀錄 + Drive ---------- */
function showProfile(u) {
  $('authSec').style.display = 'none';
  $('profileSec').style.display = '';
  $('hello').textContent = `嗨，${u.nick}！`;
  $('profMeta').innerHTML =
    `${escapeHtml(u.email)} · ${u.gender || '不提供'}${u.age ? `・${u.age} 歲` : ''}` +
    ` · 加入於 ${(u.createdAt || '').slice(0, 10)}`;

  /* 統計 */
  const hist = u.history || [];
  $('pfRounds').textContent = hist.length;
  $('pfTotal').textContent = hist.reduce((a, s) => a + (s.totalScore || 0), 0);
  $('pfBest').textContent = hist.length ? Math.max(...hist.map(s => s.totalScore || 0)) : '—';
  $('pfQs').textContent = hist.reduce((a, s) => a + (s.rounds ? s.rounds.length : 0), 0);

  /* 紀錄列表 */
  const list = $('histList');
  if (!hist.length) {
    list.innerHTML = '<div class="tc-empty">尚無紀錄，去 <a href="explore.html">開始探索</a> 吧！</div>';
  } else {
    list.innerHTML = '<div class="hist-list">' + hist.slice(0, 20).map((s, i) => {
      const d = new Date(s.date);
      const ds = isNaN(d) ? s.date : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const themeName = s.mode === 'engineering'
        ? (s.theme ? THEMES_AC[s.theme - 1] : '全部主題')
        : (s.mode === 'curated' ? '精選地景' : (s.mode === 'trial' ? '試玩 20 題' : 'Mapillary'));
      const max = (s.rounds?.length || 0) * 1000;
      const pct = max ? Math.round((s.totalScore / max) * 100) : 0;
      return `<div class="hist-row">
        <div class="h-date">${ds}</div>
        <div class="h-mode">${escapeHtml(themeName)}${s.deepMode ? ' · 深度' : ''}</div>
        <div class="h-bar"><div style="width:${pct}%"></div></div>
        <div class="h-score">${s.totalScore} 分</div>
      </div>`;
    }).join('') + '</div>';
  }

  /* 按鈕事件 */
  $('logoutBtn').onclick = () => { TwegAuth.logout(); refreshUI(); };
  $('changePinBtn').onclick = handleChangePin;
  $('deleteAccBtn').onclick = handleDeleteAccount;

  /* Drive 區塊狀態 */
  initDriveSection();
  /* 純檔案版下載／上傳（不需 OAuth） */
  $('driveDownload').onclick = downloadJson;
  $('driveUpload').onclick = () => $('fileInput').click();
  $('fileInput').onchange = uploadJson;
}

function handleChangePin() {
  const oldP = prompt('請輸入原本的 4 碼密碼：');
  if (oldP == null) return;
  const newP = prompt('請輸入新的 4 碼密碼：');
  if (newP == null) return;
  TwegAuth.changePin(oldP.trim(), newP.trim())
    .then(() => alert('✅ 密碼已變更'))
    .catch(err => alert('⚠ ' + err.message));
}

function handleDeleteAccount() {
  const u = TwegAuth.currentUser();
  if (!u) return;
  const c = prompt(`確定要刪除帳號 "${u.email}" 嗎？\n所有本機紀錄會清除（Drive 備份不受影響）。\n\n請輸入 DELETE 確認：`);
  if (c !== 'DELETE') { if (c != null) alert('已取消'); return; }
  TwegAuth.deleteAccount();
  refreshUI();
}

/* ---------- 純檔案版備份 / 還原 ---------- */
function downloadJson() {
  const data = TwegAuth.exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `tweg-record-${date}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  $('driveMsg').innerHTML = '<span style="color:var(--c-green)">✅ 已下載到本機。請自行存到 Drive / Dropbox / Email。</span>';
}

function uploadJson(e) {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.accounts) throw new Error('檔案格式錯誤（缺 accounts 欄位）');
      TwegAuth.importAllData(data, 'merge');
      $('driveMsg').innerHTML = '<span style="color:var(--c-green)">✅ 已從本機 JSON 還原。請重新整理頁面或按下方</span>';
      setTimeout(refreshUI, 500);
    } catch (err) {
      $('driveMsg').innerHTML = `<span style="color:var(--c-red)">⚠ 還原失敗：${escapeHtml(err.message)}</span>`;
    }
    e.target.value = '';
  };
  reader.readAsText(f);
}

/* ---------- Drive 整合 ---------- */
function initDriveSection() {
  const status = $('driveStatus');
  const backupBtn = $('driveBackup');
  const restoreBtn = $('driveRestore');

  if (typeof TwegDrive === 'undefined' || !TwegDrive.isConfigured()) {
    status.innerHTML = '<span style="color:var(--c-amber)">ℹ️ Google Drive 一鍵備份尚未由站長設定，目前可用「⬇️ 純下載 JSON 檔」自行管理備份。</span>';
    backupBtn.disabled = true; restoreBtn.disabled = true;
    backupBtn.style.opacity = restoreBtn.style.opacity = .5;
    backupBtn.style.cursor = restoreBtn.style.cursor = 'not-allowed';
    return;
  }
  status.innerHTML = '🔒 連線 Drive 時會跳出 Google 授權視窗。本站<strong>只能存取自己建立的那一個檔</strong>，看不到 Drive 其他內容。';
  backupBtn.disabled = false; restoreBtn.disabled = false;
  backupBtn.onclick = driveBackupClick;
  restoreBtn.onclick = driveRestoreClick;
}

async function driveBackupClick() {
  const msg = $('driveMsg');
  msg.innerHTML = '⏳ 連線 Drive 中…';
  try {
    const data = TwegAuth.exportAllData();
    const file = await TwegDrive.backup(data);
    msg.innerHTML = `<span style="color:var(--c-green)">✅ 已備份到 Drive（檔名：${escapeHtml(file.name || 'taiwan-engineering-geo-record.json')}）</span>`;
  } catch (err) {
    msg.innerHTML = `<span style="color:var(--c-red)">⚠ 備份失敗：${escapeHtml(err.message)}</span>`;
  }
}

async function driveRestoreClick() {
  const msg = $('driveMsg');
  msg.innerHTML = '⏳ 從 Drive 取回…';
  try {
    const data = await TwegDrive.restore();
    if (!data) {
      msg.innerHTML = '<span style="color:var(--c-amber)">ℹ️ Drive 上沒有備份檔（先按「備份到 Drive」吧）</span>';
      return;
    }
    if (!confirm('要把 Drive 上的紀錄合併進本機嗎？已存在的帳號會保留，新的會加入。')) return;
    TwegAuth.importAllData(data, 'merge');
    msg.innerHTML = '<span style="color:var(--c-green)">✅ 已從 Drive 還原</span>';
    setTimeout(refreshUI, 500);
  } catch (err) {
    msg.innerHTML = `<span style="color:var(--c-red)">⚠ 還原失敗：${escapeHtml(err.message)}</span>`;
  }
}

refreshUI();
