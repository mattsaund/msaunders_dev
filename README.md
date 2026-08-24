# msaunders.dev

Personal site for Matthew Saunders. Plain static HTML/CSS/JS: no build step, no
dependencies, no external requests. Cloudflare Pages serves the repo root as-is.

## Structure

```
Everything in the repo root is deployed. Only index.html is written by hand;
the other two pages are generated and say so in a comment at the top.

```
index.html          hand-written   The whole site: hero, education,
                                   certifications, skills, projects, future
                                   plans. Projects are portfolio entries that
                                   link straight out to their own sites.
misc/index.html     generated      Hobbies + gallery. Currently serving a
                                   holding screen: see "Hidden pages".
404.html            generated      Not found

css/site.css                       Design tokens + every component
js/site.js                         Typed name, section label travel, lightbox
js/cosmos.js                       ASCII planetarium: background art
files/                             The resume PDF, linked from the hero
favicon.svg / favicon.png
og.png                             512x512 link-preview image: see below
_headers                           Cache + security headers
_redirects                         301s for pages that have been retired
robots.txt, sitemap.xml

tools/build_pages.py               Page generator + asset stamper: see below
```

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

The image is `og.png`, the favicon artwork at 512x512 on black, referenced as an
absolute URL because scrapers do not resolve relative ones. It is square and
`twitter:card` is `summary`, so it renders as a thumbnail beside the title
rather than a banner above it. To redraw it, run the polygon from `favicon.svg`
at whatever size you want; it is six points on a 32-unit grid.

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
is needed. About a third twinkle on staggered CSS keyframes: that fraction is
down from two thirds, because each animated star is a composited layer and the
field is four times larger than the gutters-only one.

No star is placed on a body. `onHorizon` and `onBody` reject any that would land
inside a globe or on a ring, testing the star's whole glyph box against the body
grown by one of its own cells, since a cell inks whenever its centre is on the
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
`--space` and `--star` in `css/site.css` set the two ink colours. `window.__cosmos` exposes
`{ render, bodies, live, horizon, measure, draw }` in the console for experimenting.

## Design

Pure black (`#000`), by design. Colours, spacing, and type live as CSS custom
properties at the top of `css/site.css`: change `--accent` to reskin the whole
site. No gradients anywhere.

Each section sits in its own panel: a `--panel` fill (black at 62%) over the
planetarium, outlined with the same `--line` hairline as the timeline rail, so
the art shows through the panels and at full strength between them. Three tokens
drive the whole rhythm and nothing else sets section spacing:

- `--panel-pad` the inset on all four sides, so a title sits as far from the
  left edge of its box as from the top
- `--panel-gap` the distance between one panel and the next
- `--panel` the fill

The footer deliberately has no panel: a box there would sit over the horizon
globe and cut the copyright out of the row it is punched into.

House style: no em dashes, no en dashes, plain hyphens only. Copy stays terse.

## Adding a gallery image

1. Create `img/gallery/` and put the file in it.
2. Add a `<figure class="shot" data-zoom>` block to `MISC` in
   `tools/build_pages.py` (a commented template is already in there), then
   rebuild. Nothing shows until `MISC_LIVE` is `True`: see "Hidden pages".

The lightbox and responsive grid pick it up automatically.
