import test from 'node:test';
import assert from 'node:assert/strict';
import { FlightTimeline } from '../input-timeline.js';
import { createLevel, createRun, advance } from '../engine.js';

function openRun() {
  const level = { ...createLevel(0), speed: 552, objects: [], portals: [], length: 100000 };
  const run = createRun(level); run.state = 'playing';
  return run;
}
function replay(frameTimes, events) {
  const run = openRun(), timeline = new FlightTimeline();
  let next = 0;
  for (const now of frameTimes) {
    while (next < events.length && events[next].at <= now) {
      const event = events[next++]; timeline.setHeld(event.held, event.at);
    }
    const result = timeline.advanceTo(now, (held, seconds) => advance(run, held, seconds));
    assert.equal(result.stalled, false);
  }
  return run;
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

test('A complete tap between rendered frames still changes the real high-speed flight', () => {
  const events = [{ at: 12.5, held: true }, { at: 37.5, held: false }];
  const run = replay([50], events);
  near(run.y, 360); near(run.x, 27.6); near(run.time, .05);
  const lostTap = openRun(); advance(lostTap, false, .05);
  assert.ok(Math.abs(run.y - lostTap.y) > 27);
  assert.equal(run.trail.length, 3);
});

test('A late press never applies the new direction retroactively to the entire frame', () => {
  const run = replay([50], [{ at: 37.5, held: true }]);
  near(run.y, 373.8);
  const retroactive = openRun(); advance(retroactive, true, .05);
  assert.ok(run.y - retroactive.y > 40);
});

test('Many transitions produce identical 240 Hz flight through regular and delayed frames', () => {
  const events = Array.from({ length: 60 }, (_, index) => ({ at: 12.5 + index * 12.5, held: index % 2 === 0 }));
  const schedules = [
    Array.from({ length: 180 }, (_, index) => (index + 1) * 1000 / 240),
    Array.from({ length: 45 }, (_, index) => (index + 1) * 1000 / 60),
    Array.from({ length: 15 }, (_, index) => (index + 1) * 50),
    [7, 48, 62, 110, 147, 151, 202, 246, 300, 319, 371, 409, 458, 501, 553, 599, 645, 701, 750]
  ];
  const runs = schedules.map(schedule => replay(schedule, events));
  for (const run of runs) {
    assert.equal(run.state, 'playing');
    near(run.x, runs[0].x); near(run.y, runs[0].y); near(run.time, runs[0].time);
    assert.equal(run.lastHeld, runs[0].lastHeld);
    assert.deepEqual(run.trail, runs[0].trail);
  }
});

test('Long but permitted frames are split without losing time to the engine delta cap', () => {
  const run = replay([125], [{ at: 62.5, held: true }]);
  near(run.x, 69); near(run.time, .125); near(run.y, 360);
});

test('Stall detection occurs before any movement or event consumption', () => {
  const timeline = new FlightTimeline().reset(1000);
  timeline.setHeld(true, 1050);
  const before = JSON.stringify(timeline); let calls = 0;
  const result = timeline.advanceTo(1151, () => calls++);
  assert.deepEqual(result, { stalled: true, advancedSeconds: 0, held: false });
  assert.equal(calls, 0); assert.equal(JSON.stringify(timeline), before);
  timeline.reset(1151);
  const intervals = []; timeline.advanceTo(1201, (held, seconds) => intervals.push([held, seconds]));
  assert.deepEqual(intervals, [[false, .05]]);
});

test('Lifecycle reset clears pending touches and starts a fresh clock', () => {
  const timeline = new FlightTimeline().reset(20, true);
  timeline.setHeld(false, 30); timeline.setHeld(true, 40);
  timeline.reset(100, false);
  const intervals = []; timeline.advanceTo(150, (held, seconds) => intervals.push([held, seconds]));
  assert.deepEqual(intervals, [[false, .05]]); assert.deepEqual(timeline.events, []);
});

test('Zero timestamps, future events and duplicate or stale times preserve chronology', () => {
  const timeline = new FlightTimeline().reset(0);
  assert.equal(timeline.setHeld(true, 0), true);
  assert.equal(timeline.setHeld(true, 5), false);
  timeline.setHeld(false, 20); timeline.setHeld(true, 10);
  const intervals = []; const step = (held, seconds) => intervals.push([held, seconds]);
  timeline.advanceTo(10, step);
  assert.deepEqual(intervals, [[true, .01]]); assert.equal(timeline.events.length, 2);
  timeline.advanceTo(30, step);
  assert.deepEqual(intervals, [[true, .01], [true, .01], [true, .01]]);
  timeline.setHeld(false, 1); timeline.advanceTo(40, step);
  assert.deepEqual(intervals.at(-1), [false, .01]);
  const before = intervals.length; timeline.advanceTo(25, step); timeline.advanceTo(Number.NaN, step);
  assert.equal(intervals.length, before); assert.equal(timeline.cursor, 40);
});

test('The exact stall boundary remains playable and invalid configuration fails clearly', () => {
  const timeline = new FlightTimeline(); const intervals = [];
  assert.equal(timeline.advanceTo(150, (held, seconds) => intervals.push(seconds)).stalled, false);
  assert.deepEqual(intervals, [.05, .05, .05]);
  assert.throws(() => new FlightTimeline({ maxFrameMs: 0 }), RangeError);
  assert.throws(() => timeline.advanceTo(150), TypeError);
});
