"""
خادم محلي لتجربة MADAR Z على هذا الجهاز.

    python serve.py            ← يفتح على http://localhost:8777
    python serve.py 9000       ← منفذ آخر

عامل الخدمة (العمل دون إنترنت) لا يعمل من ملف مفتوح مباشرة بالنقر المزدوج،
لذا يلزم خادم — وهذا أبسط خادم ممكن، بلا أي تثبيت.
"""

import http.server
import socketserver
import socket
import sys
from pathlib import Path

ROOT = Path(__file__).parent.resolve()
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8777


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # لا تخزّن في المتصفح أثناء التطوير — عامل الخدمة يتكفّل بالعمل دون إنترنت
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "404" in (fmt % args):
            super().log_message(fmt, *args)


Handler.extensions_map.update({
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".webmanifest": "application/manifest+json",
    ".json": "application/json",
    ".svg": "image/svg+xml",
})


def lan_ip():
    """عنوان الجهاز على الشبكة، ليُفتح التطبيق من الجوال على نفس الواي فاي."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    with Server(("0.0.0.0", PORT), Handler) as httpd:
        print(f"\n  MADAR Z يعمل الآن")
        print(f"  على هذا الجهاز :  http://localhost:{PORT}")
        ip = lan_ip()
        if ip:
            print(f"  من الجوال      :  http://{ip}:{PORT}   (نفس شبكة الواي فاي)")
        print("\n  للإيقاف: Ctrl+C\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  أُوقف الخادم.\n")
