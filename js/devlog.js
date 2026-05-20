/* ============================================================
 * 開發紀錄 — 各開發段落資料
 * 維護規則：每完成一個開發段落，在 PHASES 陣列最後新增一筆。
 * ============================================================ */

const PHASES = [
  {
    tag: '段落 0',
    date: '2026-05-20',
    title: '從 PC13110 的 GeoGuess 衍生為獨立教育站',
    commit: 'e028227',
    verbatim: '我繼續上次的 PC13110 工程設計學習平台專案（/Volumes/128G/pc13110-platform，可參考你的記憶）。最新狀態：commit 00339a0，dev-log 段落 41，全部已 push 上線。昨天剛完成全站三輪驗證並修正 5 處（truss.js、geoguess overlay、dev-log 統計卡、VERIFY 區塊、m-truss 截圖）。平台五章 27 模組、教師後台、教師手冊、像素實驗室、下課遊樂區（含 8 款遊戲）全部齊全。接下來我想看看，是否可以把遊戲區的 GeoGuess 另外做成一個獨立的專案活動，讓他以單獨教育的概念搭配遊戲進行設計',
    context: '與使用者對齊方向：① 定位上選擇「三者整合的完整專案」（學生個人探索 + 教師活動模式 + 學習單與成果產出）；② 部署上選擇「完全獨立的個體」——資料初始複製 PC13110 的 200 景點與 wiki 截圖，之後各自維護；③ 名稱為 taiwan-engineering-geo；④ 教育設計元素同時加入「課前導讀／學習單／深度模式追問／教師端統計」四項。建立 6 個頁面的完整站、繼承 GeoGuess 既有的三層影像來源（360° 環景 / 平面實景 / 衛星空照），並設計獨立的紙地圖視覺風格（深青 + 琥珀，與 PC13110 不同）。',
    decisions: [
      '完全獨立 repo、與 PC13110 解耦',
      '名稱 taiwan-engineering-geo（henrychao521.github.io/taiwan-engineering-geo/）',
      '資料初始複製 200 景點 + 151 wiki 截圖，之後各自維護',
      '紙地圖紙底 #FDFBF7 + 深青 #1E5266 + 琥珀 #D97706 視覺識別',
    ],
    outputs: [
      '6 頁站點：index / intro / explore / worksheet / teacher / about',
      'js/data.js 抽出 200 景點、151 wiki refs',
      '探索三模式（工程地景 / 精選地景 / Mapillary）＋ 深度模式追問',
      '學習單可列印（自動帶入或空白版）',
      '教師端：解碼學生成績碼 → 班級統計（全瀏覽器執行）',
      'git init + 推上 GitHub + GitHub Pages 上線',
    ],
  },
  {
    tag: '段落 1',
    date: '2026-05-20',
    title: '衛星空照載入速度優化',
    commit: '40735c7',
    verbatim: '現在開啟空照畫面的速度都有點慢，有什麼辦法可以提升嗎？',
    context: '原本使用 Esri World Imagery 的 export REST 端點——伺服器即時合成一張 1024×768 JPEG，每次切景或縮放都重新合成、無 CDN 快取，因此感覺很慢。改用同服務的瓦片端點 tile/{z}/{y}/{x}：256×256 預渲染瓦片、全球 CDN 快取、多瓦片並行載入。將 photo-box 內的 <img> 改為迷你 Leaflet 地圖呈現空照，保留原本的「拉遠／拉近」五段視野（街廓 / 近 / 中 / 遠 / 最遠），對應 Leaflet zoom [17,16,15,13,12]。並加入「揭曉到使用者按下一題之間」背景預載下一題附近 3×3=9 個瓦片的暖快取機制。',
    decisions: [
      '空照從 export 端點改為 tile 端點（CDN 快取）',
      'photo-box 用迷你 Leaflet map 取代 <img>',
      '預設 zoom 13「遠」，揭曉時自動拉到 16「近」',
      '揭曉同時背景 prefetch 下一題 9 個瓦片',
    ],
    outputs: [
      'css/style.css 新增 #satMap 樣式',
      'js/explore.js initSatMap / showSatMap / hideSatMap / prefetchSatTiles',
      '實測切景明顯加速、邊緣瓦片重用、同地多次玩近乎瞬開',
    ],
  },
  {
    tag: '段落 2',
    date: '2026-05-20',
    title: '玩家資料紀錄系統（首版：email + 4 碼密碼）',
    commit: '487b56d',
    verbatim: '可以加入玩家資料紀錄的功能嗎？提供試玩（題目20題）以及輸入個人資料（email、設定密碼四碼簡單就好、年紀、性別（男、女、不提供））',
    verbatim2: '（後續決策）「有辦法跟 google drive 連結嗎？」→ 選擇「兩階段：本機帳號 + Drive 一鍵備份（推薦）」',
    context: '與使用者討論儲存方式：站台本身為純前端、無後端；考量 PDPA 與校園個資保護，採 localStorage 為主，Drive 為「跨裝置自選備份」。建立完整 v1.1 帳號系統：account.html（登入/註冊分頁）、js/auth.js（多帳號 + SHA-256 PIN 雜湊）、js/drive.js（Google OAuth + drive.file scope 只能讀寫自己建立的 JSON）。探索完成自動存到登入帳號 history；探索起始畫面新增「🎮 試玩 20 題」入口，跨全 200 景點、不需登入、不會保存。學習單與教師端改為帳號感知。',
    decisions: [
      'localStorage 為主、不開後端、不收個資',
      '4 碼 PIN 經 SHA-256 雜湊存放（軟鎖層級）',
      'Drive scope 採 drive.file（只能存取本站建立的檔）',
      '試玩 20 題：跨 200 景點，不需登入、不保存',
      '註冊時自動把 v1.0 全域 tweg_history 搬到新帳號',
    ],
    outputs: [
      '4 個新檔：account.html / js/auth.js / js/account.js / js/drive.js',
      '所有頁面 topnav 自動顯示「👤 暱稱」/「📋 登入/註冊」chip',
      '結算頁依儲存結果顯示不同提示文字',
      'README 補上 Google OAuth 設定步驟',
    ],
  },
  {
    tag: '段落 3',
    date: '2026-05-20',
    title: '簡化帳號系統：拿掉 email 與密碼',
    commit: 'c2788d0',
    verbatim: '修正一下好了，不要讓他這麼複雜，讓使用者輸入名稱、性別、年紀 這些資訊就好了',
    context: '使用者回饋：登入流程過於複雜。重寫 auth.js 為「單一個人檔案」結構：{ nick, age, gender, createdAt, history }。一個瀏覽器一個檔案，要換人就按「重新建立」。同時保留 v1.0 全域 history 與 v1.1 多帳號版本的自動遷移邏輯——載入 auth.js 時偵測舊格式 keys、搬到新 tweg_profile、清掉舊 keys。account.html 從「登入/註冊分頁」改為單頁表單，三欄位（暱稱／年齡／性別）即可建檔。explore.js 起始畫面文字配合改為「目前玩家：xx」。',
    decisions: [
      '單一個人檔案（每瀏覽器一個），不再有多帳號概念',
      '拿掉 email、PIN、SHA-256 雜湊、登入流程',
      '舊 v1.0 / v1.1 結構自動遷移到 v1.2',
      'Drive 備份邏輯保留，只是備份對象變單一 profile',
    ],
    outputs: [
      'auth.js 重寫為單 profile 模型（221 +、277 -）',
      'account.html 單頁表單，移除 tabs',
      'explore.js 結算頁與起始畫面文字配合簡化',
    ],
  },
  {
    tag: '段落 4',
    date: '2026-05-20',
    title: '字級放大、JSON 匯出移到教師端、結算頁加排行榜',
    commit: '4ad60e8',
    verbatim: '文字可以放大嗎？然後JSON下載的功能放在教師後台。測驗完之後顯示不同人的測驗排名。',
    context: '三項使用者回饋一次處理：① body 15 → 17px、lead 16.5 → 19px、h1 44 → 50px、按鈕／HUD／追問題目／結算 overlay／模式選擇按鈕等同步放大，對投影或視力較弱者較友善。② JSON 下載／還原按鈕從帳號頁移到 teacher.html 的「資料匯出 / 匯入」區，並可勾選「含本次貼上的班級成績資料」一起打包；帳號頁只保留 Drive 備份。③ 新增 tweg_leaderboard 全域陣列（上限 100），跨個人檔案保留所有玩過紀錄；結算頁顯示「同題型排行榜」（按 rounds 分組，10 題與 20 題各自獨立），當前玩家以琥珀色高亮為「你」，未進前 10 補一行顯示自己名次。',
    decisions: [
      '整站字級往上跳 1–2 級',
      '跨個人檔案的排行榜：清除 profile 不影響排行榜',
      '排行榜按 rounds 分組（10 題 / 20 題 / 5 題各自獨立）',
      'JSON 下載／還原集中到教師端',
    ],
    outputs: [
      'css/style.css 大幅調整字級',
      'js/explore.js: pushLeaderboard + renderLeaderboard',
      'js/teacher.js: jsonDownload / jsonUpload + 「含班級成績資料」開關',
      'account.html: 只保留 Drive 備份按鈕',
    ],
  },
  {
    tag: '段落 5',
    date: '2026-05-20',
    title: '教師使用指南 PPT（含每頁截圖）',
    commit: '833d2b6',
    verbatim: '幫我設計一份使用教學PPT，給沒用過的老師們看，需要有每個頁面的截圖。',
    context: '截圖部分：嘗試安裝 Playwright 被 auto mode classifier 攔下（不在 repo manifest 內），改用 Chrome headless + 在 explore/account/worksheet/teacher 各加極小的 ?demo= 參數 helper（URL 帶該參數時自動產生示範資料、推進到對應狀態，URL 不帶完全不執行）。寫 /tmp/capture_tweg.sh 用 --headless=new + --virtual-time-budget + 22 秒 kill timer 抓 11 張 1440×900 截圖。再用 pptxgenjs 寫 /tmp/build_tweg_ppt.js 生成 16 頁 PPT：封面、這是什麼、整體流程、11 張截圖頁、四種教學使用場景、6 題 FAQ、結尾。視覺風格沿用站內紙地圖（深青 + 琥珀 + 紙底）。轉 PDF 後用 subagent 做視覺 QA，發現 slide 5（子彈壓到 callout）與 slide 16（上方空 teal 帶）兩處問題，修正後再驗證通過。',
    decisions: [
      '為 4 個頁面 JS 加入 ?demo= helper 作為截圖介面（無侵入）',
      'Chrome headless=new + virtual-time-budget + kill timer 抓互動狀態截圖',
      'pptxgenjs 生成 16 頁，QA 後修兩處版面問題',
    ],
    outputs: [
      'docs/教師使用指南.pptx（4.2 MB）',
      'docs/教師使用指南.pdf（2.5 MB，列印友善版）',
      'docs/screenshots/ — 11 張 1440×900 PNG',
      '各頁 JS 新增 demo helper（截圖用，不影響正常使用者）',
    ],
  },
  {
    tag: '段落 6',
    date: '2026-05-20',
    title: '學習單新增「教師版（含參考答案）」',
    commit: '3740c00',
    verbatim: '剛剛有老師提問：是否可以在學生測驗完，生成學習單之後，同樣生成一份學習單給老師，並附上參考答案呢？',
    context: '學習單頁 versionSel 下拉新增第三種選項「📚 教師版（含參考答案）」。教師版會根據學生這一局實際遇到的 10 個景點，動態生成四題反思題的參考答案與評分要點：Q1 取本局最低分景點解釋地理／工程／教材；Q2 取最高分景點並依名稱判斷從結構／機構／控制哪個面向切入；Q3 計算四主題平均得分、給最弱主題一個合理解釋；Q4 從本局景點挑兩個有明顯地理線索的（橋／水庫／隧道／風場／港等），逐一說明「地理 → 限制 → 設計回應」鏈條。延伸探究表格自動帶入示範填答（用 tip 最長的景點）。自我評量在教師版隱藏、改成「教師評語」空白欄。表格上方加黃色 banner 標明「教師版」與對應的模式／總分／成績碼。',
    decisions: [
      'versionSel 多一個 teacher 選項，不另開新頁',
      '答案根據學生本局實際 10 題動態生成（而非通用答案）',
      'geoCueOf() 依名稱關鍵字推地理線索 → 提供 11 種設施類型對應的設計回應說明',
      '?teacher=1 URL 參數讓截圖工具自動切到教師版',
    ],
    outputs: [
      'worksheet.html：data-q 標註反思題、id="extColHead" 標欄頭',
      'js/worksheet.js：buildAnswers / renderTeacherAnswers / clearTeacherAnswers / EXT_BLANK 重設',
      'css/style.css：.ws-answer 綠色 callout（含列印 page-break-inside:avoid）',
      'docs/screenshots/12-worksheet-teacher.png 新截圖',
    ],
  },
  {
    tag: '段落 7',
    date: '2026-05-20',
    title: 'Apple 上架可行性諮詢（不執行）',
    verbatim: '這個系統有辦法做成 Apple 的上架程式嗎？',
    context: '提供三條路徑分析：A. PWA（漸進式 Web App）—— 加 manifest.json + service worker，現有站不用改架構，零費用、無審核、學生「加入主畫面」即近似 app；B. Capacitor 包殼上 App Store —— Apple Developer $99/年 + Mac + Xcode，1–2 週工時，需加 3–4 個原生功能才有機會避開 Guideline 4.2「Minimum Functionality」退件；C. 純原生 Swift 重寫 —— 3–6 個月、可整合 ARKit / Core ML / GameCenter，但是另一個專案規模。對「老師在課堂上要學生用 iPad 玩」這個實際需求，推薦走 PWA 即可。使用者回覆「先不要，我只是了解一下」，留下決策卡片與三個未來觸發訊號（學校 IT 禁網頁／要 AR 相機／需要 App Store 曝光）。',
    decisions: [
      '當前不執行任何上架方向',
      '保留決策卡片：PWA / Capacitor / Swift 三條路徑成本對照',
      '記下未來再評估的三個觸發訊號',
    ],
    outputs: [
      '本段落僅為諮詢，無程式碼變動',
    ],
  },
  {
    tag: '段落 8',
    date: '2026-05-20',
    title: '建立本專案的開發紀錄頁',
    commit: 'fad4841',
    verbatim: '這個專案一樣幫我生成紀錄以及逐字稿，謝謝',
    context: '仿 PC13110 dev-log.html 結構為本專案建立獨立的開發紀錄頁。逐段追溯本專案從段落 0（衍生獨立站）到段落 7（Apple 上架諮詢）的完整對話脈絡，包含每段使用者需求逐字稿、決策依據、執行產出與對應的 git commit。設定後續維護規則：每完成一個新開發段落即新增一張卡片並同步 commit。同時更新個人記憶（feedback_pc13110_devlog.md 已涵蓋此規則的精神，本專案加註同樣適用）。',
    decisions: [
      '與 PC13110 各自一份開發紀錄頁',
      '採三段式結構：使用者需求逐字稿 / 決策與脈絡 / 執行產出',
      '紀錄頁 noindex，內部留存與檢視用',
    ],
    outputs: [
      'dev-log.html 與 js/devlog.js（共 9 段落）',
      'index.html footer 加入連結',
      '記憶檔加註本專案的紀錄維護規則',
    ],
  },
  {
    tag: '段落 9',
    date: '2026-05-20',
    title: '手機版響應式優化',
    verbatim: '手機頁面有進行優化嗎？',
    context: '在 375px iPhone 寬度逐頁實測，發現 6 處需要調整：① 頂部 nav 6 連結 + 帳號 chip 擠成 2 行；② 帳號頁 4 欄統計卡每欄寬不到 50px 導致 label「完成局／數」垂直斷字；③ 學習單 8 欄表格在手機完全擠死、文字斷字嚴重；④ 探索頁 HUD 雖換行但顯得擁擠；⑤ explore 起始畫面「目前玩家：小明，每局結束會自動存到你的紀錄。我的檔案」一行用 flex gap 佈局，導致每個內容被當 flex item 異常斷字；⑥ 個人檔案頁「✏️ 編輯」按鈕被擠成「編／輯」直書。新增 4 個 mobile breakpoint（760 / 600 / 480 / 420 px），統計卡 4 欄 → 2×2，學習單表格 min-width: 680px 配合 -webkit-overflow-scrolling:touch 與「→ 左右滑動」提示。ov-userline 從 flex 改回 block。',
    decisions: [
      '加 4 個媒體查詢斷點（760 / 600 / 480 / 420）',
      'tc-stats / dl-meta 等 4 欄統計在小螢幕變 2×2',
      '學習單表格 min-width: 680px 強制橫向捲動，附「左右滑動」提示',
      'ov-userline 改用 block + line-height，避免 flex gap 異常斷字',
      'topbar logo / brand 字級在小螢幕同步縮小',
    ],
    outputs: [
      'css/style.css 增添各斷點處理（約 80 行 mobile-only 規則）',
      '375px 視口下所有頁面實測通過：首頁 / 探索三狀態 / 帳號 / 學習單 / 教師端',
    ],
  },
];

/* ---- 渲染時間軸 ---- */
(function render() {
  const tl = document.getElementById('timeline');
  if (!tl) return;
  PHASES.forEach(p => {
    const phase = document.createElement('div');
    phase.className = 'log-phase';
    const vb2 = p.verbatim2
      ? `<blockquote class="verbatim" style="margin-top:8px"><span class="vq-mark">▸ 補充說明</span><br>${p.verbatim2}</blockquote>`
      : '';
    const commitTag = p.commit
      ? `<span class="lp-commit">${p.commit}</span>`
      : '';
    phase.innerHTML = `
      <div class="lp-card">
        <span class="lp-date">${p.date}</span>
        <span class="lp-tag">${p.tag}</span>${commitTag}
        <h3>${p.title}</h3>
        <div class="lp-sec">
          <h4>💬 使用者需求（逐字稿）</h4>
          <blockquote class="verbatim"><span class="vq-mark">「</span>${p.verbatim}<span class="vq-mark">」</span></blockquote>
          ${vb2}
        </div>
        <div class="lp-sec">
          <h4>🧭 決策與脈絡</h4>
          <p>${p.context}</p>
          <div class="lp-decisions">${p.decisions.map(d => `<span>${d}</span>`).join('')}</div>
        </div>
        <div class="lp-sec">
          <h4>✅ 執行產出</h4>
          <ul>${p.outputs.map(o => `<li>${o}</li>`).join('')}</ul>
        </div>
      </div>`;
    tl.appendChild(phase);
  });
  const mPhase = document.getElementById('mPhase');
  if (mPhase) mPhase.textContent = PHASES.length;
  const mCommits = document.getElementById('mCommits');
  if (mCommits) mCommits.textContent = PHASES.filter(p => p.commit).length;
})();
