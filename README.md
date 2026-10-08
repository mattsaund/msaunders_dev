# msaunders.dev

**See it here: https://msaunders.dev**

## Files

```
index.html                     the whole site
404.html                       generated

pages/misc/                    /misc/      
pages/projects/godash/         /godash     
pages/projects/crucible/       /crucible/  
pages/projects/tiny/           /tiny/      
pages/projects/cosmos/         /cosmos/    

css/site.css                   tokens and every component on my own pages
js/site.js                     typed name, folding lists, lightbox
js/cosmos.js                   the ASCII planetarium
js/install.js                  copy buttons on the project install lines
fonts/                         JetBrains Mono, subset, self hosted

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
