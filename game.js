import { WORLD, LEVELS, createLevel, createRun, advance, progress, corridorAt, seeded } from './engine.js';

const $ = id => document.getElementById(id);
const canvas = $('game-canvas'), ctx = canvas.getContext('2d');
const levels = LEVELS.map((_, i) => createLevel(i));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const palettes = {
  mint: { sky: '#e3f2ec', low: '#b7d8ce', hill: '#83b4a7', hill2: '#99c6b8', ground: '#214b49', ground2: '#153c3a', edge: '#78d4b5', spike: '#effaf0', crystal: '#a8f0d1', stars: '#4f9d8c', line: '#245a4d', text: '#32685b' },
  lunar: { sky: '#10162c', low: '#1b2945', hill: '#1b2848', hill2: '#223252', ground: '#171e37', ground2: '#0e142a', edge: '#b19af1', spike: '#cbbafc', crystal: '#c5a5ff', stars: '#c7cce9', line: '#39416c', text: '#c8b8ed' },
  frog: { sky: '#171e22', low: '#25352e', hill: '#2b4135', hill2: '#344f3e', ground: '#27233d', ground2: '#1b192e', edge: '#c1de7a', spike: '#ddf9a7', crystal: '#b39af0', stars: '#a9cb86', line: '#494363', text: '#c5e58c' }
};
let records = {};
try {
  const saved = JSON.parse(localStorage.getItem('zankii-progress-v1') || '{}');
  if (saved && typeof saved === 'object') for (const l of LEVELS) {
    const r = saved[l.id];
    if (r && typeof r === 'object') records[l.id] = {
      best: Number.isFinite(r.best) ? Math.max(0, Math.min(100, r.best)) : 0,
      attempts: Number.isFinite(r.attempts) ? Math.max(0, Math.floor(r.attempts)) : 0,
      complete: r.complete === true
    };
  }
} catch { /* Play remains available when browser storage is unavailable. */ }
const recordFor = id => records[id] ||= { best: 0, attempts: 0, complete: false };
function save() { try { localStorage.setItem('zankii-progress-v1', JSON.stringify(records)); } catch { /* Keep this session's progress in memory. */ } }
let current = 0, run = null, inGame = false, held = false, pointers = new Set(), keys = new Set();
let primaryAction = () => {}, secondaryAction = () => {}, lastFrame = 0, terminalHandled = false, effectStart = 0;

class Sound {
  constructor() { this.enabled = false; this.context = null; this.lastBeat = -1; }
  unlock() {
    if (!this.enabled) return;
    try {
      this.context ||= new (window.AudioContext || window.webkitAudioContext)();
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    } catch { this.enabled = false; updateSound(); }
  }
  tone(frequency, duration, volume = .04, type = 'sine', delay = 0) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator(), gain = this.context.createGain();
    oscillator.type = type; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain); gain.connect(this.context.destination);
    oscillator.start(start); oscillator.stop(start + duration + .02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  tick(time, level) {
    const beat = Math.floor(time * level.bpm / 60);
    if (beat === this.lastBeat) return;
    this.lastBeat = beat;
    const melodies = [[0, 7, 12, 7, 4, 7, 14, 12], [0, 7, 10, 14, 3, 7, 12, 10], [0, 7, 12, 14, 7, 3, 10, 7]];
    const root = [146.83, 130.81, 164.81][level.index];
    this.tone(root * 2 ** (melodies[level.index][beat % 8] / 12), .7, .025, 'sine');
    if (beat % 4 === 0) { this.tone(root / 2, 1.8, .035); this.tone(root * 1.5, 1.5, .012); }
    this.tone(beat % 2 ? 880 : 660, .035, .005, 'triangle');
  }
  effect(name) {
    this.unlock();
    if (name === 'dead') { this.tone(130, .17, .045, 'triangle'); this.tone(65, .25, .025, 'sine', .05); }
    if (name === 'start') this.tone(440, .18, .02);
    if (name === 'win') [0, 4, 7, 12].forEach((n, i) => this.tone(261.63 * 2 ** (n / 12), .8, .035, 'sine', i * .12));
  }
  mute() { if (this.context) this.context.suspend().catch(() => {}); }
}
const sound = new Sound();
function updateSound() {
  $('sound').setAttribute('aria-pressed', String(sound.enabled));
  $('sound-label').textContent = sound.enabled ? 'Звук вкл.' : 'Звук выкл.';
}
$('sound').addEventListener('click', () => { sound.enabled = !sound.enabled; if (sound.enabled) sound.unlock(); else sound.mute(); updateSound(); });

function path(context, points, offset = 0) {
  context.beginPath();
  points.forEach((p, i) => i ? context.lineTo(p.x - offset, p.y) : context.moveTo(p.x - offset, p.y));
  context.closePath();
}
function frogFace(context, x, y, scale, opacity) {
  context.save(); context.translate(x, y); context.scale(scale, scale); context.globalAlpha = opacity;
  context.fillStyle = '#b6d87d'; context.beginPath(); context.ellipse(0, 0, 69, 44, 0, 0, Math.PI * 2); context.fill();
  for (const side of [-1, 1]) {
    context.beginPath(); context.arc(side * 38, -34, 25, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#ecf3d5'; context.beginPath(); context.arc(side * 38, -37, 16, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#263b31'; context.beginPath(); context.arc(side * 38 + 3, -35, 7, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#b6d87d';
  }
  context.strokeStyle = '#334f3a'; context.lineWidth = 4; context.lineCap = 'round';
  context.beginPath(); context.moveTo(-30, 8); context.quadraticCurveTo(0, 26, 30, 8); context.stroke();
  context.restore();
}
function background(context, theme, offset, time = 0) {
  const p = palettes[theme];
  const gradient = context.createLinearGradient(0, 0, 0, 720); gradient.addColorStop(0, p.sky); gradient.addColorStop(1, p.low);
  context.fillStyle = gradient; context.fillRect(0, 0, 1280, 720);
  const rand = seeded(theme === 'mint' ? 3 : 14);
  if (theme !== 'mint') {
    context.fillStyle = p.stars;
    for (let i = 0; i < 85; i++) {
      const x = ((rand() * 1600 - offset * .025) % 1440 + 1440) % 1440 - 80;
      const y = rand() * 620, r = rand() * 1.3 + .4;
      context.globalAlpha = .2 + rand() * .4; context.beginPath(); context.arc(x, y, r, 0, 7); context.fill();
    }
    context.globalAlpha = 1;
  }
  if (theme === 'lunar') {
    const x = 1010 - (offset * .015 % 180), y = 225;
    const moon = context.createRadialGradient(x - 40, y - 55, 10, x, y, 150);
    moon.addColorStop(0, '#6771a54a'); moon.addColorStop(.9, '#515e9345'); moon.addColorStop(1, '#8593c221');
    context.fillStyle = moon; context.beginPath(); context.arc(x, y, 150, 0, 7); context.fill();
    const craters = seeded(71);
    context.save(); context.beginPath(); context.arc(x, y, 150, 0, 7); context.clip();
    for (let i = 0; i < 30; i++) {
      const cx = x - 130 + craters() * 260, cy = y - 130 + craters() * 260, r = 4 + craters() * 21;
      context.fillStyle = '#17264515'; context.beginPath(); context.ellipse(cx, cy, r, r * .55, -.4, 0, 7); context.fill();
    }
    context.restore();
  } else if (theme === 'mint') {
    context.fillStyle = '#f7fff35c'; context.beginPath(); context.arc(1010 - offset * .015 % 180, 255, 123, 0, 7); context.fill();
    context.strokeStyle = '#3979690b'; context.lineWidth = 1;
    for (let x = -offset * .08 % 54; x < 1280; x += 54) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 720); context.stroke(); }
    for (let y = 0; y < 720; y += 54) { context.beginPath(); context.moveTo(0, y); context.lineTo(1280, y); context.stroke(); }
  } else {
    context.strokeStyle = '#c1de7a0b'; context.lineWidth = 1;
    for (let x = -offset * .08 % 64; x < 1280; x += 64) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 720); context.stroke(); }
    for (let y = 0; y < 720; y += 64) { context.beginPath(); context.moveTo(0, y); context.lineTo(1280, y); context.stroke(); }
    frogFace(context, 1010 - offset * .025 % 250, 260, 1.65, .12);
  }
  for (let layer = 0; layer < 3; layer++) {
    const random = seeded(19 + layer * 7), parallax = offset * (.035 + layer * .025);
    context.beginPath(); context.moveTo(-200, 720);
    for (let i = -2; i < 16; i++) {
      const x = i * 140 - parallax % 140;
      const y = 400 + layer * 75 - random() * (180 - layer * 35);
      context.lineTo(x, y);
    }
    context.lineTo(1500, 720); context.closePath();
    context.fillStyle = layer === 0 ? p.hill2 : p.hill; context.globalAlpha = .25 + layer * .13; context.fill();
  }
  context.globalAlpha = 1;
  if (theme === 'frog') {
    const labels = ['ПИНГ: КВА', 'это база', 'не квакнись', 'СИГНАЛ ПОЙМАН'];
    const block = Math.floor(offset / 2200);
    context.save(); context.fillStyle = p.text; context.globalAlpha = .13; context.font = '600 26px monospace';
    context.translate(850, 180); context.rotate(-.06); context.fillText(labels[((block % 4) + 4) % 4], 0, 0); context.restore();
  }
}
function terrain(context, level, offset) {
  const p = palettes[level.theme], points = level.points;
  const first = Math.max(0, Math.floor(Math.max(0, offset) / level.spacing) - 1);
  const last = Math.min(points.length - 2, Math.ceil((offset + 1280) / level.spacing));
  const upper = [], lower = [];
  if (offset < 0) { upper.push({ x: offset - 10, y: points[0].top }); lower.push({ x: offset - 10, y: points[0].bottom }); }
  for (let i = first; i <= last + 1; i++) { upper.push({ x: points[i].x, y: points[i].top }); lower.push({ x: points[i].x, y: points[i].bottom }); }
  if (offset + 1280 > level.length) { upper.push({ x: offset + 1290, y: points.at(-1).top }); lower.push({ x: offset + 1290, y: points.at(-1).bottom }); }
  for (const [edge, top] of [[upper, true], [lower, false]]) {
    const far = top ? -20 : 740;
    const poly = [{ x: edge[0].x, y: far }, ...edge, { x: edge.at(-1).x, y: far }];
    const gradient = context.createLinearGradient(0, top ? 0 : 720, 0, 360); gradient.addColorStop(0, p.ground2); gradient.addColorStop(1, p.ground);
    path(context, poly, offset); context.fillStyle = gradient; context.fill();
    context.save(); path(context, poly, offset); context.clip();
    context.strokeStyle = p.line; context.lineWidth = 1; context.globalAlpha = .6;
    for (let x = Math.floor(offset / 220) * 220; x < offset + 1500; x += 220) {
      context.beginPath(); context.moveTo(x - offset, far); context.lineTo(x + 155 - offset, 360); context.lineTo(x + 155 - offset, far); context.stroke();
    }
    context.restore();
    context.beginPath(); edge.forEach((point, i) => i ? context.lineTo(point.x - offset, point.y) : context.moveTo(point.x - offset, point.y));
    context.strokeStyle = p.edge; context.lineWidth = 3; context.lineJoin = 'bevel'; context.stroke();
    context.strokeStyle = p.edge + '15'; context.lineWidth = 10; context.stroke();
  }
  for (const hazard of level.hazards) {
    if (hazard.x < offset - 70 || hazard.x > offset + 1350) continue;
    path(context, hazard.poly, offset); context.fillStyle = hazard.crystal ? p.crystal : p.spike; context.fill();
    context.lineWidth = 1.7; context.strokeStyle = level.theme === 'mint' ? '#4b9f88' : p.edge; context.stroke();
    if (hazard.crystal) {
      const [a, b, c, d] = hazard.poly;
      path(context, [a, b, c], offset); context.fillStyle = '#ffffff24'; context.fill();
      context.beginPath(); context.moveTo(d.x - offset, d.y); context.lineTo(b.x - offset, b.y); context.strokeStyle = '#ffffff55'; context.lineWidth = 1; context.stroke();
    }
  }
  const finishX = level.length - offset;
  if (finishX > -30 && finishX < 1350) {
    const c = corridorAt(level, level.length);
    context.save(); context.strokeStyle = p.edge; context.lineWidth = 2; context.setLineDash([5, 10]); context.globalAlpha = .7;
    context.beginPath(); context.moveTo(finishX, c.top + 8); context.lineTo(finishX, c.bottom - 8); context.stroke(); context.restore();
    context.fillStyle = p.edge; context.font = '12px sans-serif'; context.textAlign = 'center'; context.fillText('ФИНИШ', finishX, c.top - 17); context.textAlign = 'left';
  }
}
function fatWave(context, x, y, size = 20, heldUp = true, glow = true) {
  context.save(); context.translate(x, y); context.rotate(heldUp ? -Math.PI / 4 : Math.PI / 4); context.scale(size / 25, size / 25);
  if (glow) { context.shadowColor = '#759dff'; context.shadowBlur = 8; }
  context.beginPath(); context.arc(-3, 0, 24, Math.PI * .31, Math.PI * 1.69); context.lineTo(22, 0); context.closePath();
  context.fillStyle = '#183b8c'; context.fill(); context.shadowBlur = 0; context.strokeStyle = '#95b2ff'; context.lineWidth = 1.6; context.stroke();
  context.beginPath(); context.arc(-6, 0, 14, 0, 7); context.fillStyle = '#7d00ff'; context.fill(); context.strokeStyle = '#10192e'; context.lineWidth = 2.5; context.stroke();
  context.fillStyle = '#7d00ff'; context.strokeStyle = '#10192e'; context.lineWidth = 2;
  for (const sy of [-1, 1]) { context.fillRect(17, sy === -1 ? -21 : 15, 11, 6); context.strokeRect(17, sy === -1 ? -21 : 15, 11, 6); }
  context.restore();
}
function drawTrail(context, trail, offset, theme) {
  if (!trail.length) return;
  context.save(); context.beginPath(); trail.forEach((p, i) => i ? context.lineTo(p.x - offset, p.y) : context.moveTo(p.x - offset, p.y));
  context.lineJoin = 'miter'; context.lineCap = 'round'; context.lineWidth = 4;
  context.strokeStyle = theme === 'mint' ? '#4b9af0' : '#96baff'; context.shadowColor = '#754bff'; context.shadowBlur = reducedMotion ? 0 : 10; context.stroke();
  context.shadowBlur = 0; context.lineWidth = 1.5; context.strokeStyle = '#c7d4ff'; context.stroke(); context.restore();
}
function render(context, level, x, y, trail, up = true, time = 0, deadEffect = 0, playerScreenX = WORLD.playerX) {
  const offset = x - playerScreenX;
  context.save(); context.scale(context.canvas.width / 1280, context.canvas.height / 720);
  background(context, level.theme, offset, time); terrain(context, level, offset); drawTrail(context, trail, offset, level.theme);
  if (!deadEffect) fatWave(context, playerScreenX, y, playerScreenX === WORLD.playerX ? 20 : 35, up);
  else {
    context.save(); context.globalAlpha = Math.max(0, 1 - deadEffect * 2);
    const rand = seeded(81);
    for (let i = 0; i < 14; i++) {
      const angle = rand() * Math.PI * 2, dist = deadEffect * (60 + rand() * 130);
      context.fillStyle = i % 2 ? '#97baff' : '#b185ff'; context.fillRect(playerScreenX + Math.cos(angle) * dist, y + Math.sin(angle) * dist, 4, 4);
    }
    context.restore();
  }
  context.restore();
}
function preview(target, index, hero = false, time = 0) {
  const level = levels[index], context = target.getContext('2d');
  const x = hero ? 1850 : 2200, y = corridorAt(level, x).center;
  const trail = [
    { x: x - 600, y: y + 40 }, { x: x - 500, y: y - 60 }, { x: x - 400, y: y + 40 },
    { x: x - 300, y: y - 60 }, { x: x - 200, y: y + 40 }, { x: x - 100, y: y - 60 },
    { x: x - 50, y: y - 10 }, { x, y: y - 60 }
  ];
  render(context, level, x, y - 60, trail, true, time, 0, hero ? 850 : 550);
}
function buildMenu() {
  $('level-grid').replaceChildren();
  levels.forEach((level, i) => {
    const r = recordFor(level.id), card = document.createElement('button');
    card.className = 'level-card'; card.style.setProperty('--card-accent', level.accent);
    card.setAttribute('aria-label', `${i + 1}. ${level.name}. ${level.difficulty}. ${level.seconds} секунд. ${r.complete ? 'Пройден' : 'Рекорд ' + r.best + '%'}`);
    card.innerHTML = `<div class="thumbnail"><canvas width="768" height="432" aria-hidden="true"></canvas><span class="level-badge">0${i + 1} / ${level.english}</span><span class="level-duration">${level.seconds} СЕК</span></div><div class="card-body"><div class="card-top"><h3>${level.name}</h3><span class="card-play" aria-hidden="true">▶</span></div><p class="card-desc">${level.subtitle}</p><div class="card-bottom"><span class="difficulty"><i></i>${level.difficulty}</span><span class="card-record">${r.complete ? '✓ Пройден' : r.best ? 'Рекорд ' + r.best + '%' : 'Начать ↗'}</span></div></div>`;
    card.addEventListener('click', () => selectLevel(i)); $('level-grid').append(card); preview(card.querySelector('canvas'), i);
  });
}
function clearInput() { held = false; pointers.clear(); keys.clear(); }
function announce(text) { $('announcement').textContent = text; }
function overlay(eyebrow, title, text, primary, action, secondary = 'К уровням', secondAction = showMenu, stats = '') {
  clearInput(); $('overlay-eyebrow').textContent = eyebrow; $('overlay-title').textContent = title; $('overlay-text').textContent = text;
  $('overlay-stats').innerHTML = stats; $('overlay-primary').textContent = primary; $('overlay-secondary').textContent = secondary;
  primaryAction = action; secondaryAction = secondAction; $('game-overlay').hidden = false;
  $('overlay-primary').focus({ preventScroll: true }); announce(title + '. ' + text);
}
function hideOverlay() { $('game-overlay').hidden = true; canvas.focus({ preventScroll: true }); }
function selectLevel(index) {
  clearInput(); current = index; run = createRun(levels[index]); inGame = true; terminalHandled = false;
  document.body.classList.add('in-game'); document.documentElement.style.setProperty('--game-accent', run.level.accent);
  $('menu').hidden = true; $('game-view').hidden = false;
  history.replaceState(null, '', `#${run.level.id}`);
  $('game-number').textContent = `0${index + 1}`; $('game-title').textContent = run.level.name;
  $('attempt-label').textContent = `Попыток: ${recordFor(run.level.id).attempts}`;
  $('pause').disabled = true; updateHud();
  overlay(`0${index + 1} / ${run.level.english}`, index === 2 ? 'Не квакнись.' : 'Поймай волну',
    'Держи пробел, кнопку мыши или палец — вверх.\nОтпускай — вниз. Долетай до финиша.', 'Начать полёт ↗', () => startRun(false));
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function startRun(initialHeld = false) {
  run = createRun(levels[current]); run.state = 'playing'; terminalHandled = false;
  clearInput(); held = initialHeld;
  const r = recordFor(run.level.id); r.attempts++; save();
  $('attempt-label').textContent = `Попытка ${r.attempts}`; $('pause').disabled = false;
  sound.lastBeat = -1; sound.effect('start'); hideOverlay(); updateHud();
}
function showMenu() {
  if (run?.state === 'playing') rememberProgress();
  clearInput(); inGame = false; if (run) run.state = 'ready';
  $('game-view').hidden = true; $('menu').hidden = false; document.body.classList.remove('in-game'); buildMenu();
  history.replaceState(null, '', location.pathname + location.search);
  $('quick-play').focus({ preventScroll: true });
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
function rememberProgress() {
  if (!run) return;
  const r = recordFor(run.level.id); r.best = Math.max(r.best, progress(run));
  if (run.state === 'complete') { r.best = 100; r.complete = true; } save();
}
function pauseGame() {
  if (run?.state !== 'playing') return;
  run.state = 'paused'; rememberProgress();
  overlay('МОЖНО ВЫДОХНУТЬ', 'Пауза', 'Твоя волна подождёт.', 'Продолжить ↗', resumeGame);
}
function resumeGame() { if (run?.state !== 'paused') return; clearInput(); run.state = 'playing'; hideOverlay(); }
function terminal(now) {
  if (terminalHandled) return; terminalHandled = true; effectStart = now; clearInput(); rememberProgress(); $('pause').disabled = true;
  const r = recordFor(run.level.id), value = progress(run);
  if (run.state === 'dead') {
    sound.effect('dead');
    // A short, quiet impact makes the collision readable before the retry panel.
    setTimeout(() => {
      if (!inGame || run.state !== 'dead') return;
      overlay(current === 2 ? 'КВАКНУЛСЯ. БЫВАЕТ.' : 'ЕЩЁ ОДИН ЗИГЗАГ', current === 2 ? 'Ква. Ещё раз?' : 'Почти поймал.',
        'Каждая попытка — чуть точнее.\nПробел или кнопка — и снова в полёт.', 'Ещё попытка ↗', () => startRun(false), 'К уровням', showMenu,
        `<div><strong>${value}%</strong><small>ЭТА ПОПЫТКА</small></div><div><strong>${r.best}%</strong><small>ЛУЧШИЙ ПОЛЁТ</small></div>`);
    }, reducedMotion ? 50 : 280);
  } else {
    sound.effect('win');
    const last = current === levels.length - 1;
    overlay('100% / ЧИСТЫЙ ПОЛЁТ', current === 2 ? 'Ква-красиво!' : 'Волна поймана.',
      last ? 'Все три мира доступны в меню.\nМожно вернуться и пройти любимый ещё раз.' : `${run.level.name} пройден.\nСледующий мир уже ждёт.`,
      last ? 'Выбрать уровень ↗' : 'Следующий уровень ↗', last ? showMenu : () => selectLevel(current + 1),
      'Пройти ещё раз', () => selectLevel(current), `<div><strong>100%</strong><small>ПРОЙДЕНО</small></div><div><strong>${r.attempts}</strong><small>ПОПЫТОК</small></div>`);
  }
}
function updateHud() {
  if (!run) return;
  const p = progress(run); $('progress-fill').style.width = `${p}%`; $('progress-label').textContent = `${p}%`;
  $('game-section').textContent = run.level.sections[Math.min(3, Math.floor(p / 25))];
  $('touch-hint').hidden = run.time > 6;
}
$('overlay-primary').addEventListener('click', () => primaryAction());
$('overlay-secondary').addEventListener('click', () => secondaryAction());
$('quick-play').addEventListener('click', () => selectLevel(0));
$('brand').addEventListener('click', showMenu); $('back').addEventListener('click', showMenu);
$('restart').addEventListener('click', () => selectLevel(current));
$('pause').addEventListener('click', pauseGame);
$('fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else if ($('stage').requestFullscreen) await $('stage').requestFullscreen(); } catch { /* Browser may choose not to enter fullscreen. */ }
});
if (!$('stage').requestFullscreen) $('fullscreen').hidden = true;

function pointerDown(event) {
  if (!inGame || run?.state !== 'playing' || (event.pointerType === 'mouse' && event.button !== 0)) return;
  event.preventDefault(); pointers.add(event.pointerId); held = true;
  try { canvas.setPointerCapture(event.pointerId); } catch { /* Window release also clears the input. */ }
  canvas.focus({ preventScroll: true }); sound.unlock();
}
canvas.addEventListener('pointerdown', pointerDown);
function pointerUp(event) { pointers.delete(event.pointerId); held = pointers.size > 0 || keys.size > 0; }
window.addEventListener('pointerup', pointerUp); window.addEventListener('pointercancel', pointerUp);
canvas.addEventListener('lostpointercapture', pointerUp);
canvas.addEventListener('contextmenu', event => event.preventDefault());
window.addEventListener('keydown', event => {
  if (!inGame || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.code === 'Escape') { event.preventDefault(); if (run?.state === 'playing') pauseGame(); else if (run?.state === 'paused') resumeGame(); return; }
  if (event.code === 'KeyR' && !event.repeat) { event.preventDefault(); selectLevel(current); return; }
  if (!['Space', 'ArrowUp'].includes(event.code)) return;
  // Let focused buttons retain native Space activation when a panel is open.
  if (event.target instanceof HTMLButtonElement && !['playing', 'dead', 'ready'].includes(run?.state)) return;
  event.preventDefault(); if (event.repeat) return;
  if (run?.state === 'dead') { if (!terminalHandled || performance.now() - effectStart < 280) return; startRun(true); }
  else if (run?.state === 'ready') startRun(true);
  if (run?.state === 'playing') { keys.add(event.code); held = true; sound.unlock(); }
});
window.addEventListener('keyup', event => { keys.delete(event.code); held = keys.size > 0 || pointers.size > 0; if (inGame && ['Space', 'ArrowUp'].includes(event.code)) event.preventDefault(); });
window.addEventListener('blur', () => { clearInput(); pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); pauseGame(); } });

function frame(now) {
  const delta = lastFrame ? Math.min((now - lastFrame) / 1000, .1) : 0; lastFrame = now;
  if (inGame && run) {
    if (run.state === 'playing') { advance(run, held, delta); sound.tick(run.time, run.level); }
    if (['dead', 'complete'].includes(run.state)) terminal(now);
    const trail = [...run.trail, { x: run.x, y: run.y }];
    render(ctx, run.level, run.x, run.y, trail, held, run.time, run.state === 'dead' ? Math.max(.001, (now - effectStart) / 1000) : 0);
    updateHud();
  }
  requestAnimationFrame(frame);
}
buildMenu(); preview($('hero-canvas'), 1, true);
const linkedLevel = levels.findIndex(level => `#${level.id}` === location.hash);
if (linkedLevel !== -1) selectLevel(linkedLevel);
requestAnimationFrame(frame);
