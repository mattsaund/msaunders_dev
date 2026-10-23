/* Crucible : the hero flame.

   A fire simulation on a character grid, clipped to a fixed silhouette. Heat is
   seeded along the base, rises, drifts a column either way and decays, and what
   survives maps to a ramp of glyphs. Two colors, the page's orange and a
   yellow for the core, and within each it reads through glyph density rather
   than hue.

   Presentation only: if the script never runs, the hero is the title and the
   button. */
(function () {
  'use strict';

  var el = document.getElementById('flame');
  if (!el) return;

  /* --- the shape ---
     This is the flame. Swap the block and the flame changes; nothing below
     reads anything about it but its dimensions. '#' is the flame and 'o' its
     core, drawn in yellow (.flame__core in the stylesheet). Any other
     non-space character counts as flame, rows may be ragged, and the grid
     sizes off the longest.

     The core is a fire of its own, an inner flame with its own base and tip:
     it takes heat only from itself. The flame takes heat from both, so what
     rises off the core's tip carries on up the middle. Shut off from the
     core, the flame above it had nothing to rise from and starved into a
     black crack down the middle of the fire.

     It is the most the fire can fill, not what it always fills. The fuel runs
     along the underside of the lower half (see FUELED), the upper half burns
     on the heat that rises into it, and a draft runs up the outline (see
     DRAFT), so the edges flicker in and out and the top licks and comes and
     goes. Only the bottom row holds still: it is where the flame stands on
     the title's baseline.

     This one is crucible/flame.md resampled. That file draws the flame in
     braille, which packs 2x4 dots into a cell and decodes to a 28 by 45 dot
     grid. Its hollow middle is the core here. Left empty, it was a black
     hole in the middle of the fire; in yellow it reads as the fire's hotter
     heart. It is not rendered as braille here: Paper Mono has no braille, so it would fall
     through to whatever the system offers, at that font's advance rather than
     this one's and by a different amount on every platform. The flame would
     be stretched, and stretched differently for each visitor. Resampling onto
     glyphs the font actually carries keeps the metrics ours.

     Draw it wide. A glyph is 0.6 as wide as the line is tall (see .flame in
     the stylesheet), so a shape that looks right as a block of text renders
     about 40% narrower than it reads here. The resample already accounts
     for that: 21 columns by 20 rows comes out 75.6 by 120 px, about the
     28:45 the flame was drawn at. Regenerating from a new flame.md means
     decoding the braille, then resampling to whatever column count holds
     that ratio in cells 0.6 as wide as they are tall.

     Resample by tracking each wing's edges, not by thresholding how much of a
     cell the art covers. Coverage was what put a flat wall down the left side:
     the drawing carries thin detached marks a single dot wide out there, too
     fine for this grid to hold, and the threshold kept tipping them on and
     welding them to the wing. Following the left and right edge of each wing
     instead, averaged over the source rows a cell spans and smoothed once
     along the run, keeps the taper that those marks were burying.

     The grid is sized to the title rather than the other way round: the two
     stand as a lockup, so the flame's height is set off the heading's, half
     again its 80px line box. That caps how many rows there is room for, and
     20 is what a 6px cell buys. It is a coarse grid for a fire, which is why
     the resample keeps the core rather than the fine edge detail: the shape
     has to survive at this size, and the silhouette is what carries it.
     ============================================================ */
  var MASK = [
    '         ###',
    '          ##',
    '          ###',
    '          #####',
    '         #######',
    '         ######',
    '        ##########',
    '       ####o######',
    '      #####oo######',
    '     ######oooo#####',
    '    ######oooo#######',
    '   ######ooooo#######',
    ' #######ooooo########',
    ' ######ooooooo#######',
    '#######oooooooo#####',
    ' #####oooooooooo####',
    ' ######ooooooooo####',
    '   ####ooooooooo###',
    '    ####oooooo###',
    '     ####ooooo###'
  ];

  /* Sparse to dense: the Bourke ramp, the same one the planetarium maps
     its shading onto. Index 0 is a space, so a cell that has cooled all
     the way out simply disappears. */
  var RAMP = ' .:-=+*#%@';

  /* What a row keeps climbing to the next one. Over the 19 rows above the
     base that leaves about a third of the heat at the tip, which is what
     puts the sparse end of the ramp up there and the dense end at the
     bottom. Raise it and the flame fills the silhouette flat; drop it and
     it never reaches the tip. */
  var COOL = 0.95;

  /* Per cell flicker, and the slow lean of the whole flame. The lean is a
     single value shared by every cell in a frame, which is the difference
     between a flame that sways and one that just seethes. */
  var JITTER = 0.08;
  var SWAY = 0.22;

  /* How far up the shape the fuel runs, as a share of its height. Above it
     the flame burns on what rises into it, the core's heat included. */
  var FUELED = 0.5;

  /* How much hotter than its heat the top is drawn. Less heat climbs past the
     fuel, and drawn as it is the top of the flame was dots and colons, faint
     just where a real flame's tongues catch the eye. Each row above the fuel
     draws hotter, up to WISP times at the tip, on a curve that leaves the
     rows just above the fuel nearly as they were: a straight rise made the
     narrow middle brighter than the body. More, and the tip outweighs it. It
     changes how bright a lit cell is, not which cells are lit, so the top
     comes and goes all the same. */
  var WISP = 2;

  /* The draft up the outline, which is what makes the edges flicker and the
     top lick. Two waves cross the outline, both climbing, and add up to
     between -1 and 1. Where they pass this, an edge cell loses all of its
     heat and goes dark, and it fades back in over the 0.6 below. Taken from
     the heat rather than the drawing, so what rises off a cell the draft has
     put out is cooler too, and the edge pulls back like a tongue of flame.
     Lower and the edges go out more. */
  var DRAFT = 0.4;

  /* Heat below this draws nothing, a little above where the ramp itself
     rounds down to its space, so a tip that is going out goes rather than
     lingering as a dot or two. */
  var FLOOR = 0.08;

  /* At least 55 ms between steps, which a 60 Hz screen rounds up to every
     fourth frame: 15 a second. Fire that redraws every frame blurs into a
     texture; slowing it down is what makes the eye read separate flickers. */
  var FRAME = 55;

  var H = MASK.length, W = 0, i;
  for (i = 0; i < H; i++) W = Math.max(W, MASK[i].length);

  /* What each cell is: 0 outside the shape, FLAME, or CORE. */
  var FLAME = 1, CORE = 2;
  var kind = new Uint8Array(W * H);
  for (var y = 0; y < H; y++) {
    for (var x = 0; x < MASK[y].length; x++) {
      var c = MASK[y].charAt(x);
      if (c !== ' ') kind[y * W + x] = c === 'o' ? CORE : FLAME;
    }
  }

  /* The fuel: every cell on the underside of the lower half, meaning one with
     nothing of its own kind directly below it, so the flame above the core
     burns as it would over a hole, and so does the core above the flame's
     feet. Not the bottom row. This flame stands on two feet, four columns and
     three, and lighting only those left the wide middle with almost nothing
     rising into it: heat halves at every step it spreads sideways, so a body
     twenty columns across cannot be fed from seven. The whole lower edge
     burns instead, which is also what it looks like, the bright rim curving
     up the flanks and cooling inward.

     A still flame is fueled all the way up: frozen in a frame where the tip
     has gone out, it would look cut off rather than flickering. */
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var base = still ? 0 : Math.round(H * (1 - FUELED));   // the top row with fuel
  var fuel = new Uint8Array(W * H);
  for (y = base; y < H; y++) {
    for (var fx = 0; fx < W; fx++) {
      var f = y * W + fx;
      if (kind[f] && (y === H - 1 || kind[f + W] !== kind[f])) fuel[f] = 1;
    }
  }

  /* The cells the draft reaches: the outline, meaning those with outside of
     the shape beside, above or below them, in every row but the bottom one.
     A still flame keeps its whole outline. */
  var side = new Uint8Array(W * H);
  if (!still) {
    for (y = 0; y < H - 1; y++) {
      for (x = 0; x < W; x++) {
        var s = y * W + x;
        if (kind[s] && (x === 0 || !kind[s - 1] || x === W - 1 || !kind[s + 1] ||
                        y === 0 || !kind[s - W] || !kind[s + W])) side[s] = 1;
      }
    }
  }

  /* WISP for each row: 1 at the fuel and below it, rising above. */
  var gain = new Float32Array(H);
  for (y = 0; y < H; y++) {
    gain[y] = y < base ? 1 + (WISP - 1) * Math.pow((base - y) / base, 1.5) : 1;
  }

  /* The text, set up once: a node for each run of flame or of core along a
     row, the core's inside a span for its color. A frame only rewrites what
     the nodes say. */
  var runs = [];
  el.textContent = '';
  for (y = 0; y < H; y++) {
    for (x = 0; x < W;) {
      var from = y * W + x, inCore = kind[from] === CORE;
      while (x < W && (kind[y * W + x] === CORE) === inCore) x++;
      var node = document.createTextNode('');
      if (inCore) {
        var span = document.createElement('span');
        span.className = 'flame__core';
        el.appendChild(span).appendChild(node);
      } else {
        el.appendChild(node);
      }
      runs.push({ node: node, from: from, to: y * W + x });
    }
    if (y < H - 1) el.appendChild(document.createTextNode('\n'));
  }

  var heat = new Float32Array(W * H);
  var glyph = new Array(W * H);
  var lastIdx = RAMP.length - 1;
  var clock = 0;

  /* How much of an edge cell's heat the draft leaves it now, 0 to 1. The two
     waves cross the outline at different slants and speeds, so where they
     peak together keeps moving, and both climb, so it moves up. */
  function draft(x, y) {
    var n = (Math.sin(0.9 * x + 1.1 * y + clock * 5) +
             Math.sin(-0.8 * x + 0.9 * y + clock * 3.7 + 2.1)) / 2;
    var keep = (DRAFT - n) / 0.6;
    return keep < 0 ? 0 : keep > 1 ? 1 : keep;
  }

  /* The fuel, re-lit every frame. The sine gives neighboring columns
     different phases of the same slow pulse, so the foot of the flame
     breathes instead of strobing, and the depth term leaves the lowest
     point of the underside hotter than the rim running up the sides. */
  function seed() {
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var f = y * W + x;
        if (!fuel[f]) continue;
        var depth = 0.6 + 0.4 * (y / (H - 1));
        heat[f] = depth * (0.9 + 0.1 * Math.sin(clock * 2.1 + x * 0.7))
                + 0.08 * Math.random();
        if (side[f]) heat[f] *= draft(x, y);
      }
    }
  }

  /* Whether heat rises out of a cell of kind `from` into one of kind `to`:
     within the flame, within the core, and from the core into the flame, but
     not from the flame into the core (see the shape). */
  function feeds(from, to) {
    return from === to || (from === CORE && to === FLAME);
  }

  /* One buffer, walked top down. Writing row y reads row y + 1, which has
     not been touched yet this pass and so still holds the last frame: the
     row below is exactly the input the row above should rise from.

     Each cell takes a weighted blend of the three below it rather than one
     of them at random, counting only those it takes heat from (feeds()).
     Sampling a single cell is the classic way to do this and it is far too
     noisy at twenty rows: the field breaks into speckle instead of holding
     together as a flame. The weights lean with the wind and always sum to
     one, so the blend moves the heat sideways without adding any. */
  function step() {
    clock += 0.08;
    var wind = SWAY * Math.sin(clock * 0.9);
    var wl = 0.25 - wind * 0.5, wc = 0.5, wr = 0.25 + wind * 0.5;

    for (var y = 0; y < H - 1; y++) {
      var below = (y + 1) * W;
      for (var x = 0; x < W; x++) {
        var t = y * W + x, k = kind[t];
        if (!k) { heat[t] = 0; continue; }
        if (fuel[t]) continue;              // lit by seed(), not from below
        var v = 0;
        if (x > 0 && feeds(kind[below + x - 1], k)) v += wl * heat[below + x - 1];
        if (feeds(kind[below + x], k)) v += wc * heat[below + x];
        if (x + 1 < W && feeds(kind[below + x + 1], k)) v += wr * heat[below + x + 1];
        v *= COOL * (1 - JITTER + 2 * JITTER * Math.random());
        if (side[t]) v *= draft(x, y);
        heat[t] = v > 0 ? v : 0;
      }
    }
    seed();
  }

  function draw() {
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var t = y * W + x, v = heat[t];
        // Heat at the fuel can reach 1.08 and the tip's gain takes it further,
        // past the top of the ramp, and a character past its end would be "":
        // the row would come out short and everything right of it would jump
        // a column.
        glyph[t] = (kind[t] && v > FLOOR) ? RAMP.charAt(Math.min(lastIdx, Math.round(v * gain[y] * lastIdx))) : ' ';
      }
    }
    for (var r = 0; r < runs.length; r++) {
      runs[r].node.data = glyph.slice(runs[r].from, runs[r].to).join('');
    }
  }

  /* Settle before the first paint, or the opening frames are a block of
     heat climbing out of an empty grid. */
  seed();
  for (i = 0; i < H * 2; i++) step();

  if (still) {
    draw();
    return;
  }

  var raf = 0, prev = 0;

  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (now - prev < FRAME) return;
    prev = now;
    step();
    draw();
  }

  function start() { if (!raf) { prev = 0; raf = requestAnimationFrame(tick); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  /* Nothing to animate behind a hidden tab. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  draw();
  start();
})();
