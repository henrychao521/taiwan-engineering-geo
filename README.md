# 台灣工程地景探索 · Taiwan Engineering Geo

> 200 個台灣工程地景的互動學習活動。看實景或衛星空照圖，在地圖上點出它在台灣的位置；揭曉時了解這座工程的設計重點。為高中生活科技／工程設計課程設計的獨立教育站。

線上版：<https://henrychao521.github.io/taiwan-engineering-geo/>

## 站點結構

| 頁面 | 用途 |
| --- | --- |
| `index.html` | 首頁。三個入口：課前導讀 / 開始探索 / 學習單。 |
| `intro.html` | 5 分鐘課前導讀：四大主題、200 景點分布地圖、教學使用建議。 |
| `explore.html` | 核心探索活動：三種模式、深度模式追問、結算與成績碼。 |
| `worksheet.html` | 學習單：自動帶入最近一局的 10 題、可列印 / 存 PDF。 |
| `teacher.html` | 教師端：貼上學生成績碼解碼成班級統計。 |
| `about.html` | 設計理念、資料來源、授權說明、FAQ。 |

## 三種模式

- **🏗 工程地景挑戰**（主力）— 200 個課程工程景點分為四大主題模組，每局隨機 10 題。
- **📷 精選地景**（暖身）— 10 個經典台灣地景照（CC 授權），每局 5 題。
- **🛰 Mapillary 即時街景** — 從台灣各地有街景覆蓋的城鎮隨機抽 5 題（需 Mapillary token）。

## 三層影像來源

每題依序嘗試，找到第一個可用的即顯示：

1. **🔄 360° 環景** — Mapillary spherical 影像，由 three.js 貼在球體內側、可拖曳環視
2. **📷 平面實景照** — Mapillary 一般街景照
3. **🛰 衛星空照圖** — Esri World Imagery，5 段視野縮放，無需金鑰

## 教育設計要素

- **課前導讀** — 四大主題與工程分類，附 200 個地景的縮覽地圖
- **深度模式** — 答題後追問「主題分類」與「設施類型」，每題答對 +300 分
- **學習單** — 可列印的 A4 表格，自動帶入這一局的紀錄；含反思題與延伸探究欄位
- **教師端** — 學生在結算頁複製成績碼，老師整批貼上解碼為班級統計（全在瀏覽器執行）

## 本地預覽

只是靜態網站，任意 HTTP 伺服器即可：

```sh
python3 -m http.server 8000
# 或
npx serve .
```

打開 <http://localhost:8000/>。

## 部署

預設使用 GitHub Pages：

1. 把整個資料夾推到 GitHub repo
2. Settings → Pages → Source → 選 `main` 分支根目錄
3. 等 Pages 部署完成即可

## 資料來源與授權

- 程式碼：MIT License
- 教學內容：CC BY-SA 4.0
- 第三方資料／影像依各自原始授權，詳見 [`about.html`](about.html) 與 [`refs/SOURCES.md`](refs/SOURCES.md)

主要來源：

- 200 景點清單：源自「PC13110 工程設計學習平台」研究報告
- 底圖：OpenStreetMap + CARTO Voyager
- 衛星空照：Esri World Imagery
- 實景／環景：Mapillary（CC BY-SA）
- 維基條目截圖：Wikimedia / 維基百科（CC BY-SA）
- 字型：Noto Sans TC / JetBrains Mono（OFL）
- 元件：Leaflet（BSD-2-Clause）、three.js（MIT）

## 製作者

趙珩宇老師．國中／高中生活科技、工程設計教師。

- 個人作品站：<https://henrychao521.github.io/>
- 國中生活科技數位教具平台：<https://henrychao521.github.io/livingtech-tools/>
- PC13110 工程設計學習平台：<https://henrychao521.github.io/pc13110-platform/>
