#!/usr/bin/env python3
"""Serve the site locally the way Cloudflare Pages serves it.

    python3 tools/serve.py [port]        # default 8788, localhost only
    python3 tools/serve.py [port] --lan  # also answer on the local network,
                                         # which is how to open it on a phone

python -m http.server is not enough any more. The pages live under pages/ but
are published at short URLs (/tiny/, /crucible/, /cosmos/, /godash/, /misc/),
and what maps one to the other is _redirects, which Pages reads and a plain file
server does not. Previewing without it would 404 on exactly the pages being
worked on.

The rules are read from _redirects itself, on every request, rather than
restated here, so this and production cannot drift apart and an edit to the
file shows without a restart. They are applied the way Pages applies them:

  - 200 is a rewrite: the URL stays, the file comes from somewhere else. Any
    other status is a redirect sent to the browser, 302 when none is given.
  - Rules come before files: a rule for a path wins even where a file sits.
  - A rule without a splat wins over one with a splat; otherwise the first in
    the file does.
  - A redirect keeps the request's query string, unless its target has one.

What Pages never serves, this does not either: no folder listings, nothing
whose name starts with a dot (.git above all), not _redirects or _headers, and
nothing git ignores, such as the tiny clone and its build. A path that matches
nothing gets the site's 404.html, as it does there.
"""

import argparse
import http.server
import os
import subprocess
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RULES_FILE = os.path.join(ROOT, "_redirects")
NOT_FOUND = os.path.join(ROOT, "404.html")

# Files that configure Pages rather than being served by it.
CONFIG = {"/_redirects", "/_headers"}


def rules():
    """_redirects as a list of (pattern, target, status), in file order."""
    out = []
    if not os.path.exists(RULES_FILE):
        return out
    with open(RULES_FILE, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            status = int(parts[2]) if len(parts) > 2 else 302
            out.append((parts[0], parts[1], status))
    return out


def apply_rules(path, table):
    """The rule that matches, as (target, status), or None: one without a
    splat if any does, otherwise the first splat in the file."""
    for pattern, target, status in table:
        if "*" not in pattern and path == pattern:
            return target, status
    for pattern, target, status in table:
        if pattern.endswith("/*"):
            stem = pattern[:-1]                     # keep the trailing slash
            if path.startswith(stem):
                return target.replace(":splat", path[len(stem):]), status
    return None


def ignored():
    """What git ignores here, as repo paths, folders ending in "/". Read once,
    at the start: the clone and the build output it names do not move."""
    try:
        out = subprocess.run(
            ["git", "ls-files", "--others", "--ignored", "--exclude-standard", "--directory"],
            cwd=ROOT, capture_output=True, text=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        return ()
    return tuple("/" + line for line in out.splitlines() if line)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kw):
        super().__init__(*args, directory=ROOT, **kw)

    def send_head(self):
        url = urllib.parse.urlsplit(self.path)
        if not self.host_allowed():
            # Only the names this server was started for: a page elsewhere that
            # points a domain of its own at this machine (DNS rebinding) would
            # otherwise read the repo through the visitor's browser.
            self.send_error(403)
            return None
        if self.hidden(urllib.parse.unquote(url.path)):
            self.send_error(404)
            return None
        hit = apply_rules(url.path, rules())
        if hit:
            target, status = hit
            if status == 200:
                self.path = target
            else:
                if url.query and "?" not in target:
                    target += "?" + url.query
                self.send_response(status)
                self.send_header("Location", target)
                self.end_headers()
                return None
        # Pages serves page.html at /page, and a rewrite target gets the same
        # treatment, so /godash/privacy lands on privacy.html.
        path = urllib.parse.urlsplit(self.path).path
        if os.path.isfile(self.translate_path(path) + ".html"):
            self.path = path + ".html"
        return super().send_head()

    def host_allowed(self):
        host = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]").lower()
        return host in self.server.hosts

    def hidden(self, path):
        """Something Pages would not serve, or that is not the site's at all."""
        if path in CONFIG:
            return True
        if any(part.startswith(".") and part != ".well-known" for part in path.split("/")):
            return True
        return any(path == p.rstrip("/") or path.startswith(p) for p in self.server.ignored)

    def list_directory(self, path):
        # Pages never lists a folder: one without an index.html is a 404.
        self.send_error(404)
        return None

    def send_error(self, code, message=None, explain=None):
        if code != 404 or not os.path.isfile(NOT_FOUND):
            return super().send_error(code, message, explain)
        with open(NOT_FOUND, "rb") as fh:
            body = fh.read()
        self.send_response(404)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def end_headers(self):
        # Pages sends this with every file: keep a copy, but ask before using
        # it. Without it a browser guesses how long a file stays fresh from its
        # age, and after a rebuild or a cosmos re-sync it can run the new page
        # on the old CSS and JS without asking the server at all.
        self.send_header("Cache-Control", "public, max-age=0, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        """One line per request, minus the date noise."""
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))


def lan_address():
    """This machine's address on the local network, for the phone to type in.

    Opening a socket toward an outside address is the portable way to ask the
    routing table which interface would carry it. Nothing is sent: UDP connect
    only assigns the local end.
    """
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("192.0.2.1", 9))        # reserved for documentation, unroutable
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("port", nargs="?", type=int, default=8788)
    ap.add_argument("--lan", action="store_true", help="also answer on the local network")
    a = ap.parse_args()
    # Localhost by default: the whole repo is served, so answering the network
    # is something to ask for rather than get.
    server = http.server.ThreadingHTTPServer(("0.0.0.0" if a.lan else "127.0.0.1", a.port), Handler)
    server.hosts = {"localhost", "127.0.0.1", "::1"}
    server.ignored = ignored()
    print("serving %s  (%d rules from _redirects)" % (ROOT, len(rules())), flush=True)
    print("  http://127.0.0.1:%d" % a.port, flush=True)
    if a.lan:
        ip = lan_address()
        if ip:
            server.hosts.add(ip)
        print("  http://%s:%d   on this network" % (ip or "<this machine>", a.port), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
