#!/usr/bin/env python3
"""Serve the site locally the way Cloudflare Pages serves it.

    python3 tools/serve.py [port]        # default 8788, localhost only
    python3 tools/serve.py [port] --lan  # also answer on the local network,
                                         # which is how to open it on a phone

python -m http.server is not enough any more. The pages live under pages/ but
are published at short URLs (/tiny/, /crucible/, /cosmos/, /misc/), and what
maps one to the other is _redirects, which Pages reads and a plain file server
does not. Previewing without it would 404 on exactly the pages being worked on.

The rules are read from _redirects itself rather than restated here, so this and
production cannot drift apart. Two statuses are used:

  200   a rewrite. The URL stays, the file comes from somewhere else.
  301   a real redirect, sent to the browser.

Static files win over rules, which is how Pages behaves: a request is only put
through the rules when nothing is there to serve.
"""

import http.server
import os
import posixpath
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RULES_FILE = os.path.join(ROOT, "_redirects")


def rules():
    """_redirects as a list of (pattern, target, status), in file order.

    Order is the whole point: Pages takes the first rule that matches, which is
    why the bare and trailing-slash forms sit above the splat in that file.
    """
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
            status = int(parts[2]) if len(parts) > 2 else 301
            out.append((parts[0], parts[1], status))
    return out


def apply_rules(path, table):
    """The first rule that matches, as (target, status), or None."""
    for pattern, target, status in table:
        if pattern.endswith("/*"):
            stem = pattern[:-1]                     # keep the trailing slash
            if path.startswith(stem):
                return target.replace(":splat", path[len(stem):]), status
        elif path == pattern:
            return target, status
    return None


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kw):
        super().__init__(*args, directory=ROOT, **kw)

    def send_head(self):
        path = urllib.parse.urlsplit(self.path).path
        if not self.exists(path):
            hit = apply_rules(path, self.server.rules)
            if hit:
                target, status = hit
                if status == 200:
                    self.path = target
                else:
                    self.send_response(status)
                    self.send_header("Location", target)
                    self.end_headers()
                    return None
        return super().send_head()

    def exists(self, path):
        """Is there a file to serve for this URL, index.html included?"""
        local = self.translate_path(path)
        if os.path.isdir(local):
            return os.path.exists(os.path.join(local, "index.html"))
        return os.path.exists(local)

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
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    lan = "--lan" in sys.argv
    port = int(args[0]) if args else 8788
    table = rules()
    # Localhost by default: the whole repo is served, so answering the network
    # is something to ask for rather than get.
    host = "0.0.0.0" if lan else "127.0.0.1"
    server = http.server.ThreadingHTTPServer((host, port), Handler)
    server.rules = table
    print("serving %s  (%d rules from _redirects)" % (ROOT, len(table)))
    print("  http://127.0.0.1:%d" % port)
    if lan:
        ip = lan_address()
        print("  http://%s:%d   on this network" % (ip or "<this machine>", port))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
