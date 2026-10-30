# Zankii — Wave Arcade

**[Play in your browser →](https://ignatpobal505.github.io/Zankii/)**

Hold. Release. Break through. Fourteen original Wave courses with blocks, slaloms, moving gates, rotating saws and five portal types. The iPhone app and browser game share the same engine and original courses.

## iPhone app — current development focus

Open **[ios/Zankii.xcodeproj](ios/Zankii.xcodeproj)** in Xcode 15 or newer on a Mac. iPhone, iOS 16+, landscape in both directions. All game assets are committed and bundled for offline play; no Node.js, server, CocoaPods or third-party dependency is needed to build the app. The project is signed by the WaiWai, LLC team as `school.wai.zankii` and is distributed through TestFlight.

The iPhone layout has a large **HOLD** button beside the playfield, **Pause / Resume**, **Restart**, **Levels**, **Sound** and **Settings**. It respects safe areas, clears held input and pauses on interruption, and prevents screen sleep during an active run. Browser records and app records are separate.

**[Russian build instructions and device verification steps →](ios/README.md)**

Version 0.3.0 (build 1) was built and uploaded to TestFlight on 29 October 2026. It was played in the iPhone 17 simulator: start, HOLD, collisions, pause when the app goes to the background, level list and records after relaunch. Real-device verification remains. The shared game and packaging/input tests pass. A browser preview is not an iOS device test. This 0.3.1 (build 2) source update has not been built or uploaded to TestFlight here; the next native build remains for the other Mac.

## Fourteen different courses

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
| 11 | [Arcade Passage](https://ignatpobal505.github.io/Zankii/#arcade-passage) | Easy | Wide moving gates, block slalom and a first rift |
| 12 | [Neon Relay](https://ignatpobal505.github.io/Zankii/#neon-relay) | Normal | Saws, gravity shifts, linked exits and staircases |
| 13 | [Split Signal](https://ignatpobal505.github.io/Zankii/#split-signal) | Hard | Mini control, moving gates, teleports and dual lanes |
| 14 | [Blackout Circuit](https://ignatpobal505.github.io/Zankii/#blackout-circuit) | Insane | Early dual lanes, boost, inverted gates and a Mini finale |

All fourteen courses are available immediately. Redline, Event Horizon, Final Protocol and Blackout Circuit are the expert challenges. The first ten routes and their records are unchanged by the four-course expansion. Difficulty comes from clearance, speed, obstacles and mechanic combinations; duration is not used as a difficulty rating. The original three routes have been replaced, including the retired frog course.

## Controls

- Hold **HOLD**, **Space**, **A**, **any arrow key**, the **left mouse button**, or **touch the playing field** to climb.
- Release to dive. Multiple held controls work together: releasing one does not cancel another.
- **Inverted gravity reverses hold/release direction.** A visible restoration portal returns normal controls.
- **R** restarts the course; **Esc** pauses/resumes. Switching away also pauses and releases input.
- **♫** enables the selected real soundtrack and game effects. Sound starts off.
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

## Music

**At the Speed of Light — Dimrain47** is included as a real, unmodified MP3 and replaces the synthesized melody. It is bundled for this **noncommercial** edition under [CC BY-NC 3.0](https://creativecommons.org/licenses/by-nc/3.0/); see [artist source](https://www.newgrounds.com/audio/listen/467339), [credits](assets/music/CREDITS.md) and [source/permission notes](design/soundtrack-research.json). Game sound effects remain generated locally.

**Settings → Soundtrack** lists fifteen identified tracks requested by the user or in the same GD selection, including Nine Circles, Lost, Sakupen Hell Yes RMX, Phobos, Code Red, Shiawase VIP, Theory of Everything 1/2, Electrodynamix and Sonic Blaster. Only At the Speed of Light has a bundled audio file. For the other entries, **Add audio file** chooses a local copy from Files; **Remove file** removes that imported copy. Imported music stays on the device in IndexedDB and is never uploaded. If storage is unavailable, the current session still works. Maximum import size is 40 MB.

The original artist links are provided beside the selector. Availability in Geometry Dash, a store purchase or a download button does not by itself authorize distributing a track in Zankii. Other original recordings are not copied into this repository without an applicable grant. The requested “Artemis 13” track remains unidentified and is excluded from the player until its exact name is available.

Playback follows the course clock, resumes at practice checkpoints and stops on pause, backgrounding or death. Only the selected file is loaded. Enabling sound and starting/resuming playback require player interaction.

## High-speed input and rendering fixes

Input transitions are timestamped rather than applying the last button state retroactively to a whole frame. Tests with the real 240 Hz engine preserve short taps and match regular 240/60/20 Hz frames and irregular frame delivery. A delay above 150 ms pauses before any catch-up movement; Resume begins a fresh input clock.

Decorative paths are batched, gradients and saw vertices reused, unchanged HUD values are left alone, and paused/dead frames are not continuously redrawn. Persistent slow frames enable **AUTO LOW FX** for that course attempt without changing physics. In a sampled Redline/Final Protocol/Blackout Circuit draw-call comparison, the largest stroke count fell from 194 to 38; these are Canvas operation counts, not a measured iPhone FPS claim. Real-device performance still needs checking after the iOS build.

## Development and verification

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/`. An HTTP server is needed for JavaScript modules; opening the HTML file directly is not supported.

With Node.js 18 or newer:

```sh
npm test
```

The tests complete all fourteen courses with ordinary hold/release inputs and live collisions; exercise every portal type; check both members of a dual; validate moving hazards, practice entry/checkpoint state, 30/60/144 Hz consistency, instant direction changes, pausing and collision tunnelling. They also check multiple touch/keyboard inputs, native interruption/resume behavior and offline iPhone packaging. These simulations prove a playable input path exists; they do not replace human difficulty tuning or native device testing.

After changing shared sources, run `npm run ios:sync` and commit `ios/Zankii/Web` with them. `npm run ios:check` verifies the checked-in offline package. Xcode uses these ready-to-build local files without a JavaScript build phase.

Main files: `engine.js` (courses and fixed-step simulation), `input-timeline.js` (timestamped controls), `render.js` (Canvas graphics), `game.js` (UI and coordination), `music-player.js` / `soundtracks.js` / `audio-storage.js` (recorded music and device imports), `styles.css` (responsive interface). GitHub Pages serves the root of `main`.

## Research and references

The reference comparison is recorded in [community-research.json](design/community-research.json), with source links, displayed likes/downloads and explicit limitations. Among the sampled pages, [Bloodbath](https://gdbrowser.com/10565740) and [Nine Circles](https://gdbrowser.com/4284013) have larger accumulated like counts than [Change of Scene](https://gdbrowser.com/90475473) and [Sonic Wave](https://gdbrowser.com/26681070). This is a small selection, not a global ranking or approval percentage; age and downloads differ. Routes and artwork are authored for Zankii. Music credits and source permissions are documented separately below.

The user's supplied forum feedback informed route visibility, progressive difficulty, variety and optional effects. Direct retrieval of those forum threads timed out during this update, so their summary is attributed to the user rather than presented as independently verified survey findings. [Geode Texture Loader](https://geode-sdk.org/mods/geode.texture-loader) manages texture packs; its download count was not treated as a vote for any particular pack or course.

Earlier imagegen concepts remain in [design/style-options](design/style-options/) as an archive. The Fat Wave shape reference comes from [GDBrowser's Icon Kit](https://gdbrowser.com/iconkit/), whose original game sprites belong to RobTop Games. Zankii keeps its dark-blue shell and violet centre.
