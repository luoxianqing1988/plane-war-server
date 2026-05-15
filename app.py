#!/usr/bin/env python3
"""数字飞机大战 - 服务端"""
import os
from flask import Flask, send_from_directory

BASE = os.path.dirname(os.path.abspath(__file__))
GAME_DIR = os.path.join(BASE, "game")
app = Flask(__name__)

@app.route("/")
def index():
    return send_from_directory(GAME_DIR, "index.html")

@app.route("/<path:filename>")
def serve(filename):
    return send_from_directory(GAME_DIR, filename)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5011, debug=True)
