# ns2
Owned by mmec-ca.

This repository contains a small static page that is intended to be served from the path `erd.mmec.ca/ns2/`.

## Deployment

- Place the site on Cloudflare Pages or another static host.
- Ensure the root of the site is the repository root.
- With the current structure, `ns2/index.html` will be served at `erd.mmec.ca/ns2/` and `erd.mmec.ca/ns2/index.html`.

If you want `erd.mmec.ca` itself to redirect to `/ns2/`, the root `index.html` already does that.
