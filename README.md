# msaunders.dev

**See it here: https://msaunders.dev**

## Files

```
index.html                     the whole site
404.html                       generated

pages/misc/                    /misc/      
pages/projects/godash/         /godash/    
pages/projects/crucible/       /crucible/  
pages/projects/tiny/           /tiny/      
pages/projects/cosmos/         /cosmos/    

css/site.css                   tokens and every component on my own pages
js/site.js                     typed name, folding lists, lightbox
js/cosmos.js                   the ASCII planetarium
js/install.js                  copy buttons on the project install lines
fonts/                         Paper Mono, self hosted

files/images/                  favicon.svg, favicon.png, og.png
files/docs/                    resume and certificates

_headers                       cache and security headers, by request path
_redirects                     rewrites for the pages under pages/, and 301s
robots.txt, sitemap.xml

tools/build_pages.py           generates 404 and misc, stamps asset URLs
tools/build_tiny.py            builds tiny to WebAssembly for /tiny/
tools/make_icons.py            cuts the site mark out of the font
tools/serve.py                 local preview, applies _redirects
```

## Licenses

My own code is MIT ([LICENSE](LICENSE)). What I did not write, or do not
license that way, carries its terms in a file beside it:

```
fonts/                         Paper Mono (paper.design), SIL Open Font
                               License 1.1, in fonts/OFL.txt
pages/projects/godash/         the GoDash site, all rights reserved, in its LICENSE
pages/projects/tiny/app/       tiny.wasm: tiny itself, MIT, in LICENSE; every
                               crate built into it, in THIRD-PARTY-NOTICES.txt;
                               its syntax definitions, in SYNTAX-ACKNOWLEDGMENTS.md;
                               the terminal's JetBrains Mono subset, SIL Open
                               Font License 1.1, in OFL.txt
pages/projects/tiny/app/wasi/  browser_wasi_shim, MIT or Apache 2.0
pages/projects/cosmos/         a copy of cosmos.js, MIT, same author; its own
                               copy of Paper Mono, SIL Open Font License 1.1,
                               in fonts/OFL.txt
```

The platform marks on the install lines are Simple Icons outlines (CC0). The
tiny licenses are written by tools/build_tiny.py each time tiny is built.
