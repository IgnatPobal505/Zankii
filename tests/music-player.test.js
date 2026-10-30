import test from 'node:test';
import assert from 'node:assert/strict';
import { MusicPlayer } from '../music-player.js';

class FakeAudio {
  constructor() {
    this.duration = NaN; this.paused = true; this._time = 0; this.seeks = [];
    this.playCalls = 0; this.pauseCalls = 0; this.loadCalls = 0; this.requests = []; this.listeners = new Map();
  }
  get currentTime() { return this._time; }
  set currentTime(value) {
    if (!Number.isFinite(this.duration)) throw new Error('Metadata not ready');
    this._time = value; this.seeks.push(value);
  }
  addEventListener(name, callback) { const list = this.listeners.get(name) || []; list.push(callback); this.listeners.set(name, list); }
  removeEventListener(name, callback) { this.listeners.set(name, (this.listeners.get(name) || []).filter(item => item !== callback)); }
  emit(name) { for (const callback of this.listeners.get(name) || []) callback(); }
  load() { this.loadCalls++; }
  pause() { this.pauseCalls++; this.paused = true; this.emit('pause'); }
  removeAttribute(name) { if (name === 'src') this.src = ''; }
  play() {
    this.playCalls++;
    return new Promise((resolve, reject) => this.requests.push({
      resolve: () => { this.paused = false; resolve(); }, reject
    }));
  }
  metadata(duration) { this.duration = duration; this.emit('loadedmetadata'); }
}
function setup() {
  const audios = [], statuses = [];
  const player = new MusicPlayer({ audioFactory: () => { const audio = new FakeAudio(); audios.push(audio); return audio; }, onStatus: status => statuses.push(status) });
  return { player, audios, statuses };
}
const flush = () => new Promise(resolve => queueMicrotask(resolve));

test('Only the selected source is loaded, with no autoplay or eager audio object', () => {
  const { player, audios } = setup();
  assert.equal(player.audio, null); assert.equal(audios.length, 0);
  player.setSource('track-a.mp3');
  assert.equal(audios.length, 1); assert.equal(audios[0].src, 'track-a.mp3'); assert.equal(audios[0].loadCalls, 1);
  assert.equal(audios[0].playCalls, 0); assert.equal(audios[0].loop, true); assert.equal(audios[0].volume, .35);
  player.setSource(''); player.resumeAt(10);
  assert.equal(player.audio, null); assert.equal(player.status, 'missing'); assert.equal(audios.length, 1);
});

test('A user resume calls play synchronously before metadata and seeks when it arrives', async () => {
  const { player } = setup(); player.setSource('track.mp3'); const audio = player.audio;
  player.resumeAt(72);
  assert.equal(audio.playCalls, 1); assert.equal(player.status, 'loading'); assert.equal(audio.seeks.length, 0);
  audio.metadata(60); assert.deepEqual(audio.seeks, [12]);
  audio.requests[0].resolve(); await flush(); assert.equal(player.status, 'playing');
});

test('Pause cancels pending playback and metadata cannot restart it', async () => {
  const { player } = setup(); player.setSource('track.mp3'); const audio = player.audio;
  player.resumeAt(20); player.pause(); const before = audio.pauseCalls;
  audio.metadata(60); assert.equal(audio.seeks.length, 0); assert.equal(audio.playCalls, 1);
  audio.requests[0].resolve(); await flush();
  assert.equal(audio.paused, true); assert.ok(audio.pauseCalls > before); assert.equal(player.status, 'paused');
  player.sync(40); assert.equal(audio.playCalls, 1); assert.equal(audio.seeks.length, 0);
});

test('Track switching cancels old requests, resets seek and ignores old loading events', async () => {
  const { player, audios } = setup(); player.setSource('first.mp3'); const first = player.audio;
  player.resumeAt(90); player.setSource('second.mp3'); const second = player.audio;
  first.metadata(120); first.requests[0].resolve(); await flush();
  assert.equal(first.paused, true); assert.equal(second.playCalls, 0); assert.equal(second.seeks.length, 0);
  assert.equal(player.status, 'loading'); assert.equal(audios.length, 2);
  second.metadata(80); player.resumeAt(0); assert.deepEqual(second.seeks, [0]);
  second.requests[0].resolve(); await flush(); assert.equal(player.status, 'playing');
});

test('Sync corrects drift over 300 ms and handles the loop boundary without extra playback', async () => {
  const { player } = setup(); player.setSource('track.mp3'); const audio = player.audio;
  audio.metadata(60); player.resumeAt(10); audio.requests[0].resolve(); await flush();
  const before = audio.seeks.length;
  player.sync(10.2); assert.equal(audio.seeks.length, before);
  player.sync(10.5); assert.equal(audio.currentTime, 10.5);
  audio._time = 59.9; const boundary = audio.seeks.length;
  player.sync(60.1); assert.equal(audio.seeks.length, boundary);
  player.sync(61); assert.equal(audio.currentTime, 1); assert.equal(audio.playCalls, 1);
});

test('Repeated hold gestures during playback do not continuously seek or call play', async () => {
  const { player } = setup(); player.setSource('track.mp3'); const audio = player.audio;
  audio.metadata(60); player.resumeAt(10); audio.requests[0].resolve(); await flush();
  for (let i = 0; i < 10; i++) player.resumeAt(10.1);
  assert.equal(audio.playCalls, 1); assert.deepEqual(audio.seeks, [10]);
});

test('A rejected play request reports status and a later gesture can retry', async () => {
  const { player, statuses } = setup(); player.setSource('track.mp3'); const audio = player.audio;
  player.resumeAt(0); audio.requests[0].reject(Object.assign(new Error('Gesture required'), { name: 'NotAllowedError' })); await flush();
  assert.equal(player.status, 'blocked'); assert.ok(statuses.includes('blocked'));
  audio.metadata(60); player.resumeAt(5); assert.equal(audio.playCalls, 2);
  audio.requests[1].resolve(); await flush(); assert.equal(player.status, 'playing');
});

test('Late rejection after pause is handled without replacing the paused status', async () => {
  const { player } = setup(); player.setSource('track.mp3'); const audio = player.audio;
  player.resumeAt(0); player.pause(); audio.requests[0].reject(new Error('Aborted')); await flush();
  assert.equal(player.status, 'paused'); assert.equal(player.wantsPlay, false);
});

test('An older play resolution cannot pause a newer user resume on the same audio', async () => {
  const { player } = setup(); player.setSource('track.mp3'); const audio = player.audio; audio.metadata(60);
  player.resumeAt(0); player.pause(); player.resumeAt(10);
  const pauses = audio.pauseCalls; audio.requests[0].resolve(); await flush();
  assert.equal(audio.pauseCalls, pauses);
  audio.requests[1].resolve(); await flush(); assert.equal(player.status, 'playing'); assert.equal(audio.currentTime, 10);
});

test('Loading errors stop the request and a late playing event is immediately paused', async () => {
  const { player } = setup(); player.setSource('track.mp3'); const audio = player.audio;
  player.resumeAt(0); audio.emit('error'); assert.equal(player.status, 'error');
  audio.requests[0].resolve(); await flush(); assert.equal(audio.paused, true);
  assert.equal(player.status, 'error'); audio.metadata(60); assert.equal(audio.seeks.length, 0);
  player.pause(); audio.paused = false; audio.emit('playing'); assert.equal(audio.paused, true);
});
