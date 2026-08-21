# msaunders.dev

Personal site for Matthew Saunders. Plain static HTML/CSS/JS — no build step, no
dependencies, no external requests. Cloudflare Pages serves the repo root as-is.

## Structure

```
index.html                    About  (landing page, built from the academic resume)
projects/index.html           Projects index — 3 slots, GoDash featured
projects/godash/              GoDash writeup (full)
projects/observatory/         Mobile Computerized Automated Observatory (stub)
projects/apt-decoder/         NOAA APT ground station (stub)
hobbies/index.html            Placeholder — reserved slots
gallery/index.html            Placeholder — grid + lightbox wired, awaiting images
404.html                      Not found

css/site.css                  Design tokens + every component
js/site.js                    Mobile nav, scroll reveal, image lightbox
js/cosmos.js                  ASCII planetarium — scroll-driven background art
img/godash/                   Web-optimised GoDash media (source: assets/)
files/                        Resume PDF
favicon.svg / favicon.png
_headers                      Cloudflare Pages cache + security headers
robots.txt, sitemap.xml

assets/                       Original source media (not linked from the site)
tools/build_pages.py          Optional page generator — see below
```

## Cloudflare Pages settings

- **Framework preset:** None
- **Build command:** *(empty)*
- **Build output directory:** `/`

Pushing to `main` deploys.

## Editing

Every page is a complete, hand-editable HTML file — edit them directly.

`tools/build_pages.py` is a convenience only: it regenerates the pages other than
`index.html` from a shared shell, so the nav and footer stay identical everywhere.
It is **not** part of the deploy. If you change the nav or footer in `index.html`,
run it to propagate:

```sh
python3 tools/build_pages.py
```

If you'd rather stop using it, delete `tools/` and edit the HTML directly.

## The ASCII planetarium

`js/cosmos.js` draws the background art. Nothing is pre-rendered: each body is a
shaded sphere computed per glyph from a real lighting model, with Saturn's and
Uranus' rings intersected against the ring plane and depth-sorted against the
globe. Scroll position drives the rotation, so the planets spin as you move down
the page and unwind if you scroll back up. Each body holds a fixed spot on screen
and cross-fades to the next one, and every page starts on a different body.

Worst-case render is ~0.14 ms a frame (Saturn, 65x19 glyphs) and only the
visible body is redrawn, so the whole effect costs nothing measurable. It
respects `prefers-reduced-motion` by drawing the art and freezing the spin.

To retune: `BODIES` at the top of the file holds every knob — frame extents,
grid size, axial tilt, spin rate per pixel scrolled, ambient light, ring radii
and gaps, and screen position. `--space` in `css/site.css` sets the ink colour.
`window.__cosmos` exposes `{ render, bodies }` in the console for experimenting.

## Design

Pure black (`#000`), by design. Colours, spacing, and type live as CSS custom properties at the
top of `css/site.css` — change `--accent` to reskin the whole site. No gradients are
used anywhere.

## Adding a gallery image

1. Put the file in `img/gallery/`.
2. Add a `<figure class="shot" data-zoom>` block to `gallery/index.html`
   (a commented template is already in the file).

The lightbox and responsive grid pick it up automatically.
