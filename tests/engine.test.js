import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, LEVELS, CONTROL_CODES, createLevel, createRun, createPracticeRun, advance, progress, guideInput, applyPortal, collisionAt, circleHitsPolygon, rect, isFlightKey } from '../engine.js';

function completeCourse(index, tolerance = 10) {
  const level = createLevel(index), run = createRun(level); run.state = 'playing';
  let held = false, turns = 0, types = new Set();
  for (let tick = 0; tick < 60000 && run.state === 'playing'; tick++) {
    const next = guideInput(run, held, tolerance); if (next !== held) turns++; held = next;
    advance(run, held, WORLD.step); for (const e of run.events) types.add(e.type);
    if (run.dual) assert.ok(Math.abs(run.y + run.y2 - 720) < 1e-7, 'Dual motion lost symmetry');
  }
  return { run, level, turns, types };
}
for (let i = 0; i < LEVELS.length; i++) {
  test(`${LEVELS[i].name}: entire authored course is clearable with hold/release and live collisions`, () => {
    const { run, level, turns, types } = completeCourse(i);
    assert.equal(run.state, 'complete', `Hit ${run.collision?.type} at ${run.x}`);
    assert.equal(progress(run), 100); assert.ok(turns > 25);
    assert.equal(run.portalIndex, level.portals.length);
    for (const m of level.mechanics) assert.ok(types.has(m), `Did not exercise ${m}`);
    assert.equal(run.dual, false); assert.equal(run.mini, false); assert.equal(run.gravity, 1); assert.equal(run.speedFactor, 1);
    assert.ok(Math.abs(run.time - level.seconds) < .6);
  });
}
test('Campaign has fourteen distinct English courses, five portal types and four expert challenges', () => {
  assert.equal(LEVELS.length, 14); assert.equal(new Set(LEVELS.map(l => l.id)).size, 14);
  assert.equal(new Set(LEVELS.map(l => l.sequence.join('/'))).size, 14);
  assert.equal(LEVELS.filter(l => ['Insane', 'Extreme'].includes(l.difficulty)).length, 4);
  assert.ok(LEVELS.slice(7, 10).every(l => l.gap <= 156));
  assert.equal(LEVELS.some(l => l.id === 'frog'), false);
  assert.equal(LEVELS.some(l => /[а-яё]/i.test(l.name + l.subtitle)), false);
  assert.deepEqual([...new Set(LEVELS.flatMap((_, i) => createLevel(i).mechanics))].sort(), ['dual', 'gravity', 'size', 'speed', 'teleport']);
});
test('Space, physical A and all arrows are flight inputs; restart is separate', () => {
  for (const code of ['Space', 'KeyA', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) assert.equal(isFlightKey(code), true);
  assert.equal(CONTROL_CODES.length, 6); assert.equal(isFlightKey('KeyR'), false); assert.equal(isFlightKey('KeyF'), false);
});
test('Normal Wave has an instant 45-degree change with no acceleration', () => {
  const r = createRun(createLevel(0)); r.state = 'playing'; advance(r, true, .1);
  assert.ok(Math.abs(r.x - 25) < 1e-8); assert.ok(Math.abs(r.y - 335) < 1e-8);
  advance(r, false, WORLD.step); assert.ok(Math.abs(r.y - 335 - r.level.speed * WORLD.step) < 1e-8);
});
test('All five portals change real simulation state, including mini slope and paired teleport', () => {
  const r = createRun(createLevel(9)); r.state = 'playing';
  applyPortal(r, { type: 'speed', value: 1.6 }); applyPortal(r, { type: 'size', value: true });
  const before = { x: r.x, y: r.y }; advance(r, true, WORLD.step);
  assert.ok(Math.abs((before.y - r.y) / (r.x - before.x) - 2) < 1e-8);
  applyPortal(r, { type: 'gravity', value: -1 }); const y = r.y; advance(r, true, WORLD.step); assert.ok(r.y > y);
  applyPortal(r, { type: 'dual', value: true }); assert.equal(r.y2, 720 - r.y);
  applyPortal(r, { type: 'teleport', targetX: 500, targetY: 250 }); assert.equal(r.x, 500); assert.equal(r.y, 250); assert.equal(r.y2, 470);
  assert.ok(r.trail.some(p => p.break));
});
test('Either member of a dual can collide; the primary is not the only player checked', () => {
  const level = createLevel(0); level.objects = [{ type: 'block', x: 10, w: 100, poly: rect(10, 470, 100, 100) }];
  const r = createRun(level); r.state = 'playing'; r.y = 200; applyPortal(r, { type: 'dual', value: true });
  for (let i = 0; i < 100 && r.state === 'playing'; i++) advance(r, true, WORLD.step);
  assert.equal(r.state, 'dead'); assert.equal(r.collision.type, 'block');
});
test('Moving gates and saws use their current positions in collision checks', () => {
  const l = createLevel(0);
  l.objects = [{ type: 'gate', x: 200, w: 80, cy: 360, gap: 140, amplitude: 60, frequency: 1, phase: 0 }];
  assert.equal(collisionAt(l, 220, 305, 0), null); assert.equal(collisionAt(l, 220, 305, Math.PI / 2)?.type, 'gate');
  l.objects = [{ type: 'saw', x: 300, w: 70, cy: 360, radius: 35, amplitude: 70, frequency: 1, phase: 0 }];
  assert.equal(collisionAt(l, 300, 360, 0)?.type, 'saw'); assert.equal(collisionAt(l, 300, 360, Math.PI / 2), null);
});
test('Pause freezes the clock, moving hazards, portal state and position', () => {
  const r = createRun(createLevel(0)); r.state = 'playing'; advance(r, true, .05); r.state = 'paused';
  const before = JSON.stringify(r); advance(r, false, 60); assert.equal(JSON.stringify(r), before);
});
test('Fixed simulation steps give identical motion and collisions at 30/60/144 Hz', () => {
  const positions = [30, 60, 144].map(fps => {
    const r = createRun(createLevel(0)); r.state = 'playing';
    for (let cycle = 0; cycle < 3 && r.state === 'playing'; cycle++) for (const held of [true, false]) for (let f = 0; f < fps / 2; f++) advance(r, held, 1 / fps);
    return [r.state, r.x, r.y, r.time, r.portalIndex];
  });
  assert.deepEqual(positions[0], positions[1]); assert.deepEqual(positions[1], positions[2]);
});
test('Solid edges, world rails and narrow blocks catch a swept high-speed player', () => {
  assert.equal(circleHitsPolygon(10, 20, 3, rect(12, 10, 10, 30)), true);
  const l = createLevel(0); l.objects = [{ type: 'block', x: 100, w: 2, poly: rect(100, 54, 2, 612) }];
  const r = createRun(l); r.state = 'playing'; r.speedFactor = 2;
  for (let i = 0; i < 10 && r.state === 'playing'; i++) advance(r, false, .1);
  assert.equal(r.state, 'dead'); assert.equal(r.collision.type, 'block'); assert.ok(r.x < 105);
});
test('Restarting is independent and returns all portal modes to normal', () => {
  const l = createLevel(9), a = createRun(l); applyPortal(a, { type: 'size', value: true }); applyPortal(a, { type: 'gravity', value: -1 });
  const b = createRun(l); assert.equal(b.mini, false); assert.equal(b.gravity, 1); assert.equal(b.x, 0); assert.equal(b.time, 0); assert.equal(b.events.length, 0);
});
test('Every Final Protocol practice sector starts in a coherent state and remains clearable', () => {
  const l = createLevel(9);
  for (let sector = 0; sector < l.sections.length; sector++) {
    const r = createPracticeRun(l, sector); r.state = 'playing'; let held = false;
    assert.equal(r.x, l.sections[sector].start); assert.equal(r.mini, false); assert.equal(r.dual, false); assert.equal(r.gravity, 1);
    for (let tick = 0; tick < 60000 && r.state === 'playing'; tick++) { held = guideInput(r, held); advance(r, held, WORLD.step); }
    assert.equal(r.state, 'complete', `Practice entry ${sector + 1} hits ${r.collision?.type}`);
  }
});
test('Restoring a checkpoint preserves modes, clock and moving-hazard phase', () => {
  const level = createLevel(9), firstMini = level.sections.findIndex(s => s.kind === 'mini');
  let r = createPracticeRun(level, firstMini); r.state = 'playing'; let held = false;
  while (!r.mini && r.state === 'playing') { held = guideInput(r, held); advance(r, held, WORLD.step); }
  assert.equal(r.mini, true); const { level: ignored, ...checkpoint } = r;
  const restored = { level, ...structuredClone(checkpoint) };
  advance(r, held, .08); advance(restored, held, .08);
  assert.deepEqual([r.x, r.y, r.time, r.mini, r.portalIndex, r.state], [restored.x, restored.y, restored.time, restored.mini, restored.portalIndex, restored.state]);
});
