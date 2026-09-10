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
TABS = [("About", "/"), ("Misc", "/misc/")]

# Misc is finished enough to build but not to show, so /misc/ serves the holding
# screen instead and carries noindex. The real body is still MISC below and is
# still the thing this script would emit: flip this to True and rebuild to
# publish it (and put /misc/ back in sitemap.xml).
MISC_LIVE = False

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
          "crucible/css/crucible.css", "crucible/js/flame.js",
          "favicon.svg", "favicon.png")


#  The site's top bar over the cosmos.js tool
# ---------------------------------------------------------------------------
# cosmos/ is a copy of the tool's own web/ directory, re-synced from that repo
# whenever it changes. The bar over it belongs to this site, not to the tool:
# it carries a link home, and upstream ships a folder that also opens over
# file://, where "/" means nothing. So the site owns the whole bar rather than
# reaching into upstream's markup to add one control to it.
#
# That means this replaces upstream's <header class="bar"> when it is there and
# supplies the bar when it is not, which is what lets the tool drop its own bar
# without this needing to change. Both the markup and its style live in this
# one file, so no upstream stylesheet drifts, and the bar is exactly --bar-h
# tall (58px, border included) because app.css sizes the tool's first row off
# that token. Nothing wraps: the repo link truncates instead, so the bar cannot
# grow and put that sizing out.

COSMOS_BAR_CSS = """<style>
/* The site's bar over the tool. Added by tools/build_pages.py; not part of
   upstream cosmos.js, which as of its bar removal knows nothing about one.
   Hence --site-bar-h rather than the old --bar-h: that token went with the
   markup, and the height is the site's own business now. */
:root { --site-bar-h: 58px; }
.site-bar {
  display: flex; align-items: center; flex-wrap: nowrap;
  gap: 14px; height: var(--site-bar-h);
  padding: 0 28px;
  border-bottom: 1px solid var(--line);
}
/* The tool sizes its first row against the window so the preview fills the
   screen. With its own bar gone it no longer discounts one, but this page has
   a bar, so the row has to give the height back or the preview overshoots the
   fold and pushes the code panel down. Same rule and breakpoint as app.css,
   restated with the bar in it. */
@media (min-width: 901px) {
  .app { grid-template-rows: calc(100vh - var(--site-bar-h) - 2 * var(--app-pad) - var(--code-peek)) auto; }
  .app { grid-template-rows: calc(100dvh - var(--site-bar-h) - 2 * var(--app-pad) - var(--code-peek)) auto; }
}
.site-bar__back {
  display: inline-flex; align-items: center;
  color: var(--fg-3); text-decoration: none;
  padding: 6px 2px; flex: none;
  transition: color .15s;
}
/* Drawn, not typed. This page loads no webfont, so a "<-" ligated nowhere and
   an arrow character would have come from whatever mono the system happens to
   supply. A path is the same on every one of them. */
.site-bar__back svg {
  width: 16px; height: 16px; display: block;
  fill: none; stroke: currentColor; stroke-width: 1.5;
  stroke-linecap: round; stroke-linejoin: round;
}
.site-bar__back:hover { color: var(--fg); }
.site-bar__name {
  font: 500 18px/18px var(--mono); color: var(--fg);
  letter-spacing: -0.01em; margin: 0; flex: none;
}
.site-bar__name::before { content: "~/"; color: var(--fg-3); }
/* Truncates rather than wraps, so the bar keeps its height on a narrow window. */
.site-bar__repo {
  font: 400 13px/18px var(--mono); color: var(--fg-3);
  text-decoration: none; transition: color .15s;
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.site-bar__repo:hover { color: var(--fg); text-decoration: underline; }
</style>
"""

COSMOS_BAR = """<header class="site-bar">
  <a class="site-bar__back" href="/" aria-label="Back to msaunders.dev"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8H3M7 4L3 8l4 4"/></svg></a>
  <h1 class="site-bar__name">cosmos.js</h1>
  <a class="site-bar__repo" href="https://github.com/mattsaund/cosmos.js"
     target="_blank" rel="noopener">github.com/mattsaund/cosmos.js</a>
</header>
"""

# Upstream's own bar, however much whitespace it carries around it.
UPSTREAM_BAR = re.compile(r'<header class="bar">.*?</header>\s*', re.S)


def cosmos_bar():
    """Give the hosted copy of the cosmos.js tool this site's top bar."""
    path = os.path.join(ROOT, "cosmos", "index.html")
    if not os.path.exists(path):
        print("  cosmos/: not present, skipped")
        return
    with open(path, encoding="utf-8") as fh:
        html = fh.read()
    before = html

    had_upstream = bool(UPSTREAM_BAR.search(html))
    if had_upstream:
        html = UPSTREAM_BAR.sub("", html, count=1)

    if "site-bar__back" not in html:
        if "<body>" not in html or "</head>" not in html:
            print("  cosmos/index.html                      SHAPE CHANGED, bar NOT added")
            return
        html = html.replace("</head>", COSMOS_BAR_CSS + "</head>", 1)
        html = html.replace("<body>\n", "<body>\n\n" + COSMOS_BAR, 1)

    if html == before:
        print("  cosmos/index.html                      site bar already in place")
        return
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(html)
    print("  cosmos/index.html                      site bar {}".format(
        "replaced upstream's" if had_upstream else "added"))


# ---------------------------------------------------------------------------
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
    html = f'''<!-- Generated by tools/build_pages.py. Do not hand-edit: edit the
     matching body constant in that script and re-run it. index.html is the
     exception, it is written by hand and only has its asset URLs stamped. -->
<!doctype html>
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
<meta property="og:site_name" content="msaunders.dev">
<meta property="og:url" content="{canonical}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="https://msaunders.dev/og.png">
<meta name="twitter:card" content="summary">
<!-- The stylesheet only asks for the font once it has parsed, and the
     planetarium sizes itself against the font it finds, so start the
     fetch alongside the CSS rather than after it. -->
<link rel="preload" href="/fonts/jetbrains-mono-latin.woff2" as="font" type="font/woff2" crossorigin>
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
#  PROJECTS / GoDash
# ==================================================================
#  PROJECTS / Observatory (slot 02)
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
      </div>
    </div>
  </section>
"""


# ==================================================================
#  BUILD
# ==================================================================
if __name__ == "__main__":
    print("building pages...")
    page("misc/index.html", title="Misc / Matthew Saunders",
         desc=("Astrophotography, aerospace, computer building, camping, hiking, climbing, music and film, "
               "plus the photographs that come out of them.") if MISC_LIVE else "Under construction.",
         body=MISC if MISC_LIVE else MISC_SOON,
         canonical="https://msaunders.dev/misc/", trail=[("Misc", None)],
         noindex=not MISC_LIVE)

    page("404.html", title="404 / Matthew Saunders",
         desc="Page not found.", body=NOTFOUND,
         canonical="https://msaunders.dev/404.html", noindex=True, trail=[("404", None)])
    cosmos_bar()
    stamp_assets()
    print("done.")
