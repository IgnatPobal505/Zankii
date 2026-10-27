# Zankii — Wave Arcade

**[Play in your browser →](https://ignatpobal505.github.io/Zankii/)**

Hold. Release. Break through. Ten original Wave courses with blocks, slaloms, moving gates, rotating saws and five portal types. No installation, build step or external libraries.

## Ten different courses

| # | Course | Difficulty | Main challenge |
| --- | --- | --- | --- |
| 01 | [Circuit Break](https://ignatpobal505.github.io/Zankii/#circuit-break) | Easy | Broad block slalom, staircase and a first speed sector |
| 02 | [Ion Drive](https://ignatpobal505.github.io/Zankii/#ion-drive) | Easy | Moving gates and rotating saws |
| 03 | [Lunar Shift](https://ignatpobal505.github.io/Zankii/#lunar-shift) | Normal | Inverted gravity with restoration portals |
| 04 | [Pocket Storm](https://ignatpobal505.github.io/Zankii/#pocket-storm) | Normal | Mini Wave, steeper flight and size transitions |
| 05 | [Rift Runner](https://ignatpobal505.github.io/Zankii/#rift-runner) | Hard | Linked teleports, clear exit markers and lane transfers |
| 06 | [Dual Core](https://ignatpobal505.github.io/Zankii/#dual-core) | Hard | Two mirrored Waves through separate lanes |
| 07 | [Phase Factory](https://ignatpobal505.github.io/Zankii/#phase-factory) | Hard | Machinery mixed with mini, gravity and teleport sectors |
| 08 | [Redline](https://ignatpobal505.github.io/Zankii/#redline) | Insane | Fast block slalom, tight gates and precision transitions |
| 09 | [Event Horizon](https://ignatpobal505.github.io/Zankii/#event-horizon) | Insane | Dual lanes, teleports and inverted control |
| 10 | [Final Protocol](https://ignatpobal505.github.io/Zankii/#final-protocol) | Extreme | Every mechanic in the most demanding sequence |

All ten courses are available immediately. The final three are intentionally much harder. Difficulty comes from clearance, speed, obstacles and mechanic combinations; duration is not used as a difficulty rating. The original three routes have been replaced, including the retired frog course.

## Controls

- Hold **Space**, **A**, **any arrow key**, the **left mouse button**, or **touch the playing field** to climb.
- Release to dive. Multiple held controls work together: releasing one does not cancel another.
- **Inverted gravity reverses hold/release direction.** A visible restoration portal returns normal controls.
- **R** restarts the course; **Esc** pauses/resumes. Switching away also pauses and releases input.
- **♫** enables original browser-generated music. Sound starts off.
- **⛶** enables fullscreen where supported. Phones are easier to play in landscape.

Physical **KeyA** also works with the Russian keyboard layout (the **Ф** key).

## Portals

| Portal | What it really changes |
| --- | --- |
| Speed | Flight speed, including 0.80× slow sectors, normal speed and boosts up to 1.60× |
| Mini / Normal | Character and collision size; Mini has twice the vertical-to-horizontal velocity ratio |
| Gravity | Reverses the vertical response; restoration returns it to normal |
| Teleport | Moves to the marked orange exit; the trail breaks instead of crossing the intervening wall |
| Dual / Single | Adds/removes a mirrored second Wave; both characters have active collisions |

Portals are labelled in advance. A live HUD shows size, dual state, speed and control direction. Rotating saws and moving gates have visible motion tracks. A red impact ring and a specific collision message explain failed runs.

## Practice and accessibility

Enable **Practice mode** on the course's start panel and optionally choose a starting sector. Safe checkpoints are saved after entering sectors. Retry restores position, simulation time, portal state and moving-hazard phase. Practice never saves a normal completion or personal best.

**Settings → Low effects** simplifies rendering and removes glow. **Portal pulse** is off by default and only draws a local activation ring when enabled. There is no full-screen strobe or camera shake. Graphics settings do not change collision or timing.

Normal records use `zankii-progress-v2`. The previous release's `zankii-progress-v1` data is left intact but is not transferred onto rebuilt routes. Settings use `zankii-settings-v2`. All storage is local to the browser; the game also works when storage is unavailable.

## Development and verification

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/`. An HTTP server is needed for JavaScript modules; opening the HTML file directly is not supported.

With Node.js 18 or newer:

```sh
npm test
```

The tests complete all ten courses with ordinary hold/release inputs and live collisions; exercise every portal type; check both members of a dual; validate moving hazards, practice entry/checkpoint state, 30/60/144 Hz consistency, instant direction changes, pausing and collision tunnelling. These simulations prove a playable input path exists; they do not replace human difficulty tuning.

Main files: `engine.js` (courses and fixed-step simulation), `render.js` (Canvas graphics), `game.js` (UI, audio, storage and input), `styles.css` (responsive interface). GitHub Pages serves the root of `main`.

## Research and references

The reference comparison is recorded in [community-research.json](design/community-research.json), with source links, displayed likes/downloads and explicit limitations. Among the sampled pages, [Bloodbath](https://gdbrowser.com/10565740) and [Nine Circles](https://gdbrowser.com/4284013) have larger accumulated like counts than [Change of Scene](https://gdbrowser.com/90475473) and [Sonic Wave](https://gdbrowser.com/26681070). This is a small selection, not a global ranking or approval percentage; age and downloads differ. Routes, artwork and music in Zankii are original, rather than imported copies of those levels.

The user's supplied forum feedback informed route visibility, progressive difficulty, variety and optional effects. Direct retrieval of those forum threads timed out during this update, so their summary is attributed to the user rather than presented as independently verified survey findings. [Geode Texture Loader](https://geode-sdk.org/mods/geode.texture-loader) manages texture packs; its download count was not treated as a vote for any particular pack or course.

Earlier imagegen concepts remain in [design/style-options](design/style-options/) as an archive. The Fat Wave shape reference comes from [GDBrowser's Icon Kit](https://gdbrowser.com/iconkit/), whose original game sprites belong to RobTop Games. Zankii keeps its dark-blue shell and violet centre.
