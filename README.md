# Melon Sandbox Builder

A website for planning contraptions in the Melon Sandbox game. You lay parts out on a true-to-scale 2D grid, link them with ropes, rods and wires, and get a step-by-step animated build guide you can follow while playing.

## The pages

* Home: where to start.
* Build: the grid editor. Drag parts, rotate, link, save, and play the build guide. The Plan with AI panel lives here.
* Learn: short lessons for common mechanisms.
* Plans: premade plans. Open one to copy it into your own library.
* Wiki: every measured part, with its size in crates and its settings.
* Dev tools: helpers for checking sizes and codes.

## Publish and update

1. Changes arrive as a pull request on GitHub.
2. Netlify builds a preview of the pull request. Open it from the checks on the pull request and look it over.
3. Choose Merge pull request. Netlify publishes the new version of the site within a minute or two.

There is no build step. The site is plain files.

To switch on the AI planner, follow `docs/AI.md` (one environment variable in Netlify).

## Where the data lives

* `data/catalog.json`: the list of parts (name, size in crates, settings, picture). Add or fix parts here. Pictures go in `assets/sprites/`.
* `data/missing.json`: parts that still need measuring.
* `data/blueprints.json` and `data/lessons.json`: premade plans and lessons.
* `docs/ARCHITECTURE.md`: how the code is organised, for whoever edits it next.

## Saving and sharing

Builds are saved in your own browser (localStorage). They are not on a server, so clearing site data or switching browser loses them. To keep or share a build, use Export: it makes a Base64 text code starting with `MSB1:`. Paste that code into Import on any device to get the build back.

## Honest limitations

* Part sizes were measured from screenshots taken with a fixed camera. They are accurate to about 2 pixels, which is under 1 percent for big parts and up to about 8 percent for the smallest. They are not official numbers.
* There is no game API. Nothing here talks to the game; you copy the plan by hand.
* Plans are untested in the game unless a page says otherwise. Physics (weight, friction, how parts behave when joined) is not simulated.
* AI plans can be wrong. They are checked against the catalog, but the design may not work.
* Some part names and settings are marked unsure on the wiki; treat them as unconfirmed.
