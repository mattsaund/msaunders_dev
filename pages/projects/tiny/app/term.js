/* ============================================================
   tiny, running in the page

   tiny is a terminal program and this page has no terminal. The
   program runs as tiny.wasm, built from the web branch of the clone
   in tiny/web (see tools/build_tiny.py), and this file stands in for everything a terminal
   would have given it: a filesystem with a project in it, the
   keyboard, and a screen to paint its frames on.

   Nothing downloads until someone asks for it. The program is a few
   megabytes, and most people who open this page only read it.
   ============================================================ */

import { WASI, File, Directory, OpenFile, PreopenDirectory, ConsoleStdout } from "./wasi/index.js";

const APP = new URL(".", import.meta.url);

/* The frame's separators, the ASCII unit, record, group and file separators,
   and the two line-ending characters. By code rather than written as escapes.
   The format is documented at the top of src/web.rs in that clone, which builds it. */
const US = String.fromCharCode(0x1f);
const RS = String.fromCharCode(0x1e);
const GS = String.fromCharCode(0x1d);
const FS = String.fromCharCode(0x1c);
const LF = String.fromCharCode(0x0a);
const CR = String.fromCharCode(0x0d);

/* ratatui's modifier bits. */
const BOLD = 1, DIM = 2, ITALIC = 4, UNDERLINED = 8, REVERSED = 64, HIDDEN = 128, CROSSED_OUT = 256;

const BG = "#000000";
const FG = "#e6e6e6";
const CURSOR = "#3f8352"; /* the page's green */
const FAMILY = '"tiny term", "JetBrains Mono", ui-monospace, monospace';

/* The sixteen colors tiny's themes are written in, tuned to read on black. */
const ANSI = [
  "#000000", "#e06c75", "#7fbf7f", "#e5c07b", "#61afef", "#c678dd", "#56b6c2", "#c8c8c8",
  "#6b6b6b", "#ef8f97", "#a6e3a1", "#f2d58f", "#8cc8ff", "#dca3ef", "#8be0eb", "#ffffff",
];

/* What tiny_key in web.rs expects for each named key. */
const NAMED = {
  Enter: 1, Escape: 2, Backspace: 3, Tab: 4, ArrowLeft: 6, ArrowRight: 7, ArrowUp: 8,
  ArrowDown: 9, Home: 10, End: 11, PageUp: 12, PageDown: 13, Delete: 14, Insert: 15,
};

/* Box drawing is drawn, not typed. A font's line glyphs are cut for its own
   line height and leave gaps or overlaps at this grid's. Sides are up, right,
   down, left; 1 is light, 2 heavy, 3 double. Dashed lines are drawn solid. */
const BOX = {
  0x2500: [0, 1, 0, 1], 0x2501: [0, 2, 0, 2], 0x2502: [1, 0, 1, 0], 0x2503: [2, 0, 2, 0],
  0x2504: [0, 1, 0, 1], 0x2505: [0, 2, 0, 2], 0x2506: [1, 0, 1, 0], 0x2507: [2, 0, 2, 0],
  0x2508: [0, 1, 0, 1], 0x2509: [0, 2, 0, 2], 0x250A: [1, 0, 1, 0], 0x250B: [2, 0, 2, 0],
  0x250C: [0, 1, 1, 0], 0x250F: [0, 2, 2, 0], 0x2510: [0, 0, 1, 1], 0x2513: [0, 0, 2, 2],
  0x2514: [1, 1, 0, 0], 0x2517: [2, 2, 0, 0], 0x2518: [1, 0, 0, 1], 0x251B: [2, 0, 0, 2],
  0x251C: [1, 1, 1, 0], 0x2523: [2, 2, 2, 0], 0x2524: [1, 0, 1, 1], 0x252B: [2, 0, 2, 2],
  0x252C: [0, 1, 1, 1], 0x2533: [0, 2, 2, 2], 0x2534: [1, 1, 0, 1], 0x253B: [2, 2, 0, 2],
  0x253C: [1, 1, 1, 1], 0x254B: [2, 2, 2, 2],
  0x2550: [0, 3, 0, 3], 0x2551: [3, 0, 3, 0], 0x2554: [0, 3, 3, 0], 0x2557: [0, 0, 3, 3],
  0x255A: [3, 3, 0, 0], 0x255D: [3, 0, 0, 3], 0x2560: [3, 3, 3, 0], 0x2563: [3, 0, 3, 3],
  0x2566: [0, 3, 3, 3], 0x2569: [3, 3, 0, 3], 0x256C: [3, 3, 3, 3],
  0x2574: [0, 0, 0, 1], 0x2575: [1, 0, 0, 0], 0x2576: [0, 1, 0, 0], 0x2577: [0, 0, 1, 0],
  0x2578: [0, 0, 0, 2], 0x2579: [2, 0, 0, 0], 0x257A: [0, 2, 0, 0], 0x257B: [0, 0, 2, 0],
};
/* The rounded corners: which way the vertical leg goes, then the horizontal. */
const ARC = { 0x256D: "dr", 0x256E: "dl", 0x256F: "ul", 0x2570: "ur" };

const decoder = new TextDecoder();
const encoder = new TextEncoder();

const box = document.getElementById("term");
if (box) mount(box);

function mount(box) {
  const screen = box.querySelector(".term__screen");
  const start = box.querySelector(".term__start");
  const status = box.querySelector(".term__status");
  const section = box.closest(".try");
  const inner = box.closest(".try__inner");
  const buttons = [...document.querySelectorAll(".term__win")];

  let m = metrics();
  let want = { cols: 0, rows: 0 };
  let ex = null;
  let booting = null;
  let focused = false;
  let wheel = 0;
  let resizing = 0;
  let startFrames = null; // the opening frame at every size, once asked for

  const manifest = fetch(new URL("manifest.json", APP), { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  fit();
  new ResizeObserver(() => {
    clearTimeout(resizing);
    resizing = setTimeout(fit, 80);
  }).observe(section);

  // The dimmed opening frame behind the start button. Fetched when the section
  // comes near the screen rather than with the page: most visits never scroll
  // this far.
  new IntersectionObserver(
    (entries, seen) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      seen.disconnect();
      preview();
    },
    { rootMargin: "600px 0px" },
  ).observe(section);

  start.addEventListener("click", () => boot().catch(() => {}));
  buttons.forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await boot();
      } catch (_) {
        return;
      }
      ex.tiny_window(Number(b.dataset.window));
      paint();
      box.focus();
    }),
  );

  box.addEventListener("focus", () => {
    focused = true;
    box.classList.add("is-focused");
    if (ex) paint();
  });
  box.addEventListener("blur", () => {
    focused = false;
    box.classList.remove("is-focused");
    if (ex) paint();
  });
  box.addEventListener("mousedown", (e) => {
    if (!start.contains(e.target)) box.focus();
  });

  box.addEventListener("keydown", (e) => {
    if (!ex) {
      if (e.target === box && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        boot().catch(() => {});
      }
      return;
    }
    if (e.isComposing || reserved(e)) return;
    const altGraph = e.getModifierState && e.getModifierState("AltGraph");
    const mods = (e.shiftKey ? 1 : 0) | (e.ctrlKey && !altGraph ? 2 : 0) | (e.altKey && !altGraph ? 4 : 0);
    let key;
    let ch = 0;
    if (e.key in NAMED) {
      key = NAMED[e.key];
      if (key === 4 && e.shiftKey) key = 5;
    } else if (/^F([1-9]|1[01])$/.test(e.key)) {
      key = 16;
      ch = Number(e.key.slice(1));
    } else if ([...e.key].length === 1) {
      key = 0;
      let c = e.key;
      // A terminal reports Ctrl with a letter as the lowercase letter, caps lock
      // or not; tiny's bindings are written that way.
      if (mods & 2 && /^[A-Z]$/.test(c) && !e.shiftKey) c = c.toLowerCase();
      ch = c.codePointAt(0);
    } else {
      return; // Shift, Control, Dead, Unidentified: nothing a terminal would send
    }
    e.preventDefault();
    ex.tiny_key(key, ch, mods);
    paint();
  });

  box.addEventListener("paste", (e) => {
    if (!ex) return;
    const text = e.clipboardData && e.clipboardData.getData("text");
    if (!text) return;
    e.preventDefault();
    for (const c of text.split(CR + LF).join(LF).split(CR).join(LF)) {
      if (c === LF) ex.tiny_key(1, 0, 0);
      else ex.tiny_key(0, c.codePointAt(0), 0);
    }
    paint();
  });

  screen.addEventListener(
    "wheel",
    (e) => {
      if (!ex) return;
      e.preventDefault();
      wheel += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const col = Math.max(0, Math.floor((e.clientX - screen.getBoundingClientRect().left) / m.cw));
      let moved = false;
      while (Math.abs(wheel) >= 40) {
        ex.tiny_scroll(wheel > 0 ? 1 : 0, col);
        wheel -= Math.sign(wheel) * 40;
        moved = true;
      }
      if (moved) paint();
    },
    { passive: false },
  );

  function say(text) {
    status.textContent = text;
  }

  function boot() {
    if (booting) return booting;
    start.disabled = true;
    say("Loading tiny...");
    booting = load().catch((err) => {
      booting = null;
      ex = null;
      start.disabled = false;
      say("tiny could not start: " + ((err && err.message) || err));
      console.error(err);
      throw err;
    });
    return booting;
  }

  async function load() {
    const man = await manifest;
    if (!man || !man.wasm || !man.project) throw new Error("the build is missing");
    const url = (f) => new URL(f.file + "?v=" + f.hash, APP);
    const [project] = await Promise.all([
      fetch(url(man.project)).then((r) => {
        if (!r.ok) throw new Error("project.json " + r.status);
        return r.json();
      }),
      document.fonts.load("400 " + m.fs + "px " + FAMILY),
      document.fonts.load("700 " + m.fs + "px " + FAMILY),
    ]);

    const wasi = new WASI(
      ["tiny"],
      ["HOME=/home", "XDG_CONFIG_HOME=/home/.config", "TERM=xterm-256color"],
      [
        new OpenFile(new File([])),
        ConsoleStdout.lineBuffered((line) => console.log("[tiny]", line)),
        ConsoleStdout.lineBuffered((line) => console.warn("[tiny]", line)),
        new PreopenDirectory("/", filesystem(project)),
      ],
      // The shim logs every system call to the console unless told not to.
      { debug: false },
    );
    const imports = { wasi_snapshot_preview1: wasi.wasiImport };
    let instance;
    try {
      ({ instance } = await WebAssembly.instantiateStreaming(fetch(url(man.wasm)), imports));
    } catch (_) {
      // A server that labels .wasm wrongly defeats the streaming compiler; the
      // bytes still compile the slow way.
      const bytes = await (await fetch(url(man.wasm))).arrayBuffer();
      ({ instance } = await WebAssembly.instantiate(bytes, imports));
    }
    wasi.initialize(instance);
    const exports = instance.exports;
    if (exports.tiny_start(want.cols, want.rows) !== 0) {
      throw new Error(read(exports, exports.tiny_error_ptr(), exports.tiny_error_len()));
    }
    ex = exports;
    // The live frame is painted before the class changes. It is the frame the
    // dimmed preview already shows, so lifting the dimming is all anyone sees.
    paint();
    box.classList.add("is-running");
    say("");
    box.focus();
    // What tiny's terminal loop does while it waits for a key: collect a git
    // job and look at the disk, twice a second.
    setInterval(() => {
      if (ex && !document.hidden && ex.tiny_tick()) paint();
    }, 500);
  }

  function fit() {
    m = metrics();
    const style = getComputedStyle(section);
    const room = section.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const cols = Math.max(40, Math.min(160, Math.floor((room - 2 * m.pad - 2) / m.cw)));
    const rows = m.rows;
    inner.style.width = cols * m.cw + 2 * m.pad + 2 + "px";
    box.style.padding = m.pad + "px";
    if (cols === want.cols && rows === want.rows) return;
    want = { cols, rows };
    if (ex) {
      ex.tiny_resize(cols, rows);
      paint();
    } else {
      sizeScreen(cols, rows);
      if (startFrames) preview();
    }
  }

  function sizeScreen(cols, rows) {
    const dpr = window.devicePixelRatio || 1;
    const w = cols * m.cw;
    const h = rows * m.ch;
    screen.style.width = w + "px";
    screen.style.height = h + "px";
    const W = Math.round(w * dpr);
    const H = Math.round(h * dpr);
    if (screen.width !== W || screen.height !== H) {
      screen.width = W;
      screen.height = H;
    }
    return dpr;
  }

  function paint() {
    draw(read(ex, ex.tiny_frame_ptr(), ex.tiny_frame_len()));
  }

  /* tiny's opening frame at the current size, dimmed by the stylesheet until
     the program runs. tools/build_tiny.py makes these by starting the same
     tiny.wasm at every size this page can use and keeping what it drew first. */
  function preview() {
    if (ex) return;
    if (!startFrames) {
      startFrames = manifest
        .then((man) =>
          man && man.start
            ? fetch(new URL(man.start.file + "?v=" + man.start.hash, APP)).then((r) => (r.ok ? r.json() : null))
            : null,
        )
        .then((data) => (data && data.frames) || null)
        .catch(() => null);
    }
    Promise.all([
      startFrames,
      document.fonts.load("400 " + m.fs + "px " + FAMILY),
      document.fonts.load("700 " + m.fs + "px " + FAMILY),
    ])
      .then(([frames]) => {
        const raw = frames && frames[want.cols + "x" + want.rows];
        if (raw && !ex) draw(raw);
      })
      .catch(() => {});
  }

  /* Paint one frame. The format is written up at the top of src/web.rs in that clone. */
  function draw(raw) {
    const nl = raw.indexOf(LF);
    const [cols, rows, cx, cy, shown, win] = raw.slice(0, nl).split(" ").map(Number);
    const lines = raw.slice(nl + 1).split(GS);
    const dpr = sizeScreen(cols, rows);
    const ctx = screen.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, cols * m.cw, rows * m.ch);
    ctx.textBaseline = "alphabetic";
    const baseline = Math.round(m.ch / 2 + m.fs * 0.36);
    let font = "";
    let under = "";

    for (let y = 0; y < rows; y++) {
      const line = lines[y];
      if (!line) continue;
      let x = 0;
      for (const run of line.split(RS)) {
        if (!run) continue;
        const a = run.indexOf(US);
        const b = run.indexOf(US, a + 1);
        const c = run.indexOf(US, b + 1);
        const mods = Number(run.slice(b + 1, c));
        const cells = run.slice(c + 1).split(FS);
        let fg = color(Number(run.slice(0, a)), FG);
        let bg = color(Number(run.slice(a + 1, b)), BG);
        if (mods & REVERSED) [fg, bg] = [bg, fg];
        const px = x * m.cw;
        const py = y * m.ch;
        const n = cells.length;
        if (y === cy && cx >= x && cx < x + n) under = cells[cx - x];
        if (bg !== BG) {
          ctx.fillStyle = bg;
          ctx.fillRect(px, py, n * m.cw, m.ch);
        }
        if (!(mods & HIDDEN)) {
          const f = (mods & ITALIC ? "italic " : "") + (mods & BOLD ? 700 : 400) + " " + m.fs + "px " + FAMILY;
          if (f !== font) ctx.font = font = f;
          ctx.globalAlpha = mods & DIM ? 0.55 : 1;
          ctx.fillStyle = fg;
          drawCells(ctx, cells, x, py + baseline, py, fg);
          ctx.globalAlpha = 1;
        }
        if (mods & UNDERLINED) {
          ctx.fillStyle = fg;
          ctx.fillRect(px, py + m.ch - 2, n * m.cw, 1);
        }
        if (mods & CROSSED_OUT) {
          ctx.fillStyle = fg;
          ctx.fillRect(px, py + Math.round(m.ch / 2), n * m.cw, 1);
        }
        x += n;
      }
    }

    if (shown && cx < cols && cy < rows) {
      const px = cx * m.cw;
      const py = cy * m.ch;
      if (focused) {
        ctx.fillStyle = CURSOR;
        ctx.fillRect(px, py, m.cw, m.ch);
        if (under && under !== " ") {
          ctx.font = "400 " + m.fs + "px " + FAMILY;
          ctx.fillStyle = "#ffffff";
          ctx.fillText(under, px, py + baseline);
        }
      } else {
        ctx.strokeStyle = CURSOR;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, m.cw - 1, m.ch - 1);
      }
    }

    buttons.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.window) === win)));
  }

  /* One run's cells. ASCII is batched into single fillText calls, which is
     most of the screen and most of the speed: at this grid the font's advance
     is exactly one cell, so a string lands on the columns it should. Anything
     else is drawn a cell at a time and fitted to the columns it occupies. */
  function drawCells(ctx, cells, x0, base, py, fg) {
    let from = -1;
    let text = "";
    const flush = () => {
      if (text) ctx.fillText(text, from * m.cw, base);
      text = "";
      from = -1;
    };
    for (let i = 0; i < cells.length; i++) {
      const s = cells[i];
      const col = x0 + i;
      if (s.length === 1 && s.charCodeAt(0) < 128) {
        if (from < 0) {
          if (s === " ") continue;
          from = col;
        }
        text += s;
        continue;
      }
      flush();
      if (!s) continue; // under the wide glyph to its left
      const cp = s.codePointAt(0);
      if (BOX[cp] || ARC[cp]) {
        drawBox(ctx, cp, col * m.cw, py, m.cw, m.ch, fg);
        continue;
      }
      const span = cells[i + 1] === "" || wide(cp) ? 2 : 1;
      const room = span * m.cw;
      const w = ctx.measureText(s).width;
      if (w > room + 0.5) {
        ctx.save();
        ctx.translate(col * m.cw, base);
        ctx.scale(room / w, 1);
        ctx.fillText(s, 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(s, col * m.cw + (room - w) / 2, base);
      }
    }
    flush();
  }
}

function metrics() {
  const small = window.matchMedia("(max-width: 560px)").matches;
  const fs = small ? 10 : 15;
  return { fs, cw: fs * 0.6, ch: small ? 14 : 20, rows: small ? 30 : 32, pad: small ? 6 : 12 };
}

/* Chords the browser keeps, or should: tab and window keys, reload, the
   address bar, developer tools, and anything with the Command key. Some a
   page cannot intercept at all and the rest it should not. Ctrl+Q is here
   because quit means nothing in a page. */
function reserved(e) {
  if (e.metaKey) return true;
  if (/^F(5|11|12)$/.test(e.key)) return true;
  if (!e.ctrlKey) return false;
  return /^(Tab|[1-9]|[lnqrtw])$/i.test(e.key) || (e.shiftKey && /^[cijr]$/i.test(e.key));
}

function drawBox(ctx, cp, x, y, w, h, fg) {
  const t = Math.max(1, Math.round(w / 9));
  const cx = x + Math.floor(w / 2);
  const cy = y + Math.floor(h / 2);
  const arc = ARC[cp];
  if (arc) {
    const lx = cx - Math.floor(t / 2) + t / 2;
    const ly = cy - Math.floor(t / 2) + t / 2;
    const r = Math.min(w, h) / 2;
    const down = arc[0] === "d";
    const right = arc[1] === "r";
    ctx.strokeStyle = fg;
    ctx.lineWidth = t;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(lx, down ? y + h : y);
    ctx.lineTo(lx, ly + (down ? r : -r));
    ctx.arcTo(lx, ly, lx + (right ? r : -r), ly, r);
    ctx.lineTo(right ? x + w : x, ly);
    ctx.stroke();
    return;
  }
  const [up, right, down, left] = BOX[cp];
  ctx.fillStyle = fg;
  const reach = t; // how far past center each half runs, so the halves meet
  const vert = (k, y0, y1) => {
    if (!k) return;
    if (k === 3) {
      ctx.fillRect(cx - t - 1, y0, t, y1 - y0);
      ctx.fillRect(cx + 1, y0, t, y1 - y0);
      return;
    }
    const s = k === 2 ? 2 * t : t;
    ctx.fillRect(cx - Math.floor(s / 2), y0, s, y1 - y0);
  };
  const horiz = (k, x0, x1) => {
    if (!k) return;
    if (k === 3) {
      ctx.fillRect(x0, cy - t - 1, x1 - x0, t);
      ctx.fillRect(x0, cy + 1, x1 - x0, t);
      return;
    }
    const s = k === 2 ? 2 * t : t;
    ctx.fillRect(x0, cy - Math.floor(s / 2), x1 - x0, s);
  };
  vert(up, y, cy + reach);
  vert(down, cy - reach, y + h);
  horiz(left, x, cx + reach);
  horiz(right, cx - reach, x + w);
}

/* East Asian wide and emoji ranges: the glyphs a terminal gives two columns. */
function wide(cp) {
  return (
    (cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe4f) || (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x1f300 && cp <= 0x1f64f) || (cp >= 0x1f900 && cp <= 0x1f9ff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  );
}

const colors = new Map();
function color(n, fallback) {
  if (n < 0) return fallback;
  let c = colors.get(n);
  if (c) return c;
  if (n < 16) {
    c = ANSI[n];
  } else if (n < 232) {
    const v = [0, 95, 135, 175, 215, 255];
    const i = n - 16;
    c = hex(v[Math.floor(i / 36)], v[Math.floor(i / 6) % 6], v[i % 6]);
  } else if (n < 256) {
    const g = 8 + (n - 232) * 10;
    c = hex(g, g, g);
  } else {
    const rgb = n - 16777216;
    c = hex((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255);
  }
  colors.set(n, c);
  return c;
}

function hex(r, g, b) {
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function read(exports, ptr, len) {
  return decoder.decode(new Uint8Array(exports.memory.buffer, ptr, len));
}

/* The page's filesystem: tiny's source where web.rs opens it, the recorded
   git answers where git/run.rs reads them, and a home for the settings file.
   Built leaves first, so every directory exists before its parent does. */
function filesystem(project) {
  const tree = {};
  for (const [path, text] of Object.entries(project.files)) {
    const parts = path.split("/");
    let node = tree;
    for (const part of parts.slice(0, -1)) node = node[part] || (node[part] = {});
    node[parts[parts.length - 1]] = text;
  }
  const entries = (node) =>
    new Map(
      Object.entries(node).map(([name, v]) => [
        name,
        typeof v === "string" ? new File(encoder.encode(v)) : new Directory(entries(v)),
      ]),
    );
  return new Map([
    [project.dir, new Directory(entries(tree))],
    [
      ".tiny-web",
      new Directory(
        new Map([
          ["status", new File(encoder.encode(project.git.status))],
          ["graph", new File(encoder.encode(project.git.graph))],
        ]),
      ),
    ],
    ["home", new Directory(new Map([[".config", new Directory(new Map())]]))],
    ["tmp", new Directory(new Map())],
  ]);
}
