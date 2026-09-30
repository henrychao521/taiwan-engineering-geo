#!/usr/bin/env python3
"""產生 assets/sheet-items.json：給老師試算表「匯入最新題庫」用（規格 classroom-sheets/SPEC.md 第 2 節）。

題目來源（用 node 直接載入前端資料檔，避免和網頁不同步）：
  - js/data.js  SITES：200 個工程景點 → q = spot-<索引>，t = game，stem = 景點名稱，answer = "緯度,經度"
  - js/data.js  LOCS ：精選地景 10 張照片 → q = loc-<圖檔名>，同上
  - js/principles.js PRINCIPLE_QS：深度模式工程原理題 → q = 題目 id，t = single，選項 A–D（原始順序）
指紋 h 和 EMT build.py 的 q_hash 同法：{type, stem, options, answer, items} 以
json.dumps(sort_keys=True, ensure_ascii=False) 做 SHA-1 取前 8 碼；前端 js/sheet-log.js 的 SheetLog.hash 算法相同
（景點的 options／items 為 null，原理題的 options 是原始順序的選項文字陣列、answer 是選項代號）。

用法：python3 tools/sheets/build_items.py            （寫入 assets/sheet-items.json）
      python3 tools/sheets/build_items.py --check    （只比對，不一致就結束碼 1）
"""
import datetime, hashlib, json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets" / "sheet-items.json"
OPT = "ABCDEF"

NODE = r"""
const fs = require('fs'), vm = require('vm');
const code = ['js/data.js', 'js/principles.js'].map(f => fs.readFileSync(f, 'utf8')).join('\n;\n')
  + '\n;({SITES, LOCS, PRINCIPLE_QS})';
const d = vm.runInNewContext(code, {});
// 景點正解字串用 JS 的數字轉字串（和 explore.js 的 r.lat + ',' + r.lon 完全相同）
const spots = d.SITES.map((s, i) => ({ q: 'spot-' + i, name: s[0], answer: s[1] + ',' + s[2] }));
const locs = d.LOCS.map(l => ({ q: 'loc-' + l.img.replace(/\.[a-z]+$/i, ''), name: l.name, answer: l.lat + ',' + l.lon }));
const prs = [];
for (const [type, list] of Object.entries(d.PRINCIPLE_QS)) for (const p of list)
  prs.push({ q: p.id, type, stem: p.q, options: p.options, answer: p.answer });
process.stdout.write(JSON.stringify({ spots, locs, prs }));
"""


def q_hash(core):
    c = {k: core.get(k) for k in ("type", "stem", "options", "answer", "items")}
    return hashlib.sha1(json.dumps(c, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()[:8]


def build():
    raw = json.loads(subprocess.run(["node", "-e", NODE], cwd=ROOT, check=True,
                                    capture_output=True, text=True).stdout)
    qs, seen = [], set()
    for s in raw["spots"] + raw["locs"]:
        qs.append({"q": s["q"], "h": q_hash({"type": "game", "stem": s["name"], "answer": s["answer"]}),
                   "t": "game", "page": "explore", "stem": s["name"], "options": {},
                   "answer": s["answer"], "items": []})
    for p in raw["prs"]:
        if len(p["options"]) > len(OPT):
            raise SystemExit(f"{p['q']} 選項超過 {len(OPT)} 個")
        key = OPT[p["answer"]]
        qs.append({"q": p["q"], "h": q_hash({"type": "single", "stem": p["stem"], "options": p["options"], "answer": key}),
                   "t": "single", "page": "explore", "stem": f"【{p['type']}】{p['stem']}",
                   "options": {OPT[i]: o for i, o in enumerate(p["options"])}, "answer": key, "items": []})
    for q in qs:
        if q["q"] in seen:
            raise SystemExit(f"題目代號重複：{q['q']}")
        seen.add(q["q"])
    return qs


def main():
    qs = build()
    old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    changed = [q["q"] for q in qs] != [q["q"] for q in old.get("questions", [])] or \
        any(a != b for a, b in zip(qs, old.get("questions", [])))
    if "--check" in sys.argv:
        print("sheet-items.json " + ("需要重新產生" if changed else "已是最新"))
        sys.exit(1 if changed else 0)
    version = old.get("version") if not changed and old.get("version") else datetime.date.today().isoformat()
    data = {"platform": "twgeo", "version": version, "questions": qs}
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    n = {t: sum(1 for q in qs if q["t"] == t) for t in ("game", "single")}
    print(f"寫入 {OUT.relative_to(ROOT)}：共 {len(qs)} 題（景點 {n['game']}、原理題 {n['single']}）")


if __name__ == "__main__":
    main()
