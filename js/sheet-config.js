/* 作答紀錄送到老師 Google 試算表的設定（規格：classroom-sheets/SPEC.md）
 * endpoint 空字串＝完全不送、頁面也不顯示任何告知或班級座號元件。
 * 老師部署 Apps Script 後，把網頁應用程式網址（…/exec）貼到 endpoint；
 * token 是共用口令（寫在公開網頁，只能擋掃描），和 Code.gs 的 CONFIG.TOKEN 一致即可，可空。 */
window.SHEET_CONFIG = {
  platform: 'twgeo',
  endpoint: '',
  token: '',
};
