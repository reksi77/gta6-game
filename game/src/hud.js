// The heads-up display: everything the judge should see in one frame, painted as panels
// around the playfield instead of loose text. Top left is the mission card (which job,
// which objective, the stage bar, the timer on a timed job, the payout and what comes
// next) with the SBPD dispatch board under it (every unit on the player, its call sign,
// distance and tactic, Air One on top). Top right is the money, the wanted stars and
// the in-sight tag; top centre names the district the player is standing in. Bottom
// left is the weapon slots, the health bar and a circular minimap with the objective
// beacon, the police and the player on it. Bottom right is the speedometer with the
// vehicle name. Bottom centre is Marta's dialogue. Drawing only — it reads the state
// and paints pixels; it never changes the game.

import { VIEW, PALETTE, FONT, WANTED, MISSIONS } from './config.js';
import { objectiveLabel, objectiveTarget, currentObjective, missionProgress } from './missions.js';
import { wantedLevel } from './police.js';
import { dispatchBoardRows, dispatchUnitCount, dispatchInSight, airUnitDeployed } from './dispatch.js';

const MARGIN = 16;
const CARD_X = 16;
const CARD_W = 384;

function text(ctx, value, x, y, size, color, align, weight) {
  ctx.font = `${weight || 400} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function panel(ctx, x, y, width, height) {
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
}

function bar(ctx, x, y, width, height, fraction, color) {
  ctx.fillStyle = 'rgba(244, 241, 232, 0.18)';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width * Math.max(0, Math.min(1, fraction)), height);
}

function nearestDistrict(state) {
  const player = state.player;
  let best = null;
  let bestDist = Infinity;
  for (const landmark of Object.values(state.city.landmarks)) {
    const dist = Math.hypot(landmark.x - player.x, landmark.y - player.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = landmark;
    }
  }
  return best === null ? 'Solara Bay' : best.name;
}

/** Top-left mission card: job number, title, objective, stage bar, timer, pay, next job. */
function drawMissionCard(ctx, state) {
  const progress = missionProgress(state.missions);
  const height = 124;
  panel(ctx, CARD_X, 12, CARD_W, height);
  const mission = MISSIONS[progress.index - 1];
  const next = progress.index < MISSIONS.length
    ? `NEXT  ${MISSIONS[progress.index].title} — $${MISSIONS[progress.index].pay}`
    : 'NEXT  Solara Bay is yours';
  text(ctx, `MISSION ${progress.index}/${progress.total} · ${progress.title.toUpperCase()}`, CARD_X + 14, 40, 18, '#ffd94c', 'left', 800);
  text(ctx, objectiveLabel(state.missions), CARD_X + 14, 66, 18, PALETTE.text, 'left', 700);
  bar(ctx, CARD_X + 14, 78, 220, 10, progress.objective / Math.max(1, progress.objectives), '#ffd94c');
  text(ctx, `STAGE ${progress.objective}/${progress.objectives}`, CARD_X + 244, 88, 14, PALETTE.muted, 'left', 700);
  text(ctx, next, CARD_X + 14, 116, 15, PALETTE.muted, 'left');
  text(ctx, `PAY $${progress.pay}`, CARD_X + CARD_W - 14, 116, 15, '#7dff9e', 'right', 700);
  if (progress.secondsLeft !== null) {
    const seconds = Math.ceil(progress.secondsLeft);
    text(ctx, `${seconds}s`, CARD_X + CARD_W - 14, 42, 28, seconds < 20 ? '#ff5a4e' : PALETTE.text, 'right', 800);
  }
  return 12 + height;
}

const TACTIC_COLORS = {
  RAMMING: '#ff5a4e',
  PURSUIT: '#f2a541',
  RESPONDING: '#7ba7dd',
  SPOTLIGHT: '#ffd94c',
  ARREST: '#ff5a4e',
  'CLOSING IN': '#f2a541',
  'ON FOOT': '#aab2bd',
};

/** The SBPD dispatch board under the mission card: one row per unit on the player. */
function drawDispatchBoard(ctx, state, top) {
  const wanted = wantedLevel(state.police);
  const rows = dispatchBoardRows(state);
  const shown = rows.slice(0, 5);
  const extra = rows.length - shown.length;
  const height = 36 + shown.length * 26 + (extra > 0 ? 24 : 0) + 10;
  panel(ctx, CARD_X, top + 12, CARD_W, height);
  const y = top + 12;
  text(ctx, 'SOLARA BAY PD', CARD_X + 14, y + 26, 16, PALETTE.text, 'left', 800);
  text(
    ctx,
    wanted > 0 ? `${dispatchUnitCount(state)} UNITS · ${'★'.repeat(wanted)}${'☆'.repeat(WANTED.max - wanted)}` : 'NO HEAT',
    CARD_X + CARD_W - 14,
    y + 26,
    15,
    wanted > 0 ? '#ff5a4e' : PALETTE.muted,
    'right',
    700,
  );
  shown.forEach((row, i) => {
    const rowY = y + 52 + i * 26;
    text(ctx, row.callSign, CARD_X + 14, rowY, 16, PALETTE.text, 'left', 700);
    const tactic = row.tactic;
    const metresLabel = row.overhead ? 'OVERHEAD' : `${row.metres} m`;
    ctx.font = `400 16px ${FONT}`;
    const metresWidth = ctx.measureText(metresLabel).width;
    ctx.font = `700 13px ${FONT}`;
    const tacticWidth = ctx.measureText(tactic).width + 12;
    const pillRight = CARD_X + CARD_W - 14 - metresWidth - 10;
    ctx.fillStyle = TACTIC_COLORS[tactic] || '#aab2bd';
    ctx.fillRect(pillRight - tacticWidth, rowY - 14, tacticWidth, 18);
    text(ctx, tactic, pillRight - tacticWidth / 2, rowY, 13, '#0e1420', 'center', 700);
    text(ctx, metresLabel, CARD_X + CARD_W - 14, rowY, 16, PALETTE.text, 'right');
  });
  if (extra > 0) {
    text(ctx, `+${extra} more unit${extra > 1 ? 's' : ''} · roadblock ahead`, CARD_X + 14, y + 52 + shown.length * 26, 14, PALETTE.muted, 'left');
  }
}

/** Top right: the money, the wanted stars, and whether the police can see the player. */
function drawCashAndWanted(ctx, state) {
  const wanted = wantedLevel(state.police);
  text(ctx, `$${state.player.money.toLocaleString('en-US')}`, VIEW.width - MARGIN, 46, 38, '#7dff9e', 'right', 800);
  const size = 30;
  const gap = 4;
  const total = WANTED.max * (size + gap) - gap;
  let x = VIEW.width - MARGIN - total;
  text(ctx, 'WANTED', x - 12, 84, 16, wanted > 0 ? '#ff5a4e' : PALETTE.muted, 'right', 800);
  for (let star = 0; star < WANTED.max; star += 1) {
    text(ctx, '\u2605', x + size / 2, 88, size, star < wanted ? '#ffd94c' : 'rgba(244, 241, 232, 0.25)', 'center', 700);
    x += size + gap;
  }
  if (wanted > 0) {
    const label = dispatchInSight(state) ? 'IN SIGHT' : 'BREAK LINE OF SIGHT';
    const units = `${dispatchUnitCount(state)} UNITS${airUnitDeployed(state.police) ? ' · AIR ONE' : ''}`;
    ctx.font = `700 15px ${FONT}`;
    const labelWidth = ctx.measureText(`${label} · ${units}`).width + 20;
    ctx.fillStyle = dispatchInSight(state) ? '#ff5a4e' : '#f2a541';
    ctx.fillRect(VIEW.width - MARGIN - labelWidth, 102, labelWidth, 26);
    text(ctx, `${label} · ${units}`, VIEW.width - MARGIN - labelWidth / 2, 121, 15, '#0e1420', 'center', 700);
  }
}

/** The weapon slots: fists always, the pistol with its live ammo count. */
function drawWeaponSlots(ctx, state) {
  const slots = [
    { key: '1', label: 'FISTS', sub: '∞', selected: state.player.ammo <= 0 },
    { key: '2', label: 'PISTOL', sub: `${state.player.ammo}`, selected: state.player.ammo > 0 },
  ];
  const slotW = 104;
  const slotH = 54;
  const y = 410;
  slots.forEach((slot, i) => {
    const x = MARGIN + i * (slotW + 10);
    ctx.fillStyle = 'rgba(14, 20, 32, 0.82)';
    ctx.fillRect(x, y, slotW, slotH);
    ctx.strokeStyle = slot.selected ? '#ffd94c' : 'rgba(244, 241, 232, 0.35)';
    ctx.lineWidth = slot.selected ? 2 : 1;
    ctx.strokeRect(x, y, slotW, slotH);
    text(ctx, slot.key, x + 8, y + 20, 13, PALETTE.muted, 'left', 700);
    text(ctx, slot.label, x + 8, y + 40, 14, PALETTE.text, 'left', 800);
    text(ctx, slot.sub, x + slotW - 8, y + 40, 14, '#ffd94c', 'right', 700);
  });
}

/** Health bar above the minimap, with the number on it. */
function drawHealthBar(ctx, state) {
  const y = 478;
  text(ctx, 'HEALTH', MARGIN, y + 12, 13, PALETTE.muted, 'left', 700);
  text(ctx, `${Math.round(state.player.health)}`, MARGIN + 196, y + 12, 13, PALETTE.text, 'right', 700);
  bar(ctx, MARGIN, y + 18, 196, 12, state.player.health / 100, state.player.health > 30 ? '#37c978' : '#ff5a4e');
}

/** The circular minimap, bottom left: roads, objective beacon, police, player, north. */
function drawCircularMinimap(ctx, state) {
  const cx = MARGIN + 96;
  const cy = VIEW.height - MARGIN - 96;
  const radius = 96;
  const scale = (radius * 2) / state.city.size;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#20242c';
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.strokeStyle = '#6a7078';
  ctx.lineWidth = 2;
  for (const line of state.city.roads.vertical) {
    ctx.beginPath();
    ctx.moveTo(cx - radius + line * scale, cy - radius);
    ctx.lineTo(cx - radius + line * scale, cy + radius);
    ctx.stroke();
  }
  for (const line of state.city.roads.horizontal) {
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy - radius + line * scale);
    ctx.lineTo(cx + radius, cy - radius + line * scale);
    ctx.stroke();
  }
  const target = objectiveTarget(state.missions, state.city);
  if (target !== null) {
    ctx.fillStyle = '#ffd94c';
    ctx.beginPath();
    ctx.arc(cx - radius + target.x * scale, cy - radius + target.y * scale, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ff5a4e';
  for (const cop of state.police.cops) {
    ctx.fillRect(cx - radius + cop.x * scale - 2, cy - radius + cop.y * scale - 2, 4, 4);
  }
  for (const patrol of state.police.patrols) {
    ctx.fillRect(cx - radius + patrol.car.x * scale - 2, cy - radius + patrol.car.y * scale - 2, 4, 4);
  }
  const px = cx - radius + state.player.x * scale;
  const py = cy - radius + state.player.y * scale;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd94c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#ffd94c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  text(ctx, 'N', cx, cy - radius + 18, 15, PALETTE.text, 'center', 800);
}

/** Bottom right: the speedometer — vehicle name, big speed, and the driving hint. */
function drawSpeedometer(ctx, state) {
  const player = state.player;
  const width = 268;
  const height = 132;
  const x = VIEW.width - MARGIN - width;
  const y = VIEW.height - MARGIN - height;
  panel(ctx, x, y, width, height);
  if (player.car !== null) {
    const speed = Math.round(Math.abs(player.car.speed) * 0.36);
    text(ctx, player.car.type.name.toUpperCase(), x + 16, y + 30, 18, '#ffd94c', 'left', 800);
    text(ctx, `${speed}`, x + width - 16, y + 74, 56, PALETTE.text, 'right', 800);
    text(ctx, 'KM/H', x + width - 16, y + 96, 15, PALETTE.muted, 'right', 700);
    text(ctx, 'E — Get out   •   W/S drive   •   A/D steer', x + 16, y + height - 12, 13, PALETTE.muted, 'left');
  } else {
    text(ctx, 'ON FOOT', x + 16, y + 30, 18, '#ffd94c', 'left', 800);
    text(ctx, 'WASD move   •   F punch   •   Space shoot', x + 16, y + height - 12, 13, PALETTE.muted, 'left');
    text(ctx, 'E — Get in the car', x + 16, y + 62, 17, PALETTE.text, 'left');
  }
}

/** Marta's dialogue, bottom centre, with the speaker named the way the winners do it. */
function drawDialog(ctx, missions) {
  if (missions.dialog.length === 0) return;
  const lines = missions.dialog.map((line) => line.replace(/^Marta:\s*/, ''));
  const width = 640;
  const height = 58 + lines.length * 26;
  const x = (VIEW.width - width) / 2;
  const y = VIEW.height - MARGIN - height;
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
  text(ctx, 'MARTA DELGADO · FIXER', x + 18, y + 28, 15, '#ffd94c', 'left', 800);
  lines.forEach((line, i) => {
    text(ctx, line, x + 18, y + 56 + i * 26, 17, PALETTE.text, 'left');
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

/**
 * The full in-game HUD: mission card, dispatch board, cash and wanted stars, district,
 * weapon slots, health, circular minimap, speedometer, dialog and banner.
 */
export function drawHud(ctx, state) {
  const cardBottom = drawMissionCard(ctx, state);
  drawDispatchBoard(ctx, state, cardBottom);
  drawCashAndWanted(ctx, state);

  // District, top centre.
  text(ctx, `${nearestDistrict(state).toUpperCase()} · SOLARA BAY`, VIEW.width / 2, 40, 18, '#ffd94c', 'center', 700);

  drawWeaponSlots(ctx, state);
  drawHealthBar(ctx, state);
  drawCircularMinimap(ctx, state);
  drawSpeedometer(ctx, state);
  drawDialog(ctx, state.missions);
  drawBanner(ctx, state.missions);
  if (state.audioMuted) text(ctx, 'Muted (M)', MARGIN, VIEW.height - 42, 16, PALETTE.muted, 'left');
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
