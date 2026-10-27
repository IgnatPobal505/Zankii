export const WORLD = Object.freeze({ width: 1280, height: 720, playerX: 220, radius: 9, step: 1 / 240, ceiling: 54, floor: 666 });
export const CONTROL_CODES = Object.freeze(['Space', 'KeyA', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
export const isFlightKey = code => CONTROL_CODES.includes(code);
export const PORTAL_INFO = Object.freeze({
  speed: { label: 'SPEED', color: '#ffce63', hint: 'The arrows show the new flight speed.' },
  size: { label: 'MINI', color: '#f59ce6', hint: 'Mini Wave is smaller and climbs at a steeper angle.' },
  gravity: { label: 'GRAVITY', color: '#ffdb70', hint: 'Inverted: hold to dive, release to climb.' },
  teleport: { label: 'TELEPORT', color: '#65d9ff', hint: 'Blue entrance. Orange exit. Follow the exit marker.' },
  dual: { label: 'DUAL', color: '#ffa56f', hint: 'Two Waves, one input. Both must survive.' }
});
const course = (id, name, difficulty, theme, speed, gap, bpm, subtitle, sequence) => ({ id, name, difficulty, theme, speed, gap, bpm, subtitle, sequence });
// Explicit sequences give each course its own obstacle vocabulary and progression.
export const LEVELS = [
  course('circuit-break', 'Circuit Break', 'Easy', 'mint', 250, 310, 112, 'Learn the line. Carve through blocks. Hit the boost.', ['launch', 'slalom', 'steps', 'boost', 'slalom', 'gates', 'finish']),
  course('ion-drive', 'Ion Drive', 'Easy', 'cyan', 260, 290, 118, 'Wide sweeps, rotating saws and your first moving gates.', ['launch', 'saws', 'gates', 'steps', 'boost', 'saws', 'finish']),
  course('lunar-shift', 'Lunar Shift', 'Normal', 'lunar', 275, 255, 124, 'Flip gravity. Read the arrows. Keep your nerve.', ['launch', 'slalom', 'invert', 'gates', 'invert', 'saws', 'boost', 'finish']),
  course('pocket-storm', 'Pocket Storm', 'Normal', 'pink', 280, 245, 128, 'Small Wave. Steep lines. A very different rhythm.', ['launch', 'steps', 'mini', 'saws', 'mini', 'gates', 'boost', 'finish']),
  course('rift-runner', 'Rift Runner', 'Hard', 'orange', 290, 210, 132, 'Jump between lanes through visible linked portals.', ['launch', 'slalom', 'teleport', 'gates', 'teleport', 'saws', 'boost', 'finish']),
  course('dual-core', 'Dual Core', 'Hard', 'violet', 295, 205, 136, 'Split into two. Thread both lanes with one button.', ['launch', 'saws', 'dual', 'slalom', 'dual', 'gates', 'finish']),
  course('phase-factory', 'Phase Factory', 'Hard', 'lime', 305, 190, 140, 'Moving machinery meets Mini Wave and gravity switches.', ['launch', 'gates', 'mini', 'invert', 'steps', 'teleport', 'gates', 'boost', 'finish']),
  course('redline', 'Redline', 'Insane', 'red', 325, 156, 148, 'Fast slalom, narrow gates and very little recovery room.', ['launch', 'boost', 'slalom', 'gates', 'mini', 'saws', 'invert', 'boost', 'gates', 'finish']),
  course('event-horizon', 'Event Horizon', 'Insane', 'ice', 330, 150, 152, 'Dual lanes, sharp transfers and inverted precision.', ['launch', 'invert', 'teleport', 'dual', 'mini', 'gates', 'dual', 'boost', 'saws', 'finish']),
  course('final-protocol', 'Final Protocol', 'Extreme', 'gold', 345, 132, 160, 'Every mechanic. Three pressure peaks. One clean finish.', ['launch', 'boost', 'mini', 'gates', 'invert', 'dual', 'teleport', 'mini', 'boost', 'dual', 'saws', 'finish'])
];
export const DIFFICULTIES = ['Easy', 'Normal', 'Hard', 'Insane', 'Extreme'];
export function seeded(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
export const rect = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
const sectionNames = { launch: 'Launch control', slalom: 'Block slalom', steps: 'Staircase', boost: 'Speed sector', gates: 'Moving gates', saws: 'Saw run', mini: 'Mini tunnel', invert: 'Gravity shift', teleport: 'Rift transfer', dual: 'Dual lanes', finish: 'Final approach' };
const lengths = { launch: 1100, slalom: 1600, steps: 1500, boost: 1700, gates: 1650, saws: 1550, mini: 1850, invert: 1800, teleport: 1700, dual: 2400, finish: 850 };

export function createLevel(index) {
  const config = LEVELS[index]; if (!config) throw new RangeError('Unknown level');
  const level = { ...config, index, objects: [], portals: [], sections: [], guides: [{ x: 0, y: 360 }], length: 0 };
  let cursor = 0;
  const guide = (x, y) => level.guides.push({ x, y });
  const block = (x, y, w, h, type = 'block') => { if (h > 0) level.objects.push({ type, x, w, poly: rect(x, y, w, h), y, h }); };
  const portal = (x, type, value, extra = {}) => level.portals.push({ x, type, value, ...extra });
  const gate = (x, cy, gap, width = 90, moving = false, lane = false) => {
    if (moving) { level.objects.push({ type: 'gate', x, w: width, cy, gap, amplitude: index < 2 ? 28 : 38, frequency: .85, phase: index * .6, lane: false }); }
    else if (lane) {
      block(x, 54, width, cy - gap / 2 - 54);
      block(x, cy + gap / 2, width, 310 - cy - gap / 2);
      block(x, 410, width, 720 - cy - gap / 2 - 410);
      block(x, 720 - cy + gap / 2, width, 666 - (720 - cy + gap / 2));
    } else { block(x, 54, width, cy - gap / 2 - 54); block(x, cy + gap / 2, width, 666 - cy - gap / 2); }
  };
  config.sequence.forEach((kind, s) => {
    const start = cursor, end = start + lengths[kind];
    const difficulty = DIFFICULTIES.indexOf(config.difficulty);
    const section = { kind, start, end, name: sectionNames[kind] }; level.sections.push(section);
    guide(start, 360); guide(start + 150, 360);
    const gap = config.gap;
    if (kind === 'launch' || kind === 'finish') {
      if (kind === 'launch') { block(start + 640, 54, 105, 96); block(start + 870, 576, 105, 90); }
      guide(end - 100, 360);
    }
    if (kind === 'slalom' || kind === 'steps' || kind === 'boost') {
      if (kind === 'boost') { portal(start + 180, 'speed', index < 2 ? 1.25 : index < 7 ? 1.4 : 1.6); portal(end - 160, 'speed', 1); }
      const centers = kind === 'steps' ? [435, 270, 405] : kind === 'boost' ? [295, 430, 300] : [265, 455, 270];
      centers.forEach((cy, k) => {
        const x = start + 430 + k * 420, width = kind === 'steps' ? 155 : kind === 'boost' ? 65 : 95;
        gate(x, cy, gap, width); guide(x - 80, cy); guide(x + width + 65, cy);
      });
    }
    if (kind === 'gates') {
      [320, 405, 310].forEach((cy, k) => { const x = start + 400 + k * 440; gate(x, cy, gap, 92, true); guide(x - 110, cy); guide(x + 195, cy); });
    }
    if (kind === 'saws') {
      [290, 430, 285, 410].forEach((cy, k) => {
        const x = start + 380 + k * 310, side = k % 2 ? -1 : 1;
        const radius = 38 + difficulty * 3;
        const safety = gap / 2;
        level.objects.push({ type: 'saw', x, w: radius * 2, cy: cy + side * (radius + safety), radius, amplitude: 17 + difficulty * 3, frequency: .95, phase: k * .7 });
        guide(x - 60, cy); guide(x + 60, cy);
        // Teeth on the opposite wall prevent camping on the far border.
        const y = side === 1 ? 54 : 666;
        level.objects.push({ type: 'spike', x: x - 30, w: 60, poly: [{ x: x - 30, y }, { x: x + 30, y }, { x, y: y + (side === 1 ? 65 : -65) }] });
      });
    }
    if (kind === 'mini') {
      portal(start + 80, 'speed', .8); portal(start + 250, 'size', true);
      portal(end - 280, 'size', false); portal(end - 110, 'speed', 1);
      const miniGap = Math.max(122, gap * .71);
      [265, 420, 285, 420].forEach((cy, k) => { const x = start + 465 + k * 315; gate(x, cy, miniGap, 100); guide(x - 65, cy); guide(x + 165, cy); });
    }
    if (kind === 'invert') {
      portal(start + 200, 'gravity', -1); portal(end - 180, 'gravity', 1);
      [435, 280, 415].forEach((cy, k) => { const x = start + 480 + k * 420; gate(x, cy, gap, 85); guide(x - 95, cy); guide(x + 150, cy); });
    }
    if (kind === 'teleport') {
      const first = start + 420, exit = start + 780;
      portal(first, 'teleport', null, { targetX: exit, targetY: 265, exitId: `exit-${s}`, targetLabel: 'UPPER EXIT' });
      block(start + 570, 54, 85, 612);
      guide(first - 80, 360); guide(exit, 265); guide(exit + 220, 265);
      gate(exit + 380, 415, gap, 100); guide(exit + 300, 415); guide(exit + 560, 415);
    }
    if (kind === 'dual') {
      guide(start + 230, 245); portal(start + 270, 'dual', true); portal(end - 200, 'dual', false);
      block(start + 590, 310, end - start - 1080, 100, 'divider');
      const laneGap = Math.max(108, Math.min(155, gap * .78));
      [200, 240, 195].forEach((cy, k) => { const x = start + 830 + k * 390; gate(x, cy, laneGap, 80, false, true); guide(x - 85, cy); guide(x + 155, cy); });
      guide(end - 280, 245);
    }
    guide(end - 30, 360); guide(end, 360); cursor = end;
  });
  level.length = cursor;
  level.guides.sort((a, b) => a.x - b.x);
  // Duplicate section boundaries are intentional; collapse them before interpolation.
  level.guides = level.guides.filter((p, i, a) => !i || p.x !== a[i - 1].x);
  level.portals.sort((a, b) => a.x - b.x);
  level.objects.sort((a, b) => a.x - b.x);
  level.mechanics = [...new Set(level.portals.map(p => p.type))];
  let lastX = 0, factor = 1, duration = 0;
  for (const p of level.portals) {
    duration += (p.x - lastX) / (config.speed * factor); lastX = p.x;
    if (p.type === 'speed') factor = p.value;
    if (p.type === 'teleport') lastX = p.targetX;
  }
  level.seconds = Math.round(duration + (level.length - lastX) / (config.speed * factor));
  return level;
}

export function sectionAt(level, x) { return level.sections.find(s => x >= s.start && x < s.end) || level.sections.at(-1); }
export function corridorAt(level, x) {
  const points = level.guides;
  let low = 0, high = points.length - 1;
  while (high - low > 1) { const mid = (low + high) >> 1; if (points[mid].x <= x) low = mid; else high = mid; }
  const a = points[low], b = points[high];
  const t = Math.max(0, Math.min(1, (x - a.x) / (b.x - a.x || 1)));
  return { center: a.y + (b.y - a.y) * t, top: WORLD.ceiling, bottom: WORLD.floor };
}
export const movingY = (object, time) => object.cy + Math.sin(time * object.frequency + object.phase) * object.amplitude;
export function polygonsFor(object, time) {
  if (object.type !== 'gate') return object.poly ? [object.poly] : [];
  const cy = movingY(object, time);
  return [rect(object.x, 54, object.w, cy - object.gap / 2 - 54), rect(object.x, cy + object.gap / 2, object.w, 666 - cy - object.gap / 2)];
}
export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
export function circleHitsPolygon(x, y, radius, poly) {
  if (pointInPolygon(x, y, poly)) return true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    if ((x - a.x - t * dx) ** 2 + (y - a.y - t * dy) ** 2 <= radius ** 2) return true;
  }
  return false;
}
export function collisionAt(level, x, y, time = 0, radius = WORLD.radius) {
  if (y - radius <= WORLD.ceiling || y + radius >= WORLD.floor) return { type: 'boundary', x, y };
  for (const o of level.objects) {
    if (o.x > x + 140) break;
    if (x > o.x + o.w + 140 || x < o.x - 140) continue;
    if (o.type === 'saw') {
      const cy = movingY(o, time);
      if ((x - o.x) ** 2 + (y - cy) ** 2 <= (radius + o.radius) ** 2) return { type: 'saw', x, y };
    } else if (polygonsFor(o, time).some(poly => circleHitsPolygon(x, y, radius, poly))) return { type: o.type, x, y };
  }
  return null;
}
export function collides(level, x, y, time = 0, radius = WORLD.radius) { return Boolean(collisionAt(level, x, y, time, radius)); }
export function createRun(level) {
  return { level, x: 0, y: 360, y2: 360, time: 0, accumulator: 0, state: 'ready', mini: false, gravity: 1, dual: false, speedFactor: 1, portalIndex: 0, trail: [{ x: 0, y: 360 }], trail2: [], lastHeld: false, events: [], collision: null };
}
export function createPracticeRun(level, sectionIndex = 0) {
  const run = createRun(level), section = level.sections[sectionIndex];
  if (!section) throw new RangeError('Unknown practice sector');
  const x = section.start; let position = 0, factor = 1, time = 0;
  for (const p of level.portals) {
    if (p.x >= x) break;
    time += (p.x - position) / (level.speed * factor); position = p.x; run.portalIndex++;
    if (p.type === 'speed') run.speedFactor = factor = p.value;
    if (p.type === 'size') run.mini = p.value;
    if (p.type === 'gravity') run.gravity = p.value;
    if (p.type === 'dual') run.dual = p.value;
    if (p.type === 'teleport') position = p.targetX;
  }
  run.time = time + (x - position) / (level.speed * factor); run.x = x; run.y = corridorAt(level, x).center; run.y2 = 720 - run.y;
  run.trail = [{ x, y: run.y }]; run.trail2 = run.dual ? [{ x, y: run.y2 }] : [];
  return run;
}
export function applyPortal(run, portal) {
  if (portal.type === 'speed') run.speedFactor = portal.value;
  if (portal.type === 'size') run.mini = portal.value;
  if (portal.type === 'gravity') run.gravity = portal.value;
  if (portal.type === 'dual') { run.dual = portal.value; run.y2 = 720 - run.y; run.trail2 = run.dual ? [{ x: run.x, y: run.y2 }] : []; }
  if (portal.type === 'teleport') {
    run.trail.push({ x: run.x, y: run.y });
    if (run.dual) run.trail2.push({ x: run.x, y: run.y2 });
    run.x = portal.targetX; run.y = portal.targetY;
    if (run.dual) run.y2 = 720 - run.y;
    run.trail.push({ x: run.x, y: run.y, break: true });
    if (run.dual) run.trail2.push({ x: run.x, y: run.y2, break: true });
  }
  run.events.push({ type: portal.type, value: portal.value, time: run.time, x: run.x });
  if (run.events.length > 12) run.events.shift();
  run.trail.push({ x: run.x, y: run.y });
  if (run.dual) run.trail2.push({ x: run.x, y: run.y2 });
}
export function advance(run, held, delta) {
  if (run.state !== 'playing') return;
  run.accumulator += Math.max(0, Math.min(delta, .1));
  while (run.accumulator + 1e-10 >= WORLD.step && run.state === 'playing') {
    run.accumulator = Math.max(0, run.accumulator - WORLD.step);
    if (held !== run.lastHeld) { run.trail.push({ x: run.x, y: run.y }); if (run.dual) run.trail2.push({ x: run.x, y: run.y2 }); run.lastHeld = held; }
    const dx = run.level.speed * run.speedFactor * WORLD.step;
    const dy = (held ? -1 : 1) * run.gravity * dx * (run.mini ? 2 : 1);
    run.x += dx; run.y += dy; if (run.dual) run.y2 -= dy; run.time += WORLD.step;
    while (run.portalIndex < run.level.portals.length && run.x >= run.level.portals[run.portalIndex].x) applyPortal(run, run.level.portals[run.portalIndex++]);
    const radius = WORLD.radius * (run.mini ? .55 : 1);
    run.collision = collisionAt(run.level, run.x, run.y, run.time, radius) || (run.dual ? collisionAt(run.level, run.x, run.y2, run.time, radius) : null);
    if (run.collision) { run.state = 'dead'; break; }
    if (run.x >= run.level.length) { run.x = run.level.length; run.state = 'complete'; break; }
    for (const trail of [run.trail, run.trail2]) while (trail.length > 2 && trail[1].x < run.x - 1280) trail.shift();
  }
}
export function progress(run) { return Math.min(100, Math.floor(run.x / run.level.length * 100)); }
// Test/authoring aid: produces only hold/release input. It cannot alter a run or skip collisions.
export function guideInput(run, previous = false, tolerance = 12) {
  let target = corridorAt(run.level, run.x + 15).center;
  const gate = run.level.objects.find(o => o.type === 'gate' && run.x > o.x - 150 && run.x < o.x + o.w + 150);
  if (gate) target += movingY(gate, run.time) - gate.cy;
  if (run.y > target + tolerance) return run.gravity === 1;
  if (run.y < target - tolerance) return run.gravity !== 1;
  return previous;
}
