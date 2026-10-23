/* tiny, running in the page.

   tiny is a terminal program and this page has no terminal. It runs here as
   tiny.wasm, built by tools/build_tiny.py from the web branch of the clone, and
   this file stands in for what a terminal would have given it: a filesystem
   with a project in it, a keyboard, and a screen to paint frames on.

   The program itself downloads only when someone presses its button: it is a
   few megabytes, and most people who open this page only read it. What comes
   sooner is small: the manifest with the page, and tiny's opening frame at
   this window's size once the terminal is near the screen. */

import { WASI, File, Directory, OpenFile, PreopenDirectory, ConsoleStdout } from "./wasi/index.js";

const APP = new URL(".", import.meta.url);

/* The frame's separators, the ASCII unit, record, group and file separators,
   and the line feed that ends its first line. By code rather than written as
   escapes. The format is documented at the top of src/web.rs in that clone,
   which builds it. */
const US = String.fromCharCode(0x1f);
const RS = String.fromCharCode(0x1e);
const GS = String.fromCharCode(0x1d);
const FS = String.fromCharCode(0x1c);
const LF = String.fromCharCode(0x0a);

/* ratatui's modifier bits. */
const BOLD = 1, DIM = 2, ITALIC = 4, UNDERLINED = 8, REVERSED = 64, HIDDEN = 128, CROSSED_OUT = 256;

const BG = "#000000";
const FG = "#e6e6e6";
const CURSOR = "#3f8352"; /* the page's green */
/* The site's own face. tiny draws its structure in whatever characters suit
   the terminal it is in, and box lines and the three marks Paper Mono lacks
   are drawn here rather than taken from a font (see BOX and SHAPES), so the
   face only has to carry text. */
const FAMILY = '"Paper Mono", ui-monospace, monospace';

/* The sizes the screen can take, as [least, most, step]. tools/build_tiny.py
   draws tiny's opening frame at each of them (START_SIZES there), so keep the
   two in step. Steps of four columns and two rows keep that set to a few
   hundred frames. */
const COLS = [40, 160, 4];
const ROWS = [24, 48, 2];
/* A phone keeps one height: its page scrolls anyway, and a phone browser's
   window grows and shrinks as its toolbar slides away. */
const PHONE_ROWS = 30;

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
  const keys = [...document.querySelectorAll(".term__key")];

  let m = metrics();
  let want = { cols: 0, rows: 0 };
  let ex = null;
  let booting = null;
  let focused = false;
  let wheel = 0;
  let resizing = 0;
  let ticking = 0;
  let escaped = false; // the last key was a lone Escape: see the keydown below
  let pasteKey = false; // the paste on its way is Ctrl+V's: see the paste listener
  let previewing = false; // the opening frame is wanted, once the section is near
  const startFiles = new Map(); // the opening frames for each height, once asked for

  const manifest = fetch(new URL("manifest.json", APP), { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  const refit = () => {
    clearTimeout(resizing);
    resizing = setTimeout(fit, 80);
  };
  fit();
  new ResizeObserver(refit).observe(section);
  // The section's width is not all that matters: the window's height decides
  // the rows, and the webfont landing moves the screen's top.
  addEventListener("resize", refit);
  document.fonts.ready.then(fit);
  // A window moved to a screen with another scale keeps its size in the
  // page's pixels but not in the screen's, so the canvas is redrawn for it.
  const watchScale = () =>
    matchMedia("(resolution: " + (window.devicePixelRatio || 1) + "dppx)").addEventListener(
      "change",
      () => {
        refit();
        watchScale();
      },
      { once: true },
    );
  watchScale();

  // The dimmed opening frame behind the start button. Fetched when the section
  // comes near the screen rather than with the page: most visits never scroll
  // this far.
  new IntersectionObserver(
    (entries, seen) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      seen.disconnect();
      previewing = true;
      preview();
    },
    { rootMargin: "600px 0px" },
  ).observe(section);

  start.addEventListener("click", () => boot().catch(() => {}));
  // The buttons under the screen: tiny's windows, and the keys of its that a
  // browser keeps for its own tabs. Either starts tiny first if need be.
  const press = (b, f) =>
    b.addEventListener("click", async () => {
      try {
        await boot();
      } catch (_) {
        return;
      }
      call(f);
      paint();
      box.focus({ preventScroll: true });
    });
  buttons.forEach((b) => press(b, (t) => t.tiny_window(Number(b.dataset.window))));
  keys.forEach((b) => press(b, (t) => t.tiny_key(0, b.dataset.key.codePointAt(0), 2)));

  box.addEventListener("focus", () => {
    focused = true;
    box.classList.add("is-focused");
    paint();
  });
  box.addEventListener("blur", () => {
    focused = false;
    box.classList.remove("is-focused");
    paint();
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
    // Tab is tiny's while it runs, so a lone Escape and then Tab is the way out
    // of the terminal for a keyboard, which the hint #term points to says.
    // A modifier pressed on its own leaves that alone.
    if (!["Shift", "Control", "Alt", "Meta"].includes(e.key)) {
      const was = escaped;
      escaped = e.key === "Escape" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey;
      if (e.key === "Tab" && was) return;
    }
    // Pastes are the browser's to start, since only its paste event carries
    // what the clipboard holds: the chords a terminal on Linux or Windows
    // pastes with, and Ctrl+V, which is tiny's own paste key too. The paste
    // listener below hands each on. Should the browser not paste at all, as
    // with nothing on the clipboard it will give a page, Ctrl+V still reaches
    // tiny, which pastes its own last copy.
    if (e.ctrlKey && !e.altKey && e.key.toLowerCase() === "v") {
      pasteKey = !e.shiftKey;
      if (pasteKey) setTimeout(() => pasteKey && pasteInto("tiny_paste_key", ""), 100);
      return;
    }
    if (e.shiftKey && e.key === "Insert") return;
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
    call((t) => t.tiny_key(key, ch, mods));
    paint();
    handOver();
  });

  // Ctrl+V goes on as tiny's key, with the clipboard's text, so tiny pastes
  // it the way it pastes its own copies: whole lines above the line, copied
  // files into a folder. Any other paste is a terminal's own, all of the text
  // at once and exactly as it was copied.
  box.addEventListener("paste", (e) => {
    if (!ex) return;
    e.preventDefault();
    const text = (e.clipboardData && e.clipboardData.getData("text")) || "";
    if (pasteKey) pasteInto("tiny_paste_key", text);
    else if (text) pasteInto("tiny_paste", text);
  });

  screen.addEventListener(
    "wheel",
    (e) => {
      if (!ex) return;
      e.preventDefault();
      wheel += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const at = screen.getBoundingClientRect();
      const col = Math.max(0, Math.floor((e.clientX - at.left) / m.cw));
      const row = Math.max(0, Math.floor((e.clientY - at.top) / m.ch));
      let moved = false;
      while (Math.abs(wheel) >= 40) {
        const down = wheel > 0 ? 1 : 0;
        call((t) => t.tiny_scroll(down, col, row));
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

  /* A paste into tiny: the text into its memory, then `fn`, tiny_paste or
     tiny_paste_key, to use it (see src/web.rs in the clone). */
  function pasteInto(fn, text) {
    pasteKey = false;
    call((t) => {
      const bytes = encoder.encode(text);
      const at = t.tiny_text(bytes.length);
      // Read only now: making room may have grown the memory, which replaces
      // its buffer.
      new Uint8Array(t.memory.buffer, at, bytes.length).set(bytes);
      t[fn]();
    });
    paint();
  }

  /* What tiny just copied, onto the browser's clipboard. A page may only
     write there while it handles something the person did, so this runs
     after each key. */
  function handOver() {
    const text = call((t) => {
      const n = t.tiny_copied_len();
      return n ? read(t, t.tiny_copied_ptr(), n) : "";
    });
    if (text && navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  }

  /* Every call into tiny once it runs. A panic in tiny aborts the program and
     every call after it fails too, so the first failure stops it, says so,
     and leaves the button to load a fresh copy. */
  function call(f) {
    if (!ex) return undefined;
    try {
      return f(ex);
    } catch (err) {
      stopped(err);
      return undefined;
    }
  }

  function stopped(err) {
    clearInterval(ticking);
    ex = null;
    booting = null;
    box.classList.remove("is-running");
    start.disabled = false;
    say("tiny stopped: " + ((err && err.message) || err) + ". Press the button to start it again.");
    console.error(err);
  }

  function boot() {
    if (booting) return booting;
    // Into the terminal before the button goes, so a keyboard is not dropped
    // back to the top of the page while it loads.
    box.focus({ preventScroll: true });
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
    box.focus({ preventScroll: true });
    // What tiny's terminal loop does while it waits for a key: collect a git
    // job and look at the disk, twice a second.
    ticking = setInterval(() => {
      if (!document.hidden && call((t) => t.tiny_tick())) paint();
    }, 500);
  }

  function fit() {
    m = metrics();
    const style = getComputedStyle(section);
    const room = section.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const cols = snap(Math.floor((room - 2 * m.pad - 2) / m.cw), COLS);
    const rows = m.small ? PHONE_ROWS : snap(Math.floor(heightLeft() / m.ch), ROWS);
    const dpr = window.devicePixelRatio || 1;
    inner.style.width = cols * m.cw + 2 * m.pad + 2 + "px";
    box.style.padding = m.pad + "px";
    if (cols === want.cols && rows === want.rows && dpr === want.dpr) return;
    const resized = cols !== want.cols || rows !== want.rows;
    want = { cols, rows, dpr };
    if (ex) {
      if (resized) call((t) => t.tiny_resize(cols, rows));
      paint();
    } else {
      sizeScreen(cols, rows);
      if (previewing) preview();
    }
  }

  /* The most height the screen can have with the whole page in the window: the
     window's, less what is above the screen and what is below it. Neither of
     those depends on the screen, so fitting to this does not chase itself. */
  function heightLeft() {
    const s = screen.getBoundingClientRect();
    const below = section.getBoundingClientRect().bottom - s.bottom;
    return window.innerHeight - (s.top + window.scrollY) - below;
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
    call((t) => draw(read(t, t.tiny_frame_ptr(), t.tiny_frame_len())));
  }

  /* tiny's opening frame at the current size, dimmed by the stylesheet until
     the program runs. tools/build_tiny.py makes these by starting the same
     tiny.wasm at every size this page can use and keeping what it drew first,
     in one file for each height, so a page fetches only the height it is. */
  function preview() {
    if (ex) return;
    const { cols, rows } = want;
    let frames = startFiles.get(rows);
    if (!frames) {
      frames = manifest
        .then((man) => {
          const f = man && man.start && man.start[rows];
          return f ? fetch(new URL(f.file + "?v=" + f.hash, APP)).then((r) => (r.ok ? r.json() : null)) : null;
        })
        .then((data) => (data && data.frames) || null)
        .catch(() => null);
      startFiles.set(rows, frames);
    }
    Promise.all([
      frames,
      document.fonts.load("400 " + m.fs + "px " + FAMILY),
      document.fonts.load("700 " + m.fs + "px " + FAMILY),
    ])
      .then(([found]) => {
        const raw = found && found[cols + "x" + rows];
        // Only while the screen is still this size: the window may have
        // changed while the file was on its way.
        if (raw && !ex && want.cols === cols && want.rows === rows) draw(raw);
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
    // The font's ascent and descent centered in the cell.
    const baseline = Math.round(m.ch / 2 + m.fs * 0.36);
    // Paper Mono's math axis, where a ">" centers, 0.3135 em up with its
    // size-adjust: the drawn marks center on it, as the characters would.
    const axis = baseline - m.fs * 0.3135;
    let font = "";
    let adv = m.cw;
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
          if (f !== font) {
            ctx.font = font = f;
            adv = advance(ctx, f);
          }
          ctx.globalAlpha = mods & DIM ? 0.55 : 1;
          ctx.fillStyle = fg;
          drawCells(ctx, cells, x, py, py + baseline, py + axis, fg, adv);
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
          const shape = SHAPES[under.codePointAt(0)];
          if (shape) drawShape(ctx, shape, px, py + axis, m.cw);
          else ctx.fillText(under, px, py + baseline);
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
     most of the screen and most of the speed. A string lands on the columns
     it should as long as the font advances exactly one cell, and stretching
     the run by the little it does not (see advance()) makes sure of that.
     Anything else is drawn a cell at a time and fitted to its columns. */
  function drawCells(ctx, cells, x0, py, base, axis, fg, adv) {
    const stretch = m.cw / adv;
    let from = -1;
    let text = "";
    const flush = () => {
      if (!text) return;
      if (Math.abs(stretch - 1) < 1e-4) {
        ctx.fillText(text, from * m.cw, base);
      } else {
        ctx.save();
        ctx.translate(from * m.cw, base);
        ctx.scale(stretch, 1);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
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
      if (SHAPES[cp]) {
        drawShape(ctx, SHAPES[cp], col * m.cw, axis, m.cw);
        continue;
      }
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

/* The grid. Paper Mono at 14.4px and at 9.6px is 9px and 6px a column, at the
   0.625 em tiny.css gives it, so every column starts on a whole pixel. */
function metrics() {
  const small = window.matchMedia("(max-width: 560px)").matches;
  return small ? { small, fs: 9.6, cw: 6, ch: 14, pad: 6 } : { small, fs: 14.4, cw: 9, ch: 20, pad: 12 };
}

/* n brought onto [min, max], down to a whole number of steps from min. */
function snap(n, [min, max, step]) {
  return Math.max(min, Math.min(max, min + Math.floor((n - min) / step) * step));
}

/* What a font really advances at a size, measured over a long run. Paper
   Mono's 0.625 em is 9px at 14.4px on paper, but a canvas sets text at a size
   rounded to 1/64 of a pixel and comes out at 8.995, most of a pixel off the
   grid by the end of a row. Runs are stretched by the difference. Asked once
   a font, after the font has loaded. */
const advances = new Map();
function advance(ctx, font) {
  let a = advances.get(font);
  if (a === undefined) {
    a = ctx.measureText("M".repeat(64)).width / 64;
    advances.set(font, a);
  }
  return a;
}

/* The three marks tiny draws that Paper Mono lacks: the browser's open and
   closed folder markers and the third bullet. Drawn like the box lines rather
   than left to whatever font the system has for them, sized off the cell and
   centered on the axis a ">" sits on, in the current fill. */
const SHAPES = { 0x25b8: "right", 0x25be: "down", 0x25aa: "square" };

function drawShape(ctx, kind, x, axis, w) {
  const cx = x + w / 2;
  if (kind === "square") {
    const s = Math.max(2, Math.round(w * 0.44));
    ctx.fillRect(Math.round(cx - s / 2), Math.round(axis - s / 2), s, s);
    return;
  }
  // A triangle s across its base and h from base to point.
  const s = w * 0.62;
  const h = s * 0.85;
  ctx.beginPath();
  if (kind === "right") {
    ctx.moveTo(cx - h / 2, axis - s / 2);
    ctx.lineTo(cx + h / 2, axis);
    ctx.lineTo(cx - h / 2, axis + s / 2);
  } else {
    ctx.moveTo(cx - s / 2, axis - h / 2);
    ctx.lineTo(cx + s / 2, axis - h / 2);
    ctx.lineTo(cx, axis + h / 2);
  }
  ctx.closePath();
  ctx.fill();
}

/* Chords the browser keeps, or should: tab and window keys, reload, the
   address bar, developer tools, and anything with the Command key. Some a
   page cannot intercept at all and the rest it should not. Reload is F5 and
   Ctrl+Shift+R only: Ctrl+R is tiny's, and records a macro. Ctrl+Q is here
   because quit means nothing in a page. tiny's own Ctrl+L, Ctrl+T and Ctrl+W
   have buttons under the screen instead. */
function reserved(e) {
  if (e.metaKey) return true;
  if (/^F(5|11|12)$/.test(e.key)) return true;
  if (!e.ctrlKey) return false;
  return /^(Tab|[1-9]|[lnqtw])$/i.test(e.key) || (e.shiftKey && /^[cijr]$/i.test(e.key));
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
