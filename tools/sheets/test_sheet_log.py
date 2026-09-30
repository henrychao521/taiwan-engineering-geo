#!/usr/bin/env python3
"""作答紀錄端到端測試（只用本機假 endpoint，絕不送正式 Google 網址）。

  1. 一般模式（工程地景 10 題）：學生先填班級座號、有建立暱稱檔案 → 確認暱稱不外送、班級座號有帶
  2. 深度模式（試玩 20 題）：不填班級座號 → class／seat 為空；原理題 a／k 換回原始順序
  3. 精選地景 5 題
  4. 離線時佇列保留、恢復連線補送
  5. endpoint 空：不顯示元件、不送任何請求
  6. 前端指紋 == assets/sheet-items.json 的指紋
用法：python3 tools/sheets/test_sheet_log.py
"""
import json, socket, subprocess, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
def free_port():
    with socket.socket() as so:
        so.bind(("127.0.0.1", 0)); return so.getsockname()[1]


SITE_PORT, EP_PORT = free_port(), free_port()   # 隨機空埠，避免和其他本機服務撞埠
EP = f"http://127.0.0.1:{EP_PORT}/exec"
SITE = f"http://127.0.0.1:{SITE_PORT}"
ITEMS = {q["q"]: q for q in json.loads((ROOT / "assets/sheet-items.json").read_text(encoding="utf-8"))["questions"]}
FAIL = []


def check(cond, msg):
    print(("  ✓ " if cond else "  ✗ ") + msg)
    if not cond: FAIL.append(msg)


def records():
    return json.loads(urllib.request.urlopen(f"http://127.0.0.1:{EP_PORT}/records").read())


def reset():
    urllib.request.urlopen(urllib.request.Request(f"http://127.0.0.1:{EP_PORT}/reset", data=b"", method="POST"))


def cfg_route(endpoint):
    body = f"window.SHEET_CONFIG = {{ platform: 'twgeo', endpoint: {json.dumps(endpoint)}, token: 'test' }};"
    return lambda route: route.fulfill(status=200, content_type="application/javascript", body=body)


def block_external(route):
    u = route.request.url
    if u.startswith(SITE) or u.startswith(f"http://127.0.0.1:{EP_PORT}"): return route.continue_()
    return route.abort()


def new_page(ctx, endpoint):
    page = ctx.new_page()
    page.route("**/*", block_external)
    page.route("**/js/sheet-config.js", cfg_route(endpoint))
    return page


def play(page, mode_btns, deep, near_every=2, fu_right=True):
    """開始一局並玩完：每 near_every 題點在正解附近（其餘點遠處）；深度模式追問輪流答對／答錯。"""
    page.evaluate(f"localStorage.setItem('tweg_deep_mode', '{1 if deep else 0}')")
    page.evaluate("showStart()")
    for b in mode_btns:
        page.click(b)
    picks = []
    for n in range(40):
        page.wait_for_function("state === 'guess' || state === 'over'", timeout=15000)
        if page.evaluate("state") == "over": break
        near = n % near_every == 0
        page.evaluate("near => { const la = near ? current.lat + 0.01 : 21.95, lo = near ? current.lon : 118.3;"
                      " lmap.fire('click', { latlng: L.latLng(la, lo) }); }", near)
        page.click("#actBtn")
        page.wait_for_function("state === 'reveal'")
        # 深度模式：依序回答追問
        k = 0
        while page.evaluate("deepMode && fuIndex < activeFollowups.length"):
            fu = page.evaluate("({ q: activeFollowups[fuIndex].q, pid: activeFollowups[fuIndex].principle ? activeFollowups[fuIndex].principle.id : null,"
                               " opts: activeFollowups[fuIndex].options.map(o => ({ label: o.label, ok: o.ok })) })")
            want_ok = (n + k) % 2 == 0 if not fu_right else True
            j = next(i for i, o in enumerate(fu["opts"]) if o["ok"] == want_ok)
            page.locator("#fuOpts .fu-opt").nth(j).click()
            if fu["pid"]:
                picks.append({"pid": fu["pid"], "label": fu["opts"][j]["label"], "ok": want_ok})
            k += 1
            page.wait_for_timeout(750)
        page.click("#actBtn")
    page.wait_for_function("state === 'over'")
    return picks


def main():
    ep = subprocess.Popen([sys.executable, str(ROOT / "tools/sheets/fake_endpoint.py"), str(EP_PORT), "twgeo"])
    site = subprocess.Popen([sys.executable, "-m", "http.server", str(SITE_PORT), "--bind", "127.0.0.1"],
                            cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.2)
    try:
        with sync_playwright() as pw:
            b = pw.chromium.launch(channel="chrome")
            ctx = b.new_context(viewport={"width": 1280, "height": 900})
            principles = {}

            # ---------- 1. 一般模式＋班級座號＋暱稱不外送 ----------
            print("1. 一般模式（工程地景 10 題）＋填班級座號")
            reset()
            page = new_page(ctx, EP)
            page.goto(SITE + "/explore.html")
            page.evaluate("TwegAuth.create({ nick: '測試暱稱小明', age: 16, gender: '男' })")
            principles = page.evaluate("Object.fromEntries(Object.values(PRINCIPLE_QS).flat().map(p => [p.id, p]))")
            check(page.locator("#sl-btn").is_visible(), "右下角有「填班級座號」元件")
            check("老師" in page.inner_text("footer"), "頁尾有告知文字")
            il = "#ovBox .sl-inline "
            check(page.locator(il + ".sl-btn").is_visible(), "開始畫面內有班級座號元件")
            page.click(il + ".sl-btn"); page.fill(il + ".sl-class", "301"); page.fill(il + ".sl-seat", "")
            page.click(il + ".sl-save")
            check("一起填" in page.inner_text(il + ".sl-msg"), "只填班級會被擋下（要一起填）")
            page.fill(il + ".sl-class", "３０１"); page.fill(il + ".sl-seat", "１２"); page.click(il + ".sl-save")
            check("301 班 12 號" in page.inner_text(il + ".sl-btn") and "301 班 12 號" in page.inner_text("#sl-btn"),
                  "全形轉半形、開始畫面與右下角元件同步顯示目前值")
            check(page.evaluate("JSON.parse(sessionStorage.getItem('sheetlog-identity')).seat") == "12", "存在 sessionStorage")
            check(page.evaluate("localStorage.getItem('sheetlog-identity')") is None, "沒有存進 localStorage")
            play(page, ["#mEng", "#thAll"], deep=False)
            page.wait_for_timeout(800)
            r = records()
            check(len(r["accepted"]) == 1 and not r["rejected"], f"收到 1 筆且無拒收（收 {len(r['accepted'])}／拒 {len(r['rejected'])}）")
            d = r["accepted"][0] if r["accepted"] else {}
            check(d.get("kind") == "game" and d.get("page") == "explore.engineering.t0", f"kind=game、page={d.get('page')}")
            check(d.get("class") == "301" and d.get("seat") == "12", "班級座號有帶")
            check("測試暱稱小明" not in json.dumps(r["raw"], ensure_ascii=False), "暱稱沒有送出")
            its = d.get("items", [])
            check(len(its) == 10 and all(i["t"] == "game" and i["q"].startswith("spot-") for i in its), "10 題景點 spot-N")
            check(all(i["h"] == ITEMS[i["q"]]["h"] for i in its), "景點指紋與 sheet-items.json 相同")
            check(sum(i["ok"] for i in its) == 5, f"點近的 5 題 ok=1（實得 {sum(i['ok'] for i in its)}）")
            m = d.get("meta", {})
            check(m.get("max") == 10000 and isinstance(m.get("score"), (int, float)) and m.get("sec", -1) >= 0, f"meta {m}")
            sess = page.evaluate("JSON.parse(localStorage.getItem('tweg_profile') || '{}')")
            check(len(json.dumps(sess)) > 50 and "principle" not in json.dumps(sess), "本局有存進個人檔案，且沒有夾帶作答紀錄用的欄位")
            check(all(x["ct"].startswith("text/plain") for x in r["raw"]), "Content-Type 為 text/plain")
            page.close()

            # ---------- 2. 深度模式（試玩 20 題）不填班級座號 ----------
            print("2. 深度模式（試玩 20 題）不填班級座號")
            reset()
            ctx2 = b.new_context(viewport={"width": 1280, "height": 900})
            page = new_page(ctx2, EP)
            page.goto(SITE + "/explore.html")
            picks = play(page, ["#mTrial"], deep=True, fu_right=False)
            page.wait_for_timeout(800)
            r = records()
            d = r["accepted"][0] if r["accepted"] else {}
            check(len(r["accepted"]) == 1 and not r["rejected"], f"收到 1 筆且無拒收（拒 {[x['why'] for x in r['rejected']]}）")
            check(d.get("class") == "" and d.get("seat") == "", "沒填班級座號 → 空")
            check(d.get("page") == "explore.trial.deep", f"page={d.get('page')}")
            its = d.get("items", [])
            spots = [i for i in its if i["t"] == "game"]; prs = [i for i in its if i["t"] == "single"]
            # 同一原理題在一局出現兩次時只記第一次作答
            seen_pid = set(); first_picks = [pk for pk in picks if not (pk["pid"] in seen_pid or seen_pid.add(pk["pid"]))]
            check(len(spots) == 20 and len(prs) == len(first_picks) and len(its) <= 40 and len({i["q"] for i in its}) == len(its),
                  f"20 景點＋{len(prs)} 原理題（作答 {len(picks)}、不重複 {len(first_picks)}），題號不重複")
            ok_map = True
            for it, pk in zip(prs, first_picks):
                p = principles[pk["pid"]]
                exp_a = "ABCDEF"[p["options"].index(pk["label"])]
                exp_k = "ABCDEF"[p["answer"]]
                if not (it["q"] == pk["pid"] and it["a"] == exp_a and it["k"] == exp_k and it["ok"] == (1 if pk["ok"] else 0)
                        and it["h"] == ITEMS[it["q"]]["h"]):
                    ok_map = False; print("    不符", it, pk)
            check(ok_map and prs, "原理題 q／a／k（原始順序）／ok／指紋全對")
            check(any(i["ok"] for i in prs) and any(not i["ok"] for i in prs), "原理題有答對也有答錯")
            fu_max = page.evaluate("JSON.parse(localStorage.getItem('tweg_leaderboard'))[0].score")
            check(d.get("meta", {}).get("score") == fu_max, "meta.score 等於結算總分")
            check("班級座號" in page.inner_text("#ovBox"), "結算畫面有告知文字")

            # ---------- 3. 精選地景 ----------
            print("3. 精選地景 5 題")
            reset()
            play(page, ["#mCurated"], deep=False)
            page.wait_for_timeout(800)
            r = records(); d = r["accepted"][0] if r["accepted"] else {}
            its = d.get("items", [])
            check(len(its) == 5 and all(i["q"].startswith("loc-") and i["h"] == ITEMS[i["q"]]["h"] for i in its), "5 題 loc-* 且指紋相符")

            # ---------- 4. 離線佇列 ----------
            print("4. 離線佇列補送")
            reset()
            ctx2.set_offline(True)
            play(page, ["#mCurated"], deep=False)
            page.wait_for_timeout(600)
            q = page.evaluate("JSON.parse(localStorage.getItem('sheetlog-queue-twgeo') || '[]').length")
            check(q == 1 and not records()["accepted"], f"離線時留在佇列（{q} 筆）")
            ctx2.set_offline(False)
            page.evaluate("window.dispatchEvent(new Event('online'))")
            page.wait_for_timeout(1000)
            q = page.evaluate("JSON.parse(localStorage.getItem('sheetlog-queue-twgeo') || '[]').length")
            check(q == 0 and len(records()["accepted"]) == 1, "恢復連線後補送、佇列清空")
            # 重開頁面時補送
            reset()
            ctx2.set_offline(True)
            play(page, ["#mCurated"], deep=False)
            page.wait_for_timeout(400)
            ctx2.set_offline(False)
            page.close()
            page = new_page(ctx2, EP); page.goto(SITE + "/explore.html"); page.wait_for_timeout(1200)
            check(len(records()["accepted"]) == 1, "下次開頁補送")
            page.close(); ctx2.close()

            # ---------- 5. endpoint 空 ----------
            print("5. endpoint 空（正式預設設定，不攔截 sheet-config.js）")
            reset()
            ctx3 = b.new_context(viewport={"width": 1280, "height": 900})
            page = ctx3.new_page(); page.route("**/*", block_external)
            reqs = []
            page.on("request", lambda rq: reqs.append(rq.url) if rq.method == "POST" else None)
            page.goto(SITE + "/explore.html")
            check(page.evaluate("SheetLog.enabled()") is False, "預設 endpoint 為空")
            check(page.locator("#sl-wrap").count() == 0 and page.locator("#sl-foot").count() == 0, "不顯示元件與告知")
            play(page, ["#mCurated"], deep=False)
            page.wait_for_timeout(600)
            check(not reqs and not records()["raw"], "沒有送出任何請求")
            check(page.evaluate("localStorage.getItem('sheetlog-queue-twgeo')") is None, "沒有寫入佇列")
            check(page.locator(".sl-ov-note").count() == 0, "結算畫面沒有告知文字")
            ctx3.close()
            b.close()
    finally:
        ep.terminate(); site.terminate()
    print("\n結果：" + ("全部通過" if not FAIL else f"{len(FAIL)} 項失敗"))
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
