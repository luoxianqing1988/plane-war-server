#!/usr/bin/env python3
"""数字飞机大战 - 服务端"""
import os, sqlite3, json, datetime
from flask import Flask, send_from_directory, request, jsonify, make_response

BASE = os.path.dirname(os.path.abspath(__file__))
GAME_DIR = os.path.join(BASE, "game")
DB_PATH = os.path.join(BASE, "answers.db")

app = Flask(__name__)

# ---- 初始化数据库 ----
def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS answer_logs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp   TEXT NOT NULL,
            round       INTEGER NOT NULL,
            score       INTEGER NOT NULL,
            question    TEXT NOT NULL,
            answer      INTEGER NOT NULL,
            user_answer INTEGER NOT NULL,
            correct     INTEGER NOT NULL,
            difficulty  TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

init_db()

# ---- 静态文件 ----
@app.route("/")
@app.route("/play")
def index():
    resp = make_response(send_from_directory(GAME_DIR, "index.html"))
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

@app.route("/<path:filename>")
def serve(filename):
    resp = make_response(send_from_directory(GAME_DIR, filename))
    # JS/CSS 文件不缓存（避免浏览器用旧代码）
    if filename.endswith(".js") or filename.endswith(".css"):
        resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
    return resp

# ---- 答题记录 API ----
@app.route("/api/log", methods=["POST"])
def log_answer():
    try:
        data = request.get_json()
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            "INSERT INTO answer_logs (timestamp, round, score, question, answer, user_answer, correct, difficulty) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                datetime.datetime.now().isoformat(),
                data.get("round", 0),
                data.get("score", 0),
                data.get("question", ""),
                data.get("answer", 0),
                data.get("userAnswer", 0),
                1 if data.get("correct") else 0,
                data.get("difficulty", "unknown"),
            )
        )
        conn.commit()
        conn.close()
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5011, debug=True)
