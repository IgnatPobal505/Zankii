// The game uses fixed simulation steps so movement doesn't depend on screen refresh rate.
export const WORLD = { width: 1280, height: 720, playerX: 230, radius: 9, step: 1 / 240 };

export const LEVELS = [
  { id: 'mint', name: 'Мятный поток', english: 'MINT FLOW', subtitle: 'Мягкий старт. Свежий воздух. Твой первый зигзаг.', difficulty: 'Лёгкий', seconds: 42, speed: 225, accent: '#a7ead7', bpm: 96, theme: 'mint', seed: 13,
    sections: ['Первый полёт', 'Лови ритм', 'Выше облаков', 'Мятная прямая'],
    centers: [360, 360, 290, 405, 285, 370, 450, 330, 255, 390, 330, 445, 300, 360, 360], gap: 350, minGap: 285 },
  { id: 'lunar', name: 'Лунный свет', english: 'LUNAR LIGHT', subtitle: 'Тихая ночь и чуть более точные движения.', difficulty: 'Средний', seconds: 46, speed: 240, accent: '#b7a1f5', bpm: 104, theme: 'lunar', seed: 29,
    sections: ['Ночной взлёт', 'Между звёзд', 'Лунная дуга', 'На другой стороне'],
    centers: [360, 320, 440, 275, 380, 255, 420, 310, 445, 290, 400, 250, 370, 440, 290, 360], gap: 300, minGap: 240 },
  { id: 'frog', name: 'Ква-код', english: 'FROG.EXE', subtitle: 'Лягушка в сети. Пинг норм. Главное — не квакнуться.', difficulty: 'С характером', seconds: 48, speed: 245, accent: '#d1f67d', bpm: 110, theme: 'frog', seed: 47,
    sections: ['Подключаем болото', 'Пинг: ква', 'Это база', 'Сигнал пойман'],
    centers: [360, 330, 420, 270, 395, 290, 445, 300, 390, 260, 425, 315, 450, 280, 390, 300, 360], gap: 295, minGap: 235 }
];

export function seeded(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
export function corridorAt(level, x) {
  const points = level.points;
  let i = Math.floor(Math.max(0, Math.min(x, level.length)) / level.spacing);
  i = Math.min(i, points.length - 2);
  const a = points[i], b = points[i + 1];
  const t = Math.max(0, Math.min(1, (x - a.x) / (b.x - a.x)));
  return { top: a.top + (b.top - a.top) * t, bottom: a.bottom + (b.bottom - a.bottom) * t, center: a.center + (b.center - a.center) * t };
}

export function createLevel(index) {
  const config = LEVELS[index];
  if (!config) throw new RangeError('Unknown level');
  const level = { ...config, index, length: config.speed * config.seconds, points: [], hazards: [] };
  level.spacing = level.length / (config.centers.length - 1);
  level.points = config.centers.map((center, i) => {
    // Open, forgiving entry and exit; the middle asks for more precise timing.
    const t = i / (config.centers.length - 1);
    const gap = config.gap - (config.gap - config.minGap) * Math.sin(t * Math.PI);
    return { x: i * level.spacing, center, top: center - gap / 2, bottom: center + gap / 2 };
  });
  let n = 0;
  for (let x = 880; x < level.length - 650; x += index === 0 ? 470 : 425) {
    const { top, bottom } = corridorAt(level, x);
    const upper = n % 2 === 0;
    const edge = upper ? top : bottom;
    const sign = upper ? 1 : -1;
    const height = 28 + (n % 3) * 5;
    const w = 25;
    const crystal = n % 3 !== 0;
    const poly = crystal
      ? [{ x, y: edge - sign * 5 }, { x: x + w * .7, y: edge + sign * height * .46 }, { x, y: edge + sign * height }, { x: x - w * .7, y: edge + sign * height * .46 }]
      : [{ x: x - w, y: edge - sign * 5 }, { x: x + w, y: edge - sign * 5 }, { x, y: edge + sign * height }];
    level.hazards.push({ x, poly, crystal, upper });
    n++;
  }
  return level;
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
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    if ((x - a.x - t * dx) ** 2 + (y - a.y - t * dy) ** 2 <= radius ** 2) return true;
  }
  return false;
}
export function collides(level, x, y) {
  const r = WORLD.radius;
  if (y - r < 0 || y + r > WORLD.height) return true;
  const first = Math.max(0, Math.floor((x - r) / level.spacing));
  const last = Math.min(level.points.length - 2, Math.floor((x + r) / level.spacing));
  for (let i = first; i <= last; i++) {
    const a = level.points[i], b = level.points[i + 1];
    if (circleHitsPolygon(x, y, r, [{ x: a.x, y: 0 }, { x: b.x, y: 0 }, { x: b.x, y: b.top }, { x: a.x, y: a.top }])) return true;
    if (circleHitsPolygon(x, y, r, [{ x: a.x, y: a.bottom }, { x: b.x, y: b.bottom }, { x: b.x, y: WORLD.height }, { x: a.x, y: WORLD.height }])) return true;
  }
  for (const hazard of level.hazards) {
    if (Math.abs(hazard.x - x) < 50 && circleHitsPolygon(x, y, r, hazard.poly)) return true;
  }
  return false;
}
export function createRun(level) {
  return { level, x: 0, y: level.centers[0], time: 0, accumulator: 0, state: 'ready', trail: [{ x: 0, y: level.centers[0] }], lastHeld: false, deathTime: 0 };
}
export function advance(run, held, delta) {
  if (run.state !== 'playing') return;
  // Hidden tabs are paused in the UI. This cap prevents a stalled frame teleporting the player.
  run.accumulator += Math.max(0, Math.min(delta, .1));
  while (run.accumulator + 1e-10 >= WORLD.step && run.state === 'playing') {
    run.accumulator = Math.max(0, run.accumulator - WORLD.step);
    if (held !== run.lastHeld) { run.trail.push({ x: run.x, y: run.y }); run.lastHeld = held; }
    run.x += run.level.speed * WORLD.step;
    run.y += (held ? -1 : 1) * run.level.speed * WORLD.step;
    run.time += WORLD.step;
    if (collides(run.level, run.x, run.y)) { run.state = 'dead'; break; }
    if (run.x >= run.level.length) { run.x = run.level.length; run.state = 'complete'; break; }
    while (run.trail.length > 2 && run.trail[1].x < run.x - WORLD.width) run.trail.shift();
  }
}
export function progress(run) { return Math.min(100, Math.floor(run.x / run.level.length * 100)); }
