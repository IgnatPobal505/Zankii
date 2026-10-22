import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, LEVELS, createLevel, createRun, advance, corridorAt, collides, circleHitsPolygon, progress } from '../engine.js';

for (let i = 0; i < LEVELS.length; i++) {
  test(`${LEVELS[i].name}: complete route is playable using only normal Wave inputs`, () => {
    const level = createLevel(i), run = createRun(level); run.state = 'playing';
    // Follow the middle of the corridor with ordinary on/off steering; no collision bypass.
    let held = false, turns = 0;
    for (let tick = 0; tick < (level.seconds + 1) / WORLD.step && run.state === 'playing'; tick++) {
      const center = corridorAt(level, run.x + 18).center;
      if (run.y > center + 24 && !held) { held = true; turns++; }
      if (run.y < center - 24 && held) { held = false; turns++; }
      advance(run, held, WORLD.step);
    }
    assert.equal(run.state, 'complete', `Blocked at x=${run.x.toFixed(1)}, y=${run.y.toFixed(1)}`);
    assert.equal(progress(run), 100); assert.ok(turns > 20);
    assert.ok(Math.abs(run.time - level.seconds) < .01);
  });
  test(`${LEVELS[i].name}: all hazards are separated and the intended corridor is clear`, () => {
    const level = createLevel(i);
    for (let j = 1; j < level.hazards.length; j++) assert.ok(level.hazards[j].x - level.hazards[j - 1].x > 100);
    for (let x = 0; x < level.length; x += 8) {
      const c = corridorAt(level, x);
      assert.ok(c.bottom - c.top >= level.minGap - .01);
      assert.equal(collides(level, x, c.center), false);
    }
  });
}
test('Wave moves at 45 degrees, switches direction immediately, and uses the same speed in both directions', () => {
  const run = createRun(createLevel(0)); run.state = 'playing';
  advance(run, true, .1); assert.ok(Math.abs(run.x - 22.5) < 1e-8); assert.ok(Math.abs(run.y - 337.5) < 1e-8);
  advance(run, false, WORLD.step); assert.ok(run.y > 337.5);
  assert.ok(Math.abs(run.y - 337.5 - run.level.speed * WORLD.step) < 1e-8);
});
test('Simulation has the same result at 30, 60 and 144 rendered frames per second', () => {
  const positions = [30, 60, 144].map(fps => {
    const run = createRun(createLevel(0)); run.state = 'playing';
    for (let cycle = 0; cycle < 5 && run.state === 'playing'; cycle++) {
      for (let frame = 0; frame < fps / 2; frame++) advance(run, false, 1 / fps);
      for (let frame = 0; frame < fps / 2; frame++) advance(run, true, 1 / fps);
    }
    return [run.state, run.x, run.y];
  });
  assert.deepEqual(positions[0], positions[1]); assert.deepEqual(positions[1], positions[2]);
});
test('Pause and ready screens freeze all movement and progress', () => {
  const run = createRun(createLevel(0)); advance(run, true, .1); assert.equal(run.x, 0);
  run.state = 'playing'; advance(run, true, .05); const before = [run.x, run.y, run.time, run.accumulator];
  run.state = 'paused'; advance(run, false, 60); assert.deepEqual([run.x, run.y, run.time, run.accumulator], before);
});
test('Collision catches platform surfaces, crystal edges and tunneling attempts', () => {
  const level = createLevel(0);
  assert.equal(collides(level, 100, 0), true); assert.equal(collides(level, 100, 720), true);
  const hazard = level.hazards[0];
  assert.equal(circleHitsPolygon(hazard.poly[2].x, hazard.poly[2].y, 1, hazard.poly), true);
  const run = createRun(level); run.state = 'playing';
  for (let i = 0; i < 200 && run.state === 'playing'; i++) advance(run, true, .1);
  assert.equal(run.state, 'dead'); assert.ok(run.x < 300);
});
test('Each level can be restarted with a clean independent run', () => {
  const level = createLevel(0), a = createRun(level), b = createRun(level);
  a.state = 'playing'; advance(a, true, .1);
  assert.equal(b.state, 'ready'); assert.equal(b.x, 0); assert.equal(b.trail.length, 1);
});
