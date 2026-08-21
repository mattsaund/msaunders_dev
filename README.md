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

## Design

Dark only, by design. Colours, spacing, and type live as CSS custom properties at the
top of `css/site.css` — change `--accent` to reskin the whole site. No gradients are
used anywhere.

## Adding a gallery image

1. Put the file in `img/gallery/`.
2. Add a `<figure class="shot" data-zoom>` block to `gallery/index.html`
   (a commented template is already in the file).

The lightbox and responsive grid pick it up automatically.
