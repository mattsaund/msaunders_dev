#!/usr/bin/env python3
"""Build the browser version of tiny into pages/projects/tiny/app/.

pages/projects/tiny/web/ is a clone of github.com/mattsaund/tiny. Its `main`
branch is tiny as published; its `web` branch adds what lets tiny run in a page
instead of a terminal. This script turns that clone into what the page loads:

  app/tiny.wasm      the program, built for wasm32-wasip1 and shrunk
  app/project.json   the project it opens: tiny's own source, exactly as it
                     stands on `main`, plus the answers Source Control asks
                     git for, recorded from a real checkout of it
  app/start.json     the first frame tiny draws, at every size the page can
                     give it, which the page shows dimmed behind the start
                     button until the program itself takes over
  app/manifest.json  the content hash of each of those three, which the page
                     reads to fetch each under a URL that changes when the
                     file does
  app/LICENSE, app/THIRD-PARTY-NOTICES.txt, app/SYNTAX-ACKNOWLEDGMENTS.md
                     what tiny.wasm carries and under what terms: tiny's own
                     license, its third-party notices (with a note on what the
                     browser build leaves out of them), and the syntax
                     definitions' acknowledgments, which only the program
                     itself can list

Nothing here touches the real tiny repository. The demo's files come out of
the clone's `main` branch, and its git answers from a throwaway clone of that.

    python3 tools/build_tiny.py              everything
    python3 tools/build_tiny.py --project    project.json only
    python3 tools/build_tiny.py --wasm       tiny.wasm only
    python3 tools/build_tiny.py --start      start.json only, from the other two
"""

import argparse
import gzip
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import textwrap

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLONE = os.path.join(ROOT, "pages", "projects", "tiny", "web")
OUT = os.path.join(ROOT, "pages", "projects", "tiny", "app")
WASM_OPT = os.path.expanduser("~/.local/opt/binaryen/bin/wasm-opt")
TARGET = "wasm32-wasip1"

# Where the project sits inside the page's filesystem, and the name its folder
# shows under in tiny's tree.
PROJECT_DIR = "tiny"

# The commit graph Source Control draws is capped by how many rows fit, which
# is only known in the page. Record more than any window could show and cut it
# there instead.
GRAPH_LIMIT = "1000"

# Every grid the page can ask for, from metrics() and fit() in the page's term.js:
# 32 rows above a 560px window and 30 at or below it, 40 to 160 columns wide.
# Keep the two in step, or the page falls back to a blank screen at the sizes
# this leaves out.
START_SIZES = [(c, 32) for c in range(40, 161)] + [(c, 30) for c in range(40, 101)]

# The opening frames are drawn by the same tiny.wasm the page runs, under
# wasmtime, which lives in its own environment beside the other tools.
TOOLS_VENV = os.path.expanduser("~/.local/opt/tiny-web-venv")


# wasm-opt refuses a module that uses a feature it was not told about, and
# the feature names in a module's target_features section are not its flags.
FEATURE_FLAGS = {
    "bulk-memory": ["--enable-bulk-memory", "--enable-bulk-memory-opt"],
    "bulk-memory-opt": ["--enable-bulk-memory-opt"],
    "call-indirect-overlong": ["--enable-call-indirect-overlong"],
    "exception-handling": ["--enable-exception-handling"],
    "multivalue": ["--enable-multivalue"],
    "mutable-globals": ["--enable-mutable-globals"],
    "nontrapping-fptoint": ["--enable-nontrapping-float-to-int"],
    "reference-types": ["--enable-reference-types"],
    "sign-ext": ["--enable-sign-ext"],
    "simd128": ["--enable-simd"],
    "tail-call": ["--enable-tail-call"],
}

# What Rust's wasm32 targets turn on, for a module that does not say. Every
# browser current since 2021 supports all of it.
RUST_DEFAULT_FEATURES = ["bulk-memory", "sign-ext", "mutable-globals",
                         "nontrapping-fptoint", "multivalue", "reference-types",
                         "call-indirect-overlong"]


def target_features(path):
    """The features a module declares it uses, or None if it does not say."""
    with open(path, "rb") as fh:
        d = fh.read()

    def leb(i):
        r = s = 0
        while True:
            b = d[i]
            i += 1
            r |= (b & 0x7F) << s
            s += 7
            if b < 0x80:
                return r, i

    i = 8
    while i < len(d):
        sid = d[i]
        size, i = leb(i + 1)
        end = i + size
        if sid == 0:
            n, j = leb(i)
            if d[j:j + n] == b"target_features":
                count, j = leb(j + n)
                used = []
                for _ in range(count):
                    prefix = d[j]
                    ln, j = leb(j + 1)
                    if prefix == ord("+"):
                        used.append(d[j:j + ln].decode())
                    j += ln
                return used
        i = end
    return None


def run(cmd, cwd=None, env=None):
    r = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True)
    if r.returncode != 0:
        sys.exit("failed: {}\n{}".format(" ".join(cmd), r.stderr.decode("utf-8", "replace")))
    return r.stdout


def kb(n):
    return "{:,} KB".format(round(n / 1024))


def project():
    commit = run(["git", "rev-parse", "--short", "main"], cwd=CLONE).decode().strip()

    # The files: tiny as published, not the web branch this clone builds from.
    # Text only. The page builds its filesystem from strings, and the binary
    # files (the README's screenshots, so far) would add their weight to every
    # visit for a tree entry nobody opens in a terminal editor. They are left
    # out, and named in the summary so it is plain what the demo lacks.
    files, skipped = {}, []
    with tarfile.open(fileobj=io.BytesIO(run(["git", "archive", "main"], cwd=CLONE))) as tar:
        for m in tar.getmembers():
            if m.isfile():
                data = tar.extractfile(m).read()
                try:
                    files[m.name] = data.decode("utf-8")
                except UnicodeDecodeError:
                    skipped.append(m.name)

    # The git answers, asked of a real checkout so they are exactly what git
    # says, decorations and all. The same flags tiny's own Repo passes.
    env = dict(os.environ, GIT_OPTIONAL_LOCKS="0")
    with tempfile.TemporaryDirectory() as tmp:
        co = os.path.join(tmp, "checkout")
        run(["git", "clone", "--quiet", "--single-branch", "--branch", "main", CLONE, co])
        status = run(["git", "status", "--porcelain=v1", "--branch", "-z"], cwd=co, env=env)
        graph = run(["git", "log", "--graph", "--all", "--decorate", "--color=never",
                     "--date=short", "--pretty=format:%h %d %s", "-n", GRAPH_LIMIT], cwd=co, env=env)

    image = {
        "commit": commit,
        "dir": PROJECT_DIR,
        "files": files,
        "git": {"status": status.decode("utf-8"), "graph": graph.decode("utf-8")},
    }
    data = json.dumps(image, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "project.json"), "wb") as fh:
        fh.write(data)
    print("  project.json   {} files at {}   {} raw, ~{} gzipped".format(
        len(files), commit, kb(len(data)), kb(len(gzip.compress(data, 9)))))
    if skipped:
        print("                 left out, not text: " + ", ".join(sorted(skipped)))


def wasm():
    run(["cargo", "build", "--release", "--lib", "--target", TARGET], cwd=CLONE)
    built = os.path.join(CLONE, "target", TARGET, "release", "tiny.wasm")
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, "tiny.wasm")
    if os.path.exists(WASM_OPT):
        features = target_features(built) or RUST_DEFAULT_FEATURES
        flags = [f for name in features for f in FEATURE_FLAGS.get(name, [])]
        run([WASM_OPT, "-Oz", "--strip-debug"] + flags + [built, "-o", out])
    else:
        shutil.copyfile(built, out)
        print("  (wasm-opt not found at {}; shipped unoptimized)".format(WASM_OPT))
    raw = os.path.getsize(out)
    with open(out, "rb") as fh:
        gz = len(gzip.compress(fh.read(), 9))
    print("  tiny.wasm      {} raw, ~{} gzipped   (cargo output {})".format(
        kb(raw), kb(gz), kb(os.path.getsize(built))))


def licenses():
    """Ship tiny's license and third-party notices beside tiny.wasm.

    The wasm is tiny plus every crate compiled into it, so it carries their
    notices the way tiny's own release downloads do: tiny's LICENSE and
    THIRD-PARTY-NOTICES.txt, both from `main`. The notices are tiny's, written
    for its terminal builds, and the browser build carries a subset (no Lua,
    no terminal or Windows crates), so a note at the top names what of it is
    not in this one. A crate in the browser build that the notices do not list
    stops the build: its notice would be missing.
    """
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "LICENSE"), "wb") as fh:
        fh.write(run(["git", "show", "main:LICENSE"], cwd=CLONE))
    notices = run(["git", "show", "main:THIRD-PARTY-NOTICES.txt"], cwd=CLONE).decode("utf-8")
    commit = run(["git", "rev-parse", "--short", "main"], cwd=CLONE).decode().strip()

    # Every crate the notices list, a line each: "name 1.2.3", or
    # "name 1.2.3, 2.0.0" for one used at two versions.
    listed = set()
    crates = notices.split("---- crates ", 1)[1].split("\n---- ", 1)[0]
    for m in re.finditer(r"^([A-Za-z0-9_-]+) (\d\S*(?:, \d\S*)*)$", crates, re.M):
        for version in m.group(2).split(", "):
            listed.add((m.group(1), version))

    # Every crate inside the wasm: normal dependencies for the browser target,
    # without the proc-macro crates, which run in the compiler and are not in
    # the program.
    tree = run(["cargo", "tree", "--target", TARGET, "-e", "normal,no-proc-macro",
                "--prefix", "none", "--no-dedupe"], cwd=CLONE).decode("utf-8")
    inside = set()
    for line in tree.splitlines():
        m = re.match(r"^(\S+) v(\S+)", line)
        if m and m.group(1) != "tiny":
            inside.add((m.group(1), m.group(2)))

    unlisted = sorted(inside - listed)
    if unlisted:
        sys.exit("the browser build carries crates tiny's notices do not list: "
                 + ", ".join("{} {}".format(*c) for c in unlisted)
                 + "\nwrite the notices again in tiny (see its src/licenses.rs)")
    left_out = sorted(listed - inside)
    names = ", ".join("{} {}".format(*c) for c in left_out)
    note = ("This copy ships with the browser build of tiny at msaunders.dev/tiny/, "
            "built from tiny {} for WebAssembly. Below this note is tiny's own "
            "notices file, unchanged. The browser build carries every crate it "
            "lists except the ones named here, and it does not carry Lua, which "
            "it leaves out along with plugins. The syntax definitions' "
            "acknowledgments are in SYNTAX-ACKNOWLEDGMENTS.md beside this file."
            ).format(commit)
    wrap = dict(width=76, break_on_hyphens=False, break_long_words=False)
    wrapped = (textwrap.fill(note, **wrap) + "\n\nNot in the browser build:\n"
               + textwrap.fill(names + ".", initial_indent="    ", subsequent_indent="    ", **wrap))
    with open(os.path.join(OUT, "THIRD-PARTY-NOTICES.txt"), "w", encoding="utf-8") as fh:
        fh.write(wrapped + "\n\n" + "=" * 76 + "\n\n" + notices)
    print("  licenses       LICENSE, THIRD-PARTY-NOTICES.txt ({} crates in the wasm, all listed; "
          "{} listed ones not in it)".format(len(inside), len(left_out)))


def start_frames():
    """Run tiny.wasm at every size the page uses and keep its first frame."""
    py = os.path.join(TOOLS_VENV, "bin", "python")
    if not os.path.exists(py):
        run([sys.executable, "-m", "venv", TOOLS_VENV])
    if subprocess.run([py, "-c", "import wasmtime, brotli"], capture_output=True).returncode:
        run([py, "-m", "pip", "install", "--quiet", "wasmtime", "brotli"])
    if subprocess.run([py, os.path.abspath(__file__), "--start-worker"]).returncode:
        sys.exit("start frames failed")


def start_worker():
    """The half of start_frames that needs wasmtime, run inside TOOLS_VENV."""
    import ctypes
    import time
    import wasmtime

    with open(os.path.join(OUT, "project.json"), encoding="utf-8") as fh:
        project = json.load(fh)
    engine = wasmtime.Engine()
    module = wasmtime.Module.from_file(engine, os.path.join(OUT, "tiny.wasm"))
    linker = wasmtime.Linker(engine)
    linker.define_wasi()

    def read(store, ex, name):
        ptr, n = ex[name + "_ptr"](store), ex[name + "_len"](store)
        memory = ex["memory"]
        try:
            return bytes(memory.read(store, ptr, ptr + n))
        except AttributeError:
            base = ctypes.addressof(memory.data_ptr(store).contents)
            return ctypes.string_at(base + ptr, n)

    frames = {}
    began = time.time()
    with tempfile.TemporaryDirectory() as root:
        # The filesystem term.js builds in the page, laid out on disk.
        for path, text in project["files"].items():
            full = os.path.join(root, project["dir"], path)
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "w", encoding="utf-8") as fh:
                fh.write(text)
        os.makedirs(os.path.join(root, ".tiny-web"))
        for name in ("status", "graph"):
            with open(os.path.join(root, ".tiny-web", name), "w", encoding="utf-8") as fh:
                fh.write(project["git"][name])
        os.makedirs(os.path.join(root, "home", ".config"))
        os.makedirs(os.path.join(root, "tmp"))

        # A fresh instance per size, not one resized: the page starts tiny at
        # its size, and this has to be that first frame exactly.
        for cols, rows in START_SIZES:
            store = wasmtime.Store(engine)
            wasi = wasmtime.WasiConfig()
            wasi.argv = ["tiny"]
            wasi.env = [("HOME", "/home"), ("XDG_CONFIG_HOME", "/home/.config"), ("TERM", "xterm-256color")]
            try:
                wasi.preopen_dir(root, "/")
            except TypeError:
                wasi.preopen_dir(root, "/", wasmtime.DirPerms.READ_WRITE, wasmtime.FilePerms.READ_WRITE)
            store.set_wasi(wasi)
            ex = linker.instantiate(store, module).exports(store)
            if ex["tiny_start"](store, cols, rows) != 0:
                sys.exit("tiny_start failed at {}x{}: {}".format(
                    cols, rows, read(store, ex, "tiny_error").decode("utf-8", "replace")))
            frames["{}x{}".format(cols, rows)] = read(store, ex, "tiny_frame").decode("utf-8")

    data = json.dumps({"frames": frames}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with open(os.path.join(OUT, "start.json"), "wb") as fh:
        fh.write(data)
    import brotli
    print("  start.json     {} frames in {:.1f}s   {} raw, ~{} gzipped, ~{} brotli".format(
        len(frames), time.time() - began, kb(len(data)), kb(len(gzip.compress(data, 9))),
        kb(len(brotli.compress(data, quality=5)))))

    # The syntax definitions' acknowledgments live in tiny's code rather than
    # in a file (see licenses() above), so they are asked of the same program
    # the page runs, and shipped beside it.
    store = wasmtime.Store(engine)
    store.set_wasi(wasmtime.WasiConfig())
    ex = linker.instantiate(store, module).exports(store)
    ex["tiny_acknowledgments"](store)
    text = read(store, ex, "tiny_acknowledgments")
    with open(os.path.join(OUT, "SYNTAX-ACKNOWLEDGMENTS.md"), "wb") as fh:
        fh.write(text)
    print("  acknowledgments SYNTAX-ACKNOWLEDGMENTS.md   {} for the syntax definitions".format(kb(len(text))))


def manifest():
    """Write the content hash of each file that is built, for the page."""
    man = {}
    for key, name in (("wasm", "tiny.wasm"), ("project", "project.json"), ("start", "start.json")):
        path = os.path.join(OUT, name)
        if os.path.exists(path):
            with open(path, "rb") as fh:
                man[key] = {"file": name, "hash": hashlib.md5(fh.read()).hexdigest()[:8]}
    with open(os.path.join(OUT, "manifest.json"), "w") as fh:
        json.dump(man, fh, indent=2)
        fh.write("\n")
    print("  manifest.json  " + ", ".join("{}={}".format(v["file"], v["hash"]) for v in man.values()))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--project", action="store_true", help="build project.json only")
    ap.add_argument("--wasm", action="store_true", help="build tiny.wasm only")
    ap.add_argument("--start", action="store_true", help="build start.json only")
    ap.add_argument("--start-worker", action="store_true", help=argparse.SUPPRESS)
    a = ap.parse_args()
    if a.start_worker:
        return start_worker()
    every = not (a.project or a.wasm or a.start)
    print("building tiny for the browser...")
    if every or a.project:
        project()
    if every or a.wasm:
        wasm()
        licenses()
    if every or a.start:
        start_frames()
    manifest()
    print("done.")


if __name__ == "__main__":
    main()
