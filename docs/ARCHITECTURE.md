# Architecture (read this before editing)

Static site, no build step. ES modules. Hash router (`#/build`, `#/wiki/item/crate`). Deployed by Netlify from `main`.

```
index.html           shell, fonts, css links
css/base.css         tokens + shared components (buttons, cards, tables, tabs, dialog, player). Do NOT restyle these; add page css instead.
css/pages.css        small shared page bits (hero, grids). Page-specific css goes in css/<page>.css loaded with ensureCss().
js/app.js            router. Imports ./pages/<route>.js and calls mount(root, ctx). ctx = { data, app, params, query, route }
js/util.js           $, h() element builder, store (localStorage w/ fallback), encodeBuild/decodeBuild (Base64), download, copyText, toast, ensureCss
js/data.js           loadData(), sizeOf/boundsOf/buildBounds, newBuild, normalizeBuild, validateBuild, LINK_KINDS, CELL
js/render.js         canvas drawing: drawScene(), hitTest(), fitCam(), thumbnail(), sprites
js/guide.js          generateGuide(data, build) -> steps; partsList(); guideAsText()
js/player.js         createPlayer({data, build, steps?, autoplay, compact}) -> animated step-by-step player (DOM element .el)
js/library.js        saved builds in localStorage: listBuilds/getBuild/saveBuild/adoptBuild/importCode/exportCode
js/pages/*.js        one module per route: export async function mount(root, ctx) { ...; return cleanupFn }
data/catalog.json    177 measured items (see schema below)   data/gates.json   chip gate names
data/missing.json    items with no measurement yet           data/blueprints.json, data/lessons.json
netlify/functions/   serverless functions (AI build helper)
```

## Units and coordinates
* 1 **crate** = the in-game Crate (263 x 261 px in our fixed-camera screenshots). All sizes are in crates. 1 grid cell = 1/8 crate (`CELL`).
* World: x right, **y up**, floor at y = 0. Items are positioned by their **centre**. A crate resting on the floor has y = 0.5.
* Item `r` = rotation in degrees (counter-clockwise), `f` = horizontally flipped.

## catalog.json item
`{ id, name, cat, px:[w,h], c:[wCrates,hCrates], sprite, flags:['edge-unsure','name-unsure','large'], act:boolean (has power button), params:[{key,label,type:'number'|'bool'|'color',default,uncertain?}], note }`
Sizes are measured from screenshots, accurate to about +-2 px (under 1 percent for big items, up to ~8 percent for the tiniest). Never present them as "official".

## Build format (what gets saved and exported as Base64, prefix `MSB1:`)
```
{ v:1, id, name, created, updated, notes,
  items:[{ id, t:'crate'|'custom', x, y, r, f, p:{paramKey:value}, label, cw?, ch?, color? }],   // custom = stand-in block with its own cw/ch in crates
  links:[{ id, a, b, kind:'rope'|'cable'|'rod'|'chain'|'elastic'|'pipe'|'wire'|'electric', ax, ay, bx, by, label, out, in }],  // ax.. = anchor offset in the item's own frame (crates)
  steps:[] }                                                                                      // optional hand-written steps; otherwise generated
```

## Voice and honesty rules
* Plain, short sentences. Sentence case. Say what to tap.
* Never claim a plan was tested in the game unless the user told us so. Use "Untested plan" or "Seen in the recordings" labels.
* Things we infer are marked "(inferred)" or shown with an Unconfirmed badge. Never invent item parameters, ranges or physics numbers.
* No emoji. No ALL-CAPS labels except game text that is in caps in game (EDIT PARAMETERS etc.).
