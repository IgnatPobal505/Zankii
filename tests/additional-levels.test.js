import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, LEVELS, createLevel, createPracticeRun, advance, guideInput } from '../engine.js';

const additions = ['arcade-passage', 'neon-relay', 'split-signal', 'blackout-circuit'];
function fly(run) {
  run.state = 'playing';
  let held = false, changes = 0;
  const activated = new Set();
  for (let tick = 0; tick < 60000 && run.state === 'playing'; tick++) {
    const next = guideInput(run, held, 10);
    if (next !== held) changes++;
    held = next;
    advance(run, held, WORLD.step);
    for (const event of run.events) activated.add(event.type);
    if (run.dual) assert.ok(Math.abs(run.y + run.y2 - WORLD.height) < 1e-7, 'Both dual players keep mirrored movement');
  }
  return { changes, activated };
}

for (const id of additions) {
  test(`${id}: every practice sector has a safe and clearable entry`, () => {
    const level = createLevel(LEVELS.findIndex(candidate => candidate.id === id));
    for (let sector = 0; sector < level.sections.length; sector++) {
      const run = createPracticeRun(level, sector);
      fly(run);
      assert.equal(run.state, 'complete', `${id} practice sector ${sector + 1} hits ${run.collision?.type} at ${run.x}`);
    }
  });
}

test('Bonus courses introduce distinct portal combinations instead of duration-only changes', () => {
  const courses = additions.map(id => LEVELS.find(level => level.id === id));
  assert.deepEqual(courses.map(level => level.difficulty), ['Easy', 'Normal', 'Hard', 'Insane']);
  const sequences = new Set(LEVELS.map(level => level.sequence.join('/')));
  assert.equal(sequences.size, LEVELS.length, 'Every course has a different obstacle order');
  assert.ok(courses.every(level => !/[а-яё]/i.test(level.name + level.subtitle)));
  const mechanics = additions.map(id => createLevel(LEVELS.findIndex(level => level.id === id)).mechanics);
  assert.deepEqual(mechanics[0], ['teleport']);
  assert.deepEqual(mechanics[1], ['gravity', 'teleport']);
  assert.deepEqual(mechanics[2], ['speed', 'size', 'teleport', 'dual']);
  assert.deepEqual([...mechanics[3]].sort(), ['dual', 'gravity', 'size', 'speed', 'teleport']);
  assert.ok(courses[0].gap > courses[1].gap && courses[1].gap > courses[2].gap && courses[2].gap > courses[3].gap);
});
