#!/usr/bin/env python3
"""本機假 endpoint：模擬老師的 Apps Script 接收端，只給測試用（絕不對正式 Google 網址送資料）。

依 classroom-sheets/SPEC.md 第 1 節嚴格驗證每一筆，收下的存在記憶體：
  POST /exec        收一筆（text/plain JSON）；同 sid 只收一次
  GET  /records     回傳 {"accepted": [...], "rejected": [...], "raw": [...]}
  POST /reset       清空
用法：python3 fake_endpoint.py <port> <platform>
"""
import json, re, sys, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PLATFORM = sys.argv[2] if len(sys.argv) > 2 else ""
LOCK = threading.Lock()
STATE = {"accepted": [], "rejected": [], "raw": []}
TOP = {"v", "platform", "token", "sid", "page", "kind", "class", "seat", "items", "meta"}
ITEM = {"q", "h", "t", "ok", "a", "k", "tries"}
TYPES = {"single", "tf", "order", "scenario", "match", "code", "game", "other"}
KINDS = {"quiz", "game", "exercise", "worksheet"}
CLASS_RE = re.compile(r"^(?!-)[0-9A-Za-z㐀-鿿\-]{1,10}$")


def validate(d):
    if not isinstance(d, dict): return "不是物件"
    extra = set(d) - TOP
    if extra: return f"多餘欄位 {sorted(extra)}"
    if d.get("v") != 1: return "v"
    if d.get("platform") != PLATFORM: return "platform"
    if not isinstance(d.get("token", ""), str): return "token"
    if not re.fullmatch(r"[0-9a-f]{32}", str(d.get("sid", ""))): return "sid"
    if not re.fullmatch(r"[A-Za-z0-9_./-]{1,80}", str(d.get("page", ""))): return "page"
    if d.get("kind") not in KINDS: return "kind"
    c, s = d.get("class", ""), d.get("seat", "")
    if bool(c) != bool(s): return "class/seat 要一起填或都空"
    if c and not CLASS_RE.fullmatch(c): return "class"
    if s and not re.fullmatch(r"[0-9]{1,4}", s): return "seat"
    items = d.get("items")
    if not isinstance(items, list) or not 1 <= len(items) <= 40: return "items 數量"
    for it in items:
        if not isinstance(it, dict): return "item 不是物件"
        if set(it) - ITEM: return f"item 多餘欄位 {sorted(set(it) - ITEM)}"
        if not re.fullmatch(r"[A-Za-z0-9_.:-]{1,40}", str(it.get("q", ""))): return f"q {it.get('q')}"
        if it.get("h", "") and not re.fullmatch(r"[0-9a-f]{8}", it["h"]): return "h"
        if it.get("t") not in TYPES: return "t"
        if it.get("ok") not in (0, 1): return "ok"
        for k in ("a", "k"):
            if not isinstance(it.get(k, ""), str) or len(it.get(k, "")) > 40: return k
        if it.get("k") and it.get("t") in ("single", "tf", "scenario") and (it["a"] == it["k"]) != bool(it["ok"]):
            return f"ok 與 a/k 不一致 {it['q']}"
        if "tries" in it and not (isinstance(it["tries"], int) and 1 <= it["tries"] <= 99): return "tries"
    m = d.get("meta", {})
    if not isinstance(m, dict) or set(m) - {"score", "max", "sec"}: return "meta"
    if any(not isinstance(v, (int, float)) for v in m.values()): return "meta 數字"
    return None


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _send(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers(); self.wfile.write(b)

    def do_GET(self):
        if self.path.startswith("/records"):
            with LOCK: return self._send(200, STATE)
        self._send(200, {"msg": f"假接收端運作中（平台：{PLATFORM}）"})

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(n).decode("utf-8", "replace")
        if self.path.startswith("/reset"):
            with LOCK:
                for k in STATE: STATE[k].clear()
            return self._send(200, {"ok": 1})
        with LOCK:
            STATE["raw"].append({"ct": self.headers.get("Content-Type", ""), "body": body})
            try:
                d = json.loads(body)
            except Exception:
                STATE["rejected"].append({"why": "不是 JSON", "body": body}); return self._send(200, {"ok": 0})
            why = validate(d)
            if not why and any(r["sid"] == d["sid"] for r in STATE["accepted"]):
                why = "同 sid 重複"
            if why:
                STATE["rejected"].append({"why": why, "body": d}); return self._send(200, {"ok": 0, "why": why})
            STATE["accepted"].append(d)
        self._send(200, {"ok": 1})


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
