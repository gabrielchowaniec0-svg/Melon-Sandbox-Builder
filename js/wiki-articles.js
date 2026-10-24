// Reference articles for the wiki. Pure data: js/pages/wiki.js renders it.
//
// Every claim comes from the owner's recordings. Three labels keep that honest:
//   seen     = on screen in a recording
//   inferred = our reading of what was on screen (never confirmed)
//   unknown  = not shown, so we do not know
//
// Inline markup inside strings: **bold**, `code`, [label](#/route).
//
// Block types:
//   {t:'p', x}  {t:'h', x}  {t:'h3', x}  {t:'ul', items}  {t:'ol', items}
//   {t:'facts', items:[[kind, text], ...]}        kind = seen | inferred | unknown
//   {t:'table', head:[...], rows:[[...]], cap}    cells are inline-markup strings
//   {t:'callout', kind:'warn'|'good'|'', x}
//   {t:'items', ids:[catalog ids]}                chips linking to item pages
//   {t:'menu', title, cells:[9 strings]}          a 3x3 context-menu picture
//   {t:'params'}  {t:'gates'}  {t:'glossary'}     built from the data files

export const GROUPS = [
  { id: 'use', name: 'Using the game' },
  { id: 'systems', name: 'Systems' },
  { id: 'site', name: 'About this site' },
];

export const ARTICLES = [
  // ------------------------------------------------------------------ controls
  {
    slug: 'controls-and-menus',
    group: 'use',
    title: 'Controls and menus',
    summary: 'The layout of the screen, the item panel, the tap menu on every object and the power buttons.',
    related: ['wires-and-activation', 'parameters', 'connection-tools'],
    blocks: [
      { t: 'p', x: 'This page lists what the recordings showed on screen. Where a button has no label in the game, we say so and describe the icon instead of guessing a name.' },
      { t: 'h', x: 'Spawning and the item panel' },
      {
        t: 'facts', items: [
          ['seen', 'Tap an item icon in the left panel. The item appears and falls under gravity. Items land, tumble and can be dragged with a finger.'],
          ['seen', 'Vehicles first appear as a see-through ghost and turn solid a moment later.'],
          ['seen', 'The panel has a row of category tabs (icons only, no names) with a swap-arrows button at the far left. The row scrolls sideways.'],
          ['seen', 'Inside a tab there are collapsible sections with names such as FIREARMS, PROJECTILES, ENERGY, EXPLOSIVES, TRAPS, SPECIAL, SYRINGES, LIVING, ELECTRICITY, MECHANICS, PROGRAMMABLE, LIGHT SOURCES, VEHICLES, WATER VEHICLES, MEDICINE and STABBING. Items sit three to a row with a name under each icon.'],
          ['seen', 'At the bottom of the panel: a menu (hamburger) button, CLEAR EVERYTHING and CLEAR LIVING. After a ragdoll dies, CLEAR LIVING changes to CLEAR CORPSES.'],
          ['seen', 'A left-pointing triangle slides the panel away. A 2x2 grid icon then appears at the top left.'],
          ['inferred', 'The 2x2 grid icon brings the panel back.'],
        ],
      },
      { t: 'h', x: 'Top right and bottom right' },
      {
        t: 'facts', items: [
          ['seen', 'Top right: undo (curved arrow), slow motion (dial icon) and pause. The play triangle replaces the pause bars while paused. A white bar under these buttons is never explained.'],
          ['seen', 'Right edge: a clothing icon, a blue video button, a gold M coin and a red P badge with green text that reads "10 D.". These look like shop and reward buttons, not building tools.'],
          ['seen', 'Bottom right: a four-arrow move button. Tapping it opens the connection tool picker. See [Connection tools](#/wiki/guide/connection-tools).'],
          ['unknown', 'How you pan and zoom the camera. The view changes in several recordings, but the gesture is never shown.'],
        ],
      },
      { t: 'h', x: 'Power buttons' },
      {
        t: 'facts', items: [
          ['seen', 'Two round power icons appear at the bottom left and bottom right of the screen when something that can be activated is on the field: guns, engines, a Generator, a lamp, a Defibrillator, a Contraption Spawner.'],
          ['seen', 'Tapping one triggers the object. A gun fires, an engine pushes, a spawner spawns its saved contraption.'],
          ['unknown', 'Whether the left and right buttons control different objects. Both always appeared together.'],
        ],
      },
      { t: 'h', x: 'The tap menu on an object' },
      { t: 'p', x: 'Tap a placed object and a 3x3 menu opens, with an X at the top right to close it. The menu changes a little from object to object.' },
      {
        t: 'menu', title: 'Page 1', cells: [
          'EDIT PARAMETERS', 'DEBUG OUTPUTS', 'DELETE',
          'FREEZE', 'DISABLE COLLISIONS', 'ACTIVATE',
          '(no label)', '(no label)', '(no label)',
        ],
      },
      {
        t: 'menu', title: 'Page 2', cells: [
          'COPY', 'FLIP', 'DISABLE DAMAGE',
          'RESIZE', 'FREEZE ROTATION', 'INVISIBLE',
          'NON-DRAGGABLE', '(not captured)', '(not captured)',
        ],
      },
      {
        t: 'facts', items: [
          ['seen', 'FREEZE reads UNFREEZE when the object is already frozen.'],
          ['seen', 'Vehicles and the Helicopter add START DRIVING and DROP PASSENGERS. The Car Seat has DROP PASSENGERS.'],
          ['seen', 'The Contraption Spawner adds SELECT SAVE FILE.'],
          ['seen', 'The three bottom icons have no text. Across the recordings they looked like a power symbol, a tripod or axes symbol, overlapping squares and an eye. Which icon is which was never confirmed.'],
          ['unknown', 'What DEBUG OUTPUTS shows. It opens a small panel with a bug icon, but its content was never captured.'],
          ['unknown', 'How RESIZE works. The menu button was seen, the resize control was not.'],
          ['unknown', 'Whether a plain tap or a long press opens the menu. The recordings show a touch dot on the object, then the menu.'],
        ],
      },
      { t: 'h', x: 'Parameter panels' },
      {
        t: 'facts', items: [
          ['seen', 'EDIT PARAMETERS opens a panel with a thin white line to the object. It has a CLOSE button and can scroll.'],
          ['seen', 'Numbers are typed with the Android keyboard and confirmed with OK. Yes or no settings are checkboxes. Colours open a hue wheel with a brightness slider and a hex field.'],
          ['unknown', 'Minimum, maximum and units. They are never displayed.'],
        ],
      },
      { t: 'h', x: 'What the game never showed' },
      {
        t: 'ul', items: [
          'Size and mass of any item. That is why this site measures sizes from screenshots. See [How sizes were measured](#/wiki/guide/measuring-method).',
          'The in-game info overlay. Its prompt reads "CLICK ON THE ITEM YOU ARE INTERESTED IN TO GET INFORMATION ABOUT IT", but the information itself was never captured.',
          'Whether items snap to each other. No snapping was seen.',
        ],
      },
      { t: 'p', x: 'For step-by-step practice, use the lessons on the [Learn page](#/learn).' },
    ],
  },

  // ---------------------------------------------------------- connection tools
  {
    slug: 'connection-tools',
    group: 'use',
    title: 'Connection tools',
    summary: 'Rope, rod, cable, chains, pipe, wire and electric wire: how they are picked and what each one did.',
    related: ['wires-and-activation', 'electricity', 'controls-and-menus'],
    blocks: [
      { t: 'p', x: 'The tools sit in a picker that opens from the four-arrow button at the bottom right. The game shows icons only. **The names below are ours**, picked from what each icon looked like and how it behaved.' },
      { t: 'h', x: 'The two-tap flow' },
      {
        t: 'ol', items: [
          'Tap the four-arrow button at the bottom right and pick a tool. The picker closes and the button shows the tool you picked.',
          'Tap a point on the first object. A white ring marks it.',
          'The screen says **SELECT THE SECOND ROPE POINT**. Tap a point on the second object. It gets a blue outline.',
          'The link is drawn between the two spots you tapped. The spots do not have to be the centres.',
        ],
      },
      { t: 'p', x: 'The same flow worked on crates, bottles, a Generator and a ragdoll head. Links are physical: they pull objects when something moves.' },
      { t: 'h', x: 'What each tool did' },
      {
        t: 'table', cap: 'Picker pages as seen. Names in the first column are ours.',
        head: ['Tool (our name)', 'Icon', 'What was seen'],
        rows: [
          ['**Rope**', 'Tan twisted rope, page 1', 'Thin tan rope. Sags when slack and follows the objects.'],
          ['**Cable**', 'Grey twisted rope, page 1', 'Grey rope. Sags in a U shape when slack. Length looked fixed at the distance you tapped (inferred).'],
          ['**Rod**', 'Thin grey bar, page 1', 'Straight and rigid. Crates swung around each other at a fixed distance.'],
          ['**Pipe**', 'Light blue tube with a droplet, page 1', 'Translucent blue tube. Between two bottles it moved liquid on its own: bottle 3 filled while bottle 2 drained. A pipe to a ragdoll head showed no flow.'],
          ['**Wire**', 'Arrow with a rainbow line, page 1', 'Opens the SELECT INPUT/OUTPUT dialog. See [Wires and activation](#/wiki/guide/wires-and-activation).'],
          ['**Electric wire**', 'Lightning bolt over a wooden bar, page 2', 'Used from a Generator to a ragdoll head and to a small device. The power button then made sparks and a Tesla Coil arc. Drawn as a thin brown line.'],
          ['**Chain**', 'Grey chain, pages 2 and 3', 'Stays fairly taut. Crates tumbled while joined.'],
          ['**Stretch chain**', 'Chain with a double arrow, pages 2 and 3', 'Stretched to about 3 times the crate gap when a crate was thrown. The arrow suggests it is elastic or adjustable (inferred). No length setting was shown.'],
          ['**Olive rod and bar**', 'Olive vertical rod and horizontal bar, page 2', 'Rigid. Crates tilted together.'],
          ['**Thick rod**', 'Diagonal line with square nodes, page 3', 'Made a thicker white-grey rod with node ends between two crates.'],
        ],
      },
      { t: 'h', x: 'Tools whose function was not shown' },
      {
        t: 'facts', items: [
          ['unknown', 'The white "+" on page 1. It was never used.'],
          ['unknown', 'The grey checker block (pages 2 and 3), the tan square with a dark centre and the brown object with a light peg (page 3).'],
          ['unknown', 'The small box left of the picker with a move arrow, a green wire icon and a white spiral. It looks like a mode selector but nothing confirms it.'],
          ['unknown', 'Whether any tool has settings, such as a length. None were opened.'],
        ],
      },
      {
        t: 'callout', kind: 'warn',
        x: 'The builder uses eight link kinds: rope, cable, rod, chain, stretch chain, pipe, wire and electric wire. They match the tools above. Treat the plans as a layout aid, not as a tested recipe.',
      },
    ],
  },

  // ------------------------------------------------------ wires and activation
  {
    slug: 'wires-and-activation',
    group: 'use',
    title: 'Wires and activation',
    summary: 'The SELECT INPUT/OUTPUT dialog and what the recordings showed it doing.',
    related: ['connection-tools', 'controls-and-menus', 'chip-and-gates'],
    blocks: [
      { t: 'p', x: 'Two things get called "activation" in the game, and they are easy to mix up. One is the power button that you tap. The other is a **wire** that lets one object trigger another.' },
      { t: 'h', x: 'Power button and ACTIVATE' },
      {
        t: 'facts', items: [
          ['seen', 'The round power icons at the screen corners, and ACTIVATE in the object menu. Both trigger the object by hand.'],
        ],
      },
      { t: 'h', x: 'The SELECT INPUT/OUTPUT dialog' },
      { t: 'p', x: 'Pick the wire tool (arrow with a rainbow line), tap the first object, tap the second. A dialog opens with two columns, **OUTPUT** and **INPUT**.' },
      {
        t: 'facts', items: [
          ['seen', 'Options seen in OUTPUT: ACTIVATION, and ANGLE on one object.'],
          ['seen', 'Options seen in INPUT: ACTIVATION and COLOR.'],
          ['seen', 'At the bottom the chosen pair shows as a label, for example ACTIVATION / ACTIVATION. There are buttons APPLY and CLOSE, and an icon of a crossed-out eye.'],
          ['inferred', 'The crossed-out eye hides the wire.'],
          ['seen', 'After APPLY a coloured line is drawn between the objects. Green and pink lines were seen. The line is physical and swings with the objects.'],
          ['unknown', 'Which options each kind of object offers. Only a few objects were wired.'],
          ['unknown', 'What COLOR as an input does exactly. In the demo the lights lit up; the colour was not shown changing (inferred: it sets the light colour).'],
        ],
      },
      { t: 'h', x: 'The demo that was recorded' },
      {
        t: 'ul', items: [
          'Three wires ran to three hanging bulbs: a yellow pad to the first, a bottle-shaped stand to the second and a green disc to the third.',
          'When the pad, stand or disc was triggered, the bulbs and the whole screen glowed warm yellow. The green disc turned bright yellow and swung. Afterwards everything returned to normal.',
        ],
      },
      { t: 'p', x: 'The pad, stand, disc and bulbs were never named on screen, so we cannot link them to catalog items.' },
      {
        t: 'callout', kind: '',
        x: 'Chips can also read and send values. That editor is covered in [Chips and gates](#/wiki/guide/chip-and-gates). How a chip is wired to objects was not shown.',
      },
      { t: 'p', x: 'To practise the two-tap flow, see the lessons on the [Learn page](#/learn).' },
    ],
  },

  // ---------------------------------------------------------------- parameters
  {
    slug: 'parameters',
    group: 'use',
    title: 'Parameters',
    summary: 'Every parameter shown in a recording, with the value on screen and how sure we are.',
    related: ['controls-and-menus', 'electricity', 'explosives-and-traps'],
    blocks: [
      { t: 'p', x: 'Values below are the numbers that were on screen when the panel was open. A player may have typed over a default first, so read them as **examples**, not as defaults the game guarantees. Ranges and units were never displayed.' },
      { t: 'params' },
      { t: 'h', x: 'Seen but not tied to an item' },
      {
        t: 'table',
        head: ['Where', 'Parameter', 'Value on screen', 'Status'],
        rows: [
          ['A small black device wired to a Generator (name never shown)', 'ACTIVATION VOLTAGE', '10', 'Unconfirmed: the device was not named'],
          ['Contraption Spawner', 'SELECT SAVE FILE', 'A searchable list of your saved contraptions with SELECT and CANCEL', 'Seen (a menu action, not a number)'],
        ],
      },
      { t: 'h', x: 'Items with a power button but no panel opened' },
      { t: 'p', x: 'Gyroscope showed no settings and spun when activated. Many mechanics and devices (Servo, Grabber, Magnet, Door, Slider, Valve, Radio, Timer and more) were listed in the panel but never opened. We do not guess their parameters.' },
    ],
  },

  // --------------------------------------------------------------- electricity
  {
    slug: 'electricity',
    group: 'systems',
    title: 'Electricity',
    summary: 'The seven items in the ELECTRICITY section and the one wiring demo that was recorded.',
    related: ['connection-tools', 'parameters', 'wires-and-activation'],
    blocks: [
      { t: 'p', x: 'The ELECTRICITY section holds seven items. Only the Generator was spawned in a recording, and one wiring demo shows it powering a ragdoll and a Tesla Coil.' },
      { t: 'items', ids: ['generator', 'battery', 'adapter', 'relay', 'voltmeter', 'transformer', 'tesla-coil'] },
      { t: 'h', x: 'What was seen' },
      {
        t: 'facts', items: [
          ['seen', 'The Generator is a large black portable generator with an orange fan. It stands on the floor.'],
          ['seen', 'An electric wire ran from the Generator to a ragdoll head and then to a small black device. The wire pulled on both objects, the Generator tilted and smoke came out.'],
          ['seen', 'After the power button, white sparks ran along the wires and the ragdoll. The small device showed an orange indicator on top.'],
          ['seen', 'A Tesla Coil at the right edge shot purple-white arcs toward the left while powered.'],
          ['seen', 'A VOLTAGE panel showed 10, later 1000. The panel was not clearly tied to one object.'],
          ['seen', 'The small black device had ACTIVATION VOLTAGE 10.'],
          ['seen', 'Fluorescent Lamp 1 and 2 and the neon sprites (Watermelon, Duck, Melon, Glowing Label) glowed after the power icons appeared.'],
          ['seen', 'The Edison Lamp lit the scene with no power and no wire. Its only parameter was COLOR.'],
          ['seen', 'The Defibrillator makes sparks when you press the power button with the paddles on a ragdoll torso.'],
        ],
      },
      { t: 'h', x: 'Looks only, behaviour unknown' },
      {
        t: 'table',
        head: ['Item', 'What the icon looks like'],
        rows: [
          ['Battery', 'Dark box with a yellow lightning symbol and red and blue terminals.'],
          ['Transformer', 'A coil with a red and blue core.'],
          ['Voltmeter', 'A device with a red dial.'],
          ['Adapter', 'A black block with prongs.'],
          ['Relay', 'A framed box with a white bulb icon.'],
        ],
      },
      {
        t: 'facts', items: [
          ['unknown', 'What Battery, Adapter, Relay, Transformer and Voltmeter do in this game. They were never spawned.'],
          ['unknown', 'Port names, how items connect to each other and how much power each needs.'],
          ['unknown', 'Which object owns VOLTAGE and which owns ACTIVATION VOLTAGE.'],
          ['unknown', 'What the Tesla Coil is wired to. A wire to the coil was not clearly visible.'],
        ],
      },
      { t: 'callout', kind: 'warn', x: 'Do not rely on real-world electronics rules here. Plans that use these items are untested ideas until you try them in the game.' },
    ],
  },

  // ----------------------------------------------------------- chip and gates
  {
    slug: 'chip-and-gates',
    group: 'systems',
    title: 'Chips and gates',
    summary: 'The chip editor screen and the full list of gate names read from it.',
    related: ['wires-and-activation', 'parameters'],
    blocks: [
      { t: 'callout', kind: 'warn', x: '**We have not seen a worked example.** The recordings scroll through the editor and place a few nodes. They never show a finished chip doing a job. What a gate does is not confirmed here.' },
      { t: 'h', x: 'The Programmable section' },
      { t: 'p', x: 'The panel lists Chip, All Nodes, Velocity, Following, UI Control, Array and Lua Chip. Only the Chip editor was opened.' },
      { t: 'h', x: 'What the editor looks like' },
      {
        t: 'facts', items: [
          ['seen', '**GATES panel**, left. A search box, then collapsible categories. Each gate is a row with a small icon. SAVE and EXIT buttons sit under the list, and a "+" button is in the header.'],
          ['seen', '**Graph area**, middle. Gates become nodes on a dark grid. A node has a title, input ports on the left and output ports on the right, and a small value box. Nodes are joined by white lines.'],
          ['seen', 'A CONSTANT node has a number box, a DECIMAL drop-down and an ARRAY checkbox. Other nodes placed in the demo: TRIGGER, FLOOR, ADD, CAMERA ZOOM, MASS, WORLD POSITION TO LOCAL and a Lua Script node.'],
          ['seen', 'Three buttons at the top left: a question mark, a green save icon and a crosshair. Three at the bottom right: a crossed-out bin, a recycle icon and a yellow warning triangle.'],
          ['seen', '**PARAMETERS panel**, right. A section called INPUT/OUTPUT with an ADD button, and a section called VARIABLES below it. Another section, SETTINGS, was seen once with small text that read RATE 30 TPS and PRIORITY 0.'],
          ['seen', 'The words AUTOSAVE ENABLED and later SAVED appeared on screen.'],
        ],
      },
      {
        t: 'facts', items: [
          ['unknown', 'How a chip is connected to objects in the world, and what its INPUT/OUTPUT entries become there.'],
          ['unknown', 'What the three top and three bottom buttons do.'],
          ['unknown', 'Whether TPS is "ticks per second" and what PRIORITY orders (inferred only).'],
          ['unknown', 'Any real build made with a chip.'],
        ],
      },
      { t: 'h', x: 'The gate list' },
      { t: 'p', x: 'These names were read from the gate list while it scrolled. Use the box to search across all groups. Nothing here is a description of behaviour.' },
      { t: 'gates' },
      { t: 'p', x: 'The note in our data file says the same: descriptions of what gates do would be standard-logic guesses, not confirmed in the game.' },
    ],
  },

  // ------------------------------------------------------------------ vehicles
  {
    slug: 'vehicles',
    group: 'systems',
    title: 'Vehicles',
    summary: 'Which vehicles exist, the extra menu buttons they get and what is still unknown.',
    related: ['controls-and-menus', 'parameters'],
    blocks: [
      { t: 'p', x: 'The recording only browsed the vehicles. Nothing was driven and no water appeared.' },
      { t: 'h', x: 'What the list holds' },
      {
        t: 'table',
        head: ['Section', 'Items'],
        rows: [
          ['VEHICLES', 'Jeep, APC, Scooter, Bus, Truck, Helicopter, Bicycle, Car Seat, Banana Ride, Jetpack'],
          ['WATER VEHICLES', 'Submarine, Inflatable Boat, Speedboat, Underwater Scooter, Banana Boat'],
        ],
      },
      { t: 'p', x: 'Measured so far:' },
      { t: 'items', ids: ['scooter', 'bicycle', 'car-seat', 'jetpack', 'underwater-scooter'] },
      { t: 'p', x: 'The Jeep, APC, Bus, Truck, Helicopter, Banana Ride and the boats still need a measurement. See [Missing items](#/wiki/missing).' },
      { t: 'h', x: 'What was seen' },
      {
        t: 'facts', items: [
          ['seen', 'Vehicles spawn as a ghost and turn solid.'],
          ['seen', 'The Jeep and Helicopter menus add START DRIVING and DROP PASSENGERS. The Car Seat menu has DROP PASSENGERS.'],
          ['seen', 'The Car Seat has one parameter: EJECTION FORCE 300.'],
          ['seen', 'A dark round overlay with an X appeared near the bottom right at one point while no vehicle was selected. It might be a driving joystick (inferred).'],
          ['seen', 'Jeep: olive open jeep with a spare tyre. APC: green camo, eight wheels, a turret and an antenna. Banana Ride: a yellow banana car with about five seats. Speedboat: red and black. Banana Boat: very large and yellow.'],
          ['unknown', 'The driving controls, what DROP PASSENGERS does exactly, flying, water behaviour and any parameters other than the Car Seat\'s.'],
        ],
      },
    ],
  },

  // --------------------------------------------------- explosives and traps
  {
    slug: 'explosives-and-traps',
    group: 'systems',
    title: 'Explosives and traps',
    summary: 'The lists, the one fully documented explosive and what the turret did.',
    related: ['parameters', 'controls-and-menus'],
    blocks: [
      { t: 'h', x: 'Lists seen' },
      {
        t: 'table',
        head: ['Section', 'Items'],
        rows: [
          ['EXPLOSIVES', 'Fougasse, Sticky Bomb, Flash Grenade, C4, Land Mine, Push Grenade, Molotov Cocktail, Firework, Nuclear Bomb, Munroe Bomb, Barrel 1, Barrel 2, Fragmentation Grenade, Improvised Charge'],
          ['SPECIAL', 'Freeze Grenade, Smoke Grenade, Gas Grenade, Explosive Charge, Virus Barrel, Bouncy Bomb Box, Mutation Grenade, Nasty Bomb, Spike Grenade, Honey Grenade'],
          ['TRAPS', 'Animal Trap, Turret, Modular Turret, Healing Turret, Rocket Turret, Turret with Knives, Blade Trap'],
        ],
      },
      { t: 'h', x: 'Explosive Charge (the documented one)' },
      {
        t: 'facts', items: [
          ['seen', 'A dark green box with an antenna. Its parameters: RADIUS 5, POWER 2, DAMAGE 80, TEMPERATURE 5, DESTROYABLE (unchecked), LOOP TIME STEP 1, DELAY 3.'],
          ['seen', 'After the power button, a large grey and black smoke cloud with orange sparks filled the screen. The charge was gone and soot stayed on the floor.'],
          ['inferred', 'DELAY 3 is the wait in seconds. The blast came about two to three seconds after the tap.'],
          ['unknown', 'Units, limits and what LOOP TIME STEP does.'],
        ],
      },
      { t: 'items', ids: ['explosive-charge'] },
      { t: 'h', x: 'Other things seen' },
      {
        t: 'facts', items: [
          ['seen', 'Fougasse: a small dark green grenade-like object. After the power button a bright fireball and a scorch mark on the floor.'],
          ['seen', 'Explosions leave soot on the floor and yellow fire patches burn along it for a while.'],
          ['inferred', 'The fire patches came from the Molotov Cocktail. The item was not clearly named on the field.'],
          ['seen', 'Turret: a green wheeled gun. Without any tap from the player it shot a nearby ragdoll, which fell.'],
          ['inferred', 'Turrets aim and fire by themselves.'],
          ['unknown', 'What Sticky Bomb, C4, Land Mine and Push Grenade each did. They were spawned in a group and not told apart.'],
          ['unknown', 'The parameters of every explosive except the Explosive Charge. Nothing else was opened.'],
          ['unknown', 'Any settings of any trap.'],
        ],
      },
      { t: 'callout', kind: 'warn', x: 'Explosives also move other objects. We have no blast radius or force figures, so the builder cannot predict a blast. It only shows where things sit.' },
    ],
  },

  // ------------------------------------------------------------------ syringes
  {
    slug: 'syringes',
    group: 'systems',
    title: 'Syringes and medicine',
    summary: 'The syringe list with colours, how they were used and why effects are not listed.',
    related: ['explosives-and-traps', 'electricity'],
    blocks: [
      { t: 'p', x: 'The SYRINGES section is a row of coloured needles. The recordings show them being dropped onto ragdolls, but **do not show which needle caused which change**. For that reason this page lists names and colours only.' },
      {
        t: 'table',
        head: ['Syringe', 'Colour seen'],
        rows: [
          ['Regen', 'Green and black'],
          ['Healing', 'Red'],
          ['Acid', 'Orange or brown'],
          ['Immortality', 'Black'],
          ['Underwater Breathing', 'Blue'],
          ['Fireproof', 'Yellow-green'],
          ['Virus', 'Purple'],
          ['Electricity Protection', 'Pink or purple'],
          ['Hard Skin', 'Blue'],
          ['Embalming', 'Light green or yellow-green'],
          ['Joint Diluent', 'Dark red'],
          ['Regrowth', 'Green'],
          ['Frost', 'Cyan'],
        ],
      },
      {
        t: 'facts', items: [
          ['seen', 'A syringe spawns at your finger and falls. Dragging it onto a ragdoll sticks it in.'],
          ['seen', 'Ragdolls often collapsed after a syringe, with brown dust at the feet. The cause is not clear.'],
          ['seen', 'The last icon in the list looks like a syringe launcher (inferred).'],
          ['seen', 'Flasks with the same names exist in the full item list.'],
          ['unknown', 'Which syringe does what. Guessing from colour would be unreliable, so we do not.'],
        ],
      },
      { t: 'p', x: 'Only the Regen syringe and flask are measured so far.' },
      { t: 'items', ids: ['regen', 'regen-flask'] },
      { t: 'h', x: 'Medicine items' },
      {
        t: 'facts', items: [
          ['seen', 'The Defibrillator is a box with two paddles on cables. Drag the paddles onto a ragdoll torso, then press the power button. White and yellow sparks and arcs appeared around the body.'],
          ['inferred', 'The Limb Connector reattaches limbs. It was dropped on a broken ragdoll, but the result was not clear.'],
          ['unknown', 'What Bandage, Splint and Heartbeat Monitor do. They were only seen lying on the floor.'],
        ],
      },
      { t: 'items', ids: ['defibrillator', 'limb-connector', 'bandage', 'splint', 'heartbeat-monitor'] },
    ],
  },

  // ----------------------------------------------------------- measuring method
  {
    slug: 'measuring-method',
    group: 'site',
    title: 'How sizes were measured',
    summary: 'What a crate is, how each size was found, how accurate it is and what the badges mean.',
    related: ['glossary'],
    blocks: [
      { t: 'p', x: 'The game never shows the size of an item. We measured each one from a screenshot.' },
      { t: 'h', x: 'The method' },
      {
        t: 'ol', items: [
          'The owner spawned one item next to a Crate. The camera stayed at one fixed zoom and position.',
          'A script compared each screenshot with a background built from many shots. The difference shows the item, and its tight bounding box gives width and height in pixels.',
          'The Crate measured 263 by 261 pixels. Width divided by 263 and height divided by 261 give sizes in **crates**.',
          'One grid cell is one eighth of a crate. The builder snaps to those cells.',
        ],
      },
      { t: 'h', x: 'How accurate it is' },
      {
        t: 'ul', items: [
          'Plus or minus about 2 pixels on each edge.',
          'For items near a crate in size that is under 1 percent.',
          'For the tiniest items it can be up to about 8 percent, because 2 pixels is a lot of a 25 pixel item.',
          'These are our measurements. They are not official numbers from the game.',
        ],
      },
      { t: 'h', x: 'Needs a better measurement' },
      { t: 'p', x: 'Some items carry a badge. Each one means the same thing: a new shot would help.' },
      {
        t: 'table',
        head: ['Badge', 'What it means'],
        rows: [
          ['edge-unsure', 'The edges were hard to find. Glow, shadow, sparks or a see-through part may have made the box a little too large or small.'],
          ['name-unsure', 'The item was identified from the panel order and how it looked, not from a name on the field. It may be the wrong item.'],
          ['large', 'The item is big. It may not have fitted in the view or may be partly cut off at the edge (inferred), so the true size could be bigger.'],
        ],
      },
      { t: 'h', x: 'Other limits' },
      {
        t: 'ul', items: [
          'One shot is one pose. Pistons, doors and anything that unfolds can change size. The Piston has two entries for that reason.',
          'Mass and weight were never measured. The game does not show them.',
          'Clothing is skipped on purpose. It is worn, not placed.',
        ],
      },
      { t: 'p', x: 'Want to help? See how to send a shot on the [Missing items](#/wiki/missing) page.' },
    ],
  },

  // ------------------------------------------------------------------ glossary
  {
    slug: 'glossary',
    group: 'site',
    title: 'Glossary',
    summary: 'Short definitions for words used on this site.',
    related: ['measuring-method'],
    blocks: [{ t: 'glossary' }],
  },
];

export const GLOSSARY = [
  ['Crate', 'The wooden box in the game. Every size on this site is measured against it. It is 263 by 261 pixels in our screenshots and counts as 1 by 1.'],
  ['Grid cell', 'One eighth of a crate. The builder grid uses this size.'],
  ['Ragdoll', 'A floppy character such as the Pumpkin or Melon. About 2 crates tall.'],
  ['Freeze', 'Pins an object in place so it no longer moves. The menu button changes to UNFREEZE. (Not to be confused with the Freeze Gun, which is an item.)'],
  ['Activation', 'Triggering an object, either by the power buttons, the ACTIVATE menu entry or a wire.'],
  ['Power button', 'A round icon at the bottom corners of the screen. It appears when something can be activated.'],
  ['Contraption', 'A machine you build from several items. The Contraption Spawner can spawn one you saved.'],
  ['Context menu', 'The 3x3 menu that opens when you tap a placed object.'],
  ['Parameter', 'A setting on an object, opened with EDIT PARAMETERS.'],
  ['Wire', 'The rainbow-arrow tool. It connects an output on one object to an input on another.'],
  ['Electric wire', 'The lightning-bolt tool. It carried power from a Generator.'],
  ['Chip', 'An item that opens a node editor. You place gates and join them with lines.'],
  ['Gate', 'One block in the chip editor, such as Add or Camera Zoom.'],
  ['Ghost', 'The see-through look of a vehicle just after it spawns.'],
  ['Unconfirmed', 'A badge on things we have not seen clearly. Treat them as guesses.'],
  ['Seen / Inferred / Not shown', 'Seen: visible in a recording. Inferred: our reading of it. Not shown: no evidence either way.'],
];
