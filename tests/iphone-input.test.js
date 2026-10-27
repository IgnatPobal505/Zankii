import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import * as engine from '../engine.js';

// Exercise the real UI event handlers and simulation without a WebKit dependency.
// Layout, system gestures and the native host still need simulator/device checks.
async function gameHarness() {
  const source = (await readFile(new URL('../game.js', import.meta.url), 'utf8')).replace(/^import .+;\s*$/gm, '');
  const elements = new Map(), messages = [], audioContexts = [];
  let document, frame, lastRendered;
  class Target {
    constructor() { this.handlers = new Map(); this.attrs = new Map(); this.children = []; this.hidden = false; this.disabled = false; this.checked = false; this.value = '0'; this.dataset = {}; this.style = { setProperty() {} }; this.classList = new Set(); this.classList.contains = value => this.classList.has(value); this.classList.remove = value => this.classList.delete(value); this.classList.toggle = (value, on) => on ? this.classList.add(value) : this.classList.delete(value); }
    addEventListener(type, callback) { const list = this.handlers.get(type) || []; list.push(callback); this.handlers.set(type, list); }
    emit(type, values = {}) { const event = { preventDefault() {}, pointerType: 'touch', button: 0, ...values }; for (const callback of this.handlers.get(type) || []) callback(event); }
    setAttribute(name, value) { this.attrs.set(name, String(value)); }
    getAttribute(name) { return this.attrs.get(name); }
    append(...children) { this.children.push(...children); }
    after() {}
    replaceChildren(...children) { this.children = children; }
    querySelector() { return new Target(); }
    focus() { document.activeElement = this; }
    getContext() { return {}; }
    setPointerCapture() {}
    showModal() { this.open = true; }
  }
  class AudioContext {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; this.resumes = 0; this.suspends = 0; this.stops = 0; audioContexts.push(this); }
    resume() { this.resumes++; this.state = 'running'; return Promise.resolve(); }
    suspend() { this.suspends++; this.state = 'suspended'; return Promise.resolve(); }
    createOscillator() { return { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {}, start() {}, stop: () => { this.stops++; } }; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  }
  document = new Target(); document.hidden = false;
  document.getElementById = id => { if (!elements.has(id)) elements.set(id, new Target()); return elements.get(id); };
  document.createElement = () => new Target(); document.documentElement = new Target(); document.body = new Target();
  document.documentElement.classList.add('native-ios');
  const window = new Target(); window.AudioContext = AudioContext; window.scrollTo = () => {};
  window.webkit = { messageHandlers: { zankiiGame: { postMessage: payload => messages.push(payload) } } };
  const location = { hash: '', pathname: '/index.html', search: '' };
  const sandbox = { ...engine, document, window, location, matchMedia: () => ({ matches: false }),
    localStorage: { getItem: () => null, setItem() {} }, history: { replaceState: (_, __, url) => { location.hash = url.startsWith('#') ? url : ''; } },
    performance: { now: () => 1000 }, structuredClone, setTimeout: () => 1, clearTimeout() {},
    requestAnimationFrame: callback => { frame = callback; },
    preview() {}, render: (_, __, run) => { lastRendered = { state: run.state, x: run.x, y: run.y, time: run.time }; },
    accentFor: () => '#abcdef', DIFFICULTY_COLORS: {} };
  runInNewContext(source, sandbox, { filename: 'game.js' });
  const element = id => document.getElementById(id);
  const start = () => { element('quick-play').emit('click'); element('overlay-primary').emit('click'); frame(1000); };
  return { window, document, element, messages, audioContexts, start, step: now => frame(now), rendered: () => lastRendered };
}

test('HOLD, playfield touches and keyboard combine without canceling another held control', async () => {
  const app = await gameHarness(); app.start();
  const hold = app.element('hold-button'), canvas = app.element('game-canvas');
  hold.emit('pointerdown', { pointerId: 10 }); canvas.emit('pointerdown', { pointerId: 11 });
  app.window.emit('pointerup', { pointerId: 10 });
  assert.equal(hold.getAttribute('aria-pressed'), 'true');
  app.step(1100); assert.ok(app.rendered().y < 360, 'remaining finger still climbs');
  app.window.emit('pointerup', { pointerId: 11 });
  assert.equal(hold.getAttribute('aria-pressed'), 'false');
  app.window.emit('keydown', { code: 'KeyA' }); hold.emit('pointerdown', { pointerId: 12 });
  app.window.emit('keyup', { code: 'KeyA' }); assert.equal(hold.getAttribute('aria-pressed'), 'true');
  app.window.emit('pointerup', { pointerId: 12 }); assert.equal(hold.getAttribute('aria-pressed'), 'false');
});

test('native background clears touch, freezes the course and requires an explicit resume', async () => {
  const app = await gameHarness(); app.start();
  app.element('game-sound').emit('click');
  app.element('hold-button').emit('pointerdown', { pointerId: 20 }); app.step(1100);
  const position = app.rendered().x;
  app.window.emit('zankii:lifecycle', { detail: { active: false } }); app.step(2100);
  assert.equal(app.rendered().state, 'paused'); assert.equal(app.rendered().x, position);
  assert.equal(app.element('hold-button').getAttribute('aria-pressed'), 'false');
  assert.equal(app.audioContexts[0].state, 'suspended');
  assert.equal(app.messages.at(-1).value, false);
  app.element('overlay-primary').emit('click'); app.step(2200);
  assert.equal(app.rendered().state, 'paused', 'cannot resume while the app is inactive');
  app.window.emit('zankii:lifecycle', { detail: { active: true } }); app.step(2300);
  assert.equal(app.rendered().state, 'paused'); assert.equal(app.rendered().x, position);
  app.audioContexts[0].state = 'interrupted';
  app.element('overlay-primary').emit('click'); app.step(2400); app.step(2500);
  assert.equal(app.rendered().state, 'playing'); assert.ok(app.rendered().x > position);
  assert.equal(app.audioContexts[0].state, 'running'); assert.equal(app.messages.at(-1).value, true);
  assert.equal(app.element('hold-button').getAttribute('aria-pressed'), 'false');
});

test('a canceled flight touch pauses; settings and restart stay available on iPhone', async () => {
  const app = await gameHarness(); app.start();
  app.element('hold-button').emit('pointerdown', { pointerId: 30 });
  app.window.emit('pointercancel', { pointerId: 30 }); app.step(1100);
  assert.equal(app.rendered().state, 'paused'); assert.equal(app.element('hold-button').disabled, true);
  app.element('game-settings').emit('click'); assert.equal(app.element('settings-dialog').open, true);
  app.element('settings-dialog').open = false; app.element('settings-dialog').emit('close');
  app.element('restart').emit('click'); app.step(1200);
  assert.equal(app.rendered().state, 'ready'); assert.equal(app.rendered().x, 0);
});
