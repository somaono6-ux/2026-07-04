# Cowsmic Escape

A 3D browser game. Bessie the cow is grazing on an Iowa farm at 2 AM when a UFO beams her up. Now she has to fight her way off the alien mothership with a milk blaster, a hoof dash, and a very loud moo.

Built with [Three.js](https://threejs.org/). There is no build step and there are no asset files: every model is assembled from primitive shapes in code, and every sound effect and music loop is synthesized with the Web Audio API.

## Running it

The game uses ES modules, so it has to be served over HTTP. Opening `index.html` straight from disk will not work.

```sh
npx serve .
# or
python3 -m http.server 8000
```

Then open the printed address (for example http://localhost:8000). An internet connection is needed the first time, because Three.js and the fonts load from CDNs.

To host it, enable GitHub Pages for this repository (Settings → Pages → deploy from the branch root). No other setup is needed.

## Controls

| Action | Keyboard and mouse | Touch | Gamepad |
| --- | --- | --- | --- |
| Move | WASD or arrow keys | Left thumb | Left stick |
| Aim and squirt milk | Mouse, hold left click | Hold right thumb, drag to aim | Right stick |
| Hoof Dash (can't be hit mid-dash) | Space or Shift | DASH button | A or LB |
| Mega Moo shockwave | Q, E, or right click | MOO button | B or RB |
| Pause | Esc or P | Pause button | Start |
| Mute | M | Speaker button | |

## The mothership

| Deck | Room | What's waiting |
| --- | --- | --- |
| 1 | Holding Pen | Zorblets, a short tutorial, and Bessie's first Zapper |
| 2 | Specimen Lab | Probe Drones, Zappers, and some abducted farm animals in tubes |
| 3 | Reactor Core | Gloopzillas that charge (lure them into walls to stun them) |
| Final | Command Bridge | Overlord Zyx, a three-phase boss with bullet patterns, minions, and a death ray |

Each deck is a series of waves. Clear them all and the north door opens. Walk through it to beam to the next deck.

- **Hay bales** restore 30 health.
- **Golden Milk** gives a triple-shot blaster for 10 seconds.
- Kills in quick succession build a combo multiplier, up to ×5.
- Mega Moo also erases enemy plasma shots inside its radius.
- If Bessie goes down, you restart the current deck with full health.

Your best score is saved in the browser.

## Project layout

```
index.html        page shell, HUD, and menus
style.css         HUD and menu styling
src/main.js       game state, level flow, camera, main loop
src/player.js     Bessie: movement, milk blaster, dash, Mega Moo
src/enemies.js    alien behaviours, including the Overlord Zyx boss
src/projectiles.js  milk shots, plasma bolts, and pickups
src/levels.js     deck layouts, waves, and alien chatter
src/world.js      arena construction and the farm scene
src/models.js     procedural models for every character and prop
src/cutscenes.js  title backdrop, abduction intro, homecoming ending
src/effects.js    particles, shockwave rings, teleport beams, floating text
src/hud.js        health, score, cooldowns, boss bar, edge arrows
src/input.js      keyboard, mouse, touch twin-sticks, gamepad
src/audio.js      synthesized sound effects and music
src/textures.js   canvas-drawn textures and the reflection environment
src/util.js       math helpers
```
