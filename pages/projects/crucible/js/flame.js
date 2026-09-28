/* ============================================================
   crucible : the hero flame

   A fire simulation on a character grid, clipped to a fixed
   silhouette. Heat is seeded along the base, rises, drifts a
   column either way and decays, and what survives is mapped to a
   ramp of glyphs. One color throughout, so the flame reads
   through glyph density rather than hue, which is the same trick
   the planetarium on the main site uses.

   Presentation only. The page says nothing that needs this to be
   read, so if the script never runs the hero is simply the title
   and the button.
   ============================================================ */
(function () {
  'use strict';

  var el = document.getElementById('flame');
  if (!el) return;

  /* --- the shape ------------------------------------------- *
     THIS is the flame. Swap the block and the flame changes; nothing
     below reads anything about it but its dimensions. Any non-space
     character counts as inside, rows may be ragged, and the grid sizes
     itself off the longest one.

     It is an outer bound, not the drawn edge: heat decays as it climbs,
     so the fire thins out well inside the tip most frames and only
     occasionally fills it. That gap is what flickers.

     This one is crucible/flame.md resampled. That file draws the flame in
     braille, which packs 2x4 dots into a cell and decodes to a 28 by 45 dot
     grid. The hollow core is kept: it is the drawing, and filling it in
     turned the flame into a lopsided blob. It is not rendered as
     braille here: the webfont is a latin subset, so braille falls through
     to whatever the system offers, which advances 0.73 em rather than 0.60
     and by a different amount on every platform. The flame would be
     stretched, and stretched differently for each visitor. Resampling onto
     glyphs the font actually carries keeps the metrics ours.

     Draw it wide. A glyph is 0.6 as wide as the line is tall, so a shape
     that looks right as a block of text renders about 40% narrower than it
     reads here. The resample already accounts for that: 26 columns by 25
     rows comes out 234 by 375 px, which is the 28:45 the flame was drawn
     at. Regenerating from a new flame.md means decoding the braille, then
     resampling to whatever column count holds that ratio at 0.6 em.

     Resample by tracking each wing's edges, not by thresholding how much of a
     cell the art covers. Coverage was what put a flat wall down the left side:
     the drawing carries thin detached marks a single dot wide out there, too
     fine for this grid to hold, and the threshold kept tipping them on and
     welding them to the wing. Following the left and right edge of each wing
     instead, averaged over the source rows a cell spans and smoothed once
     along the run, keeps the taper that those marks were burying.

     The grid is sized to the title rather than the other way round: the two
     stand as a lockup, so the flame is as tall as the heading's line box.
     That caps how many rows there is room for, and 16 is what a 5px cell
     buys. It is a coarse grid for a fire, which is why the resample keeps
     the hollow core rather than the fine edge detail: the shape has to
     survive at this size, and the silhouette is what carries it.
     ============================================================ */
  var MASK = [
    '         ###',
    '          ##',
    '          ###',
    '          #####',
    '         #######',
    '         ######',
    '        ##########',
    '       #### ######',
    '      #####  ######',
    '     ######    #####',
    '    ######    #######',
    '   ######     #######',
    ' #######     ########',
    ' ######       #######',
    '#######        #####',
    ' #####          ####',
    ' ######         ####',
    '   ####         ###',
    '    ####      ###',
    '     ####     ###'
  ];

  /* Sparse to dense: the Bourke ramp, the same one the planetarium maps
     its shading onto. Index 0 is a space, so a cell that has cooled all
     the way out simply disappears. */
  var RAMP = ' .:-=+*#%@';

  /* What a row keeps climbing to the next one. Over the 23 rows above the
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

  /* Heat below this draws nothing. The silhouette is the outer bound, not
     the edge: cells near it lose weight to the empty cells outside, so the
     visible edge sits inside the mask and moves as the flame leans. */
  var FLOOR = 0.08;

  /* ~18fps. Fire that redraws every frame blurs into a texture; slowing it
     down is what makes the eye read separate flickers. */
  var FRAME = 55;

  var H = MASK.length, W = 0, i;
  for (i = 0; i < H; i++) W = Math.max(W, MASK[i].length);

  var inside = new Uint8Array(W * H);
  for (var y = 0; y < H; y++) {
    for (var x = 0; x < MASK[y].length; x++) {
      if (MASK[y].charAt(x) !== ' ') inside[y * W + x] = 1;
    }
  }

  /* The fuel: every cell on the underside of the shape, meaning one that is
     inside with nothing inside directly below it. Not the bottom row. This
     flame narrows to four columns at its foot, and lighting only those left
     the wide middle with almost nothing rising into it: heat halves at every
     step it spreads sideways, so a body twenty columns across cannot be fed
     from four. The whole lower edge burns instead, which is also what it
     looks like, the bright rim curving up the flanks and cooling inward. */
  var fuel = new Uint8Array(W * H);
  for (y = 0; y < H; y++) {
    for (var fx = 0; fx < W; fx++) {
      var f = y * W + fx;
      if (inside[f] && (y === H - 1 || !inside[f + W])) fuel[f] = 1;
    }
  }

  var heat = new Float32Array(W * H);
  var row = new Array(W), out = new Array(H);
  var lastIdx = RAMP.length - 1;
  var clock = 0;

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
      }
    }
  }

  /* One buffer, walked top down. Writing row y reads row y + 1, which has
     not been touched yet this pass and so still holds the last frame: the
     row below is exactly the input the row above should rise from.

     Each cell takes a weighted blend of the three below it rather than one
     of them at random. Sampling a single cell is the classic way to do
     this and it is far too noisy at two dozen rows: the field breaks into
     speckle instead of holding together as a flame. The weights lean with
     the wind and always sum to one, so the blend moves the heat sideways
     without adding or losing any. */
  function step() {
    clock += 0.08;
    var wind = SWAY * Math.sin(clock * 0.9);
    var wl = 0.25 - wind * 0.5, wc = 0.5, wr = 0.25 + wind * 0.5;

    for (var y = 0; y < H - 1; y++) {
      var below = (y + 1) * W;
      for (var x = 0; x < W; x++) {
        var t = y * W + x;
        if (!inside[t]) { heat[t] = 0; continue; }
        if (fuel[t]) continue;              // lit by seed(), not from below
        var v = 0;
        if (x > 0 && inside[below + x - 1]) v += wl * heat[below + x - 1];
        if (inside[below + x]) v += wc * heat[below + x];
        if (x + 1 < W && inside[below + x + 1]) v += wr * heat[below + x + 1];
        v *= COOL * (1 - JITTER + 2 * JITTER * Math.random());
        heat[t] = v > 0 ? v : 0;
      }
    }
    seed();
  }

  function draw() {
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var t = y * W + x, v = heat[t];
        row[x] = (inside[t] && v > FLOOR) ? RAMP.charAt(Math.round(v * lastIdx)) : ' ';
      }
      out[y] = row.join('');
    }
    el.textContent = out.join('\n');
  }

  /* Settle before the first paint, or the opening frames are a block of
     heat climbing out of an empty grid. */
  seed();
  for (i = 0; i < H * 2; i++) step();

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
