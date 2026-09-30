/* ============================================================
 * 導讀頁：在小地圖上顯示全部 200 個地景，依四大主題上色
 * ============================================================ */

(function () {
  const mapEl = document.getElementById('introMap');
  if (!mapEl || typeof L === 'undefined' || typeof SITES === 'undefined') return;

  const map = L.map('introMap', {
    minZoom: 6, zoomControl: true, attributionControl: true,
    maxBounds: [[20.4, 117.4], [26.9, 123.6]], maxBoundsViscosity: 0.85,
  }).setView([23.7, 120.95], 7);

  // CARTO 免費底圖已改為需金鑰（無金鑰只回「API KEY REQUIRED」浮水印），改用內政部國土測繪中心臺灣通用電子地圖（中文地名、政府資料開放授權、免金鑰）；注意路徑是 {z}/{y}/{x}
  L.tileLayer('https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}', {
    maxZoom: 14,
    attribution: '© <a href="https://maps.nlsc.gov.tw/" target="_blank" rel="noopener">內政部國土測繪中心</a>',
  }).addTo(map);

  /* 主題顏色：每 50 筆對應一個主題 */
  const themeColors = ['#1E5266', '#7C3AED', '#D97706', '#15803D'];

  SITES.forEach((s, i) => {
    const themeIdx = Math.floor(i / 50);
    const color = themeColors[themeIdx] || '#6E7A8C';
    const themeName = (typeof ENG_THEMES !== 'undefined') ? ENG_THEMES[themeIdx] : '';
    L.circleMarker([s[1], s[2]], {
      radius: 4, color, fillColor: color,
      fillOpacity: .82, weight: 1, opacity: .92,
    }).addTo(map).bindTooltip(
      `<b>${s[0]}</b><br><span style="color:${color};font-weight:700">${themeName}</span>`,
      { direction: 'top', offset: [0, -4] }
    );
  });
})();
