#!/usr/bin/env python3
"""Cut the site mark, a blue "~/", from the site's own font.

The mark used to be a hand-drawn chevron. It is now the two characters the
top bars already print in front of every page name, so the tab icon, the link
preview and the bars are all the same shape in the same typeface.

Both glyphs come out of fonts/jetbrains-mono-latin.woff2 at weight 800, the
heaviest the file carries: at 16 pixels a regular stroke thins out to nothing.
The SVG gets the outlines themselves; the two PNGs are the same outlines
rendered large and resampled down, framed the same way, so all three agree.

Writes favicon.svg, favicon.png and og.png. Needs fonttools, brotli (woff2 is
brotli-compressed) and pillow, none of which the site itself needs, so run it
from a throwaway virtualenv rather than adding them anywhere:

    python3 -m venv /tmp/icons && /tmp/icons/bin/pip install fonttools brotli pillow
    /tmp/icons/bin/python tools/make_icons.py
"""

import io
import os

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, "fonts", "jetbrains-mono-latin.woff2")
MARK = "~/"
WEIGHT = 800
INK = (0x4c, 0x9e, 0xff)      # --accent, the blue the site's '~', '>' and '/' use
PAPER = (0x00, 0x00, 0x00)    # --bg

# How much of the image's width the mark spans. The tab icon is 16 pixels on
# a good day, so it takes all the room it can get; the link preview is 512 and
# wants air around it instead.
FAVICON_SPAN = 0.84
OG_SPAN = 0.60


def static(weight):
    """The variable font pinned to one weight, which both outputs draw from."""
    font = TTFont(FONT)
    return instantiateVariableFont(font, {"wght": weight}, inplace=True)


def outlines(font):
    """The mark as one SVG path, plus the box it occupies, in font units.

    Glyphs are placed by their own advances, the way a line of text sets, so
    the pair keeps the spacing the typeface intends between them.
    """
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    names = [cmap[ord(c)] for c in MARK]

    path, bounds = SVGPathPen(glyphs), BoundsPen(glyphs)
    x = 0
    for name in names:
        shift = (1, 0, 0, 1, x, 0)
        glyphs[name].draw(TransformPen(path, shift))
        glyphs[name].draw(TransformPen(bounds, shift))
        x += font["hmtx"][name][0]
    return path.getCommands(), bounds.bounds


def write_svg(path, box, size=32):
    """The favicon, as the outlines themselves.

    A favicon cannot pull in a webfont, so the shapes are baked in rather than
    set as text: a <text> tag here would come out in whatever the browser
    happened to have.
    """
    x0, y0, x1, y1 = box
    scale = size * FAVICON_SPAN / (x1 - x0)
    # The y flip: font units count up from the baseline, SVG counts down.
    tx = size / 2 - (x0 + x1) / 2 * scale
    ty = size / 2 + (y0 + y1) / 2 * scale
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {s} {s}">\n'
        '  <rect width="{s}" height="{s}" fill="#{paper}"/>\n'
        '  <path transform="translate({tx:.3f} {ty:.3f}) scale({k:.5f} -{k:.5f})"\n'
        '        d="{d}" fill="#{ink}"/>\n'
        "</svg>\n"
    ).format(s=size, paper="%02x%02x%02x" % PAPER, ink="%02x%02x%02x" % INK,
             tx=tx, ty=ty, k=scale, d=path)
    with io.open(os.path.join(ROOT, "favicon.svg"), "w", encoding="utf-8") as fh:
        fh.write(svg)
    return svg


def write_png(name, size, span, ttf):
    """A PNG of the same mark, drawn big and resampled down.

    Rendering at the final size would leave the tilde's thin waist to a
    16-pixel grid. Drawing it ten times over and resampling keeps the curve.
    """
    big = 2048
    face = ImageFont.truetype(ttf, big // 2)
    mask = Image.new("L", (big * 2, big), 0)
    ImageDraw.Draw(mask).text((big // 4, big // 2), MARK, font=face, fill=255)
    mask = mask.crop(mask.getbbox())

    width = int(round(size * span))
    height = max(1, int(round(width * mask.height / mask.width)))
    mask = mask.resize((width, height), Image.LANCZOS)

    out = Image.new("RGB", (size, size), PAPER)
    out.paste(Image.new("RGB", mask.size, INK),
              ((size - width) // 2, (size - height) // 2), mask)
    out.save(os.path.join(ROOT, name), optimize=True)
    return out.size


def main():
    font = static(WEIGHT)
    path, box = outlines(font)
    write_svg(path, box)

    ttf = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".mark.ttf")
    font.flavor = None
    font.save(ttf)
    try:
        write_png("favicon.png", 64, FAVICON_SPAN, ttf)
        write_png("og.png", 512, OG_SPAN, ttf)
    finally:
        os.remove(ttf)

    for f in ("favicon.svg", "favicon.png", "og.png"):
        print("  {:<12} {:>6,} bytes".format(f, os.path.getsize(os.path.join(ROOT, f))))


if __name__ == "__main__":
    main()
