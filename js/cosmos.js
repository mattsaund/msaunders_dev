/* ============================================================
   msaunders.dev : ASCII planetarium

   Renders shaded ASCII spheres (plus Saturn's and Uranus' ring
   systems) into fixed background layers. Every body is computed
   at runtime from real lighting maths, with no image or pre-baked
   frame assets. The bodies are pinned to document coordinates, so
   they scroll up and off the page with everything else, and they
   turn on their own clock: a slow constant rotation independent of
   scrolling. A scattered ASCII starfield fills the side margins.
   ============================================================ */
(function () {
  'use strict';

  /* --- tunables ------------------------------------------- */
  /* Bourke's 10-level ramp. Ink density rises monotonically, which the
     obvious-looking ".,:;=+ic*ox%#@" does not: 'i' and 'c' read lighter
     than '=' and '+', so gradients came out mottled. Index 0 is a space,
     which gives the empty-sky threshold for free. */
  var RAMP = " .:-=+*#%@";
  var CHAR_ASPECT = 0.6;           // glyph advance / line height (measured at init)
  var SCALE = 1.15;                // global size trim for every body
  var L = unit(-0.60, 0.40, 0.69); // key light, upper-left, toward viewer

  /* --- small maths ---------------------------------------- */
  function unit(x, y, z) { var m = Math.sqrt(x * x + y * y + z * z); return [x / m, y / m, z / m]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function wrapPi(x) {
    while (x > Math.PI) x -= 2 * Math.PI;
    while (x < -Math.PI) x += 2 * Math.PI;
    return x;
  }

  /* Deterministic PRNG so every visitor sees the same craters. */
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  /* Surface features as body-frame unit vectors + a cosine radius,
     so texture lookups are dot products rather than inverse trig. */
  function features(seed, n, rMin, rSpan) {
    var r = rng(seed), out = [], i;
    for (i = 0; i < n; i++) {
      var y = r() * 2 - 1, ph = r() * Math.PI * 2, s = Math.sqrt(1 - y * y);
      var rad = rMin + r() * rSpan;
      out.push({
        x: s * Math.cos(ph), y: y, z: s * Math.sin(ph),
        c: Math.cos(rad), rim: Math.cos(rad * 0.70)
      });
    }
    return out;
  }

  /* --- surface textures ----------------------------------- *
     Each takes a body-frame unit vector (bx,by,bz) plus the
     latitude/longitude already derived from it, and returns an
     albedo around 1.0.                                        */

  /* Feature radii are in radians of arc. Anything under ~0.14 rad lands
     inside a single glyph at these grid sizes and just reads as noise. */
  var MOON_CRATERS = features(20260821, 15, 0.15, 0.20);
  var MOON_MARIA   = features(70719, 4, 0.44, 0.26);

  function texMoon(bx, by, bz) {
    var a = 0.86, i, c, d;
    for (i = 0; i < MOON_MARIA.length; i++) {
      c = MOON_MARIA[i];
      d = bx * c.x + by * c.y + bz * c.z;
      if (d > c.c) a -= 0.40 * (d - c.c) / (1 - c.c);
    }
    for (i = 0; i < MOON_CRATERS.length; i++) {
      c = MOON_CRATERS[i];
      d = bx * c.x + by * c.y + bz * c.z;
      if (d > c.c) a += (d < c.rim) ? 0.22 : -0.26;   // bright rim, dark floor
    }
    return clamp(a, 0.12, 1.12);
  }

  function texSaturn(bx, by, bz, la, lo) {
    return 0.84 + 0.15 * Math.sin(la * 9.5)
                + 0.07 * Math.sin(la * 4.2 + 1.1)
                + 0.08 * Math.sin(lo * 3.0 + la * 7.0);
  }

  function texJupiter(bx, by, bz, la, lo) {
    var a = 0.80 + 0.17 * Math.sin(la * 12.5)
                 + 0.10 * Math.sin(la * 5.5 + 0.8)
                 + 0.14 * Math.sin(lo * 4.0 + la * 14.0)      // festoons
                 + 0.07 * Math.sin(lo * 7.0 - la * 9.0);      // turbulence
    var dl = wrapPi(lo - 0.7) * 0.62, dla = (la + 0.33) * 1.9;   // Great Red Spot
    var d = Math.sqrt(dl * dl + dla * dla);
    if (d < 0.42) a *= 0.50 + 0.36 * (d / 0.42);
    return clamp(a, 0.12, 1.15);
  }

  var MARS_ALBEDO = features(31415, 16, 0.16, 0.26);

  function texMars(bx, by, bz, la, lo) {
    var a = 0.78 + 0.09 * Math.sin(lo * 3.4 + la * 2.1)
                 + 0.06 * Math.sin(la * 6.3 - lo * 1.7);
    for (var i = 0; i < MARS_ALBEDO.length; i++) {
      var c = MARS_ALBEDO[i], d = bx * c.x + by * c.y + bz * c.z;
      if (d > c.c) a -= 0.24 * (d - c.c) / (1 - c.c);
    }
    var p = Math.abs(la);                                        // polar caps
    if (p > 1.16) a = 1.20;
    else if (p > 0.99) a += 0.42 * (p - 0.99) / 0.17;
    return clamp(a, 0.15, 1.20);
  }

  function texNeptune(bx, by, bz, la, lo) {
    var a = 0.76 + 0.09 * Math.sin(la * 6.5)
                 + 0.12 * Math.sin(lo * 2.5 + la * 4.0)
                 + 0.07 * Math.sin(lo * 4.5 - la * 3.0);
    var dl = wrapPi(lo + 1.1) * 0.70, dla = (la - 0.30) * 2.1;   // Great Dark Spot
    var d = Math.sqrt(dl * dl + dla * dla);
    if (d < 0.40) a *= 0.48 + 0.38 * (d / 0.40);
    return clamp(a, 0.12, 1.15);
  }

  /* Continents as body-frame unit vectors with a cosine radius, roughly
     where the real ones are, so the globe reads as Earth rather than noise. */
  function place(latDeg, lonDeg, radDeg) {
    var la = latDeg * Math.PI / 180, lo = lonDeg * Math.PI / 180, c = Math.cos(la);
    return { x: c * Math.cos(lo), y: Math.sin(la), z: c * Math.sin(lo),
             c: Math.cos(radDeg * Math.PI / 180) };
  }

  var LAND = [
    place(  8,   20, 30),   // Africa
    place( 50,   15, 16),   // Europe
    place( 48,   95, 34),   // Asia
    place( 24,   78, 13),   // India
    place( 45, -100, 27),   // North America
    place(-12,  -58, 22),   // South America
    place(-25,  134, 16),   // Australia
    place( 72,  -40, 11)    // Greenland
  ];

  function texEarth(bx, by, bz, la, lo) {
    var a = 0.38;                                   // ocean
    for (var i = 0; i < LAND.length; i++) {
      var c = LAND[i], d = bx * c.x + by * c.y + bz * c.z;
      /* Ramp hard at the edge so coastlines stay crisp instead of blurring. */
      if (d > c.c) a += 0.55 * Math.min(1, (d - c.c) / (1 - c.c) * 3.4);
    }
    var pl = Math.abs(la);
    if (pl > 1.32) a = 1.18;                        // ice caps
    else if (pl > 1.14) a += 0.46 * (pl - 1.14) / 0.18;
    a += 0.07 * Math.sin(lo * 6.0 + la * 4.0);      // weather
    return clamp(a, 0.14, 1.18);
  }

  function texUranus(bx, by, bz, la, lo) {
    return 0.86 + 0.05 * Math.sin(la * 5.0) + 0.025 * Math.sin(lo * 3.0);
  }

  /* --- the bodies ----------------------------------------- *
     extX/extY : half-width and half-height of the frame, in planet radii.
                 A tilted ring system is wide and flat, so these have to be
                 set independently or the frame is mostly empty sky.
     rows      : glyph rows; cols is derived so the disk stays circular.
     tilt      : pole tipped toward the viewer (rad)
     roll      : pole tipped within the view plane (rad)
     rate      : radians of rotation per second (sign = direction). One turn
                 takes 2*PI/rate seconds, so 0.105 is a ~60 second day.
     amb       : ambient light on the night side
     side      : which edge to hug; the exact x is computed so the body is
                 always fully on screen. Vertical position is assigned from
                 the document height so the bodies space themselves.        */
  var BODIES = [
    { name: 'saturn', tex: texSaturn, rows: 19, extX: 2.45, extY: 1.20, sz: 1.00,
      tilt: 0.46, roll: -0.16, rate: 0.105, amb: 0.17, phase: 0.4,
      rings: { inner: 1.28, outer: 2.30, gaps: [[1.68, 1.78], [2.04, 2.09]] },
      side: 'right' },

    { name: 'moon', tex: texMoon, rows: 17, extX: 1.14, extY: 1.14, sz: 1.20,
      tilt: 0.18, roll: 0.10, rate: -0.075, amb: 0.13, phase: 1.9,
      side: 'left' },

    { name: 'jupiter', tex: texJupiter, rows: 21, extX: 1.12, extY: 1.12, sz: 1.10,
      tilt: 0.10, roll: 0.06, rate: 0.140, amb: 0.19, phase: 2.7,
      side: 'right' },

    { name: 'mars', tex: texMars, rows: 16, extX: 1.16, extY: 1.16, sz: 1.05,
      tilt: 0.34, roll: -0.28, rate: 0.110, amb: 0.15, phase: 0.9,
      side: 'left' },

    /* Uranus rolls onto its side, so its rings stand up vertically. */
    { name: 'uranus', tex: texUranus, rows: 26, extX: 1.10, extY: 2.10, sz: 0.95,
      tilt: 0.52, roll: 1.5708, rate: -0.085, amb: 0.20, phase: 3.4,
      rings: { inner: 1.44, outer: 2.02, gaps: [[1.63, 1.69]] },
      side: 'right' },

    { name: 'neptune', tex: texNeptune, rows: 18, extX: 1.14, extY: 1.14, sz: 1.00,
      tilt: -0.30, roll: 0.22, rate: 0.095, amb: 0.18, phase: 5.1,
      side: 'left' }
  ];


  /* The horizon body: an Earth so large it is mostly below the page, with
     only a shallow band of its limb showing along the very bottom.
       span   : sphere diameter in viewport widths
       reveal : px of globe left visible above the document bottom
     tilt is 60 degrees so the visible apex sits near 30 degrees latitude
     (not the pole, where the surface would just swirl) and the rotation
     reads as a clean rightward drift. Negative rate == drifting right. */
  var EARTH = {
    name: 'earth', tex: texEarth, pin: true,
    span: 4.0, reveal: 250, sz: 1.00,
    tilt: 1.05, roll: 0, rate: -0.011, amb: 0.22, gain: 1.75, phase: 0.6
  };

  /* --- renderer ------------------------------------------- */
  function render(p, angle) {
    var W = p.cols, H = p.rows, extX = p.extX, extY = p.extY, yc = p.yc || 0;

    /* Body axis in view space. */
    var ct = Math.cos(p.tilt), st = Math.sin(p.tilt);
    var nx = -Math.sin(p.roll) * ct, ny = Math.cos(p.roll) * ct, nz = st;

    /* Orthonormal equatorial basis (u, v) perpendicular to the axis. */
    var hx = 0, hy = 0, hz = 1;
    if (Math.abs(nz) > 0.9) { hx = 1; hz = 0; }
    var ux = hy * nz - hz * ny, uy = hz * nx - hx * nz, uz = hx * ny - hy * nx;
    var um = Math.sqrt(ux * ux + uy * uy + uz * uz);
    ux /= um; uy /= um; uz /= um;
    var vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;

    var ca = Math.cos(angle), sa = Math.sin(angle);
    var rings = p.rings, gaps = rings ? rings.gaps : null;
    var gain = p.gain || 1;
    var lx = L[0], ly = L[1], lz = L[2];
    var lastIdx = RAMP.length - 1;

    var rows = new Array(H), i, j;

    for (j = 0; j < H; j++) {
      var line = new Array(W);
      /* yc offsets the frame up the sphere, so a pinned body can render
         just the shallow band that is actually on screen. */
      var sy = (1 - 2 * (j + 0.5) / H) * extY + yc;

      for (i = 0; i < W; i++) {
        var sx = (2 * (i + 0.5) / W - 1) * extX;
        var d2 = sx * sx + sy * sy;

        /* ---- lit sphere ---- */
        var sphere = -1, zs = -1e9;
        if (d2 <= 1) {
          zs = Math.sqrt(1 - d2);
          var lum = sx * lx + sy * ly + zs * lz;
          if (lum < 0) lum = 0;

          /* view-space normal -> body frame, then unspin by the angle */
          var by = clamp(sx * nx + sy * ny + zs * nz, -1, 1);
          var b0 = sx * ux + sy * uy + zs * uz;
          var b1 = sx * vx + sy * vy + zs * vz;
          var bx = b0 * ca + b1 * sa;
          var bz = b1 * ca - b0 * sa;

          var la = Math.asin(by);
          var lo = Math.atan2(bz, bx);

          var alb = p.tex(bx, by, bz, la, lo);
          sphere = alb * (p.amb + (1 - p.amb) * lum * (0.45 + 0.55 * lum));
          sphere *= (0.58 + 0.42 * zs) * gain;            // limb darkening
        }

        /* ---- ring plane ----
           Rings are a translucent sheet, not a solid surface: a faint band
           in front of the planet has to composite over it, not replace it. */
        var ringLum = 0, cov = 0, zr = -1e9;
        if (rings && Math.abs(nz) > 0.05) {
          zr = -(nx * sx + ny * sy) / nz;
          var rr = Math.sqrt(d2 + zr * zr);
          if (rr >= rings.inner && rr <= rings.outer) {
            var open = true;
            for (var g = 0; g < gaps.length; g++) {
              if (rr > gaps[g][0] && rr < gaps[g][1]) { open = false; break; }
            }
            if (open) {
              var t = (rr - rings.inner) / (rings.outer - rings.inner);
              cov = (0.55 + 0.45 * Math.sin(t * 8.2)) * (1 - 0.45 * t);

              /* Azimuth of this ring point, measured in the rotating frame.
                 Inner material shears ahead of outer on a Keplerian profile,
                 so the density clumps wind up as the body turns. */
              var au = sx * ux + sy * uy + zr * uz;
              var av = sx * vx + sy * vy + zr * vz;
              var phi = Math.atan2(av, au) - angle * Math.pow(rr, -1.5) * 1.7;
              cov *= 0.70 + 0.30 * (0.62 * Math.sin(phi * 2.0 + 0.4)
                                  + 0.38 * Math.sin(phi * 5.0 - 1.1));

              /* the flatter the system sits to us, the more material per glyph */
              cov = clamp(cov, 0, 1) * (0.55 + 0.45 * (1 - Math.abs(nz)));
              ringLum = 0.88;
              /* the planet's own shadow falling across the rings */
              var qL = sx * lx + sy * ly + zr * lz;
              if (qL < 0) {
                var px = sx - qL * lx, py = sy - qL * ly, pz = zr - qL * lz;
                if (px * px + py * py + pz * pz < 1) ringLum *= 0.16;
              }
            }
          }
        }

        /* ---- depth resolve ---- */
        var back = sphere >= 0 ? sphere : 0;
        var v;
        if (cov > 0 && (d2 > 1 || zr > zs)) v = ringLum * cov + back * (1 - cov);
        else v = back;

        line[i] = RAMP[Math.round(clamp(v, 0, 1) * lastIdx)];
      }
      rows[j] = line.join('');
    }
    return rows.join('\n');
  }

  /* --- scene ---------------------------------------------- */
  var host = document.createElement('div');
  host.className = 'cosmos';
  host.setAttribute('aria-hidden', 'true');

  /* Stars live in their own layer so they can be rebuilt on resize without
     disturbing the planets, and so the planets paint over them. */
  var stars = document.createElement('div');
  stars.className = 'stars';
  host.appendChild(stars);

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Start each page on a different body so the site doesn't feel looped. */
  var offset = 0;
  var path = location.pathname;
  if (path !== '/' && path !== '/index.html') {
    for (var k = 0; k < path.length; k++) offset = (offset * 31 + path.charCodeAt(k)) >>> 0;
    offset %= BODIES.length;
  }

  var live = [];
  for (var b = 0; b < BODIES.length; b++) {
    var p = BODIES[(b + offset) % BODIES.length];
    var pre = document.createElement('pre');
    pre.className = 'cosmos__body';
    host.appendChild(pre);
    live.push({ p: p, el: pre, drawn: null, top: 0, h: 0 });
  }
  /* The horizon is not one of the drifters: it is pinned to the foot of the
     document and always on, so it stays out of `live` and its count logic. */
  var horizonEl = document.createElement('pre');
  horizonEl.className = 'cosmos__body cosmos__horizon';
  host.appendChild(horizonEl);
  var horizon = { p: EARTH, el: horizonEl, drawn: null, top: 0, h: 0 };

  document.body.insertBefore(host, document.body.firstChild);

  /* --- starfield ------------------------------------------- */
  /* Weighted toward '.' so the field reads as depth rather than confetti. */
  var STAR_GLYPHS = "....*+,'`x.*.:.";

  function wrapWidth() {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--wrap'));
    return (isFinite(v) && v > 0) ? v : 1120;
  }

  function buildStars(vw, docH) {
    /* Only the margins either side of the content column get stars, so they
       never end up sitting behind body copy. Below this width there is no
       margin worth using. */
    var gutter = (vw - wrapWidth()) / 2;
    if (vw < 860 || gutter < 60) { stars.textContent = ''; return; }

    var r = rng(0x5EEDB0);
    var n = clamp(Math.round(2 * gutter * docH / 3200), 0, 560);
    var buf = [];

    for (var i = 0; i < n; i++) {
      var onRight = r() < 0.5;
      var inset = 8 + r() * (gutter - 18);
      var x = onRight ? (vw - inset) : inset;
      var y = r() * docH;
      var g = STAR_GLYPHS.charAt((r() * STAR_GLYPHS.length) | 0);
      /* Most of the field twinkles. Real skies do have steady stars, so a
         minority stay fixed and give the eye something to rest against. */
      var twinkle = r() < 0.62;
      var cls = 'star';
      if (twinkle) cls += (r() < 0.6) ? ' star--blink' : ' star--shimmer';
      if (r() < 0.13) cls += ' star--blue';

      var css = 'left:' + x.toFixed(0) + 'px;top:' + y.toFixed(0) + 'px;'
              + 'font-size:' + (9 + (r() * 5 | 0)) + 'px';
      var peak = (0.38 + r() * 0.62).toFixed(2);
      if (twinkle) {
        /* Period and phase both randomised; the negative delay drops each star
           somewhere mid-cycle at load so they never start in unison. */
        var dur = 3.4 + r() * 8.0;
        css += ';--tw:' + peak
             + ';animation-duration:' + dur.toFixed(1) + 's'
             + ';animation-delay:-' + (r() * dur).toFixed(1) + 's';
      } else {
        css += ';opacity:' + peak;
      }
      buf.push('<i class="' + cls + '" style="' + css + '">' + g + '</i>');
    }
    stars.innerHTML = buf.join('');
  }

  /* --- layout --------------------------------------------- */
  var count = 1;

  /* Which monospace font actually resolved decides the glyph advance, and
     both disk roundness and the on-screen fit depend on it. Measure once
     instead of trusting the 0.6 guess. */
  function measureAspect() {
    var probe = document.createElement('pre');
    probe.className = 'cosmos__body';
    probe.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0;font-size:100px';
    probe.textContent = new Array(51).join('M');          // 50 glyphs
    host.appendChild(probe);
    var w = probe.getBoundingClientRect().width;
    host.removeChild(probe);
    return (w > 0) ? (w / 50) / 100 : 0.6;
  }

  function sizeBodies() {
    CHAR_ASPECT = measureAspect();
    for (var i = 0; i < BODIES.length; i++) {
      var b = BODIES[i];
      /* Glyph columns that keep the disk circular at this font's advance. */
      b.cols = Math.round(b.rows * (b.extX / b.extY) / CHAR_ASPECT);
    }
  }

  /* Where the drifting bodies sit: one near the top of the page, then one at
     the top of every other section. Anchoring to real landmarks instead of
     splitting the document evenly keeps both the count and the positions
     stable; the old viewport-derived count silently dropped from three bodies
     to two on a taller window. */
  var TOP_INSET = 40;

  function anchors() {
    var out = [TOP_INSET];
    var secs = document.querySelectorAll('main .section');
    var y = window.scrollY || window.pageYOffset || 0;
    for (var k = 1; k < secs.length; k += 2) {
      out.push(Math.round(secs[k].getBoundingClientRect().top + y));
    }
    return out;
  }

  function measure() {
    /* clientWidth, not innerWidth: the scrollbar is not usable space. */
    var vw = document.documentElement.clientWidth, vh = window.innerHeight;
    var docH = document.documentElement.scrollHeight;
    host.style.height = docH + 'px';

    var spots = anchors();
    count = Math.min(spots.length, live.length);

    var base = clamp(Math.min(vw, vh * 1.7) / 108, 6, 13) * SCALE;
    for (var i = 0; i < live.length; i++) {
      var s = live[i], p = s.p;
      if (i >= count) { s.el.style.display = 'none'; continue; }
      s.el.style.display = '';

      var fs = base * p.sz;
      var w = p.cols * fs * CHAR_ASPECT;
      /* Never wider than the viewport, whatever the screen. */
      if (w > vw) { fs *= vw / w; w = vw; }

      /* Hug an edge, but keep the whole body on screen. */
      var gap = clamp((vw - w) * 0.5, 0, 32);
      var x = (p.side === 'right') ? vw - w - gap : gap;

      s.el.style.fontSize = fs.toFixed(2) + 'px';
      s.el.style.left = Math.round(clamp(x, 0, Math.max(0, vw - w))) + 'px';

      s.h = p.rows * fs;
      s.top = Math.max(0, spots[i]);
      s.el.style.top = s.top + 'px';
      s.drawn = null;                     // force a repaint at the new size
    }

    /* ---- the horizon ----
       Only the shallow band that is actually on screen gets rendered, rather
       than a full globe four viewports wide that is then clipped away. The
       frame's extents are derived straight from pixels, so the curve stays a
       true circular arc. */
    var E = horizon.p;
    var R = (E.span * vw) / 2;                       // sphere radius in px
    /* A floor on glyph size: `base` shrinks on small screens, which would
       otherwise make the horizon's grid denser on a phone than on a desktop. */
    var efs = Math.max(base * E.sz, 9);
    var revealPx = Math.min(E.reveal, vh * 0.30, R);

    E.cols = Math.max(8, Math.round(vw / (efs * CHAR_ASPECT)));
    E.rows = Math.max(4, Math.round(revealPx / efs));
    E.extX = (E.cols * efs * CHAR_ASPECT) / 2 / R;
    E.extY = (E.rows * efs) / 2 / R;
    E.yc = 1 - E.extY;                               // band's top edge at the apex

    horizon.h = E.rows * efs;
    horizon.top = Math.round(docH - horizon.h);
    horizonEl.style.fontSize = efs.toFixed(2) + 'px';
    horizonEl.style.left = '0px';
    horizonEl.style.top = horizon.top + 'px';
    horizon.drawn = null;
  }

  /* --- animation ------------------------------------------ */
  /* Rotation runs on wall-clock time now, not scroll position, so the bodies
     keep turning while the page sits still. Only bodies near the viewport are
     drawn, and the angle is quantised so a redraw only happens when a glyph
     could actually change. */
  function draw(spun) {
    var y = window.scrollY || window.pageYOffset || 0;
    var vh = window.innerHeight;
    var near = y - vh * 0.5, far = y + vh * 1.5;

    for (var i = 0; i < count; i++) {
      var s = live[i];
      if (s.top + s.h < near || s.top > far) continue;
      var q = Math.round((s.p.phase + spun * s.p.rate) * 120) / 120;
      if (q !== s.drawn) {
        s.el.textContent = render(s.p, q);
        s.drawn = q;
      }
    }

    if (horizon.top + horizon.h >= near && horizon.top <= far) {
      var qe = Math.round((horizon.p.phase + spun * horizon.p.rate) * 240) / 240;
      if (qe !== horizon.drawn) {
        horizon.el.textContent = render(horizon.p, qe);
        horizon.drawn = qe;
      }
    }
  }

  var spun = 0, last = 0, raf = 0;

  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (last) spun += (now - last) / 1000;
    last = now;
    draw(spun);
  }

  function start() { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; last = 0; } }

  /* A background tab should not be burning frames. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (!reduced) start();
  });

  /* Exposed so the bodies can be inspected and tuned outside the page. */
  window.__cosmos = { render: render, bodies: BODIES, live: live,
                     horizon: horizon, measure: measure, draw: draw };

  sizeBodies();
  measure();

  draw(0);            /* first paint must not wait on a frame callback */

  if (reduced) {
    /* No self-rotation, and no animation loop to burn power. Bodies are still
       drawn as scrolling brings them into range. */
    var queued = false;
    addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; draw(0); });
    }, { passive: true });
  } else {
    start();
  }

  /* Star placement depends on the document height, so rebuild it after a
     resize settles rather than on every intermediate event. */
  function restar() {
    buildStars(document.documentElement.clientWidth, document.documentElement.scrollHeight);
  }
  restar();

  var pending = 0;
  addEventListener('resize', function () {
    measure();                                  /* cheap: six elements */
    clearTimeout(pending);
    pending = setTimeout(function () { restar(); draw(0); }, 140);
  });
  /* Images and fonts settling changes the document height. */
  addEventListener('load', function () { measure(); restar(); draw(0); });
})();
