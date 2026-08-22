#!/usr/bin/env python3
"""
Generates the static pages for msaunders.dev from a shared shell.

This is a convenience script, not a deploy step: it writes plain .html files
that are committed to the repo and served as-is by Cloudflare Pages.
Run it after editing NAV/FOOT or any page body below:

    python3 tools/build_pages.py
"""
import hashlib, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Projects is reachable from the About page and the project writeups, not the top nav.
TABS = [("About", "/"), ("Hobbies", "/hobbies/"), ("Gallery", "/gallery/")]

SOCIAL_SVG = {}
with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as f:
    _idx = f.read()
FOOT = re.search(r'<footer class="foot">.*?</footer>', _idx, re.S).group(0)


def crumb(trail):
    """Top-of-page breadcrumb. With the nav bar gone this is the only way back
    to the root from a sub-page, so every generated page carries one."""
    parts = ['<a href="/">msaunders.dev</a>']
    for label, href in trail:
        parts.append('<span class="crumb__sep">/</span>')
        parts.append('<a href="{}">{}</a>'.format(href, label) if href else "<span>{}</span>".format(label))
    return ('  <div class="wrap">\n'
            '    <nav class="crumb" aria-label="Breadcrumb">\n      '
            + "".join(parts)
            + '\n    </nav>\n  </div>')


ASSETS = ("css/site.css", "js/site.js", "js/cosmos.js")


def stamp_assets():
    """Append a content hash to every CSS/JS URL in every page.

    Without a version in the URL, a browser that cached an asset under the old
    long max-age keeps serving it against freshly deployed HTML until its TTL
    expires. Changing the header alone cannot evict what is already cached, but
    changing the URL can, so the hash is what actually rescues a stale visitor.
    """
    vers = {}
    for a in ASSETS:
        with open(os.path.join(ROOT, a), "rb") as fh:
            vers[a] = hashlib.md5(fh.read()).hexdigest()[:8]

    pat = re.compile(
        r'(?P<attr>href|src)="/(?P<path>' + "|".join(a.replace(".", r"\.") for a in ASSETS)
        + r')(?:\?v=[0-9a-f]+)?"')

    def sub(m):
        return '{}="/{}?v={}"'.format(m.group("attr"), m.group("path"), vers[m.group("path")])

    touched = 0
    for root, _dirs, files in os.walk(ROOT):
        if os.sep + ".git" in root or os.sep + "assets" in root:
            continue
        for f in files:
            if not f.endswith(".html"):
                continue
            full = os.path.join(root, f)
            with open(full, encoding="utf-8") as fh:
                before = fh.read()
            after = pat.sub(sub, before)
            if after != before:
                with open(full, "w", encoding="utf-8") as fh:
                    fh.write(after)
                touched += 1
    print("  stamped {} page(s): {}".format(
        touched, "  ".join("{}={}".format(a.split("/")[-1], v) for a, v in vers.items())))


def page(path, *, title, desc, body, canonical, trail=(), noindex=False):
    html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#08090b">
{'<meta name="robots" content="noindex">' if noindex else f'<link rel="canonical" href="{canonical}">'}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate icon" href="/favicon.png">
<meta property="og:type" content="website">
<meta property="og:url" content="{canonical}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<link rel="stylesheet" href="/css/site.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>

<main id="main">
{crumb(trail) if trail else ""}
{body}
</main>

{FOOT}

<script src="/js/cosmos.js" defer></script>
<script src="/js/site.js" defer></script>
<script>document.getElementById('yr').textContent=new Date().getFullYear();</script>
</body>
</html>
'''
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as fh:
        fh.write(html)
    print(f"  {path:36s} {len(html):>7,} bytes")


# ==================================================================
#  PROJECTS / index
# ==================================================================
PROJECTS = """
  <section class="hero">
    <div class="wrap">
      <p class="eyebrow"><b>//</b> Index</p>
      <h1 class="h-xl">Projects</h1>
      <p class="lede">
        Hardware and software I have designed, built, and shipped. Each entry gets a full
        writeup: what it does, how it works, what I learned.
      </p>
    </div>
  </section>

  <!-- ---------- SLOT 01 :: FEATURED ---------- -->
  <section class="section" id="godash">
    <div class="wrap">
      <p class="eyebrow"><b>01</b> Featured</p>
      <a class="card card--link" href="/projects/godash/" style="padding:0;border-color:var(--accent-line)">
        <div style="display:grid;grid-template-columns:1.15fr .85fr;gap:0" class="feat">
          <div style="padding:clamp(24px,3.4vw,38px)">
            <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:18px">
              <span class="status status--live"><i class="dot"></i>Live on the App Store</span>
              <span class="status"><i class="dot"></i>iOS 17+</span>
            </div>
            <h2 class="h-lg card__title" style="margin-bottom:12px">GoDash</h2>
            <p class="mono" style="color:var(--accent);font-size:14px;margin-bottom:16px">Your whole drive on one dashboard.</p>
            <p class="card__body" style="font-size:14.5px;max-width:52ch">
              Turns an iPhone on a car mount into an instrumented dash cam. Records a rolling
              10&#8209;minute loop, burns live telemetry into the footage, and runs Apple&nbsp;Maps and
              Apple&nbsp;Music in split modules so you never switch apps while driving.
            </p>
            <ul class="tags" style="margin-bottom:24px">
              <li class="tag tag--accent">Swift</li>
              <li class="tag tag--accent">SwiftUI</li>
              <li class="tag">AVFoundation</li>
              <li class="tag">CoreMotion</li>
              <li class="tag">MapKit</li>
              <li class="tag">MusicKit</li>
            </ul>
            <span class="btn btn--primary" style="pointer-events:none">Read the writeup <span class="btn__arr">&rarr;</span></span>
          </div>
          <div style="border-left:1px solid var(--line);background:var(--bg-3);display:grid;place-items:center;padding:clamp(20px,3vw,32px);overflow:hidden">
            <img src="/img/godash/card-hero.jpg" width="900" height="787" loading="lazy" decoding="async"
                 alt="Two iPhones running GoDash: one showing the music module over a live speed and telemetry readout, the other showing turn-by-turn navigation"
                 style="border:1px solid var(--line);width:100%;max-width:420px">
          </div>
        </div>
      </a>
    </div>
  </section>

  <!-- ---------- SLOTS 02 / 03 ---------- -->
  <section class="section">
    <div class="wrap">
      <p class="eyebrow"><b>02-03</b> Archive</p>
      <div class="cols-2">

        <a class="card card--link" href="/projects/observatory/">
          <span class="card__idx">[ 02 ] &nbsp;2023</span>
          <h2 class="card__title h-md">Mobile Computerized Automated Observatory</h2>
          <p class="card__body">
            Newtonian reflector on an aluminium extrusion frame with a 4.5&#8209;inch spherical
            primary. A Raspberry&nbsp;Pi and base motors track celestial objects across the sky.
            269&times; magnification, car&#8209;portable, hour&#8209;long exposures.
          </p>
          <ul class="tags" style="margin-bottom:18px">
            <li class="tag">C</li><li class="tag">Python</li><li class="tag">Embedded</li>
            <li class="tag">Tesseract</li><li class="tag">Linux</li>
          </ul>
          <span class="status status--wip"><i class="dot"></i>Writeup in progress</span>
        </a>

        <a class="card card--link" href="/projects/apt-decoder/">
          <span class="card__idx">[ 03 ] &nbsp;2023</span>
          <h2 class="card__title h-md">NOAA Satellite APT Signal Decoder</h2>
          <p class="card__body">
            Custom ground station and quadrifilar helix antenna. Listens for APT downlinks from
            passing NOAA weather satellites, captures the pass automatically, and decodes it into
            visible and infrared images of Earth.
          </p>
          <ul class="tags" style="margin-bottom:18px">
            <li class="tag">C</li><li class="tag">Python</li><li class="tag">SDR</li>
            <li class="tag">Networking</li><li class="tag">Soldering</li>
          </ul>
          <span class="status status--wip"><i class="dot"></i>Writeup in progress</span>
        </a>

      </div>

      <div class="note" style="margin-top:28px">
        <span class="note__label">More coming</span>
        More builds, including the solar-powered Deployable Radio Beacon, are being written up.
      </div>
    </div>
  </section>

  <style>
    @media (max-width: 860px) { .feat { grid-template-columns: 1fr !important; } .feat > div:last-child { border-left: 0 !important; border-top: 1px solid var(--line); } }
  </style>
"""


# ==================================================================
#  PROJECTS / GoDash
# ==================================================================
GODASH = """

  <section class="hero" style="padding-top:28px">
    <div class="wrap">
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:22px">
        <span class="status status--live"><i class="dot"></i>Live on the App Store</span>
        <span class="status"><i class="dot"></i>Requires iOS 17+</span>
        <span class="status"><i class="dot"></i>Actively developed</span>
      </div>
      <h1 class="h-xl" style="margin-bottom:14px">GoDash</h1>
      <p class="hero__role">Your whole drive on one dashboard.</p>
      <p class="lede">
        An iOS app I designed and built. It turns an iPhone in a hands-free car mount into a dash
        cam that also handles navigation, music, and live vehicle telemetry, without switching
        apps at 70&nbsp;mph.
      </p>
      <div class="btn-row" style="margin-top:30px">
        <a class="btn btn--primary" href="https://apps.apple.com/us/app/godash-dashcam-app/id6792043434" target="_blank" rel="noopener">Download on the App Store <span class="btn__arr">&rarr;</span></a>
        <a class="btn" href="https://godash.us/" target="_blank" rel="noopener">godash.us <span class="btn__arr">&rarr;</span></a>
      </div>
    </div>
  </section>

  <!-- ---------- SPEC ---------- -->
  <section class="section section--tight">
    <div class="wrap">
      <div class="stats">
        <div class="stat"><div class="stat__n">10 min</div><div class="stat__l">Rolling loop buffer</div></div>
        <div class="stat"><div class="stat__n">1080p</div><div class="stat__l">Capture resolution</div></div>
        <div class="stat"><div class="stat__n">5</div><div class="stat__l">Telemetry channels</div></div>
        <div class="stat"><div class="stat__n">2</div><div class="stat__l">Simultaneous modules</div></div>
        <div class="stat"><div class="stat__n">0</div><div class="stat__l">Data leaving device</div></div>
      </div>
    </div>
  </section>

  <!-- ---------- OVERVIEW ---------- -->
  <section class="section">
    <div class="wrap">
      <div class="split">
        <div class="split__label"><p class="eyebrow"><b>01</b> Overview</p></div>
        <div>
          <div class="prose">
            <p>
              A drive normally involves three or four apps fighting for the same screen: a dash cam
              in the background, maps in the foreground, music underneath, none of them aware of each
              other. GoDash collapses that into one interface built around a single rule:
              <strong>nothing on screen should require more than a glance.</strong>
            </p>
            <p>
              The rear camera records continuously into a rolling buffer. Navigation and music sit in
              half-screen modules that can be open at once, so what you need next is already visible.
              Under both, a persistent readout shows speed, g-force, heading, altitude, and trip
              distance, sampled live and burned into saved footage.
            </p>
            <p>
              Free with basic recording. <strong>GoDash Pro</strong> unlocks higher resolution, longer
              loops, the telemetry overlay, and crash detection.
            </p>
          </div>

          <dl class="kv" style="margin-top:34px">
            <dt>Role</dt><dd>Sole designer and developer</dd>
            <dt>Platform</dt><dd>iPhone, iOS 17+</dd>
            <dt>Language</dt><dd><span class="mono">Swift</span> &middot; <span class="mono">SwiftUI</span></dd>
            <dt>Frameworks</dt><dd>AVFoundation &middot; CoreMotion &middot; CoreLocation &middot; MapKit &middot; MusicKit &middot; Photos</dd>
            <dt>Status</dt><dd>Shipped, in active development</dd>
            <dt>Privacy</dt><dd>Recordings, telemetry, and account details stay on device</dd>
          </dl>
        </div>
      </div>
    </div>
  </section>

  <!-- ---------- FEATURES ---------- -->
  <section class="section">
    <div class="wrap">
      <div class="split">
        <div class="split__label"><p class="eyebrow"><b>02</b> Features</p></div>
        <div class="cols-2" style="gap:1px;background:var(--line);border:1px solid var(--line)">
          <div class="card" style="border:0">
            <span class="card__idx">[ REC ]</span>
            <h3 class="card__title h-md">Loop recording</h3>
            <p class="card__body">
              A rolling buffer holds up to ten minutes of driving. One tap writes it to the device
              as a permanent clip. No scrubbing, no file management, no waiting until you get home.
            </p>
          </div>
          <div class="card" style="border:0">
            <span class="card__idx">[ TELEM ]</span>
            <h3 class="card__title h-md">Live telemetry overlay</h3>
            <p class="card__body">
              Speed, g-force, heading, altitude, and trip distance are sampled while you drive and
              composited onto saved clips, so the footage carries its own context.
            </p>
          </div>
          <div class="card" style="border:0">
            <span class="card__idx">[ NAV ]</span>
            <h3 class="card__title h-md">Turn-by-turn navigation</h3>
            <p class="card__body">
              Apple&nbsp;Maps directions run in a module, not another app. Full-height for the route,
              collapsed to one instruction card when you do not need it.
            </p>
          </div>
          <div class="card" style="border:0">
            <span class="card__idx">[ AUDIO ]</span>
            <h3 class="card__title h-md">Apple Music, in place</h3>
            <p class="card__body">
              Browse, play, and skip without leaving the recording session. Pairs with navigation
              so both are on screen at once.
            </p>
          </div>
          <div class="card" style="border:0">
            <span class="card__idx">[ SAFETY ]</span>
            <h3 class="card__title h-md">Crash detection</h3>
            <p class="card__body">
              Motion thresholds for collisions and hard braking preserve the footage from before,
              during, and after the event, saved without you touching the phone.
            </p>
          </div>
          <div class="card" style="border:0">
            <span class="card__idx">[ LIB ]</span>
            <h3 class="card__title h-md">Clips &amp; export</h3>
            <p class="card__body">
              Saved clips are organised chronologically, with in-app playback and one-step export
              to Photos.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ---------- HOW IT WORKS ---------- -->
  <section class="section">
    <div class="wrap">
      <div class="split">
        <div class="split__label"><p class="eyebrow"><b>03</b> How it works</p></div>
        <div class="prose">
          <h3>The recording pipeline</h3>
          <p>
            Capture runs off the rear camera through AVFoundation into a fixed-length ring of video
            segments. Old segments are discarded as new ones are written, so storage stays bounded no
            matter how long the drive is. A save stitches the ring into one clip: the ten minutes
            leading up to the moment you wanted them.
          </p>

          <h3>Telemetry</h3>
          <p>
            CoreMotion supplies acceleration for g-force, CoreLocation supplies speed, heading, and
            altitude. Samples are timestamped against the capture clock so the overlay lines up with
            the frame it describes instead of drifting across a long clip.
          </p>

          <h3>The module system</h3>
          <p>
            The interface is a stack of resizable modules, not a set of screens. Navigation and music
            each render at full or compact height, and any pairing is reachable in one gesture. This is
            the part I have iterated on most. The target: a driver can restore the layout they want by
            feel, without reading the screen.
          </p>

          <h3>Crash detection</h3>
          <p>
            A motion threshold on sustained deceleration and impact-scale acceleration flags an
            event. The buffer around it is locked and written out immediately, before the ring can
            overwrite the segments that matter.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- ---------- SCREENS ---------- -->
  <section class="section">
    <div class="wrap">
      <p class="eyebrow"><b>04</b> In the car</p>
      <p class="lede" style="margin-bottom:32px">
        Shot on a hands-free mount during real drives. Select an image to enlarge.
      </p>
      <div class="shots">
        <figure class="shot" data-zoom>
          <img src="/img/godash/incar-home.jpg" width="640" height="1385" loading="lazy" decoding="async" alt="GoDash home layout with navigation and music modules on a dash mount">
          <figcaption>Home: maps + music</figcaption>
        </figure>
        <figure class="shot" data-zoom>
          <img src="/img/godash/incar-maps-music.jpg" width="640" height="1385" loading="lazy" decoding="async" alt="Split view showing turn-by-turn navigation above the music player">
          <figcaption>Split: navigation + player</figcaption>
        </figure>
        <figure class="shot" data-zoom>
          <img src="/img/godash/incar-maps-telemetry.jpg" width="640" height="1385" loading="lazy" decoding="async" alt="Navigation module above the live telemetry readout showing speed and g-force">
          <figcaption>Navigation + telemetry</figcaption>
        </figure>
        <figure class="shot" data-zoom>
          <img src="/img/godash/incar-music-telemetry.jpg" width="640" height="1385" loading="lazy" decoding="async" alt="Music module above the live telemetry readout">
          <figcaption>Music + telemetry</figcaption>
        </figure>
        <figure class="shot" data-zoom>
          <img src="/img/godash/incar-maps-minimusic.jpg" width="640" height="1385" loading="lazy" decoding="async" alt="Full height navigation with the music module collapsed to a compact bar">
          <figcaption>Full nav, compact music</figcaption>
        </figure>
        <figure class="shot" data-zoom>
          <img src="/img/godash/incar-minimaps-music.jpg" width="640" height="1385" loading="lazy" decoding="async" alt="Compact navigation instruction card above a full height music module">
          <figcaption>Compact nav, full music</figcaption>
        </figure>
        <figure class="shot" data-zoom>
          <img src="/img/godash/screen-clips.jpg" width="640" height="1385" loading="lazy" decoding="async" alt="Saved clips library listed chronologically">
          <figcaption>Clips library</figcaption>
        </figure>
        <figure class="shot" data-zoom>
          <img src="/img/godash/screen-telemetry-overlay.jpg" width="640" height="1385" loading="lazy" decoding="async" alt="Saved clip playing back with speed, g-force, heading and altitude burned into the frame">
          <figcaption>Saved clip: overlay</figcaption>
        </figure>
      </div>
    </div>
  </section>

  <!-- ---------- PROMO ---------- -->
  <section class="section">
    <div class="wrap">
      <p class="eyebrow"><b>05</b> Press kit</p>
      <div class="promos">
        <img src="/img/godash/promo-telemetry.jpg" width="800" height="1000" loading="lazy" decoding="async" alt="GoDash promotional image highlighting the live telemetry readout">
        <img src="/img/godash/promo-music.jpg" width="800" height="1000" loading="lazy" decoding="async" alt="GoDash promotional image highlighting the music module">
        <img src="/img/godash/promo-clips.jpg" width="800" height="1000" loading="lazy" decoding="async" alt="GoDash promotional image highlighting the saved clips library">
      </div>
    </div>
  </section>

  <!-- ---------- GET IT ---------- -->
  <section class="section">
    <div class="wrap">
      <div class="card" style="border-color:var(--accent-line);display:grid;grid-template-columns:1fr auto;gap:clamp(20px,4vw,44px);align-items:center" id="get">
        <div>
          <p class="eyebrow" style="margin-bottom:16px"><b>&rarr;</b> Get GoDash</p>
          <h2 class="h-lg" style="margin-bottom:12px">Free on the App Store</h2>
          <p class="muted" style="font-size:14.5px;max-width:46ch;margin-bottom:22px">
            Basic recording is free. GoDash Pro unlocks higher resolution, longer loops, telemetry
            overlays, and crash detection. Requires iOS&nbsp;17 or later.
          </p>
          <div class="btn-row">
            <a class="btn btn--primary" href="https://apps.apple.com/us/app/godash-dashcam-app/id6792043434" target="_blank" rel="noopener">App Store <span class="btn__arr">&rarr;</span></a>
            <a class="btn" href="https://godash.us/" target="_blank" rel="noopener">godash.us <span class="btn__arr">&rarr;</span></a>
          </div>
        </div>
        <div style="text-align:center">
          <img src="/img/godash/qr-appstore.jpg" width="320" height="320" loading="lazy" decoding="async"
               alt="QR code linking to GoDash on the App Store"
               style="width:132px;border:1px solid var(--line-2)">
          <p class="mono dim" style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;margin-top:10px">Scan to install</p>
        </div>
      </div>
    </div>
  </section>

  <div class="wrap">
    <div class="pager">
      <a class="btn" href="/projects/"><span class="btn__arr">&larr;</span> All projects</a>
      <a class="btn" href="/projects/observatory/">Next: Observatory <span class="btn__arr">&rarr;</span></a>
    </div>
  </div>

  <style>
    @media (max-width: 620px) { #get { grid-template-columns: 1fr !important; } }
  </style>
"""


# ==================================================================
#  PROJECTS / Observatory (slot 02)
# ==================================================================
OBSERVATORY = """

  <section class="hero" style="padding-top:28px">
    <div class="wrap">
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:22px">
        <span class="status status--wip"><i class="dot"></i>Full writeup in progress</span>
        <span class="status"><i class="dot"></i>Built 2023</span>
      </div>
      <h1 class="h-xl" style="margin-bottom:14px">Mobile Computerized<br>Automated Observatory</h1>
      <p class="hero__role">A car-portable Newtonian reflector that finds and tracks the sky on its own.</p>
      <p class="lede">
        A ground-up telescope build: aluminium extrusion frame, 4.5&#8209;inch spherical primary
        mirror, motorised base, and a Raspberry&nbsp;Pi running plate-solving software that holds a
        target centred through hour-long exposures.
      </p>
    </div>
  </section>

  <section class="section section--tight">
    <div class="wrap">
      <div class="stats">
        <div class="stat"><div class="stat__n">4.5&Prime;</div><div class="stat__l">Spherical primary</div></div>
        <div class="stat"><div class="stat__n">269&times;</div><div class="stat__l">Max magnification</div></div>
        <div class="stat"><div class="stat__n">1.6&deg;</div><div class="stat__l">Field of view</div></div>
        <div class="stat"><div class="stat__n">24 MP</div><div class="stat__l">6000 &times; 4000 sensor</div></div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="split">
        <div class="split__label"><p class="eyebrow"><b>01</b> Overview</p></div>
        <div>
          <div class="prose">
            <p>
              The goal: an instrument capable of serious deep-sky imaging that still fits in a car
              and can be set up by one person in the dark. The optical tube is a Newtonian reflector on
              a custom aluminium extrusion frame, chosen for stiffness per kilogram and because the
              geometry can be re-squared with a hex key instead of rebuilt.
            </p>
            <p>
              Tracking runs on <strong>Pi&nbsp;Finder</strong> on a Raspberry&nbsp;Pi, driving motors
              in the base. Once a target is acquired the mount compensates for the Earth's rotation,
              which is what makes multi-hour exposures possible without the field smearing into arcs.
            </p>
            <p>
              Imaging goes through a Sony&nbsp;ZV&#8209;E10: a 6000&nbsp;&times;&nbsp;4000 frame with
              exposure stacking over long sessions. Tesseract reads instrument displays in the capture
              pipeline.
            </p>
          </div>

          <dl class="kv" style="margin-top:34px">
            <dt>Role</dt><dd>Design, fabrication, and software</dd>
            <dt>Optics</dt><dd>Newtonian reflector, 4.5&#8209;inch spherical primary</dd>
            <dt>Frame</dt><dd>Aluminium extrusion, field-serviceable</dd>
            <dt>Mount</dt><dd>Motorised base, Raspberry Pi controlled</dd>
            <dt>Camera</dt><dd>Sony ZV&#8209;E10, 6000 &times; 4000, multi-hour exposures</dd>
            <dt>Stack</dt><dd><span class="mono">C</span> &middot; <span class="mono">Python</span> &middot; Embedded &middot; Tesseract &middot; Linux</dd>
            <dt>Transport</dt><dd>Fits in a car, single-person setup</dd>
          </dl>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="note">
        <span class="note__label">Slot reserved</span>
        The full build log is being written: mirror figuring, frame geometry, drive calibration,
        first-light images. Astrophotography from this scope will appear in the
        <a href="/gallery/">Gallery</a>.
      </div>
    </div>
  </section>

  <div class="wrap">
    <div class="pager">
      <a class="btn" href="/projects/godash/"><span class="btn__arr">&larr;</span> GoDash</a>
      <a class="btn" href="/projects/apt-decoder/">Next: APT Decoder <span class="btn__arr">&rarr;</span></a>
    </div>
  </div>
"""


# ==================================================================
#  PROJECTS / APT decoder (slot 03)
# ==================================================================
APT = """

  <section class="hero" style="padding-top:28px">
    <div class="wrap">
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:22px">
        <span class="status status--wip"><i class="dot"></i>Full writeup in progress</span>
        <span class="status"><i class="dot"></i>Built 2023</span>
      </div>
      <h1 class="h-xl" style="margin-bottom:14px">NOAA Satellite<br>APT Signal Decoder</h1>
      <p class="hero__role">Catches weather satellite passes and turns them into pictures of Earth.</p>
      <p class="lede">
        A purpose-built receiver and quadrifilar helix antenna. It listens for APT downlinks from
        passing NOAA weather satellites, starts capturing the moment a pass begins, and decodes the
        audio into visible and infrared imagery.
      </p>
    </div>
  </section>

  <section class="section section--tight">
    <div class="wrap">
      <div class="stats">
        <div class="stat"><div class="stat__n">APT</div><div class="stat__l">Automatic picture transmission</div></div>
        <div class="stat"><div class="stat__n">QFH</div><div class="stat__l">Quadrifilar helix antenna</div></div>
        <div class="stat"><div class="stat__n">SDR</div><div class="stat__l">Software defined radio</div></div>
        <div class="stat"><div class="stat__n">Auto</div><div class="stat__l">Unattended pass capture</div></div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="split">
        <div class="split__label"><p class="eyebrow"><b>01</b> Overview</p></div>
        <div>
          <div class="prose">
            <p>
              NOAA's polar-orbiting weather satellites broadcast an analogue APT signal continuously
              as they pass overhead. Anyone with the right antenna can receive it. The hard parts are
              antenna polarisation, catching the pass at the right moment, and sampling cleanly enough
              that the decoder has something to work with.
            </p>
            <p>
              The antenna is a <strong>quadrifilar helix</strong>, built for circular polarisation and
              a wide hemispherical pattern so a satellite stays in the beam horizon to horizon without
              steering. Behind it, a Raspberry&nbsp;Pi and an SDR sit in a 3D-printed enclosure that
              handles capture unattended.
            </p>
            <p>
              On signal detect the receiver starts recording and processes at the correct sample
              rate. The audio goes to <strong>WXtoImg</strong>, which decodes it into imagery, overlays
              coastlines and boundaries, and combines sensor channels into visible and infrared
              composites.
            </p>
          </div>

          <dl class="kv" style="margin-top:34px">
            <dt>Role</dt><dd>Design, fabrication, and software</dd>
            <dt>Antenna</dt><dd>Custom quadrifilar helix, circular polarisation</dd>
            <dt>Receiver</dt><dd>Software defined radio + Raspberry Pi</dd>
            <dt>Enclosure</dt><dd>3D printed, weather-tolerant</dd>
            <dt>Capture</dt><dd>Automatic trigger on signal detect, correct-rate resampling</dd>
            <dt>Decoding</dt><dd>WXtoImg, landmass overlay, visible / IR composites</dd>
            <dt>Stack</dt><dd><span class="mono">C</span> &middot; <span class="mono">Python</span> &middot; Embedded &middot; Linux &middot; Networking &middot; Soldering</dd>
          </dl>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="note">
        <span class="note__label">Slot reserved</span>
        The full writeup is being written: antenna geometry and SWR tuning, pass-prediction and
        trigger logic, and a set of decoded passes.
      </div>
    </div>
  </section>

  <div class="wrap">
    <div class="pager">
      <a class="btn" href="/projects/observatory/"><span class="btn__arr">&larr;</span> Observatory</a>
      <a class="btn" href="/projects/">All projects <span class="btn__arr">&rarr;</span></a>
    </div>
  </div>
"""


# ==================================================================
#  HOBBIES  (placeholder, content pending)
# ==================================================================
HOBBIES = """
  <section class="hero">
    <div class="wrap">
      <p class="eyebrow"><b>//</b> Off the clock</p>
      <h1 class="h-xl">Hobbies</h1>
      <p class="lede">
        What I do when I am not writing code or studying. Most of it feeds back into what I build.
      </p>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="empty">
        <div class="empty__icon">&hellip;</div>
        <h2>Section under construction</h2>
        <p>
          This page is reserved. The slots below are marked out. Photographs will live in the
          <a href="/gallery/">Gallery</a>.
        </p>
      </div>

      <div class="cols-3" style="margin-top:30px">
        <div class="card"><span class="card__idx">[ 01 ]</span><h2 class="card__title h-md">Astrophotography</h2><p class="card__body">Deep-sky imaging, long exposures, and the gear behind them.</p><span class="status status--soon"><i class="dot"></i>Pending</span></div>
        <div class="card"><span class="card__idx">[ 02 ]</span><h2 class="card__title h-md">Aerospace</h2><p class="card__body">Launches, orbital mechanics, and the programs pushing the boundary.</p><span class="status status--soon"><i class="dot"></i>Pending</span></div>
        <div class="card"><span class="card__idx">[ 03 ]</span><h2 class="card__title h-md">Computer building</h2><p class="card__body">Custom systems, thermals, and the newest silicon.</p><span class="status status--soon"><i class="dot"></i>Pending</span></div>
        <div class="card"><span class="card__idx">[ 04 ]</span><h2 class="card__title h-md">Camping &amp; hiking</h2><p class="card__body">Dark-sky sites, long trails, and what fits in a pack.</p><span class="status status--soon"><i class="dot"></i>Pending</span></div>
        <div class="card"><span class="card__idx">[ 05 ]</span><h2 class="card__title h-md">Rock climbing</h2><p class="card__body">Problem solving with consequences.</p><span class="status status--soon"><i class="dot"></i>Pending</span></div>
        <div class="card"><span class="card__idx">[ 06 ]</span><h2 class="card__title h-md">Travel, music &amp; film</h2><p class="card__body">Places worth the drive, records worth the shelf, films worth rewatching.</p><span class="status status--soon"><i class="dot"></i>Pending</span></div>
      </div>
    </div>
  </section>
"""


# ==================================================================
#  GALLERY  (placeholder, awaiting media)
# ==================================================================
GALLERY = """
  <section class="hero">
    <div class="wrap">
      <p class="eyebrow"><b>//</b> Images</p>
      <h1 class="h-xl">Gallery</h1>
      <p class="lede">
        Astrophotography, hardware builds, and whatever else is worth looking at. The grid is
        wired up and waiting on files.
      </p>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="empty">
        <div class="empty__icon">&#9633;</div>
        <h2>No images yet</h2>
        <p>
          Drop image files into <span class="mono" style="color:var(--fg-2)">/img/gallery/</span> and add a
          <span class="mono" style="color:var(--fg-2)">&lt;figure class="shot" data-zoom&gt;</span> entry to
          this page. The lightbox and responsive grid already work.
        </p>
      </div>

      <!-- Template entry. Duplicate one of these per image.
      <div class="shots" style="margin-top:30px">
        <figure class="shot" data-zoom>
          <img src="/img/gallery/example.jpg" width="1200" height="800" loading="lazy" decoding="async" alt="Describe the image">
          <figcaption>Caption, date</figcaption>
        </figure>
      </div>
      -->
    </div>
  </section>
"""


# ==================================================================
#  404
# ==================================================================
NOTFOUND = """
  <section class="hero">
    <div class="wrap">
      <p class="eyebrow"><b>404</b> Not found</p>
      <h1 class="h-xl">Signal lost<span class="caret">_</span></h1>
      <p class="lede">That page does not exist, or it moved.</p>
      <div class="btn-row" style="margin-top:30px">
        <a class="btn btn--primary" href="/">Back to start <span class="btn__arr">&rarr;</span></a>
        <a class="btn" href="/projects/">Projects <span class="btn__arr">&rarr;</span></a>
      </div>
    </div>
  </section>
"""


# ==================================================================
#  BUILD
# ==================================================================
if __name__ == "__main__":
    print("building pages...")
    page("projects/index.html", title="Projects / Matthew Saunders",
         desc="Hardware and software projects by Matthew Saunders: GoDash iOS dash cam, an automated observatory, and a NOAA APT satellite ground station.",
         body=PROJECTS, canonical="https://msaunders.dev/projects/", trail=[("Projects", None)])

    page("projects/godash/index.html", title="GoDash / Matthew Saunders",
         desc="GoDash is an iOS dash cam app with a 10-minute loop buffer, live telemetry overlay, crash detection, and split-screen navigation and music modules.",
         body=GODASH, canonical="https://msaunders.dev/projects/godash/", trail=[("Projects", "/projects/"), ("GoDash", None)])

    page("projects/observatory/index.html", title="Mobile Computerized Automated Observatory / Matthew Saunders",
         desc="A car-portable Newtonian reflector with a motorised Raspberry Pi driven base that tracks celestial objects for hour-long exposures.",
         body=OBSERVATORY, canonical="https://msaunders.dev/projects/observatory/", trail=[("Projects", "/projects/"), ("Observatory", None)])

    page("projects/apt-decoder/index.html", title="NOAA Satellite APT Decoder / Matthew Saunders",
         desc="A custom SDR ground station and quadrifilar helix antenna that automatically captures and decodes APT downlinks from NOAA weather satellites.",
         body=APT, canonical="https://msaunders.dev/projects/apt-decoder/", trail=[("Projects", "/projects/"), ("APT Decoder", None)])

    page("hobbies/index.html", title="Hobbies / Matthew Saunders",
         desc="Astrophotography, aerospace, computer building, camping, hiking, climbing, music, and film.",
         body=HOBBIES, canonical="https://msaunders.dev/hobbies/", trail=[("Hobbies", None)])

    page("gallery/index.html", title="Gallery / Matthew Saunders",
         desc="Astrophotography and hardware build photography by Matthew Saunders.",
         body=GALLERY, canonical="https://msaunders.dev/gallery/", trail=[("Gallery", None)])

    page("404.html", title="404 / Matthew Saunders",
         desc="Page not found.", body=NOTFOUND,
         canonical="https://msaunders.dev/404.html", noindex=True, trail=[("404", None)])
    stamp_assets()
    print("done.")
