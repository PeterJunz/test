"""Local preview server for the demos (used by the launchers).

Why not plain `python -m http.server`:
- On some Windows machines the registry maps .js to text/plain, and browsers
  refuse to run ES modules served with that type (blank 3D scene). The types
  are forced here.
- The browser is opened only after the server is listening.
- If port 5173 is busy (e.g. another demo folder is already running), the next
  free port is used.
- Caching is disabled so edited files always reload.
"""
import http.server
import os
import socketserver
import sys
import threading
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".glb": "model/gltf-binary",
    ".liquid": "text/plain; charset=utf-8",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, **TYPES}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        if args and str(args[1]).startswith(("4", "5")):
            sys.stderr.write("  %s\n" % (fmt % args))


def main():
    for port in range(5173, 5193):
        try:
            httpd = socketserver.ThreadingTCPServer(("127.0.0.1", port), Handler)
            break
        except OSError:
            continue
    else:
        print("No free port between 5173 and 5192. Close other servers and try again.")
        input("Press Enter to exit...")
        return
    url = "http://localhost:%d/" % port
    print("Demo running at %s  (keep this window open; close it or press Ctrl+C to stop)" % url)
    threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
