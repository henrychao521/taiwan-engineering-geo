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
    context: '原本使用 Esri World Imagery 的 export REST 端點——伺服器即時合成一張 1024×768 JPEG，每次切景或縮放都重新合成、無 CDN 快取，因此感覺很慢。改用同服務的圖磚端點 tile/{z}/{y}/{x}：256×256 預渲染圖磚、全球 CDN 快取、多圖磚並行載入。將 photo-box 內的 <img> 改為迷你 Leaflet 地圖呈現空照，保留原本的「拉遠／拉近」五段視野（街廓 / 近 / 中 / 遠 / 最遠），對應 Leaflet zoom [17,16,15,13,12]。並加入「揭曉到使用者按下一題之間」背景預載下一題附近 3×3=9 個圖磚的暖快取機制。',
    decisions: [
      '空照從 export 端點改為 tile 端點（CDN 快取）',
      'photo-box 用迷你 Leaflet map 取代 <img>',
      '預設 zoom 13「遠」，揭曉時自動拉到 16「近」',
      '揭曉同時背景 prefetch 下一題 9 個圖磚',
    ],
    outputs: [
      'css/style.css 新增 #satMap 樣式',
      'js/explore.js initSatMap / showSatMap / hideSatMap / prefetchSatTiles',
      '實測切景明顯加速、邊緣圖磚重用、同地多次玩近乎瞬開',
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
  {
    tag: '段落 10',
    date: '2026-07-11',
    title: '全站體檢:200 景點事實查核修正 39 處+功能安全修復',
    verbatim: '我們還有四個小時的token內容，你看看還能發展哪些東西吧？（延伸自 livingtech-tools / pc13110 兩平台體檢的同一套管線）',
    context: '比照姊妹平台的四層檢驗:程式化座標檢查(200 筆全在台澎金馬界內、無重名;6 組同座標為同建築群雙景點屬設計)→ 兩路教科書級審稿代理逐筆查核 → 17 條存疑項以 WebSearch 附官方來源裁決 → console 掃描 7 頁零錯誤+真瀏覽器實測。景點資料共修 39 處,最嚴重:高屏溪斜張橋座標偏 0.5 度、沙崙兩筆指到台中、日月光指到路竹、林口三井摩天輪實為台中港「台中之星」、清水地熱/彰一開閉所/蘭嶼貯存場座標偏 3–5km;不存在的設施描述三筆改寫(大巨蛋活動屋頂→空調換氣、王功折疊橋→固定桁架、梅花湖抽水站→天然蓄水埤);工程事實修正:阿里山林鐵無齒軌、南方澳新橋為鋼拱非預力箱型梁、桃機 PMS 為膠輪導軌非直線馬達、林口電廠「三相點」應為「臨界點」、嘉義高鐵站非張拉膜、高美濕地為斜張橋、A25 的 Diagrid 查無佐證改保守描述;過時標註更新(淡江大橋 2026-05 已通車、綠美圖已開館)。功能修復:學習單歷史下拉每選必跳回最新一局的重建 bug、四處 XSS(nick/gender/err.message 未跳脫+匯入資料淨化)、教師頁解碼按鈕雙重綁定、分數條寫死 13000 溢出、試玩模式「不會保存」與實際寫排行榜的矛盾文案、?demo 覆寫真實排行榜加防護、auth 遷移邊角。全域用字:「 。」29 處、優化→最佳化、反饋→回饋、版本號統一 v1.2。',
    decisions: [
      '座標修正一律以官方/維基/OSM 來源為據,查無定論者改保守描述而非硬掰',
      '同建築群雙景點共用座標維持設計,不強行分離',
      '「不存在的設施」改寫為同地點真實工程知識點,保留 200 筆總數與主題分布',
      '匯入資料(Drive 還原/教師 JSON)一律淨化,防惡意備份檔注入',
    ],
    outputs: [
      'js/data.js 修正 39 處(座標 14、名稱 9、知識點改寫 12、用字 4 類),200 筆複檢通過',
      'js/worksheet.js / explore.js / teacher.js / account.js / auth.js 功能與安全修復 12 項',
      '7 頁 console 零錯誤,探索流程/學習單/教師端真瀏覽器實測',
    ],
  },
  {
    tag: '段落 11',
    date: '2026-07-17',
    title: '跨站台體檢複查:資料全數通過,修一處開局破圖',
    verbatim: '幫我搜尋這台電腦的專案、github上的專案、page等內容進行優化,並確認page上的每個分頁文章、內容都是正確的。',
    context: '納入 16 個 GitHub Pages 站台的全面體檢。本站複查結果:200 筆景點與首頁宣稱一致、欄位完整無重名;抽 10 筆與 OSM/Nominatim 交叉比對名稱座標描述皆相符;金門 2 筆(金門大橋、塔山發電廠)經度雖在台灣本島範圍外,確認 maxBounds 涵蓋且程式有金門專屬判斷,非資料錯誤;dev-log 與 git 同步、線上與本機一致、console 零錯誤。唯一修正:explore.html 的 #photo 影像元素初始無 src 又未隱藏,開局前左上角會出現瀏覽器破圖小圖示——加上 display:none,由 setPhoto 載入真實影像時再顯示。',
    decisions: ['初始隱藏交給 HTML 靜態屬性,不動 JS 邏輯(setPhoto/showMsg 原本就會切換 display)'],
    outputs: [
      'explore.html 開局破圖修正一處',
      '資料層/功能層/部署層複檢全數通過,無其他修改',
    ],
  },
  {
    tag: '段落 12',
    commit: 'ec870b4',
    date: '2026-09-07',
    title: '首頁改版「工程圖紙」風：跨站台去除 AI 模板感',
    verbatim: '我今天在研習分享的時候，很多老師反應我的 https://henrychao521.github.io/ 以及他往下層的網站看起來都很像claude的模板網站，覺得了無新意。可以和Antigravity共同討論看看，要如何修正嗎？',
    verbatim2: '都開始執行，三種方案分別依據不同的網站主題內容進行套用，讓網站增加多樣性。',
    context: '研習回饋指出所有站台共用同一套 AI 模板骨架。與 Antigravity 交叉診斷後定出三個承重系統，本站是地圖與測繪主題，採 A「工程圖紙」：紙白底＋方格線（SVG pattern，不用漸層）、1px 實線分格、零圓角、等寬字標註、唯一強調色雷射紅；頂端圖框列（AUTHOR／UNIT／SHEET 01／200 SITES）、首屏右欄放 img/geo-taroko.jpg 轉灰階高對比並疊座標標註框、三入口改成表格式索引（NO. 01–03 → 進入）、四大主題改四欄圖紙分格。首頁保留載入 css/style.css 與 js/auth.js，導覽列保留 .topnav 與 .topnav-account 掛勾供登入狀態插入。改版由 Antigravity 產出、機器探針一回合驗收通過（id/href/script 回歸、禁用 regex、圓角 0、無大陰影）。其他頁面未動。',
    decisions: [
      '方格線用 SVG data URI 而非 linear-gradient，讓「禁用漸層」的自動檢查能一體適用',
      '照片只用 img/ 裡既有的 CC 授權地景照，不虛構圖片',
      '只改 index.html，其餘頁面與資料層不動',
    ],
    outputs: [
      'index.html 重寫（內嵌 <style> 覆蓋首頁）',
      '本機實測 console 零錯誤、auth.js 掛勾存在',
    ],
  },
  {
    tag: '段落 13',
    date: '2026-09-28',
    title: '跨平台網狀檢核：橋型、通車時態、座標、技術敘述與用語修正',
    verbatim: 'twgeo：claude/twgeo.json ＋ mesh/*.json 裡牽涉 twgeo 的條目（已知：南方澳新橋被寫成鋼拱橋（高）；淡江大橋已於 2026 年 5 月通車仍用未來式；核三廠與南部展示館座標相同；85 大樓卡門渦街因果；機場捷運系統混淆……用語統一：豪氏、挫曲、橋梁、扭力）。',
    context: '多平台審查（Sonnet 單平台審查＋跨平台網狀檢核）挑出本站條目，逐條回到正本 grep 引文、再以維基、新聞、OpenStreetMap 獨立查證。最嚴重的是南方澳新橋：段落 10 當時把「預力箱型梁」改成「鋼拱」，其實改反了——新橋（2022-12-18 通車）是懸臂工法三跨連續預力混凝土箱型梁橋，鋼拱橋是 2019 年倒塌的舊橋。姊妹平台 PC13110 的寫法才對。',
    decisions: [
      '南方澳新橋改回預力混凝土箱型梁橋，並把舊鋼拱橋崩塌當對照教材',
      '下淡水溪鐵橋原始為曲弦普拉特式鋼桁架，1964 年補強才部分改華倫式',
      '南部展示館座標改 OSM 實際位置（21.9491, 120.7448），與核三廠分開約 1.1 km',
      '85 大樓拿掉查無出處的卡門渦街因果；PMS 拿掉「第三軌」，改三相交流 600 V、側向導引',
      '用語統一：橋樑→橋梁（分類標籤）、扭矩→扭力；本站原本就用「挫曲」，無「豪氏」相關文字',
    ],
    outputs: [
      'js/data.js 8 筆景點敘述／座標修正',
      'js/explore.js 分類標籤與抽題註解；js/worksheet.js、js/account.js 示範資料同步',
      'refs/SOURCES.md 淡江大橋去掉「建設中」',
      '分支 fix/mesh-2026-09-28，每主題一個 commit，未 push',
    ],
  },
  {
    tag: '段落 14',
    date: '2026-09-28',
    title: '動態體檢：我的檔案頁載入位移修正、地圖裁切判定為誤報',
    verbatim: '任務：修正三個教學平台「動畫跑起來後」才出現的版面問題。……twgeo：/Volumes/Work/taiwan-engineering-geo。explore.html、intro.html 桌機＋手機 clipped；account.html CLS 0.178（footer、nav 位移）。dev-log.html 要加一段紀錄。',
    context: '動態體檢（motion_qc：0.5s／3s／8s／捲到底／點按鈕後各量一次）在線上版標出兩類問題。① account.html 的 CLS 0.178：兩個區塊（建立檔案／個人資料）預設 display:none，要等 auth.js、account.js 載入才顯示其中一區；線上網路延遲時頁面先以空白 main 繪出，頁尾貼在上方，JS 到了才被推下去；導覽列右端的「建立檔案」chip 也是 JS 事後插入，其他連結跟著移位。本機把 JS／CSS 人為延遲 1 秒可重現同樣的 0.178。② explore.html、intro.html 的 clipped：被標的是 Leaflet 地圖容器，它本來就是 overflow:hidden、裡面的圖磚層寬度達數萬像素，scrollWidth 必然大於 clientWidth；實測縮放鈕與版權列都完整落在地圖框內，沒有文字被切，判定為誤報。',
    decisions: [
      'account.html 在 main 結尾加一小段內嵌 script，解析當下就依 localStorage 有無檔案顯示對應區塊，account.js 之後照常接手',
      '導覽列先放同尺寸的「建立檔案」佔位 chip，auth.js 的 renderTopnavChip 會移除後重建，不改 auth.js',
      'Leaflet 地圖裁切屬元件本身設計，不改（誤報）',
    ],
    outputs: [
      'account.html：內嵌區塊顯示 script＋導覽列佔位 chip',
      '延遲載入模擬：桌機 CLS 0.178 → 0；手機同一次頁尾位移（0.62，瀏覽器標為輸入後、不計入 CLS）也消失；本機 motion_qc 重跑 account 零警示、三頁零 console 錯誤',
      '判定紀錄：/Volumes/Work/mesh-review-2026-09-28/fixes/layout_twgeo.json',
    ],
  },
  {
    tag: '段落 15',
    date: '2026-09-28',
    title: '手機版側邊留白修正；第 37 筆員山子分洪道補上維基截圖與出處',
    verbatim: '1. 手機版內文左右沒留白、貼著螢幕邊：css/style.css 裡 .section 與 .hero 的 padding 寫法蓋掉了 .wrap-narrow 的左右留白。修成每個寬度都至少 16px 側邊留白，且不影響桌機版面。……2. 第 37 筆景點已由下淡水溪鐵橋（重複收錄）換成員山子分洪道，但第 37 張維基截圖與 refs/SOURCES.md 第 37 列還是舊的下淡水溪鐵橋。',
    context: '① intro.html 的 hero 與各段落寫成 class="section wrap-narrow"／"hero wrap-narrow"。.section { padding: 56px 0 } 與 .hero { padding: 80px 0 60px } 是簡寫，排在 .wrap-narrow 之後、權重相同，於是把左右 28px 一併歸零；桌機因為 max-width 820px 置中看不出來，寬度一低於 876px 內文就貼齊螢幕邊（實測 375 寬左 0、右 3.8 px）。順便用逐字量測（每個文字節點的左右邊界）掃全站 320／375／768／1440 四種寬度，另外揪出三處窄螢幕問題：about.html 授權表在 320 寬被長英文字串撐出 10 px 橫向捲動、dev-log.html 在 320 寬被長路徑撐出 4 px、首頁藍圖尺寸標籤 N: 24.16N 往外凸到離螢幕邊 15 px。worksheet.html 的紀錄表本來就放在可左右滑動的 .tw-scroll 裡，不算。② 第 37 筆資料（js/data.js 與 WIKI_REFS）早已改為員山子分洪道，但截圖與 SOURCES 還是舊的下淡水溪鐵橋（與第 16 筆重複）。姊妹平台 PC13110 在 commit 74e28c2 已重拍，直接取用。',
    decisions: [
      '.section、.hero（含 880／480 兩個斷點）改只設 padding-top／padding-bottom，左右留白交還給 .wrap／.wrap-narrow（28px）',
      '同一元素兼掛 .wrap-narrow 時 max-width 改為 820＋56 px，讓 28px 留白落在原本 820px 內文欄之外——桌機內文欄寬與位置和修正前完全相同；列印樣式同步歸零',
      'table.t 儲存格只在 ≤480px 加 overflow-wrap: anywhere（全寬度加會改到桌機欄寬，已實測排除）；dev-log 卡片同樣可斷行；首頁手機斷點讓 .dim-y 不再 translateX(50%) 外凸',
      '截圖直接沿用 PC13110 重拍檔（兩邊舊檔逐位元相同、規格一致：520×355、RGB 基線 JPEG、72 dpi、同樣的 Exif 結構），不自己重拍以免兩站不一致',
    ],
    outputs: [
      'css/style.css：.section／.hero 只設上下 padding；table.t 儲存格可斷行',
      'index.html、dev-log.html：窄螢幕外凸／溢出修正',
      'refs/wiki/wiki-37.jpg 換成員山子分洪道條目截圖；refs/SOURCES.md 第 37 列改為員山子分洪道與其維基網址',
      '驗證：全 8 頁 × 320／375／768／1440 文字側邊留白皆 ≥ 16 px（學習單紀錄表在 .tw-scroll 內可滑動，不計）、無橫向捲動、零 console 錯誤；桌機 900／1024／1280／1440 逐元素比對座標，除 intro.html 七個 section 外框外全部相同；motion_qc 桌機＋手機 16 組零 console 錯誤、零橫向溢出，僅 Leaflet 地圖 clipped（段落 14 已判定誤報）',
    ],
  },
  {
    tag: '段落 16',
    date: '2026-09-29',
    title: '決策落地：南部展示館介紹依館方實況改寫、「銲」統一為「焊」、第 37 筆截圖去橫幅重拍',
    verbatim: '1. R04 核三廠「南部展示館」介紹目前只寫「太陽能光電與風力展示」。先上網查館方（台電）現行展區說明，改寫為符合實況的敘述……2. 「銲」統一為「焊」（使用者決定全平台用教育部正字）……3. R05 第 37 筆「員山子分洪道」維基截圖畫面頂端有維基活動橫幅與「需要補充來源」提示框，和其他 151 張風格不一致……4. dev-log 加一段紀錄。',
    context: '① 原介紹只寫「太陽能光電與風力展示」，與館方說明不符。台電綠網〈南部展示館〉頁列出的展區是：A 共生（珊瑚復育）、B 發現（電的科學史）、C 運轉（節能減碳）、D 專業（核能電廠選址、發電原理、防護安全管理與核三廠運作）、E 深耕（電力建設）、F 永續（以大型裝置與互動遊戲體驗不同發電方式與減碳效益），另有綠色能源與進水口珊瑚即時觀測。館方自有網站 wapp4.taipower.com.tw/nsis/south/ 查證當日網域無法解析，故以同屬台電官方的綠網頁為出處。② 本站 3 處「銲接」（衛武營、日月光、台船）改為「焊接」，全 repo 已無「銲」字。③ 段落 15 沿用的第 37 張截圖頂端有「維基愛古蹟」活動橫幅、臺大招生 sitenotice 與「需要補充來源」ambox。改以無頭 Chrome（Playwright，channel=chrome）重拍：視窗 1220×833（與 520×355 同比例，縮放後字級與 wiki-40 等既有截圖一致），注入 CSS 隱藏 #siteNotice、#centralNotice、.ambox 等，再以 LANCZOS 縮成 520×355。',
    decisions: [
      '介紹文字只寫官方頁面可證實的展區內容，不寫館方未提的太陽能、風力實體展品',
      '出處放在 refs/SOURCES.md 新增的「景點介紹文字出處」表，與截圖來源表分開',
      '用字採教育部正字「焊」，全平台一致',
      '第 37 張截圖改為自行重拍（段落 15 是沿用 PC13110 檔），重拍檔同步給 PC13110 以維持兩站一致',
    ],
    outputs: [
      'js/data.js：南部展示館介紹改寫；3 處「銲」→「焊」',
      'refs/SOURCES.md：新增「景點介紹文字出處」表（第 191 筆 → 台電綠網）',
      'refs/wiki/wiki-37.jpg 重拍：520×355、RGB 基線 JPEG、72 dpi，無活動橫幅與維護提示框',
      '驗證：本機 http.server 開 explore.html、intro.html 零 console 錯誤',
    ],
  },
  {
    tag: '段落 17',
    date: '2026-09-29',
    title: 'Gemini 第二輪審查：四處工程敘述、計分與排行榜、地區提示、學習單教師版與用語',
    verbatim: 'Gemini 審查（9/28 修正前的原始碼快照）30 條：先比對是否已處理，新問題自己查證後修正、駁回或列待決定；fix/round2-gemini，每主題一個 commit，不 push。',
    context: '30 條中 1 條已在段落 13 修掉（核三廠與展示館座標），3 條駁回（360° 環景 three.js 是 explore.js 動態 import vendor 檔；劍潭站台北市捷運局監測報告寫明兩座龍門架、2 條主吊索，「兩側塔柱」沒錯；學習單「四、自我評量」與「四、教師評語」互斥顯示不會同時出現），2 條待決定，其餘 24 條修正。',
    decisions: [
      '工程敘述只寫查得到出處的內容：開閉所依經濟部新聞稿（併網基地、開關設備），超臨界依水的臨界點 22.1 MPa／374 °C',
      '地區提示用經緯度折線而非縣市界圖資：對 200 筆全跑，只改變原本判錯的 6 筆',
      '教師端題型混雜只加提醒、不改統計口徑（平均仍是總分），避免老師看到的數字單位改變',
      '王功生態景觀橋歸在機電主題、深度模式追問洩題兩件牽涉選點與題目設計，列待決定不動手',
    ],
    outputs: [
      'js/data.js：再生煞車（馬達轉向不變）、五分車（曲柄滑塊）、林口 USC（超臨界流體）、彰一開閉所（不含升壓變壓器）；月台幕門→月台門；第 141 筆維基改台中港',
      'refs/wiki/wiki-141.jpg 重拍（MITSUI OUTLET PARK 台中港，520×355、RGB 基線 JPEG、72 dpi）；refs/SOURCES.md 第 141 列同步',
      'js/explore.js：深度模式 maxScore 依實際追問數、排行榜分深度模式、地區提示界線；js/account.js、js/teacher.js 得分率用 maxScore；教師端題型混雜提醒',
      'js/auth.js：合併匯入套用暱稱等欄位、history 防呆；account：未設 Drive 時指向教師端 JSON 匯出入口、未建檔可直接還原的說明',
      'js/worksheet.js：切入面向先看主題、重新設計示範分四主題、光電與地熱線索分開、?demo=1 示範資料不重複且分數與總分一致',
      'about、intro、index：資料欄位四欄、維基範例、三層影像＋揭曉延伸學習、座標標籤 LON／LAT；開合橋→活動橋、瓦片→圖磚',
      '驗證：node --check；Playwright 實測學習單教師版、我的檔案得分率（深度 12000/16000 → 75%）、合併匯入、教師端提醒；motion_qc 7 頁桌機＋手機零 console 錯誤、clipped／textOverlap／offRight 皆 0（explore 桌機 CLS 0.095 與 main 相同）',
      '判定紀錄：/Volumes/Work/mesh-review-2026-09-28/fixes/round2_twgeo.json',
    ],
  },
  {
    tag: '段落 18',
    date: '2026-09-29',
    title: '與 PC13110 猜地點遊戲反向同步：雲端智慧、橋式起重機的設施類型提示',
    verbatim: 'PC13110 第二輪補驗同步 twgeo 景點資料時，發現 twgeo 這邊還有兩處要反向同步。',
    context: '第 95 筆寫「雲端智能」（中國用語），PC13110 已改為「雲端智慧」；設施類型提示的規則以「橋」字判斷橋梁，「基隆港橋式起重機群」被提示成橋梁。',
    decisions: ['起重機規則放在橋梁規則之前，歸入港灣設施；其他含「橋」的景點不受影響'],
    outputs: [
      'js/data.js：雲端智能→雲端智慧',
      'js/explore.js：FACILITY_TYPES 新增 /起重機/ → 港灣設施（排在 /橋/ 之前）',
      '驗證：node --check；typeHint(基隆港橋式起重機群)=港灣設施、typeHint(淡江大橋)=橋梁',
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
