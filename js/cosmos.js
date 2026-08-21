/* ============================================================
   msaunders.dev : ASCII planetarium

   Renders shaded ASCII spheres (plus Saturn's and Uranus' ring
   systems) into fixed background layers. Every body is computed
   at runtime from real lighting maths, with no image or pre-baked
   frame assets. The bodies are pinned to document coordinates, so
   they scroll up and off the page with everything else. Rotation
   is driven by scroll position: they spin as the page moves and
   unwind if you scroll back up.
   ============================================================ */
(function () {
  'use strict';

  /* --- tunables ------------------------------------------- */
  /* Bourke's 10-level ramp. Ink density rises monotonically, which the
     obvious-looking ".,:;=+ic*ox%#@" does not: 'i' and 'c' read lighter
     than '=' and '+', so gradients came out mottled. Index 0 is a space,
     which gives the empty-sky threshold for free. */
  var RAMP = " .:-=+*#%@";
  var CHAR_ASPECT = 0.6;           // glyph advance / line height
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
                + 0.04 * Math.sin(lo * 3.0 + la * 7.0);
  }

  function texJupiter(bx, by, bz, la, lo) {
    var a = 0.80 + 0.17 * Math.sin(la * 12.5)
                 + 0.11 * Math.sin(la * 5.5 + 0.8)
                 + 0.05 * Math.sin(lo * 4.0 + la * 14.0);
    var dl = wrapPi(lo - 0.7) * 0.62, dla = (la + 0.33) * 1.9;   // Great Red Spot
    var d = Math.sqrt(dl * dl + dla * dla);
    if (d < 0.42) a *= 0.50 + 0.36 * (d / 0.42);
    return a;
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
                 + 0.05 * Math.sin(lo * 2.5 + la * 4.0);
    var dl = wrapPi(lo + 1.1) * 0.70, dla = (la - 0.30) * 2.1;   // Great Dark Spot
    var d = Math.sqrt(dl * dl + dla * dla);
    if (d < 0.36) a *= 0.52 + 0.36 * (d / 0.36);
    return a;
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
     spin      : radians of rotation per pixel scrolled (sign = direction)
     amb       : ambient light on the night side
     at        : horizontal placement only; vertical position is assigned
                 from the document height so the bodies space themselves    */
  var BODIES = [
    { name: 'saturn', tex: texSaturn, rows: 19, extX: 2.45, extY: 1.20, sz: 1.00,
      tilt: 0.46, roll: -0.16, spin: 0.0034, amb: 0.17, phase: 0.4,
      rings: { inner: 1.28, outer: 2.30, gaps: [[1.68, 1.78], [2.04, 2.09]] },
      at: { right: '-3vw' } },

    { name: 'moon', tex: texMoon, rows: 17, extX: 1.14, extY: 1.14, sz: 1.20,
      tilt: 0.18, roll: 0.10, spin: -0.0026, amb: 0.13, phase: 1.9,
      at: { left: '2vw' } },

    { name: 'jupiter', tex: texJupiter, rows: 21, extX: 1.12, extY: 1.12, sz: 1.10,
      tilt: 0.10, roll: 0.06, spin: 0.0052, amb: 0.19, phase: 2.7,
      at: { right: '-6vw' } },

    { name: 'mars', tex: texMars, rows: 16, extX: 1.16, extY: 1.16, sz: 1.05,
      tilt: 0.34, roll: -0.28, spin: 0.0040, amb: 0.15, phase: 0.9,
      at: { left: '3vw' } },

    /* Uranus rolls onto its side, so its rings stand up vertically. */
    { name: 'uranus', tex: texUranus, rows: 26, extX: 1.10, extY: 2.10, sz: 0.95,
      tilt: 0.52, roll: 1.5708, spin: -0.0031, amb: 0.20, phase: 3.4,
      rings: { inner: 1.44, outer: 2.02, gaps: [[1.63, 1.69]] },
      at: { right: '2vw' } },

    { name: 'neptune', tex: texNeptune, rows: 18, extX: 1.14, extY: 1.14, sz: 1.00,
      tilt: -0.30, roll: 0.22, spin: 0.0029, amb: 0.18, phase: 5.1,
      at: { left: '-4vw' } }
  ];

  /* Derive the glyph width that keeps each disk round. */
  for (var bi = 0; bi < BODIES.length; bi++) {
    var bd = BODIES[bi];
    bd.cols = Math.round(bd.rows * (bd.extX / bd.extY) / CHAR_ASPECT);
  }

  /* --- renderer ------------------------------------------- */
  function render(p, angle) {
    var W = p.cols, H = p.rows, extX = p.extX, extY = p.extY;

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
    var lx = L[0], ly = L[1], lz = L[2];
    var lastIdx = RAMP.length - 1;

    var rows = new Array(H), i, j;

    for (j = 0; j < H; j++) {
      var line = new Array(W);
      var sy = (1 - 2 * (j + 0.5) / H) * extY;

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
          sphere *= 0.58 + 0.42 * zs;                     // limb darkening
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
    for (var key in p.at) { if (p.at.hasOwnProperty(key)) pre.style[key] = p.at[key]; }
    host.appendChild(pre);
    live.push({ p: p, el: pre, drawn: null, top: 0, h: 0 });
  }
  document.body.insertBefore(host, document.body.firstChild);

  /* --- layout --------------------------------------------- */
  var count = 1;

  function measure() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var docH = document.documentElement.scrollHeight;
    host.style.height = docH + 'px';

    count = clamp(Math.round((docH - vh) / vh / 0.8), 1, live.length);

    var base = clamp(Math.min(vw, vh * 1.7) / 108, 6, 13);
    for (var i = 0; i < live.length; i++) {
      var s = live[i];
      if (i >= count) { s.el.style.display = 'none'; continue; }
      s.el.style.display = '';

      var fs = base * s.p.sz;
      s.el.style.fontSize = fs.toFixed(2) + 'px';
      s.h = s.p.rows * fs;
      /* Spread the bodies evenly down the document so roughly one is in
         view at a time; each then scrolls off with the rest of the page. */
      s.top = Math.round((i + 0.5) / count * docH - s.h / 2);
      s.el.style.top = s.top + 'px';
      s.drawn = null;                     // force a repaint at the new size
    }
  }

  function frame() {
    var y = window.scrollY || window.pageYOffset || 0;
    var vh = window.innerHeight;
    var near = y - vh * 0.5, far = y + vh * 1.5;

    for (var i = 0; i < count; i++) {
      var s = live[i];
      /* Only the bodies near the viewport are worth redrawing. */
      if (s.top + s.h < near || s.top > far) continue;

      var angle = s.p.phase + (reduced ? 0 : y * s.p.spin);
      /* Quantise so we only redraw when a glyph could actually change. */
      var q = Math.round(angle * 40) / 40;
      if (q !== s.drawn) {
        s.el.textContent = render(s.p, q);
        s.drawn = q;
      }
    }
  }

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; frame(); });
  }

  /* Exposed so the bodies can be inspected and tuned outside the page. */
  window.__cosmos = { render: render, bodies: BODIES };

  measure();
  frame();
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', function () { measure(); frame(); });
  /* Images and fonts settling changes the document height. */
  addEventListener('load', function () { measure(); frame(); });
})();
