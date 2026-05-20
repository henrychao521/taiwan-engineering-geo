/* ============================================================
 * 我的檔案頁（簡化版）：建立 / 個人資料 / 紀錄 / Drive 備份
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
  if (u) showProfile(u); else showCreate();
  TwegAuth.renderTopnavChip();
}

/* ---------- 尚未建檔：建立檔案 ---------- */
function showCreate() {
  $('createSec').style.display = '';
  $('profileSec').style.display = 'none';
  $('createForm').onsubmit = handleCreate;
}

function handleCreate(e) {
  e.preventDefault();
  const msg = $('createMsg');
  msg.textContent = '';
  try {
    TwegAuth.create({
      nick: $('cNick').value,
      age: $('cAge').value,
      gender: $('cGender').value,
    });
    refreshUI();
  } catch (err) {
    msg.innerHTML = `<span style="color:var(--c-red)">⚠ ${escapeHtml(err.message)}</span>`;
  }
}

/* ---------- 已建檔：資料 / 紀錄 / Drive ---------- */
function showProfile(u) {
  $('createSec').style.display = 'none';
  $('profileSec').style.display = '';
  $('hello').textContent = `嗨，${u.nick}！`;
  $('profMeta').innerHTML =
    `${u.gender || '不提供'}${u.age ? `・${u.age} 歲` : ''}` +
    ` · 建立於 ${(u.createdAt || '').slice(0, 10)}`;

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
    list.innerHTML = '<div class="hist-list">' + hist.slice(0, 20).map(s => {
      const d = new Date(s.date);
      const ds = isNaN(d) ? s.date : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const themeName = (s.mode === 'engineering')
        ? (s.theme ? THEMES_AC[s.theme - 1] : '全部主題')
        : (s.mode === 'trial' ? '試玩 20 題'
        : s.mode === 'curated' ? '精選地景' : 'Mapillary');
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
  $('editBtn').onclick = handleEdit;
  $('resetBtn').onclick = handleReset;

  /* Drive 區塊 */
  initDriveSection();
}

function handleEdit() {
  const u = TwegAuth.currentUser();
  const nick = prompt('新的暱稱：', u.nick);
  if (nick == null) return;
  const ageStr = prompt('年齡（可留空）：', u.age == null ? '' : String(u.age));
  if (ageStr == null) return;
  const gender = prompt('性別（請輸入：男 / 女 / 不提供）：', u.gender);
  if (gender == null) return;
  try {
    TwegAuth.update({ nick, age: ageStr, gender: gender.trim() || '不提供' });
    refreshUI();
  } catch (err) { alert('⚠ ' + err.message); }
}

function handleReset() {
  if (!confirm('確定要清除目前的檔案與所有紀錄嗎？\n（已備份的 Drive / JSON 檔不受影響）')) return;
  TwegAuth.clearProfile();
  refreshUI();
}

/* ---------- Drive 整合 ---------- */
function initDriveSection() {
  const status = $('driveStatus');
  const backupBtn = $('driveBackup');
  const restoreBtn = $('driveRestore');

  if (typeof TwegDrive === 'undefined' || !TwegDrive.isConfigured()) {
    status.innerHTML = 'ℹ️ Google Drive 一鍵備份尚未由站長設定。可以用上方「⬇️ 下載 JSON 檔」自行管理。';
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
      msg.innerHTML = 'ℹ️ Drive 上沒有備份檔（先按「備份到 Drive」吧）';
      return;
    }
    if (!confirm('要把 Drive 上的紀錄合併進本機嗎？')) return;
    TwegAuth.importAllData(data, 'merge');
    msg.innerHTML = '<span style="color:var(--c-green)">✅ 已從 Drive 還原</span>';
    setTimeout(refreshUI, 500);
  } catch (err) {
    msg.innerHTML = `<span style="color:var(--c-red)">⚠ 還原失敗：${escapeHtml(err.message)}</span>`;
  }
}

refreshUI();
