# msaunders.dev

Personal site for Matthew Saunders. Static HTML, CSS and JS: no framework, no
dependencies, no external requests at runtime. Cloudflare Pages serves the repo
root as the site.

## Structure

The repo root is what ships, so the layout below is also the URL layout, with
one exception: the pages live under `pages/` and keep their short addresses
through rewrites in `_redirects` (see "URLs"). Only `index.html` is written by
hand; the two generated pages say so in a comment at the top.

```
index.html                     hand-written  The whole site: hero, education,
                                             certifications, skills, projects,
                                             future plans
404.html                       generated     Not found

pages/misc/index.html          generated     Hobbies + gallery, currently a
                                             holding screen: see "Hidden pages"
pages/projects/crucible/       hand-written  /crucible/  local LLM engine
pages/projects/tiny/           hand-written  /tiny/      terminal PKMS, with the
                                             program itself running in the page
pages/projects/cosmos/         vendored      /cosmos/    the cosmos.js tool, a
                                             copy of its own web/ directory

css/site.css                   Design tokens and every component on the site's
                               own pages. The project pages have their own.
js/site.js                     Typed name in the hero, and the image lightbox
js/cosmos.js                   ASCII planetarium: the background art
js/install.js                  Copy button on the project pages' install lines
fonts/                         JetBrains Mono, subset, self-hosted

files/images/                  favicon.svg, favicon.png, og.png
files/docs/                    The resume and the certificates

_headers                       Cache and security headers, by request path
_redirects                     Rewrites for the moved pages, 301s for retired
                               ones and for files that have moved
robots.txt, sitemap.xml

tools/build_pages.py           Page generator and asset stamper: see "Editing"
tools/build_tiny.py            Builds tiny to WebAssembly for /tiny/
tools/make_icons.py            Cuts the site mark from the font into files/images
tools/serve.py                 Local preview that applies _redirects
```

## URLs

`index.html` and `404.html` have to sit in the root: that is where Cloudflare
Pages looks for the site root and the not-found page. Everything else is free to
be organised, so the pages live under `pages/` and `_redirects` maps the short
URL onto the file:

```
/tiny/*   /pages/projects/tiny/:splat   200
```

A `200` is a rewrite rather than a redirect: the address bar keeps `/tiny/` and
Cloudflare serves the file from its new path, so published links, the sitemap
and the canonical tags all stay as they were. Static files win over these rules,
which is why the root pages are unaffected.

One rule about the rules: **the target must be a directory, never a path ending
in `index.html`**. Pages canonicalises a URL that names `index.html`, and one
that ends in `.html`, by redirecting to the clean form, and it applies that to
the target of a rewrite as well. Writing `/tiny/ /pages/projects/tiny/index.html
200` therefore produces a visible 307 to `/pages/projects/tiny/`, which is the
long path leaking into the address bar. A directory target is already canonical
and is served as-is.

Three things follow from that. Keep writing links as the short URL (`/tiny/`,
not the path on disk). `_headers` matches the request path, so its rules still
read `/tiny/app/*`. And preview with `tools/serve.py` rather than
`python -m http.server`, because a plain file server knows nothing about
`_redirects` and will 404 on every page under `pages/`.

## Local preview

```sh
python3 tools/serve.py          # http://127.0.0.1:8788
```

It reads the rules out of `_redirects` itself, so the preview and production
cannot drift apart.

## Hidden pages

**Misc is hidden** (`MISC_LIVE` at the top of `tools/build_pages.py`). Flip it to
`True`, rebuild, and restore its `sitemap.xml` line to publish it. `/misc/` serves an "Under construction" holding screen
and carries `noindex`. The real page is still the `MISC` body; `MISC_SOON` is
what gets emitted instead. The Misc button on the About page stays visible either
way, and `/hobbies/` and `/gallery/` keep redirecting to `/misc/`.
Sitemap line: `<url><loc>https://msaunders.dev/misc/</loc><priority>0.5</priority></url>`

## Cloudflare Pages settings

- **Framework preset:** None
- **Build command:** *(empty)*
- **Build output directory:** `/`

Pushing to `main` deploys.

## Editing

Every page is a complete, hand-editable HTML file: edit them directly.

`tools/build_pages.py` is a convenience only: it regenerates the pages other than
`index.html` from a shared shell, so the nav and footer stay identical everywhere.
It is **not** part of the deploy. If you change the nav or footer in `index.html`,
run it to propagate:

```sh
python3 tools/build_pages.py
```

It also stamps a content hash onto every CSS/JS URL (`site.css?v=f78bfe39`).
That is what lets a returning visitor pick up a new stylesheet instead of the
one their browser cached. **Run it before you push if you edited css/ or js/**,
even if you only hand-edited `index.html`. `_headers` makes CSS/JS revalidate
every load as a backstop, so forgetting is survivable, not silent.

If you'd rather stop using it, delete `tools/` and edit the HTML directly, but
then drop the long cache in `_headers` too.

## Link previews

Paste the link into iMessage, Discord, Slack or anywhere else and the card reads
one line and shows the site mark, nothing more:

```
Matthew Saunders, Computer Science, Aerospace Engineering
```

That is `<title>` and `og:title` in `index.html`, kept identical. There is
deliberately **no** `og:description` and **no** `<meta name="description">`:
scrapers fall back to the plain description tag when `og:description` is
missing, and either one puts a second line under the title. Adding one back is
how the old two-line Discord card comes back.

The image is `files/images/og.png`, the site mark at 512x512 on black,
referenced as an absolute URL because scrapers do not resolve relative ones. It
is square and `twitter:card` is `summary`, so it renders as a thumbnail beside
the title rather than a banner above it.

The mark is a copyleft-blue `~/`, the same two characters the project pages
print in front of their names, cut from the site's own JetBrains Mono file at
weight 800. All three files (`favicon.svg`, `favicon.png`, `og.png`) come out of
`tools/make_icons.py`, which needs fonttools, brotli and pillow in a throwaway
virtualenv; the header of that script has the commands. Change the colour or the
weight there rather than editing the SVG by hand.

Sub-pages get the same image and their own titles from the shell in
`tools/build_pages.py`.

## The ASCII planetarium

`js/cosmos.js` draws the background art. Nothing is pre-rendered: each body is a
shaded sphere computed per glyph from a real lighting model, with Saturn's and
Uranus' rings intersected against the ring plane and depth-sorted against the
globe. The rings carry azimuthal density clumps that shear on a Keplerian
profile (inner material laps outer), because a perfectly symmetric annulus looks
identical at every angle and made the ringed bodies read as frozen.

Rotation runs on wall-clock time, not scroll: each body turns slowly and
continuously (`rate`, in radians per second, so one turn takes 45 to 85 seconds
depending on the body) whether or not the page is moving. The loop pauses on a
hidden tab, and the angle is quantised so a redraw only happens when a glyph
could actually change, which is roughly every fifth frame.

At the foot of every page sits the horizon: an Earth four viewport widths
across, buried below the document so only a shallow band of its limb shows.
Its axis is tipped 60 degrees toward the viewer, which puts the visible apex
near 30 degrees latitude rather than on the pole (where the surface would just
swirl in place) and turns the rotation into a clean rightward drift of about
27 px/s. Only the visible band is rendered, not a full globe that is then
clipped, and a `gain` multiplier lifts it out of permanent limb shadow, which
otherwise squashed the whole surface into two ramp levels. It redraws about
2.6 times a second, which amortises to 0.02 ms per frame.

A scattered ASCII starfield covers the whole page. Positions are seeded
deterministically, so it is the same field on every visit. It used to be
confined to the gutters either side of the content column, and to hide entirely
below 860px where there were no gutters left; the section panels dim whatever is
behind them, so a star under body copy now reads as sky and neither restriction
is needed. The art also used to darken below 720px, which read as murk rather
than quiet, so it now keeps one ink at every width. The horizon is hidden on the
phone layout instead: at four viewport widths it is a wall under the last panel
there, not a limb rising into the page. About a third twinkle on staggered CSS keyframes: that fraction is
down from two thirds, because each animated star is a composited layer and the
field is four times larger than the gutters-only one.

No star is placed on a body. `onHorizon` and `onBody` reject any that would land
inside a globe or on a ring, testing the star's whole glyph box against the body
grown by one of its own cells, since a cell inks whenever its center is on the
surface and either box alone could straddle a limb. The globe test covers the
unlit half too, which is drawn as spaces and is exactly where a star used to
show through and read as sitting in front of the planet.

The drifting bodies are pinned to document coordinates, anchored to real section
tops rather than a share of the page height, so they scroll up and off with
everything else. Every page starts on a different body, chosen by hashing its
path.

Worst-case render is ~0.14 ms a frame (Saturn, 65x19 glyphs) and only bodies
near the viewport are redrawn, so the whole effect costs nothing measurable. It
respects `prefers-reduced-motion` by drawing the art and freezing the spin.

Placement is computed, not hand-tuned: `cosmos.js` measures the resolved
monospace font's actual glyph advance at init (rather than assuming 0.6), uses it
to derive each body's column count so the disks stay circular, and from that
works out an x position that keeps every body fully on screen at any viewport.
Anything still too wide for the screen is scaled down to fit.

To retune: `BODIES` at the top of the file holds every knob: frame extents, grid
rows, axial tilt, rotation rate, ambient light, ring radii and gaps, and which
edge to hug. `EARTH` holds the horizon's own knobs: `span` (diameter in
viewport widths), `reveal` (px left showing), tilt, gain and rate.
`SCALE` sets the global size of every drifting body; the divisor in
`buildStars` sets star density and `STAR_GLYPHS` the character mix.
`--space` and `--star` in `css/site.css` set the two ink colors. `window.__cosmos` exposes
`{ render, bodies, live, horizon, measure, draw }` in the console for experimenting.

## Design

Pure black (`#000`), by design. Colors, spacing, and type live as CSS custom
properties at the top of `css/site.css`: change `--accent` to reskin the whole
site. No gradients anywhere.

Each section sits in its own panel: a `--panel` fill (black at 62%) over the
planetarium, outlined with the same `--line` hairline as the timeline rail, so
the art shows through the panels and at full strength between them. Three tokens
drive the whole rhythm and nothing else sets section spacing:

- `--panel-pad` the inset. The vertical padding is derived from it, 3px
  shorter at the top and 2px at the bottom, because a line box is taller than
  its letters: the trim is what puts the ink the same distance from every edge,
  which is the distance the eye actually reads
- `--panel-gap` the distance between one panel and the next
- `--panel` the fill

The footer deliberately has no panel: a box there would sit over the horizon
globe and cut the copyright out of the row it is punched into.

### Type

One face, JetBrains Mono, self-hosted and subset to Latin. Two sizes, both
tokens, and nothing on the page is smaller than the second:

- `--tl-fs` / `--tl-line` (16/23) anything that titles or labels: section
  labels, entry titles, the hero's row of links
- `--body-fs` / `--body-line` (14/23) everything it says: copy, the lines under
  a title, chips, buttons, the footer, the breadcrumb

The headline keeps its own scale and steps down at the breakpoints.

`--tl-line` is not free to be anything. The rail and its notches meet the type
at `--tl-mid`, which is where a `>` centers its ink: 0.53 em below the top of
the em box, so 16px in a 23px line box puts it on 11.98px and `--tl-mid: 12px`
lands on it. Change the line box and that number has to be recomputed.
`--split-label` is the longest section label plus `--rule-gap` plus one arm, so
it moves with the title size too.

### Spacing

Whole pixels everywhere, on an 8px rhythm, with 4px reserved for the tightest
pair (a title and the line under it). Related things sit the same distance
apart: in the hero the name, the links and the sentence are each 16px apart.
Fractions are avoided rather than banned: the one on the page is the left tip of
a section's connector, which starts where the label's text ends, and the font
advances 0.6 em, so only a title size divisible by 5 would land it whole.

`.wrap` rounds its own leading margin down to a whole pixel. Centering a
1204px box in an odd window would otherwise put the panel, and every hairline
inside it, on a half pixel, where a 1px line paints across two columns and reads
thicker in one window than the next.

### Phone

The phone layout is its own design, not the desktop one squeezed. It comes in by
width **and** by pointer:

```css
@media (max-width: 860px), (pointer: coarse) and (max-width: 900px)
```

A coarse pointer under 900px is a hand, so a phone held sideways and a tablet
get it too. There is no layout in between: the label stacking above its list,
the connector that joins them and the folded lists all switch on this one
query, so no width can show a label rule that runs to nothing. What changes:

- The hero centers, and the row of links becomes rows of three. They are sized
  in thirds rather than laid out on a grid, so the row that does not fill
  centers its remainder instead of hanging left.
- The section label sits above its list, so its connector turns a corner: it
  leaves the label on the left at the same height the arm meets it on a desktop,
  then drops to the head of the rail. It is two borders of one box, so the
  corner cannot come apart.
- Every tag list and every project description folds. Each is wrapped in
  `<details class="drop" open>`. What
  shows is a marker in the same brackets the chips wear, `<+>` to open and
  `<->` to close, blue throughout and set on the body's own metrics so its row
  keeps the rhythm of the lines around it; its padding is hit area, taken back
  out of the layout by a matching negative margin. Ligatures are off on that
  row, because the font would otherwise draw `<->` as a single arrow. What the
  summary says stays in the markup as its accessible name, a count for a list
  ("11 courses") or the project's name for a description ("About GoDash"), so a
  screen reader announces something useful rather than punctuation. Both sides
  of the marker are set on the summary itself: its margins collapse with the
  content's, so splitting them across the two elements does not work. The markup
  ships open, so with no JS the page reads whole; `js/site.js` closes them at
  phone widths and syncs only when the query flips, never on every resize, so a
  list the reader opened stays open. On a desktop the summary is hidden and the
  list just shows.

`js/site.js` repeats that media query. Change one and change the other.

House style: no em dashes, no en dashes, plain hyphens only. Copy stays terse.

## Adding a gallery image

1. Create `files/images/gallery/` and put the file in it.
2. Add a `<figure class="shot" data-zoom>` block to `MISC` in
   `tools/build_pages.py` (a commented template is already in there), then
   rebuild. Nothing shows until `MISC_LIVE` is `True`: see "Hidden pages".

The lightbox and responsive grid pick it up automatically.
