import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, createLevel, createPracticeRun, corridorAt } from '../engine.js';
import { render } from '../render.js';

function countedCanvas() {
  const counts = {}, methods = new Map();
  const context = new Proxy({ canvas: { width: 1280, height: 720 } }, {
    get(target, name) {
      if (name === 'canvas') return target.canvas;
      if (!methods.has(name)) methods.set(name, () => {
        counts[name] = (counts[name] || 0) + 1;
        if (name === 'createLinearGradient') return { addColorStop() {} };
      });
      return methods.get(name);
    },
    set() { return true; }
  });
  return { context, counts };
}

test('decorative lines are batched within a bounded draw-call budget on every course', () => {
  for (let index = 0; index < LEVELS.length; index++) {
    const level = createLevel(index);
    for (let sector = 0; sector < level.sections.length; sector++) {
      const section = level.sections[sector];
      for (const fraction of [.2, .5, .8]) {
        const run = createPracticeRun(level, sector); run.state = 'playing';
        run.x = section.start + (section.end - section.start) * fraction;
        run.y = corridorAt(level, run.x).center;
        run.dual = section.kind === 'dual'; run.trail2 = run.dual ? [{ x: run.x - 100, y: 720 - run.y }] : [];
        const { context, counts } = countedCanvas();
        render(context, level, run, { lowEffects: false, portalPulse: false });
        assert.ok(counts.stroke <= 50, `${level.name}, ${section.name}: ${counts.stroke} stroke calls`);
      }
    }
  }
});

test('repeated frames reuse the context gradient instead of allocating it every frame', () => {
  const level = createLevel(0), run = createPracticeRun(level, 0), { context, counts } = countedCanvas();
  for (let frame = 0; frame < 30; frame++) { run.x += 4; render(context, level, run); }
  assert.equal(counts.createLinearGradient, 1);
});
