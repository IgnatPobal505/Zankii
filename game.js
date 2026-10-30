import { WORLD, LEVELS, DIFFICULTIES, PORTAL_INFO, isFlightKey, createLevel, createRun, createPracticeRun, advance, progress, sectionAt } from './engine.js?v=4';
import { preview, render, accentFor, DIFFICULTY_COLORS } from './render.js?v=4';
import { FlightTimeline } from './input-timeline.js?v=4';
import { MusicPlayer } from './music-player.js?v=4';
import { SOUNDTRACKS } from './soundtracks.js?v=5';
import { storedAudio, storeAudio, removeAudio } from './audio-storage.js?v=4';

const $ = id => document.getElementById(id);
const canvas = $('game-canvas'), context = canvas.getContext('2d');
const levels = LEVELS.map((_, index) => createLevel(index));
const practiceSector = document.createElement('select'); practiceSector.id = 'practice-sector'; practiceSector.setAttribute('aria-label', 'Practice starting sector');
const practiceStart = document.createElement('div'); practiceStart.className = 'practice-start'; practiceStart.hidden = true;
const practiceStartLabel = document.createElement('label'); practiceStartLabel.htmlFor = 'practice-sector'; practiceStartLabel.textContent = 'Start sector'; practiceStart.append(practiceStartLabel, practiceSector);
$('practice-option').after(practiceStart);
$('practice-toggle').addEventListener('change', () => { practiceStart.hidden = !$('practice-toggle').checked; });
const STORAGE = 'zankii-progress-v2'; // Rebuilt routes have their own records. Old v1 records are left intact.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let settings = { lowEffects: reducedMotion, portalPulse: false, musicTrack: 'at-the-speed-of-light' }, records = {};
try {
  const s = JSON.parse(localStorage.getItem('zankii-settings-v2') || '{}');
  for (const key of ['lowEffects', 'portalPulse']) if (typeof s[key] === 'boolean') settings[key] = s[key];
  if (SOUNDTRACKS.some(track => track.id === s.musicTrack)) settings.musicTrack = s.musicTrack;
} catch { /* Storage is optional. */ }
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE) || '{}');
  if (saved && typeof saved === 'object') for (const level of levels) {
    const r = saved[level.id];
    if (r && typeof r === 'object') records[level.id] = { best: Number.isFinite(r.best) ? Math.max(0, Math.min(100, r.best)) : 0, attempts: Number.isFinite(r.attempts) ? Math.max(0, Math.floor(r.attempts)) : 0, complete: r.complete === true };
  }
} catch { /* The session still works without local storage. */ }
const recordFor = id => records[id] ||= { best: 0, attempts: 0, complete: false };
function saveRecords() { try { localStorage.setItem(STORAGE, JSON.stringify(records)); } catch { /* Keep the session's records. */ } }
function saveSettings() { try { localStorage.setItem('zankii-settings-v2', JSON.stringify(settings)); } catch { /* Keep this session's settings. */ } }
let current = 0, run = null, inGame = false, held = false, filter = 'All', practice = false, checkpoint = null, checkpointSection = -1;
const keys = new Set(), pointers = new Set();
const inputTimeline = new FlightTimeline();
let primaryAction = () => {}, secondaryAction = () => {}, lastFrame = 0, terminalHandled = false, noticeUntil = 0, lastEvent = null;
let impactAt = 0, deathTimer = null, runGeneration = 0;
let lastDrawnRun = null, lastDrawnState = '', lastDrawnEffects = '', slowFrames = 0, performanceReduced = false;
let appActive = true, lastNativePlaying = null;
const nativeBridge = window.webkit?.messageHandlers?.zankiiGame;
const nativeIOS = window.zankiiNative?.platform === 'ios' || document.documentElement.classList.contains('native-ios');
if (nativeIOS) document.documentElement.classList.add('native-ios');
function syncPlatformState() {
  const playing = Boolean(appActive && !document.hidden && inGame && run?.state === 'playing');
  document.body.classList.toggle('is-playing', playing); $('hold-button').disabled = !playing;
  if (nativeBridge && playing !== lastNativePlaying) {
    try { nativeBridge.postMessage({ type: 'playing', value: playing }); lastNativePlaying = playing; }
    catch { /* Browser play remains available if the native host disconnects. */ }
  }
}
function showHeld() {
  const value = String(held); if ($('hold-button').getAttribute('aria-pressed') !== value) $('hold-button').setAttribute('aria-pressed', value);
}
function inputTime(event) {
  const now = performance.now(), stamp = event?.timeStamp;
  return Number.isFinite(stamp) && stamp >= 0 && Math.abs(stamp - now) < 60000 ? stamp : now;
}
function refreshHeld(event) { held = keys.size > 0 || pointers.size > 0; inputTimeline.setHeld(held, inputTime(event)); showHeld(); }

const importedTracks = new Map(), trackRevisions = new Map();
const trackRevision = id => trackRevisions.get(id) || 0;
function changeTrackRevision(id) { const revision = trackRevision(id) + 1; trackRevisions.set(id, revision); return revision; }
let musicSource = '', musicRequested = false;
const selectedTrack = () => SOUNDTRACKS.find(track => track.id === settings.musicTrack) || SOUNDTRACKS[0];
const music = new MusicPlayer({ audioFactory: () => new window.Audio(), onStatus: status => updateMusicStatus(status) });
function updateMusicStatus(status = music.status) {
  const track = selectedTrack(), available = Boolean(importedTracks.get(track.id) || track.src);
  const text = status === 'playing' ? `${track.title} — ${track.artist}`
    : status === 'error' ? 'This audio could not play. Try another file.'
    : status === 'blocked' ? 'Tap Sound or HOLD to start music.'
    : status === 'loading' ? `Loading ${track.title}…`
    : available ? 'Ready offline. Music follows your run and pauses with it.'
    : 'Add an audio file for this track. It stays on this device.';
  hudText('music-status', text);
}
function configureMusic() {
  const track = selectedTrack(), source = importedTracks.get(track.id) || track.src || '';
  if (source !== musicSource) { musicSource = source; musicRequested = false; music.setSource(source); }
  updateMusicStatus();
}
function buildSoundtracks() {
  const select = $('music-track'); select.replaceChildren();
  for (const track of SOUNDTRACKS) {
    const option = document.createElement('option'); option.value = track.id;
    option.textContent = `${track.title} — ${track.artist}${track.src || importedTracks.has(track.id) ? '' : ' · add file'}`;
    select.append(option);
  }
  select.value = selectedTrack().id;
  $('music-source').href = selectedTrack().source;
  $('music-source').textContent = selectedTrack().sourceLabel || `${selectedTrack().artist} / original track ↗`;
  hudHidden('music-remove', !importedTracks.has(selectedTrack().id));
  updateMusicStatus();
}
async function restoreTrackFile() {
  const id = selectedTrack().id, revision = trackRevision(id);
  if (!importedTracks.has(id)) {
    try {
      const blob = await storedAudio(id);
      if (blob && trackRevision(id) === revision && !importedTracks.has(id)) importedTracks.set(id, URL.createObjectURL(blob));
    } catch { /* Bundled music and session imports still work without IndexedDB. */ }
  }
  if (selectedTrack().id === id) { buildSoundtracks(); if (musicSource) configureMusic(); }
}

class Sound {
  constructor() { this.enabled = false; this.context = null; this.lastBeat = -1; this.voices = new Set(); }
  unlock() {
    if (!this.enabled || !appActive || document.hidden) return;
    try {
      if (!this.context || this.context.state === 'closed') this.context = new (window.AudioContext || window.webkitAudioContext)();
      if (this.context.state !== 'running') this.context.resume().catch(() => {});
      if (inGame && run?.state === 'playing') {
        configureMusic();
        musicRequested = true; music.resumeAt(run.time);
      }
    }
    catch { this.enabled = false; updateSound(); }
  }
  tone(frequency, duration, volume = .025, type = 'sine', delay = 0, sweep = false) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const t = this.context.currentTime + delay, osc = this.context.createOscillator(), gain = this.context.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, t); if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(30, frequency / 3), t + duration);
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(volume, t + .008); gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    osc.connect(gain); gain.connect(this.context.destination); this.voices.add(osc); osc.start(t); osc.stop(t + duration + .02); osc.onended = () => { this.voices.delete(osc); osc.disconnect(); gain.disconnect(); };
  }
  tick(time, level) {
    if (this.enabled && musicRequested) music.sync(time);
  }
  effect(name) {
    if (name === 'dead') this.tone(140, .2, .035, 'triangle', 0, true);
    if (name === 'start') this.tone(440, .16, .02);
    if (name === 'portal') this.tone(660, .15, .012);
    if (name === 'win') [0, 4, 7, 12].forEach((n, i) => this.tone(261.63 * 2 ** (n / 12), .6, .028, 'sine', i * .1));
  }
  mute() { musicRequested = false; music.pause(); for (const voice of this.voices) { try { voice.stop(); } catch { /* Already stopped. */ } } this.voices.clear(); if (this.context && this.context.state !== 'closed') this.context.suspend().catch(() => {}); }
}
const sound = new Sound();
function updateSound() {
  for (const id of ['sound', 'game-sound']) $(id).setAttribute('aria-pressed', String(sound.enabled));
  $('game-sound').setAttribute('aria-label', sound.enabled ? 'Disable sound' : 'Enable sound');
  $('sound-label').textContent = sound.enabled ? 'Sound on' : 'Sound off';
}
for (const id of ['sound', 'game-sound']) $(id).addEventListener('click', () => { sound.enabled = !sound.enabled; if (sound.enabled) sound.unlock(); else sound.mute(); updateSound(); });

function difficultyStyle(element, difficulty) { element.style.setProperty('--difficulty-color', DIFFICULTY_COLORS[difficulty]); }
function buildFilters() {
  $('filters').replaceChildren();
  for (const name of ['All', ...DIFFICULTIES]) {
    const button = document.createElement('button'); button.className = 'filter-button'; button.textContent = name;
    button.setAttribute('aria-pressed', String(filter === name));
    button.addEventListener('click', () => { filter = name; buildFilters(); buildMenu(); $('filters').querySelector(`[aria-pressed="true"]`).focus({ preventScroll: true }); });
    $('filters').append(button);
  }
}
function buildMenu() {
  $('level-grid').replaceChildren();
  const visible = levels.filter(l => filter === 'All' || l.difficulty === filter);
  $('visible-count').textContent = `${visible.length} course${visible.length === 1 ? '' : 's'}`;
  $('campaign-progress').textContent = `${levels.filter(l => recordFor(l.id).complete).length} / ${levels.length} cleared`;
  visible.forEach(level => {
    const index = level.index, record = recordFor(level.id), card = document.createElement('button');
    card.className = 'level-card'; card.style.setProperty('--card-accent', accentFor(level)); difficultyStyle(card, level.difficulty);
    card.setAttribute('aria-label', `${index + 1}. ${level.name}. ${level.difficulty}. ${record.complete ? 'Cleared' : 'Best ' + record.best + '%'}`);
    const mechanics = level.mechanics.map(m => `<span class="mechanic-chip">${PORTAL_INFO[m].label}</span>`).join('');
    card.innerHTML = `<div class="thumbnail"><canvas width="640" height="360" aria-hidden="true"></canvas><span class="level-badge">${String(index + 1).padStart(2, '0')}</span><span class="level-duration">~${level.seconds}s</span></div><div class="card-body"><div class="card-top"><h3>${level.name}</h3><span class="card-play" aria-hidden="true">▶</span></div><p class="card-desc">${level.subtitle}</p><div class="mechanic-chips">${mechanics}</div><div class="card-bottom"><span class="difficulty-badge">${level.difficulty}</span><span class="card-record">${record.complete ? '✓ Cleared' : record.best ? 'Best ' + record.best + '%' : 'Play ↗'}</span></div></div>`;
    card.addEventListener('click', () => selectLevel(index)); $('level-grid').append(card); preview(card.querySelector('canvas'), level, settings);
  });
  preview($('hero-canvas'), levels[0], settings, true);
}
function buildLegend() {
  $('portal-legend').replaceChildren();
  for (const [name, info] of Object.entries(PORTAL_INFO)) {
    const key = document.createElement('span'); key.className = 'portal-key'; key.style.setProperty('--portal-color', info.color);
    key.title = info.hint; key.innerHTML = `<i aria-hidden="true"></i>${name === 'size' ? 'Mini / Normal' : name[0].toUpperCase() + name.slice(1)}`; $('portal-legend').append(key);
  }
}
function clearInput() { held = false; keys.clear(); pointers.clear(); inputTimeline.reset(performance.now()); showHeld(); }
function announce(text) { $('announcement').textContent = text; }
function clearDeathTimer() { if (deathTimer !== null) clearTimeout(deathTimer); deathTimer = null; runGeneration++; }
function overlay(mode, eyebrow, title, text, primary, action, secondary = 'Level select', second = showMenu, stats = '') {
  clearInput(); $('game-overlay').dataset.mode = mode;
  $('overlay-eyebrow').textContent = eyebrow; $('overlay-title').textContent = title; $('overlay-text').textContent = text; $('overlay-stats').innerHTML = stats;
  $('overlay-primary').textContent = primary; $('overlay-secondary').textContent = secondary; primaryAction = action; secondaryAction = second;
  $('practice-option').hidden = mode !== 'ready'; practiceStart.hidden = mode !== 'ready' || !$('practice-toggle').checked; $('overlay-mechanics').hidden = mode !== 'ready';
  $('game-overlay').hidden = false; $('overlay-primary').focus({ preventScroll: true }); announce(title + '. ' + text);
}
function hideOverlay() { $('game-overlay').hidden = true; canvas.focus({ preventScroll: true }); }
function selectLevel(index) {
  clearDeathTimer(); clearInput(); sound.mute(); current = index; run = createRun(levels[index]); inGame = true; terminalHandled = false; checkpoint = null; checkpointSection = -1; practice = false; lastEvent = null;
  slowFrames = 0; performanceReduced = false; lastFrame = 0;
  document.body.classList.add('in-game'); document.documentElement.style.setProperty('--game-accent', accentFor(run.level));
  $('menu').hidden = true; $('game-view').hidden = false; history.replaceState(null, '', `#${run.level.id}`);
  $('game-number').textContent = String(index + 1).padStart(2, '0'); $('game-title').textContent = run.level.name; $('game-difficulty').textContent = run.level.difficulty; difficultyStyle($('game-difficulty'), run.level.difficulty);
  $('attempt-label').textContent = `Attempts: ${recordFor(run.level.id).attempts}`; $('pause').disabled = true; $('practice-toggle').checked = false;
  practiceSector.replaceChildren(); run.level.sections.forEach((section, i) => { const option = document.createElement('option'); option.value = String(i); option.textContent = `${i + 1}. ${section.name}`; practiceSector.append(option); });
  $('overlay-mechanics').innerHTML = run.level.mechanics.map(m => `<span class="mechanic-chip" title="${PORTAL_INFO[m].hint}">${PORTAL_INFO[m].label}</span>`).join('');
  overlay('ready', `${String(index + 1).padStart(2, '0')} / ${run.level.difficulty.toUpperCase()}`, run.level.name, `${run.level.subtitle}\nHold the HOLD button or the playfield to climb. Release to dive.`, 'Start run ↗', () => startRun(false));
  updateHud(); syncPlatformState(); window.scrollTo({ top: 0, behavior: 'instant' });
}
function captureCheckpoint() {
  const { level, ...state } = run; checkpoint = structuredClone(state);
}
function startRun(initialHeld = false, retry = false) {
  if (!appActive || document.hidden) return;
  clearDeathTimer();
  const fromCheckpoint = retry && practice && checkpoint;
  if (!retry) practice = $('practice-toggle').checked;
  run = fromCheckpoint ? { level: levels[current], ...structuredClone(checkpoint), state: 'playing', collision: null, accumulator: 0 } : practice ? createPracticeRun(levels[current], Number(practiceSector.value)) : createRun(levels[current]);
  run.state = 'playing'; terminalHandled = false; clearInput(); held = initialHeld; inputTimeline.reset(performance.now(), held); lastFrame = 0; lastEvent = run.events.at(-1) || null; noticeUntil = 0;
  if (!retry) { checkpointSection = -1; checkpoint = null; if (practice) captureCheckpoint(); }
  recordFor(run.level.id).attempts++; saveRecords(); $('attempt-label').textContent = `Attempt ${recordFor(run.level.id).attempts}`;
  $('pause').disabled = false; sound.lastBeat = -1; sound.unlock(); sound.effect('start'); hideOverlay(); updateHud(); showHeld(); syncPlatformState();
}
function rememberProgress() {
  if (!run || practice) return;
  const r = recordFor(run.level.id); r.best = Math.max(r.best, progress(run)); if (run.state === 'complete') { r.complete = true; r.best = 100; } saveRecords();
}
function showMenu() {
  clearDeathTimer(); if (run) rememberProgress(); clearInput(); sound.mute(); inGame = false; if (run) run.state = 'ready';
  $('game-view').hidden = true; $('menu').hidden = false; document.body.classList.remove('in-game'); buildMenu();
  history.replaceState(null, '', location.pathname + location.search); $('quick-play').focus({ preventScroll: true });
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  syncPlatformState();
}
function pauseGame(message = 'Your run is right where you left it.') {
  clearInput(); sound.mute();
  if (run?.state !== 'playing') { syncPlatformState(); return; }
  run.state = 'paused'; rememberProgress();
  overlay('paused', 'TAKE A BREATH', 'Paused', typeof message === 'string' ? message : 'Your run is right where you left it.', 'Resume ↗', () => resumeGame(false));
  syncPlatformState();
}
function resumeGame(initialHeld = false) { if (!appActive || document.hidden || run?.state !== 'paused') return; clearInput(); held = initialHeld; inputTimeline.reset(performance.now(), held); run.state = 'playing'; lastFrame = 0; sound.unlock(); hideOverlay(); showHeld(); syncPlatformState(); }
const causeText = { boundary: 'the outer rail', block: 'a solid block', gate: 'a moving gate', divider: 'the central divider', saw: 'a rotating saw', spike: 'a spike' };
function terminal(now) {
  if (terminalHandled) return; terminalHandled = true; impactAt = now; clearInput(); rememberProgress(); $('pause').disabled = true; syncPlatformState();
  musicRequested = false; music.pause();
  const record = recordFor(run.level.id), value = progress(run), generation = runGeneration;
  if (run.state === 'dead') {
    sound.effect('dead');
    deathTimer = setTimeout(() => {
      deathTimer = null; if (!inGame || run.state !== 'dead' || generation !== runGeneration) return;
      overlay('dead', practice ? 'PRACTICE / CHECKPOINT RETRY' : 'ONE MORE RUN', 'Line broken.', `You hit ${causeText[run.collision?.type] || 'an obstacle'}.\nThe red ring marks the impact.`, practice && checkpoint ? 'Retry checkpoint ↗' : 'Try again ↗', () => startRun(false, true), 'Level select', showMenu,
        `<div><strong>${value}%</strong><small>THIS RUN</small></div><div><strong>${practice ? 'TRAIN' : record.best + '%'}</strong><small>${practice ? 'NO CLEAR RECORD' : 'PERSONAL BEST'}</small></div>`);
    }, settings.lowEffects ? 80 : 260);
  } else {
    sound.effect('win'); const last = current === levels.length - 1;
    overlay('complete', practice ? 'PRACTICE COMPLETE' : '100% / CLEAN RUN', practice ? 'Ready for normal?' : 'Course cleared.', practice ? 'Great training. Clear this course in normal mode to save a completion.' : last ? `${run.level.name} is down. You have reached the end of the campaign.` : `${run.level.name} cleared. Your next challenge is ready.`,
      practice ? 'Play normal mode ↗' : last ? 'Level select ↗' : 'Next course ↗', practice ? () => selectLevel(current) : last ? showMenu : () => selectLevel(current + 1), 'Replay course', () => selectLevel(current),
      `<div><strong>100%</strong><small>${practice ? 'PRACTICE' : 'CLEARED'}</small></div><div><strong>${record.attempts}</strong><small>ATTEMPTS</small></div>`);
  }
}
function portalText(event) {
  if (event.type === 'speed') return `SPEED ${event.value.toFixed(2)}×`;
  if (event.type === 'size') return event.value ? 'MINI WAVE — STEEPER FLIGHT' : 'NORMAL WAVE';
  if (event.type === 'gravity') return event.value === -1 ? 'INVERTED — HOLD TO DIVE' : 'GRAVITY RESTORED — HOLD TO CLIMB';
  if (event.type === 'dual') return event.value ? 'DUAL WAVE — BOTH MUST SURVIVE' : 'SINGLE WAVE';
  return 'TELEPORT — FOLLOW THE EXIT';
}
function hudText(id, text) { const node = $(id); if (node.textContent !== text) node.textContent = text; }
function hudHidden(id, hidden) { const node = $(id); if (node.hidden !== hidden) node.hidden = hidden; }
function updateHud() {
  if (!run) return;
  const value = `${progress(run)}%`; if ($('progress-fill').style.width !== value) $('progress-fill').style.width = value; hudText('progress-label', value);
  hudText('game-section', sectionAt(run.level, run.x).name);
  hudText('elapsed-label', `${Math.floor(run.time / 60)}:${String(Math.floor(run.time % 60)).padStart(2, '0')}`);
  hudText('wave-mode', `${run.dual ? 'DUAL ' : ''}${run.mini ? 'MINI' : 'NORMAL'} WAVE`);
  hudText('gravity-mode', run.gravity === -1 ? 'INVERTED / HOLD ↘' : 'HOLD ↗ / RELEASE ↘');
  hudText('hold-direction', run.gravity === -1 ? '↘' : '↗');
  hudText('hold-caption', run.gravity === -1 ? 'release to climb' : 'release to dive');
  const label = run.gravity === -1 ? 'Hold to dive; release to climb' : 'Hold to climb; release to dive';
  if ($('hold-button').getAttribute('aria-label') !== label) $('hold-button').setAttribute('aria-label', label);
  hudText('speed-mode', `${run.speedFactor.toFixed(2)}×`); hudHidden('practice-status', !practice);
  hudHidden('performance-mode', !performanceReduced || settings.lowEffects);
  const event = run.events.at(-1);
  if (event && event !== lastEvent) { lastEvent = event; noticeUntil = run.time + 1.7; $('portal-notice').textContent = portalText(event); sound.effect('portal'); announce(portalText(event)); }
  hudHidden('portal-notice', !event || run.time > noticeUntil || run.state !== 'playing');
}

$('overlay-primary').addEventListener('click', () => primaryAction()); $('overlay-secondary').addEventListener('click', () => secondaryAction());
$('quick-play').addEventListener('click', () => selectLevel(0)); $('brand').addEventListener('click', showMenu); $('back').addEventListener('click', showMenu);
$('restart').addEventListener('click', () => selectLevel(current)); $('pause').addEventListener('click', pauseGame);
$('fullscreen').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('stage').requestFullscreen(); } catch { /* Browser decides whether fullscreen is available. */ } });
if (nativeIOS || !$('stage').requestFullscreen) $('fullscreen').hidden = true;
$('low-effects').checked = settings.lowEffects; $('portal-pulse').checked = settings.portalPulse;
for (const id of ['settings-open', 'game-settings']) $(id).addEventListener('click', () => { pauseGame(); $('settings-dialog').showModal(); });
for (const [id, key] of [['low-effects', 'lowEffects'], ['portal-pulse', 'portalPulse']]) $(id).addEventListener('change', () => { settings[key] = $(id).checked; saveSettings(); if (!inGame) buildMenu(); });
$('settings-dialog').addEventListener('close', () => { if (inGame && !$('game-overlay').hidden) $('overlay-primary').focus({ preventScroll: true }); });
$('music-import').addEventListener('click', () => $('music-file').click());
$('music-remove').addEventListener('click', async () => {
  pauseGame(); const id = selectedTrack().id, revision = changeTrackRevision(id), oldURL = importedTracks.get(id); if (!oldURL) return;
  let saved = true; try { await removeAudio(id); } catch { saved = false; }
  if (trackRevision(id) !== revision) return;
  importedTracks.delete(id);
  if (selectedTrack().id === id) { configureMusic(); buildSoundtracks(); if (!saved) hudText('music-status', 'Removed for this session. Device storage is unavailable.'); }
  URL.revokeObjectURL(oldURL);
});
$('music-track').addEventListener('change', () => {
  if (!SOUNDTRACKS.some(track => track.id === $('music-track').value)) return;
  pauseGame(); settings.musicTrack = $('music-track').value; saveSettings();
  musicRequested = false; music.pause(); configureMusic(); buildSoundtracks(); void restoreTrackFile();
});
$('music-file').addEventListener('change', async () => {
  const file = $('music-file').files?.[0]; if (!file) return;
  pauseGame();
  if ((!file.type.startsWith('audio/') && !/\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(file.name)) || file.size > 40 * 1024 * 1024) {
    hudText('music-status', 'Choose an audio file up to 40 MB.'); $('music-file').value = ''; return;
  }
  const id = selectedTrack().id, revision = changeTrackRevision(id), oldURL = importedTracks.get(id);
  music.pause(); musicRequested = false; importedTracks.set(id, URL.createObjectURL(file));
  configureMusic(); buildSoundtracks(); if (oldURL) URL.revokeObjectURL(oldURL);
  try { await storeAudio(id, file); if (selectedTrack().id === id && trackRevision(id) === revision) hudText('music-status', 'Saved on this device. Tap Resume to play.'); }
  catch { if (selectedTrack().id === id && trackRevision(id) === revision) hudText('music-status', 'Added for this session. Device storage is unavailable.'); }
  $('music-file').value = '';
});

for (const control of [canvas, $('hold-button')]) {
  control.addEventListener('pointerdown', event => {
    if (!appActive || document.hidden || !inGame || run?.state !== 'playing' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); pointers.add(event.pointerId); refreshHeld(event); sound.unlock();
    if (control === canvas) canvas.focus({ preventScroll: true });
    try { control.setPointerCapture(event.pointerId); } catch { /* Window listeners also release input. */ }
  });
  control.addEventListener('lostpointercapture', event => { pointers.delete(event.pointerId); refreshHeld(event); });
  control.addEventListener('contextmenu', event => event.preventDefault());
}
function pointerUp(event) { pointers.delete(event.pointerId); refreshHeld(event); }
window.addEventListener('pointerup', pointerUp);
window.addEventListener('pointercancel', event => { if (pointers.has(event.pointerId)) { pointerUp(event); pauseGame(); } });
$('hold-button').addEventListener('click', event => event.preventDefault());
$('hold-button').addEventListener('keydown', event => {
  if (event.code === 'Enter' && run?.state === 'playing' && appActive) { event.preventDefault(); keys.add('Enter'); refreshHeld(event); sound.unlock(); }
});
window.addEventListener('keydown', event => {
  if (!appActive || document.hidden || !inGame || event.metaKey || event.ctrlKey || event.altKey || $('settings-dialog').open) return;
  if (event.code === 'Tab' && !$('game-overlay').hidden) {
    const stops = [...(!$('practice-option').hidden ? [$('practice-toggle')] : []), ...(!practiceStart.hidden ? [practiceSector] : []), $('overlay-primary'), $('overlay-secondary')];
    event.preventDefault(); let i = stops.indexOf(document.activeElement); i = (i + (event.shiftKey ? -1 : 1) + stops.length) % stops.length; stops[i].focus(); return;
  }
  if (event.code === 'Escape') { event.preventDefault(); if (run?.state === 'playing') pauseGame(); else if (run?.state === 'paused') resumeGame(false); return; }
  if (event.code === 'KeyR' && !event.repeat) { event.preventDefault(); selectLevel(current); return; }
  if (!isFlightKey(event.code)) return;
  // Keep native Space activation on completion buttons; all flight keys otherwise control Wave.
  if (run?.state === 'complete') { if (event.code !== 'Space') event.preventDefault(); return; }
  if (document.activeElement === practiceSector || (document.activeElement === $('practice-toggle') && event.code === 'Space')) return;
  event.preventDefault(); if (event.repeat) return;
  if (run?.state === 'dead') { if (performance.now() - impactAt < 260) return; startRun(true, true); }
  else if (run?.state === 'ready') startRun(true);
  else if (run?.state === 'paused') resumeGame(true);
  if (run?.state === 'playing') { keys.add(event.code); refreshHeld(event); sound.unlock(); }
});
window.addEventListener('keyup', event => { keys.delete(event.code); refreshHeld(event); if (inGame && isFlightKey(event.code) && !$('settings-dialog').open) event.preventDefault(); });
function interruptGame() { clearInput(); pauseGame(); lastFrame = 0; }
window.addEventListener('blur', interruptGame);
window.addEventListener('pagehide', interruptGame);
document.addEventListener('visibilitychange', () => { if (document.hidden) interruptGame(); else { lastFrame = 0; syncPlatformState(); } });
window.addEventListener('zankii:lifecycle', event => {
  appActive = event.detail?.active === true;
  if (!appActive) interruptGame();
  else { lastFrame = 0; syncPlatformState(); }
});
window.addEventListener('hashchange', () => { const index = levels.findIndex(l => `#${l.id}` === location.hash); if (index >= 0 && (!inGame || current !== index)) selectLevel(index); else if (!location.hash && inGame) showMenu(); });

function frame(now) {
  const frameMs = lastFrame ? now - lastFrame : 0; lastFrame = now;
  if (inGame && run) {
    if (appActive && !document.hidden && run.state === 'playing') {
      if (frameMs > 25) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
      if (slowFrames >= 8) performanceReduced = true;
      const result = inputTimeline.advanceTo(now, (input, seconds) => advance(run, input, seconds));
      if (result.stalled) { performanceReduced = true; pauseGame('Paused after a long frame to keep your run safe.\nTap Resume when you are ready.'); }
      if (run.state === 'playing') sound.tick(run.time, run.level);
      if (practice && run.state === 'playing') {
        const section = sectionAt(run.level, run.x), index = run.level.sections.indexOf(section);
        if (index !== checkpointSection && run.x >= section.start + 150 && run.x <= section.start + 230) { checkpointSection = index; captureCheckpoint(); announce('Checkpoint saved.'); }
      }
    }
    if (['dead', 'complete'].includes(run.state)) terminal(now);
    const effectsKey = `${settings.lowEffects || performanceReduced}/${settings.portalPulse}`;
    if (run.state === 'playing' || run !== lastDrawnRun || run.state !== lastDrawnState || effectsKey !== lastDrawnEffects) {
      render(context, run.level, run, performanceReduced ? { ...settings, lowEffects: true } : settings);
      lastDrawnRun = run; lastDrawnState = run.state; lastDrawnEffects = effectsKey;
      updateHud();
    }
  }
  requestAnimationFrame(frame);
}
buildFilters(); buildMenu(); buildLegend(); buildSoundtracks(); syncPlatformState(); void restoreTrackFile();
// Preserve links shared with the original three-course release without restoring retired records.
const aliases = { '#mint': 0, '#lunar': 2, '#frog': 0 };
const direct = levels.findIndex(l => `#${l.id}` === location.hash), linked = direct >= 0 ? direct : aliases[location.hash];
if (linked !== undefined) selectLevel(linked);
requestAnimationFrame(frame);
