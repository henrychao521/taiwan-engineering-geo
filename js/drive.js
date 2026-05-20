/* ============================================================
 * Google Drive 整合：把帳號＋紀錄打包成單一 JSON 檔，
 * 存到使用者自己的 Drive，本站只能讀寫這一個檔
 * （drive.file scope：只能存取本應用建立的檔案）
 *
 * 設定方式（見 README "Google Drive 一鍵備份設定"）：
 *   1. 到 console.cloud.google.com 建立專案、啟用 Drive API
 *   2. 建立 OAuth 2.0 Client ID（網頁應用）
 *   3. Authorized JavaScript origins 加入：
 *      https://henrychao521.github.io
 *      （以及本機開發用 http://localhost:8766）
 *   4. 把 Client ID 貼到下面的 DRIVE_CLIENT_ID
 * ============================================================ */

const DRIVE_CLIENT_ID = '';   /* 例：'1234567890-xxxxxx.apps.googleusercontent.com' */
const DRIVE_FILE_NAME = 'taiwan-engineering-geo-record.json';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const TwegDrive = (function () {
  let tokenClient = null;
  let accessToken = null;
  let tokenExp = 0;

  function isConfigured() { return !!DRIVE_CLIENT_ID; }

  function ensureGsi() {
    return new Promise((resolve, reject) => {
      if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
        return resolve();
      }
      /* gsi/client 是 async defer，等它就緒 */
      const start = Date.now();
      const iv = setInterval(() => {
        if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
          clearInterval(iv); resolve();
        } else if (Date.now() - start > 7000) {
          clearInterval(iv); reject(new Error('Google 程式庫載入逾時'));
        }
      }, 100);
    });
  }

  async function initTokenClient() {
    if (!isConfigured()) throw new Error('Drive Client ID 未設定');
    await ensureGsi();
    if (tokenClient) return tokenClient;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: DRIVE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: () => {},   /* per-request overridden */
    });
    return tokenClient;
  }

  function requestToken() {
    return new Promise(async (resolve, reject) => {
      try { await initTokenClient(); }
      catch (e) { reject(e); return; }
      tokenClient.callback = (resp) => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error));
          return;
        }
        accessToken = resp.access_token;
        tokenExp = Date.now() + (resp.expires_in || 3600) * 1000 - 30000;
        resolve(accessToken);
      };
      try { tokenClient.requestAccessToken({ prompt: '' }); }
      catch (e) { reject(e); }
    });
  }

  async function getToken() {
    if (accessToken && Date.now() < tokenExp) return accessToken;
    return await requestToken();
  }

  async function findRecordFile() {
    const token = await getToken();
    const q = encodeURIComponent(`name='${DRIVE_FILE_NAME}' and trashed=false`);
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!resp.ok) throw new Error('查詢檔案失敗：' + resp.status);
    const j = await resp.json();
    return (j.files || [])[0] || null;
  }

  async function backup(data) {
    const token = await getToken();
    const existing = await findRecordFile();
    const metadata = { name: DRIVE_FILE_NAME, mimeType: 'application/json' };
    const boundary = 'tweg' + Date.now();
    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\n` +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(data) +
      `\r\n--${boundary}--`;
    const url = existing
      ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const method = existing ? 'PATCH' : 'POST';
    const resp = await fetch(url, {
      method,
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`寫入 Drive 失敗：${resp.status} ${t.slice(0, 120)}`);
    }
    return await resp.json();
  }

  async function restore() {
    const token = await getToken();
    const existing = await findRecordFile();
    if (!existing) return null;
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${existing.id}?alt=media`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!resp.ok) throw new Error('讀取 Drive 檔案失敗：' + resp.status);
    return await resp.json();
  }

  return { isConfigured, backup, restore };
})();
