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


class _ReverseProxied:
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app
    def __call__(self, environ, start_response):
        script_name = environ.get('HTTP_X_SCRIPT_NAME', '')
        if script_name:
            environ['SCRIPT_NAME'] = script_name
            path_info = environ.get('PATH_INFO', '')
            if path_info.startswith(script_name):
                environ['PATH_INFO'] = path_info[len(script_name):]
        return self.wsgi_app(environ, start_response)

app.wsgi_app = _ReverseProxied(app.wsgi_app)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5011, debug=True)
