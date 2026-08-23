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
TABS = [("About", "/"), ("Misc", "/misc/")]

# Misc is finished enough to build but not to show, so /misc/ serves the holding
# screen instead and carries noindex. The real body is still MISC below and is
# still the thing this script would emit: flip this to True and rebuild to
# publish it (and put /misc/ back in sitemap.xml).
MISC_LIVE = False

# Same idea for the projects index: two projects do not need a page of their own
# yet, so /projects/ is not emitted and the writeups link back to the About page
# instead. The PROJECTS body below is untouched. Flip this to True and rebuild to
# bring the page back (and put /projects/ back in sitemap.xml).
PROJECTS_LIVE = False

# Where a writeup's "back" button and breadcrumb point, given the above.
PROJ_CRUMB = [("Projects", "/projects/")] if PROJECTS_LIVE else []
BACKLINK = ('<a class="btn" href="/projects/">All projects</a>' if PROJECTS_LIVE
            else '<a class="btn" href="/">Back to start</a>')
PROJECTS_BTN = '<a class="btn" href="/projects/">Projects</a>' if PROJECTS_LIVE else ''

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


ASSETS = ("css/site.css", "js/site.js", "js/cosmos.js",
          "favicon.svg", "favicon.png")


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
    body = body.replace("__BACKLINK__", BACKLINK)
    # When there is no index to link to, take the whole line with it rather
    # than leaving a blank one inside the button row.
    body = (body.replace("__PROJECTS_BTN__", PROJECTS_BTN) if PROJECTS_BTN
            else re.sub(r"\n *__PROJECTS_BTN__", "", body))
    html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#000000">
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
      <h1 class="h-xl">Projects</h1>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="pstack">

        <!-- ---------- GoDash ---------- -->
        <a class="card card--link pcard" href="/projects/godash/" id="godash">
          <div class="pcard__grid">
            <div class="pcard__main">
              <h2 class="h-lg card__title">GoDash</h2>
              <p class="card__body">
                Turns an iPhone on a car mount into an instrumented dash cam. Records a rolling
                10&#8209;minute loop, burns live telemetry into the footage, and runs Apple&nbsp;Maps and
                Apple&nbsp;Music in split modules so you never switch apps while driving.
              </p>
            </div>
            <div class="pcard__media">
              <img src="/img/godash/card-hero.jpg" width="900" height="787" loading="lazy" decoding="async"
                   alt="Two iPhones running GoDash: one showing the music module over a live speed and telemetry readout, the other showing turn-by-turn navigation">
            </div>
          </div>
        </a>

        <!-- ---------- Observatory ---------- -->
        <a class="card card--link pcard" href="/projects/observatory/" id="observatory">
          <div class="pcard__grid pcard__grid--solo">
            <div class="pcard__main">
              <h2 class="h-lg card__title">Mobile Computerized Automated Observatory</h2>
              <p class="card__body">
                Newtonian reflector on an aluminium extrusion frame with a 4.5&#8209;inch spherical
                primary. A Raspberry&nbsp;Pi and base motors track celestial objects across the sky.
                269&times; magnification, car&#8209;portable, hour&#8209;long exposures.
              </p>
            </div>
          </div>
        </a>

      </div>

      <div class="note" style="margin-top:28px">
        <span class="note__label">More coming</span>
        More builds, including the solar-powered Deployable Radio Beacon, are being written up.
      </div>
    </div>
  </section>
"""


# ==================================================================
#  PROJECTS / GoDash
# ==================================================================
GODASH = """

  <section class="hero" style="padding-top:28px">
    <div class="wrap">
      <h1 class="h-xl">GoDash</h1>
      <p class="lede">
        An iOS app I designed and built. It turns an iPhone in a hands-free car mount into a dash
        cam that also handles navigation, music, and live vehicle telemetry, without switching
        apps at 70&nbsp;mph.
      </p>
      <div class="btn-row" style="margin-top:30px">
        <a class="btn" href="https://apps.apple.com/us/app/godash-dashcam-app/id6792043434" target="_blank" rel="noopener">App Store</a>
        <a class="btn" href="https://godash.us/" target="_blank" rel="noopener">Website</a>
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
              Capture runs off the rear camera through AVFoundation into a fixed-length ring of video
              segments. Old segments are discarded as new ones are written, so storage stays bounded no
              matter how long the drive is. A save stitches the ring into one clip: the ten minutes
              leading up to the moment you wanted them.
            </p>
            <p>
              CoreMotion supplies acceleration for g-force, CoreLocation supplies speed, heading, and
              altitude. Samples are timestamped against the capture clock so the overlay lines up with
              the frame it describes instead of drifting across a long clip.
            </p>
            <p>
              The interface is a stack of resizable modules, not a set of screens. Navigation and music
              each render at full or compact height, and any pairing is reachable in one gesture. This is
              the part I have iterated on most. The target: a driver can restore the layout they want by
              feel, without reading the screen.
            </p>
            <p>
              A motion threshold on sustained deceleration and impact-scale acceleration flags an
              event. The buffer around it is locked and written out immediately, before the ring can
              overwrite the segments that matter.
            </p>
          </div>

        </div>
      </div>
    </div>
  </section>

  <!-- ---------- GALLERY ---------- -->
  <section class="section">
    <div class="wrap">
      <div class="split">
        <div class="split__label"><p class="eyebrow"><b>02</b> Gallery</p></div>
        <div>
          <div class="shots">
            <figure class="shot" data-zoom>
              <img src="/img/godash/incar-home.jpg" width="640" height="1385" loading="lazy" decoding="async" alt="GoDash home layout with navigation and music modules on a dash mount">
            </figure>
            <figure class="shot" data-zoom>
              <img src="/img/godash/incar-maps-music.jpg" width="640" height="1385" loading="lazy" decoding="async" alt="Split view showing turn-by-turn navigation above the music player">
            </figure>
            <figure class="shot" data-zoom>
              <img src="/img/godash/incar-maps-telemetry.jpg" width="640" height="1385" loading="lazy" decoding="async" alt="Navigation module above the live telemetry readout showing speed and g-force">
            </figure>
            <figure class="shot" data-zoom>
              <img src="/img/godash/incar-music-telemetry.jpg" width="640" height="1385" loading="lazy" decoding="async" alt="Music module above the live telemetry readout">
            </figure>
            <figure class="shot" data-zoom>
              <img src="/img/godash/incar-maps-minimusic.jpg" width="640" height="1385" loading="lazy" decoding="async" alt="Full height navigation with the music module collapsed to a compact bar">
            </figure>
            <figure class="shot" data-zoom>
              <img src="/img/godash/incar-minimaps-music.jpg" width="640" height="1385" loading="lazy" decoding="async" alt="Compact navigation instruction card above a full height music module">
            </figure>
            <figure class="shot" data-zoom>
              <img src="/img/godash/screen-clips.jpg" width="640" height="1385" loading="lazy" decoding="async" alt="Saved clips library listed chronologically">
            </figure>
            <figure class="shot" data-zoom>
              <img src="/img/godash/screen-telemetry-overlay.jpg" width="640" height="1385" loading="lazy" decoding="async" alt="Saved clip playing back with speed, g-force, heading and altitude burned into the frame">
            </figure>
          </div>
        </div>
      </div>
    </div>
  </section>

  <div class="wrap">
    <div class="pager">
      __BACKLINK__
      <a class="btn" href="/projects/observatory/">Next: Observatory</a>
    </div>
  </div>
"""


# ==================================================================
#  PROJECTS / Observatory (slot 02)
# ==================================================================
OBSERVATORY = """

  <section class="hero" style="padding-top:28px">
    <div class="wrap">
      <h1 class="h-xl">Mobile Computerized<br>Automated Observatory</h1>
      <p class="lede">
        A ground-up telescope build: aluminium extrusion frame, 4.5&#8209;inch spherical primary
        mirror, motorised base, and a Raspberry&nbsp;Pi running plate-solving software that holds a
        target centred through hour-long exposures.
      </p>
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
              The goal: an instrument capable of serious deep-sky imaging that still fits in a car
              and can be set up by one person in the dark. The optical tube is a Newtonian reflector on
              a custom aluminium extrusion frame, chosen for stiffness per kilogram and because the
              geometry can be re-squared with a hex key instead of rebuilt. The 4.5&#8209;inch spherical
              primary reaches 269&times; magnification across a 1.6&deg; field.
            </p>
            <p>
              Tracking runs on <strong>Pi&nbsp;Finder</strong> on a Raspberry&nbsp;Pi, driving motors
              in the base. Once a target is acquired the mount compensates for the Earth's rotation,
              which is what makes multi-hour exposures possible without the field smearing into arcs.
            </p>
            <p>
              Imaging goes through a Sony&nbsp;ZV&#8209;E10: a 6000&nbsp;&times;&nbsp;4000 frame with
              exposure stacking over long sessions. Tesseract reads instrument displays in the capture
              pipeline. The full build log, covering mirror figuring, frame geometry, drive
              calibration, and first light, is still being written.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ---------- GALLERY ---------- -->
  <section class="section">
    <div class="wrap">
      <div class="split">
        <div class="split__label"><p class="eyebrow"><b>02</b> Gallery</p></div>
        <div>
          <div class="empty">
            <div class="empty__icon">&#9633;</div>
            <h2>No images yet</h2>
            <p>Build photographs and first-light frames go here.</p>
          </div>

          <!-- Drop files in /img/observatory/, then replace the block above with
               this grid. One figure per image; captions are optional.
          <div class="shots">
            <figure class="shot" data-zoom>
              <img src="/img/observatory/example.jpg" width="1200" height="800" loading="lazy" decoding="async" alt="Describe the image">
            </figure>
          </div>
          -->
        </div>
      </div>
    </div>
  </section>

  <div class="wrap">
    <div class="pager">
      <a class="btn" href="/projects/godash/"> GoDash</a>
      __BACKLINK__
    </div>
  </div>
"""


# ==================================================================
#  MISC  (hobbies + gallery, one page)
# ==============================================================
MISC = """
  <section class="hero">
    <div class="wrap">
      <p class="eyebrow"><b>//</b> Off the clock</p>
      <h1 class="h-xl">Misc</h1>
      <p class="lede">
        What I do when I am not writing code or studying, and the pictures that
        come out of it. Most of it feeds back into what I build.
      </p>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="empty">
        <div class="empty__icon">&hellip;</div>
        <h2>Section under construction</h2>
        <p>
          This page is reserved. The slots below are marked out.
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
#  MISC holding screen  (served while MISC_LIVE is False)
# ==================================================================
MISC_SOON = """
  <section class="hero">
    <div class="wrap">
      <h1 class="h-xl">Under construction<span class="caret">_</span></h1>
      <div class="btn-row" style="margin-top:30px">
        <a class="btn" href="/">Home</a>
      </div>
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
        <a class="btn btn--primary" href="/">Back to start</a>
        __PROJECTS_BTN__
      </div>
    </div>
  </section>
"""


# ==================================================================
#  BUILD
# ==================================================================
if __name__ == "__main__":
    print("building pages...")
    if PROJECTS_LIVE:
        page("projects/index.html", title="Projects / Matthew Saunders",
             desc="Hardware and software projects by Matthew Saunders: GoDash, an iOS dash cam app, and a car-portable computerized automated observatory.",
             body=PROJECTS, canonical="https://msaunders.dev/projects/", trail=[("Projects", None)])

    page("projects/godash/index.html", title="GoDash / Matthew Saunders",
         desc="GoDash is an iOS dash cam app with a 10-minute loop buffer, live telemetry overlay, crash detection, and split-screen navigation and music modules.",
         body=GODASH, canonical="https://msaunders.dev/projects/godash/", trail=PROJ_CRUMB + [("GoDash", None)])

    page("projects/observatory/index.html", title="Mobile Computerized Automated Observatory / Matthew Saunders",
         desc="A car-portable Newtonian reflector with a motorised Raspberry Pi driven base that tracks celestial objects for hour-long exposures.",
         body=OBSERVATORY, canonical="https://msaunders.dev/projects/observatory/", trail=PROJ_CRUMB + [("Observatory", None)])

    page("misc/index.html", title="Misc / Matthew Saunders",
         desc=("Astrophotography, aerospace, computer building, camping, hiking, climbing, music and film, "
               "plus the photographs that come out of them.") if MISC_LIVE else "Under construction.",
         body=MISC if MISC_LIVE else MISC_SOON,
         canonical="https://msaunders.dev/misc/", trail=[("Misc", None)],
         noindex=not MISC_LIVE)

    page("404.html", title="404 / Matthew Saunders",
         desc="Page not found.", body=NOTFOUND,
         canonical="https://msaunders.dev/404.html", noindex=True, trail=[("404", None)])
    stamp_assets()
    print("done.")
