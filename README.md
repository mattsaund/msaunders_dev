# msaunders.dev

Personal site for Matthew Saunders. Plain static HTML/CSS/JS: no build step, no
dependencies, no external requests. Cloudflare Pages serves the repo root as-is.

## Structure

```
index.html                    About  (landing page, built from the academic resume)
projects/godash/              GoDash writeup (full)
projects/observatory/         Mobile Computerized Automated Observatory (stub)
misc/index.html               Hobbies + gallery, one page. Currently serving a
                              holding screen: see "Hidden pages" below.
404.html                      Not found

css/site.css                  Design tokens + every component
js/site.js                    Mobile nav, scroll reveal, image lightbox
js/cosmos.js                  ASCII planetarium: scroll-driven background art
img/godash/                   Web-optimised GoDash media (source: assets/)
files/                        Resume PDF
favicon.svg / favicon.png
_headers                      Cloudflare Pages cache + security headers
robots.txt, sitemap.xml

assets/                       Original source media (not linked from the site)
tools/build_pages.py          Optional page generator: see below
```

## Project writeups

Every project page follows one shape. Copy an existing body constant in
`tools/build_pages.py` (`GODASH`, `OBSERVATORY`) when adding one:

1. **Hero:** `h1` and a `lede`. No status pills, no tagline under the title.
   Optional row of plain `.btn` links named for where they go ("App Store",
   "Website"), never `btn--primary`.
2. **`01 Overview`:** one unbroken block of `.prose` paragraphs. No `h3`
   subheadings, no `.kv` spec table, no stat boxes.
3. **`02 Gallery`:** a `.shots` grid, nothing else. No intro line, no
   `figcaption`. The lightbox shows a caption only when a figure has one.

Both sections use the `.split` layout, and a pager closes the page. The site is
there to explain and show the work, not to sell it, so badges, feature grids,
press kits, and download cards stay off.

## Hidden pages

Two pages are built but not published. Both are flags at the top of
`tools/build_pages.py`; flipping one to `True` and rebuilding brings the page
back, and each also wants its `sitemap.xml` line restored.

**Misc** (`MISC_LIVE`). `/misc/` serves an "Under construction" holding screen
and carries `noindex`. The real page is still the `MISC` body; `MISC_SOON` is
what gets emitted instead. The Misc button on the About page stays visible either
way, and `/hobbies/` and `/gallery/` keep redirecting to `/misc/`.
Sitemap line: `<url><loc>https://msaunders.dev/misc/</loc><priority>0.5</priority></url>`

**Projects index** (`PROJECTS_LIVE`). Two projects did not need a page of their
own yet, so `/projects/` is not emitted at all and redirects to `/`. The
`PROJECTS` body is untouched. While it is off, each writeup's breadcrumb drops
the Projects hop and its pager says "Back to start" instead of "All projects",
via `PROJ_CRUMB`, `BACKLINK`, and `PROJECTS_BTN`. Turning it back on also means
restoring the "View all projects" link in the About page's Projects section, and
dropping the `/projects/` rules from `_redirects`.
Sitemap line: `<url><loc>https://msaunders.dev/projects/</loc><priority>0.9</priority></url>`

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

A scattered ASCII starfield fills the margins either side of the content column.
Positions are seeded deterministically, so it is the same field on every visit,
and it is confined to the gutters so no star ever sits behind body copy. It
disappears below 860px wide, where there are no gutters left to use. About a
quarter of the stars twinkle on staggered CSS keyframes. Scroll position drives the rotation, so the planets spin as you move down
the page and unwind if you scroll back up. The bodies are pinned to document
coordinates, spaced evenly down the page, so they scroll up and off with
everything else. Every page starts on a different body.

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
`--space` and `--star` in `css/site.css` set the two ink colours. `window.__cosmos` exposes
`{ render, bodies, live, horizon, measure, draw }` in the console for experimenting.

## Design

Pure black (`#000`), by design. Colours, spacing, and type live as CSS custom
properties at the top of `css/site.css`: change `--accent` to reskin the whole
site. No gradients anywhere.

There are no horizontal dividers. The page reads as one continuous surface, and
the only structure is a pair of hairline side rails hung off `<main>` and
`<footer>` so they run unbroken from the nav to the bottom.

House style: no em dashes, no en dashes, plain hyphens only. Copy stays terse.

## Adding a gallery image

1. Put the file in `img/gallery/`.
2. Add a `<figure class="shot" data-zoom>` block to `MISC` in
   `tools/build_pages.py` (a commented template is already in there), then
   rebuild. Nothing shows until `MISC_LIVE` is `True`: see "Hidden pages".

The lightbox and responsive grid pick it up automatically.
