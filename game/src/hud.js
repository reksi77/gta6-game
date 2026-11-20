// The heads-up display: money and health, the wanted stars, the current objective, the
// minimap, Marta's dialogue and the mission banner. Drawing only — it reads the state and
// paints pixels; it never changes the game.

import { VIEW, PALETTE, FONT, WANTED } from './config.js';
import { objectiveLabel, objectiveTarget, currentObjective } from './missions.js';
import { wantedLevel } from './police.js';

const MINIMAP = { size: 168, margin: 16 };

function text(ctx, value, x, y, size, color, align, weight) {
  ctx.font = `${weight || 400} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function drawStars(ctx, wanted) {
  const size = 26;
  const gap = 6;
  const total = WANTED.max * (size + gap) - gap;
  let x = VIEW.width - MINIMAP.margin - total;
  const y = 34;
  for (let star = 0; star < WANTED.max; star += 1) {
    text(ctx, '\u2605', x + size / 2, y, size, star < wanted ? '#ffd94c' : 'rgba(244, 241, 232, 0.25)', 'center', 700);
    x += size + gap;
  }
}

function drawMinimap(ctx, state) {
  const size = MINIMAP.size;
  const x0 = VIEW.width - MINIMAP.margin - size;
  const y0 = VIEW.height - MINIMAP.margin - size;
  const scale = size / state.city.size;
  ctx.fillStyle = 'rgba(14, 20, 32, 0.82)';
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.strokeStyle = '#ffd94c';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.fillStyle = '#20242c';
  ctx.fillRect(x0, y0, size, size);
  // Roads.
  ctx.strokeStyle = '#6a7078';
  ctx.lineWidth = 2;
  for (const line of state.city.roads.vertical) {
    ctx.beginPath();
    ctx.moveTo(x0 + line * scale, y0);
    ctx.lineTo(x0 + line * scale, y0 + size);
    ctx.stroke();
  }
  for (const line of state.city.roads.horizontal) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + line * scale);
    ctx.lineTo(x0 + size, y0 + line * scale);
    ctx.stroke();
  }
  // Objective beacon.
  const target = objectiveTarget(state.missions, state.city);
  if (target !== null) {
    ctx.fillStyle = '#ffd94c';
    ctx.beginPath();
    ctx.arc(x0 + target.x * scale, y0 + target.y * scale, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police, then the player on top.
  ctx.fillStyle = '#ff5a4e';
  for (const cop of state.police.cops) {
    ctx.fillRect(x0 + cop.x * scale - 2, y0 + cop.y * scale - 2, 4, 4);
  }
  for (const patrol of state.police.patrols) {
    ctx.fillRect(x0 + patrol.car.x * scale - 2, y0 + patrol.car.y * scale - 2, 4, 4);
  }
  const px = x0 + state.player.x * scale;
  const py = y0 + state.player.y * scale;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd94c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, 7, 0, Math.PI * 2);
  ctx.stroke();
}

function drawDialog(ctx, missions) {
  if (missions.dialog.length === 0) return;
  const lines = missions.dialog;
  const width = 640;
  const height = 30 + lines.length * 26 + 18;
  const x = (VIEW.width - width) / 2;
  const y = VIEW.height - MINIMAP.size - 24 - height;
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
  lines.forEach((line, i) => {
    text(ctx, line, x + 18, y + 32 + i * 26, 17, PALETTE.text, 'left');
  });
}

function drawBanner(ctx, missions) {
  if (missions.bannerTimer <= 0) return;
  const alpha = Math.min(1, missions.bannerTimer / 0.6);
  ctx.save();
  ctx.globalAlpha = alpha;
  text(ctx, missions.banner, VIEW.width / 2, 190, 44, PALETTE.banner, 'center', 800);
  ctx.restore();
}

/** The full in-game HUD: money, health, stars, objective, minimap, dialog and banner. */
export function drawHud(ctx, state) {
  const player = state.player;
  // Money and health, top left.
  text(ctx, `$${player.money}`, 20, 40, 30, '#7dff9e', 'left', 800);
  ctx.fillStyle = 'rgba(14, 20, 32, 0.7)';
  ctx.fillRect(20, 52, 210, 14);
  ctx.fillStyle = player.health > 30 ? '#37c978' : '#ff5a4e';
  ctx.fillRect(20, 52, 210 * Math.max(0, player.health) / 100, 14);
  ctx.strokeStyle = '#f4f1e8';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 52, 210, 14);
  text(ctx, `Ammo ${player.ammo}`, 20, 92, 17, PALETTE.text, 'left');
  if (player.car !== null) {
    text(ctx, `${player.car.type.name}  ${Math.round(Math.abs(player.car.speed) * 0.36)} km/h`, 20, 116, 17, PALETTE.text, 'left');
  }

  drawStars(ctx, wantedLevel(state.police));

  // Current objective, top centre.
  const objective = currentObjective(state.missions);
  if (objective !== null) {
    text(ctx, objectiveLabel(state.missions), VIEW.width / 2, 40, 20, '#ffd94c', 'center', 700);
    if (objective.kind === 'timed') {
      const left = Math.max(0, objective.seconds - state.missions.timer);
      text(ctx, `${Math.ceil(left)}s`, VIEW.width / 2, 68, 26, left < 20 ? '#ff5a4e' : PALETTE.text, 'center', 800);
    }
  }

  drawMinimap(ctx, state);
  drawDialog(ctx, state.missions);
  drawBanner(ctx, state.missions);

  // Contextual hint, bottom left.
  let hint = '';
  if (player.car === null && state.nearCar) hint = 'E — Get in the car';
  else if (player.car !== null) hint = 'E — Get out   •   W/S drive   •   A/D steer';
  else hint = 'WASD move   •   F punch   •   Space / click shoot';
  text(ctx, hint, 20, VIEW.height - 18, 16, PALETTE.text, 'left');
  if (state.audioMuted) text(ctx, 'Muted (M)', 20, VIEW.height - 42, 16, PALETTE.muted, 'left');
}

/** A centred panel for the title, pause and end screens. */
export function drawPanel(ctx, title, lines, prompt, accent) {
  const width = 660;
  const height = 150 + lines.length * 32 + 64;
  const x = (VIEW.width - width) / 2;
  const y = (VIEW.height - height) / 2;
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = accent || PALETTE.panelEdge;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, width, height);
  text(ctx, title, VIEW.width / 2, y + 76, 52, accent || PALETTE.banner, 'center', 800);
  lines.forEach((line, i) => {
    text(ctx, line, VIEW.width / 2, y + 132 + i * 32, 20, PALETTE.muted, 'center');
  });
  text(ctx, prompt, VIEW.width / 2, y + height - 30, 21, '#ffd94c', 'center', 700);
}
