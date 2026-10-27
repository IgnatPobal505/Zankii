import { WORLD, PORTAL_INFO, polygonsFor, movingY, corridorAt, sectionAt } from './engine.js?v=3';

export const THEMES = {
  mint: ['#0b2228', '#112f32', '#91e3c3'], cyan: ['#0b1c2d', '#103447', '#70dbff'],
  lunar: ['#15182d', '#232941', '#bdabff'], pink: ['#251629', '#3b233d', '#f29ddc'],
  orange: ['#271b1b', '#3b2c28', '#ffb17b'], violet: ['#1e1730', '#302445', '#c3a4ff'],
  lime: ['#1a241d', '#2c3929', '#c5ec83'], red: ['#291520', '#43212c', '#ff8399'],
  ice: ['#111c2e', '#203249', '#a0d6ff'], gold: ['#272319', '#3a3224', '#ffe08c']
};
export const DIFFICULTY_COLORS = { Easy: '#8ee0b1', Normal: '#7dcfff', Hard: '#ffc878', Insane: '#ee9dda', Extreme: '#ff7f91' };
export const accentFor = level => THEMES[level.theme][2];
function poly(ctx, points, offset) { ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x - offset, p.y) : ctx.moveTo(p.x - offset, p.y)); ctx.closePath(); }

export function fatWave(ctx, x, y, size = 20, up = true, glow = true) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(up ? -Math.PI / 4 : Math.PI / 4); ctx.scale(size / 25, size / 25);
  if (glow) { ctx.shadowColor = '#8aa9ff'; ctx.shadowBlur = 7; }
  ctx.beginPath(); ctx.arc(-3, 0, 24, Math.PI * .31, Math.PI * 1.69); ctx.lineTo(22, 0); ctx.closePath();
  ctx.fillStyle = '#183b8c'; ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = '#a9c5ff'; ctx.lineWidth = 1.8; ctx.stroke();
  ctx.beginPath(); ctx.arc(-6, 0, 14, 0, 7); ctx.fillStyle = '#7d00ff'; ctx.fill(); ctx.strokeStyle = '#0d1530'; ctx.lineWidth = 2.5; ctx.stroke();
  for (const sy of [-1, 1]) { ctx.fillStyle = '#7d00ff'; ctx.fillRect(17, sy === -1 ? -21 : 15, 11, 6); ctx.strokeRect(17, sy === -1 ? -21 : 15, 11, 6); }
  ctx.restore();
}
function backdrop(ctx, level, offset, low) {
  const [sky, floor, accent] = THEMES[level.theme];
  const gradient = ctx.createLinearGradient(0, 0, 0, 720); gradient.addColorStop(0, sky); gradient.addColorStop(1, floor);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1280, 720);
  ctx.lineWidth = 1; ctx.strokeStyle = accent + '0b';
  const grid = low ? 128 : 64;
  for (let x = -(offset * .2 % grid); x < 1280; x += grid) { ctx.beginPath(); ctx.moveTo(x, 54); ctx.lineTo(x, 666); ctx.stroke(); }
  for (let y = 90; y < 660; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke(); }
  if (!low) {
    ctx.strokeStyle = accent + '12'; ctx.lineWidth = 2;
    for (let x = -(offset * .4 % 480); x < 1400; x += 480) { ctx.beginPath(); ctx.moveTo(x, 54); ctx.lineTo(x + 180, 250); ctx.lineTo(x + 180, 470); ctx.lineTo(x + 360, 666); ctx.stroke(); }
    if (level.theme === 'lunar') { ctx.fillStyle = '#c8caff09'; ctx.beginPath(); ctx.arc(1040 - offset * .02 % 180, 270, 115, 0, 7); ctx.fill(); }
  }
  ctx.fillStyle = '#0a1022'; ctx.fillRect(0, 0, 1280, WORLD.ceiling); ctx.fillRect(0, WORLD.floor, 1280, 54);
  ctx.strokeStyle = accent + 'aa'; ctx.lineWidth = 3;
  for (const y of [54, 666]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke(); }
  ctx.strokeStyle = accent + '35'; ctx.lineWidth = 2;
  for (let x = -(offset % 40); x < 1320; x += 40) { ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x + 28, 38); ctx.moveTo(x, 682); ctx.lineTo(x + 28, 710); ctx.stroke(); }
  ctx.font = '11px ui-monospace, monospace'; ctx.fillStyle = accent + '65';
  const section = sectionAt(level, offset + 650);
  ctx.fillText(`${String(level.index + 1).padStart(2, '0')} // ${section.name.toUpperCase()}`, 23, 700);
}
function block(ctx, points, offset, accent, low, moving = false) {
  poly(ctx, points, offset); ctx.fillStyle = '#172137'; ctx.fill();
  ctx.strokeStyle = moving ? '#ffc57f' : accent; ctx.lineWidth = 2.4; ctx.stroke();
  if (!low) {
    ctx.save(); poly(ctx, points, offset); ctx.clip(); ctx.strokeStyle = (moving ? '#ffbc72' : accent) + '1c'; ctx.lineWidth = 1;
    const xs = points.map(p => p.x), ys = points.map(p => p.y), left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
    for (let x = left - (bottom - top); x < right + 80; x += 44) { ctx.beginPath(); ctx.moveTo(x - offset, top); ctx.lineTo(x + bottom - top - offset, bottom); ctx.stroke(); }
    ctx.restore();
  }
  // Inner line helps distinguish solid collision edges from distant decoration.
  if (points.length === 4 && points[0].y === points[1].y) {
    const x = points[0].x - offset, y = points[0].y, w = points[1].x - points[0].x, h = points[2].y - y;
    if (w > 20 && h > 22) { ctx.strokeStyle = accent + '28'; ctx.lineWidth = 1; ctx.strokeRect(x + 7, y + 7, w - 14, h - 14); }
  }
}
function saw(ctx, object, offset, time, low) {
  const x = object.x - offset, y = movingY(object, time), r = object.radius;
  ctx.save(); ctx.strokeStyle = '#ffac7745'; ctx.setLineDash([4, 7]); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, object.cy - object.amplitude); ctx.lineTo(x, object.cy + object.amplitude); ctx.stroke(); ctx.setLineDash([]);
  ctx.translate(x, y); ctx.rotate(low ? 0 : time * 1.5); ctx.beginPath();
  for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2, d = i % 2 ? r * .78 : r; i ? ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d) : ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d); }
  ctx.closePath(); ctx.fillStyle = '#ea9272'; ctx.fill(); ctx.strokeStyle = '#ffd6b8'; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.strokeStyle = '#ffc9a987'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * .36, 0, 7); ctx.fillStyle = '#3c3040'; ctx.fill(); ctx.strokeStyle = '#ffc29e'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}
function portalStyle(p) {
  let label = PORTAL_INFO[p.type].label, color = PORTAL_INFO[p.type].color, icon = '';
  if (p.type === 'speed') { label = `${p.value.toFixed(2)}x SPEED`; icon = p.value === 1 ? '›' : '»'; if (p.value === 1) color = '#91e3b4'; }
  if (p.type === 'size') { label = p.value ? 'MINI WAVE' : 'NORMAL WAVE'; icon = p.value ? '−' : '+'; if (!p.value) color = '#91e3b4'; }
  if (p.type === 'gravity') { label = p.value === -1 ? 'INVERTED' : 'RESTORE'; icon = p.value === -1 ? '↓' : '↑'; if (p.value === 1) color = '#7cbaff'; }
  if (p.type === 'dual') { label = p.value ? 'DUAL WAVE' : 'SINGLE WAVE'; icon = p.value ? 'Ⅱ' : 'Ⅰ'; if (!p.value) color = '#7cbaff'; }
  if (p.type === 'teleport') { icon = '↗'; label = p.exit ? 'EXIT' : 'TELEPORT'; if (p.exit) color = '#ffb479'; }
  return { label, color, icon };
}
function drawPortal(ctx, p, offset, low) {
  const x = p.x - offset; if (x < -100 || x > 1380) return;
  const { color, label, icon } = portalStyle(p);
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 3;
  if (!low) { ctx.shadowColor = color; ctx.shadowBlur = 9; }
  ctx.beginPath(); ctx.ellipse(x, 360, 19, 268, 0, 0, 7); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = color + '0c'; ctx.fill();
  ctx.strokeStyle = color + '60'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, 360, 28, 278, 0, 0, 7); ctx.stroke();
  ctx.fillStyle = '#10182a'; ctx.fillRect(x - 60, 79, 120, 24);
  ctx.font = '600 11px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.fillText(label, x, 95);
  ctx.fillStyle = '#10182a'; ctx.fillRect(x - 17, 341, 34, 38); ctx.font = '25px sans-serif'; ctx.fillStyle = color; ctx.fillText(icon, x, 369);
  if (p.exit) { ctx.beginPath(); ctx.moveTo(x + 30, p.targetY); ctx.lineTo(x + 54, p.targetY); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 54, p.targetY); ctx.lineTo(x + 46, p.targetY - 6); ctx.lineTo(x + 46, p.targetY + 6); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function trail(ctx, points, offset, low, secondary = false) {
  if (!points.length) return; ctx.save(); ctx.beginPath();
  points.forEach((p, i) => !i || p.break ? ctx.moveTo(p.x - offset, p.y) : ctx.lineTo(p.x - offset, p.y));
  ctx.lineWidth = secondary ? 3 : 4; ctx.lineJoin = 'miter'; ctx.strokeStyle = secondary ? '#c9a4ff' : '#9dbbff';
  if (!low) { ctx.shadowColor = secondary ? '#bc6cff' : '#8272ff'; ctx.shadowBlur = 7; } ctx.stroke(); ctx.restore();
}
export function render(ctx, level, run, settings = {}, playerScreenX = WORLD.playerX) {
  const offset = run.x - playerScreenX, low = settings.lowEffects;
  const accent = accentFor(level); ctx.save(); ctx.scale(ctx.canvas.width / 1280, ctx.canvas.height / 720);
  backdrop(ctx, level, offset, low);
  for (const p of level.portals) if (p.type === 'teleport' && p.x >= offset - 100 && p.x <= offset + 1280) {
    ctx.save(); ctx.setLineDash([7, 8]); ctx.strokeStyle = '#6fdcff60'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - offset, 124); ctx.lineTo(p.targetX - offset, 124); ctx.lineTo(p.targetX - offset, 150); ctx.stroke(); ctx.restore();
  }
  for (const o of level.objects) {
    if (o.x > offset + 1400) break;
    if (o.x + o.w < offset - 150) continue;
    if (o.type === 'saw') saw(ctx, o, offset, run.time, low);
    else if (o.type === 'spike') { poly(ctx, o.poly, offset); ctx.fillStyle = '#f2be9f'; ctx.fill(); ctx.strokeStyle = '#ffe0c5'; ctx.lineWidth = 1; ctx.stroke(); }
    else { for (const polygon of polygonsFor(o, run.time)) block(ctx, polygon, offset, accent, low, o.type === 'gate');
      if (o.type === 'gate') { const cy = movingY(o, run.time), x = o.x - offset + o.w / 2; ctx.strokeStyle = '#ffc57f80'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(x, o.cy - o.amplitude); ctx.lineTo(x, o.cy + o.amplitude); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#ffc57f'; ctx.font = '15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('↕', x, cy + 5); ctx.textAlign = 'left'; }
    }
  }
  for (const p of level.portals) { drawPortal(ctx, p, offset, low); if (p.type === 'teleport') drawPortal(ctx, { ...p, x: p.targetX, exit: true }, offset, low); }
  const finish = level.length - offset;
  if (finish > -20 && finish < 1320) { ctx.save(); ctx.setLineDash([12, 12]); ctx.strokeStyle = accent; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(finish, 100); ctx.lineTo(finish, 620); ctx.stroke(); ctx.setLineDash([]); ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = accent; ctx.fillText('FINISH', finish - 25, 90); ctx.restore(); }
  trail(ctx, [...run.trail, { x: run.x, y: run.y }], offset, low);
  if (run.dual) trail(ctx, [...run.trail2, { x: run.x, y: run.y2 }], offset, low, true);
  const rising = (run.lastHeld ? -1 : 1) * run.gravity < 0;
  if (run.state !== 'dead') { fatWave(ctx, playerScreenX, run.y, run.mini ? 11 : 20, rising, !low); if (run.dual) fatWave(ctx, playerScreenX, run.y2, run.mini ? 11 : 20, !rising, !low); }
  if (run.collision) {
    ctx.save(); ctx.strokeStyle = '#ff7c86'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(run.x - offset, run.collision.y, 22, 0, 7); ctx.stroke(); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(run.x - offset, run.collision.y, 31, 0, 7); ctx.stroke(); ctx.restore();
  }
  const event = run.events.at(-1);
  if (event && settings.portalPulse && !low && run.time - event.time < .35) { ctx.strokeStyle = PORTAL_INFO[event.type].color + '65'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(playerScreenX, run.y, 25 + (run.time - event.time) * 130, 0, 7); ctx.stroke(); }
  ctx.restore();
}
export function preview(canvas, level, settings = {}, hero = false) {
  const signatures = ['slalom', 'saws', 'invert', 'mini', 'teleport', 'dual', 'gates', 'boost', 'dual', 'mini'];
  const section = level.sections.find(s => s.kind === (hero ? 'boost' : signatures[level.index])) || level.sections[1];
  const x = section.start + 80, y = corridorAt(level, x).center;
  const fake = { x, y, y2: 720 - y, mini: false, dual: false, gravity: 1, time: level.index * 1.4 + 4, lastHeld: true, state: 'ready', collision: null, events: [], trail2: [], trail: [{ x: x - 360, y: y + 25 }, { x: x - 265, y: y - 70 }, { x: x - 170, y: y + 25 }, { x: x - 75, y: y - 70 }, { x, y }] };
  render(canvas.getContext('2d'), level, fake, settings, hero ? 310 : 235);
}
