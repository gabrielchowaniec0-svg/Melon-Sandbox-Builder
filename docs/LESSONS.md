# Lessons and plans (data you can edit)

## data/lessons.json
`{ "v":1, "lessons":[ lesson, ... ] }`. Order in the file is the lesson order.

lesson: `id` (used in the link #/learn/<id>), `title`, `level` (Beginner, Intermediate or Advanced), `minutes`, `summary`, `intro`, `steps` (3 to 8).

step (all fields except `title` are optional):
* `title`
* `text`: a string or a list of paragraphs
* `tips`: list of strings (blue Tip boxes)
* `unknown`: list of strings, shown in a dashed "Not seen in the recordings" box. Use it for anything we did not see.
* `facts`: list of [label, value] pairs, shown as a small table
* `table`: `{ "head":[...], "rows":[[...],...] }`
* `links`: list of `{ "href", "label" }` buttons
* `mock`: `{ "scene", "args" }` shows the schematic game screen (js/ui-mock.js). Scenes: spawn, menu, params, link, wire, electric, power, hud, freeze. `args.from` and `args.to` pick a slice of the scene's beats so one scene can span several steps. `params` takes `item` (catalog id) and `rows` ([LABEL, value] with true/false for checkboxes, at most 5 rows). `link` takes `kind` (rope, rod, cable, chain, wire, electric, pipe).
* `build`: a small build `{ items:[{id,t,x,y}], links:[{id,kind,a,b,ax,ay,bx,by}] }` shown with the animated player. Positions are in crates, y up, item centre. Items must rest on the floor (y = half the item height) unless you want them to float.

New scenes are written in js/ui-mock.js (`SCENES`). A scene is a list of beats: `{ at:'element id', tap:true, set:{state changes}, caption }`.

## data/blueprints.json
Generated. Edit /home/claude/melon-build/blueprints_gen.py and run it: it reads catalog sizes, drops every part so it rests exactly, and refuses to write if anything overlaps or floats. Use `drop()` for resting parts and `hold()` for parts that float (they get a FREEZE tip, or the plan's `floatTip`). Every plan is labelled "Untested plan".
