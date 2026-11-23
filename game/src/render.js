// Drawing only: the world's state and the current screen in, pixels out. A camera follows
// the player across the 3200x3200 city; only what the camera sees is drawn. Flat shapes and
// canvas text — the whole look is rectangles, circles and a sunset palette, no images.

import { VIEW, PALETTE, FONT } from './config.js';
import { drawHud, drawPanel } from './hud.js';
import { airUnitDeployed } from './dispatch.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const BUILDING_SHADES = ['#b08a5e', '#a87f52', '#bd9570', '#96714a'];
const ROOF_SHADES = ['#8a6a45', '#7d5f3d', '#96794f', '#6f5636'];

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, width: VIEW.width, height: VIEW.height };
  const camera = { x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, weight) {
    context.font = `${weight || 400} ${size}px ${FONT}`;
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function updateCamera(state) {
    camera.x = Math.max(0, Math.min(state.city.size - VIEW.width, state.player.x - VIEW.width / 2));
    camera.y = Math.max(0, Math.min(state.city.size - VIEW.height, state.player.y - VIEW.height / 2));
  }

  function visible(x, y, margin) {
    return x > camera.x - margin && x < camera.x + VIEW.width + margin &&
      y > camera.y - margin && y < camera.y + VIEW.height + margin;
  }

  function drawCity(state) {
    const city = state.city;
    const size = city.size;
    // Grass everywhere, then the beach and the bay along the south edge.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, size, size);
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, 3040, size, 160);
    context.fillStyle = PALETTE.water;
    context.fillRect(0, 3140, size, 60);
    // The pier deck reaching into the bay.
    context.fillStyle = '#8a6a45';
    context.fillRect(1560, 3040, 80, 140);
    context.strokeStyle = '#6f5636';
    context.lineWidth = 3;
    for (let y = 3060; y < 3180; y += 24) {
      context.beginPath();
      context.moveTo(1560, y);
      context.lineTo(1640, y);
      context.stroke();
    }
    // Parks.
    for (const park of city.parks) {
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x, park.y, park.w, park.h);
    }
    // Parking lots.
    for (const lot of city.lots) {
      context.fillStyle = PALETTE.lot;
      context.fillRect(lot.x, lot.y, lot.w, lot.h);
      context.strokeStyle = '#c8b45a';
      context.lineWidth = 2;
      for (let x = lot.x + 30; x < lot.x + lot.w - 20; x += 62) {
        context.strokeRect(x, lot.y + 18, 44, 66);
        context.strokeRect(x, lot.y + lot.h - 84, 44, 66);
      }
    }
    // The plaza.
    context.fillStyle = PALETTE.plaza;
    context.fillRect(city.plaza.x, city.plaza.y, city.plaza.w, city.plaza.h);
    context.fillStyle = '#8fb8d8';
    context.beginPath();
    context.arc(city.plaza.x + city.plaza.w / 2, city.plaza.y + city.plaza.h / 2, 34, 0, Math.PI * 2);
    context.fill();
    // Sidewalks: a pale ring around every ordinary block, grass inside it. Park, lot and
    // plaza blocks keep their own ground, painted just above, so they are skipped here.
    const special = new Set();
    for (const park of city.parks) special.add(`${park.x},${park.y}`);
    for (const lot of city.lots) special.add(`${lot.x},${lot.y}`);
    special.add(`${city.plaza.x},${city.plaza.y}`);
    for (let col = 0; col < 7; col += 1) {
      for (let row = 0; row < 7; row += 1) {
        const x = 200 + col * 400 + 50;
        const y = 200 + row * 400 + 50;
        if (special.has(`${x},${y}`)) continue;
        context.fillStyle = PALETTE.sidewalk;
        context.fillRect(x, y, 300, 300);
        context.fillStyle = PALETTE.grass;
        context.fillRect(x + 22, y + 22, 256, 256);
      }
    }
    // Roads, with centre dashes.
    context.fillStyle = PALETTE.road;
    for (const line of city.roads.vertical) context.fillRect(line - 50, 0, 100, size);
    for (const line of city.roads.horizontal) context.fillRect(0, line - 50, size, 100);
    context.strokeStyle = PALETTE.lane;
    context.lineWidth = 3;
    context.setLineDash([26, 30]);
    for (const line of city.roads.vertical) {
      context.beginPath();
      context.moveTo(line, 0);
      context.lineTo(line, size);
      context.stroke();
    }
    for (const line of city.roads.horizontal) {
      context.beginPath();
      context.moveTo(0, line);
      context.lineTo(size, line);
      context.stroke();
    }
    context.setLineDash([]);
    // Trees.
    for (const tree of city.trees) {
      if (!visible(tree.x, tree.y, 40)) continue;
      context.fillStyle = '#3f7a34';
      context.beginPath();
      context.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#2c5a24';
      context.beginPath();
      context.arc(tree.x - 4, tree.y - 4, tree.r * 0.55, 0, Math.PI * 2);
      context.fill();
    }
    // Buildings, with a darker roof inset and a door facing the street.
    for (const building of city.buildings) {
      if (!visible(building.x + building.w / 2, building.y + building.h / 2, 120)) continue;
      context.fillStyle = 'rgba(0, 0, 0, 0.25)';
      context.fillRect(building.x + 6, building.y + 8, building.w, building.h);
      context.fillStyle = BUILDING_SHADES[building.shade % BUILDING_SHADES.length];
      context.fillRect(building.x, building.y, building.w, building.h);
      context.fillStyle = ROOF_SHADES[building.shade % ROOF_SHADES.length];
      context.fillRect(building.x + 8, building.y + 8, building.w - 16, building.h - 16);
      context.fillStyle = '#5a4632';
      context.fillRect(building.x + building.w / 2 - 9, building.y + building.h - 10, 18, 10);
    }
  }

  function drawCarShape(car) {
    const type = car.type;
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(0, 0, 0, 0.3)';
    context.fillRect(-type.length / 2 + 4, -type.width / 2 + 4, type.length, type.width);
    context.fillStyle = type.color;
    context.beginPath();
    context.roundRect(-type.length / 2, -type.width / 2, type.length, type.width, 9);
    context.fill();
    context.fillStyle = type.roof;
    context.beginPath();
    context.roundRect(-type.length / 2 + 14, -type.width / 2 + 5, type.length - 34, type.width - 10, 6);
    context.fill();
    context.fillStyle = '#20242c';
    context.fillRect(type.length / 2 - 16, -type.width / 2 + 5, 10, 7);
    context.fillRect(type.length / 2 - 16, type.width / 2 - 12, 10, 7);
    context.fillStyle = '#ffe9a8';
    context.fillRect(type.length / 2 - 2, -type.width / 2 + 3, 3, 6);
    context.fillRect(type.length / 2 - 2, type.width / 2 - 9, 3, 6);
    if (type.taxi) {
      context.fillStyle = '#20242c';
      context.fillRect(-8, -type.width / 2 + 2, 16, 6);
      context.fillStyle = '#f4f1e8';
      context.font = `700 8px ${FONT}`;
      context.textAlign = 'center';
      context.fillText('TAXI', 0, -type.width / 2 + 9);
    }
    if (car.marked) {
      context.strokeStyle = '#ffd94c';
      context.lineWidth = 3;
      context.beginPath();
      context.roundRect(-type.length / 2 - 5, -type.width / 2 - 5, type.length + 10, type.width + 10, 12);
      context.stroke();
    }
    context.restore();
  }

  function drawPersonShape(x, y, angle, shirt, radius, down) {
    if (down) {
      context.fillStyle = shirt;
      context.beginPath();
      context.ellipse(x, y, radius + 4, radius - 3, angle, 0, Math.PI * 2);
      context.fill();
      return;
    }
    context.fillStyle = 'rgba(0, 0, 0, 0.25)';
    context.beginPath();
    context.arc(x + 2, y + 3, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = shirt;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8b98a';
    context.beginPath();
    context.arc(x + Math.cos(angle) * 4, y + Math.sin(angle) * 4, radius * 0.55, 0, Math.PI * 2);
    context.fill();
  }

  function drawWorld(state) {
    drawCity(state);
    // Skid marks.
    context.strokeStyle = 'rgba(20, 20, 24, 0.5)';
    context.lineWidth = 5;
    for (const skid of state.skids) {
      if (!visible(skid.x, skid.y, 60)) continue;
      context.beginPath();
      context.moveTo(skid.x, skid.y);
      context.lineTo(skid.x2, skid.y2);
      context.stroke();
    }
    // Pickups, bobbing gently.
    for (const pickup of state.pickups) {
      if (!visible(pickup.x, pickup.y, 40)) continue;
      const bob = Math.sin(state.time * 2 + pickup.bob) * 3;
      const color = pickup.kind === 'cash' ? PALETTE.cash : pickup.kind === 'ammo' ? PALETTE.ammo : PALETTE.health;
      context.fillStyle = color;
      context.beginPath();
      context.arc(pickup.x, pickup.y + bob, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#0e1420';
      context.font = `800 13px ${FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(pickup.kind === 'cash' ? '$' : pickup.kind === 'ammo' ? 'A' : '+', pickup.x, pickup.y + bob);
      context.textBaseline = 'alphabetic';
    }
    // Objective beacon: a pulsing ring where the mission points.
    const target = state.objectiveTarget;
    if (target !== null) {
      const pulse = 1 + Math.sin(state.time * 4) * 0.12;
      context.strokeStyle = PALETTE.marker;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(target.x, target.y, 6, 0, Math.PI * 2);
      context.fill();
      // A gold arrow at the screen edge points at far-away objectives.
      const sx = target.x - camera.x;
      const sy = target.y - camera.y;
      if (sx < 60 || sx > VIEW.width - 60 || sy < 60 || sy > VIEW.height - 60) {
        const cx = Math.max(60, Math.min(VIEW.width - 60, sx));
        const cy = Math.max(60, Math.min(VIEW.height - 60, sy));
        const angle = Math.atan2(sy - cy, sx - cx);
        context.save();
        context.translate(cx, cy);
        context.rotate(angle);
        context.fillStyle = PALETTE.marker;
        context.beginPath();
        context.moveTo(14, 0);
        context.lineTo(-8, -10);
        context.lineTo(-8, 10);
        context.closePath();
        context.fill();
        context.restore();
      }
    }
    // Pedestrians and rivals.
    for (const ped of state.peds) {
      if (!visible(ped.x, ped.y, 40)) continue;
      drawPersonShape(ped.x, ped.y, ped.angle, ped.shirt, 11, ped.state === 'down');
    }
    for (const rival of state.rivals) {
      if (!visible(rival.x, rival.y, 40)) continue;
      drawPersonShape(rival.x, rival.y, rival.angle, rival.shirt, 12, rival.health <= 0);
      if (rival.health > 0) {
        context.fillStyle = '#ff5a4e';
        context.font = `800 16px ${FONT}`;
        context.textAlign = 'center';
        context.fillText('!', rival.x, rival.y - 18);
      }
    }
    // Cars: traffic, parked, patrols, then the player's car on top.
    for (const car of state.cars) {
      if (car === state.player.car) continue;
      if (!visible(car.x, car.y, 100)) continue;
      drawCarShape(car);
    }
    for (const patrol of state.police.patrols) {
      if (!visible(patrol.car.x, patrol.car.y, 100)) continue;
      drawCarShape(patrol.car);
      context.fillStyle = '#ffffff';
      context.font = `800 11px ${FONT}`;
      context.textAlign = 'center';
      context.save();
      context.translate(patrol.car.x, patrol.car.y);
      context.rotate(patrol.car.angle);
      context.fillText('POLICE', 0, -patrol.car.type.width / 2 - 6);
      context.restore();
    }
    // Foot cops.
    for (const cop of state.police.cops) {
      if (!visible(cop.x, cop.y, 40)) continue;
      drawPersonShape(cop.x, cop.y, cop.angle, PALETTE.cop, 12, false);
      context.fillStyle = '#ffd94c';
      context.beginPath();
      context.arc(cop.x, cop.y - 4, 4, 0, Math.PI * 2);
      context.fill();
    }
    // The player: on foot, or their car with them inside it.
    const player = state.player;
    if (player.car !== null) {
      if (visible(player.car.x, player.car.y, 100)) drawCarShape(player.car);
    } else if (player.invulnerable === 0 || Math.floor(player.invulnerable * 10) % 2 === 1) {
      drawPersonShape(player.x, player.y, player.angle, PALETTE.playerShirt, 13, false);
    }
    // Air One: from four stars the police helicopter works the sky above the player,
    // its searchlight cone sweeping the street the chase is on.
    if (airUnitDeployed(state.police)) {
      const heliX = state.player.x + 260;
      const heliY = state.player.y - 240;
      const player = state.player;
      if (visible(heliX, heliY, 160)) {
        const coneAngle = Math.atan2(player.y - heliY, player.x - heliX);
        context.save();
        context.translate(heliX, heliY);
        context.rotate(coneAngle);
        const gradient = context.createLinearGradient(0, 0, 320, 0);
        gradient.addColorStop(0, 'rgba(255, 233, 168, 0.34)');
        gradient.addColorStop(1, 'rgba(255, 233, 168, 0.05)');
        context.fillStyle = gradient;
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(320, -52);
        context.lineTo(320, 52);
        context.closePath();
        context.fill();
        context.restore();
        context.fillStyle = 'rgba(0, 0, 0, 0.22)';
        context.beginPath();
        context.ellipse(heliX + 10, heliY + 12, 34, 16, 0.3, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#1c2733';
        context.beginPath();
        context.ellipse(heliX, heliY, 26, 15, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#2c4f9e';
        context.beginPath();
        context.ellipse(heliX, heliY, 18, 10, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#7ba7dd';
        context.fillRect(heliX - 52, heliY - 4, 30, 8);
        context.fillStyle = '#ffe9a8';
        context.beginPath();
        context.arc(heliX + 14, heliY, 5, 0, Math.PI * 2);
        context.fill();
        const rotor = state.time * 9;
        context.strokeStyle = 'rgba(20, 24, 32, 0.85)';
        context.lineWidth = 4;
        context.beginPath();
        context.moveTo(heliX + Math.cos(rotor) * 52, heliY + Math.sin(rotor) * 52);
        context.lineTo(heliX - Math.cos(rotor) * 52, heliY - Math.sin(rotor) * 52);
        context.moveTo(heliX + Math.cos(rotor + Math.PI / 2) * 52, heliY + Math.sin(rotor + Math.PI / 2) * 52);
        context.lineTo(heliX - Math.cos(rotor + Math.PI / 2) * 52, heliY - Math.sin(rotor + Math.PI / 2) * 52);
        context.stroke();
      }
    }
    // Bullets and particles.
    for (const bullet of state.bullets) {
      if (!bullet.active || !visible(bullet.x, bullet.y, 20)) continue;
      context.fillStyle = PALETTE.bullet;
      context.beginPath();
      context.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
      context.fill();
    }
    for (const particle of state.particles) {
      if (!particle.active || !visible(particle.x, particle.y, 20)) continue;
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  const TITLE_LINES = [
    'A sun-soaked open-world crime game, built from scratch.',
    'Steal cars. Outrun the law. Run jobs for Marta Delgado.',
    'WASD move & drive   •   E enter a car   •   F punch',
    'Space / click shoot   •   P pause   •   M mute',
  ];
  const PAUSED_LINES = ['The city waits for you.'];
  const BUSTED_LINES = ['The Solara Bay police took you in.', ''];
  const WASTED_LINES = ['Solara Bay chewed you up.', ''];

  /** Paint one frame: the world through the camera, then the HUD or a panel. */
  function draw(state, screen, save) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    updateCamera(state);
    context.setTransform(view.scale, 0, 0, view.scale, view.x - camera.x * view.scale, view.y - camera.y * view.scale);
    drawWorld(state);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      // A dusk skyline behind the title: the city at golden hour.
      context.fillStyle = 'rgba(14, 20, 32, 0.45)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      const lines = [...TITLE_LINES];
      if (save !== null) lines.push(`Continue: $${save.money}  •  Mission ${Math.min(save.missionIndex + 1, 4)} of 4  •  N for a new game`);
      else lines.push('No save yet — a fresh start in Solara Bay.');
      drawPanel(context, 'SOLARA BAY', lines, 'Press Enter to play');
      return;
    }
    drawHud(context, state);
    if (screen === SCREEN_PAUSED) {
      drawPanel(context, 'Paused', PAUSED_LINES, 'Press P to resume');
    } else if (screen === SCREEN_BUSTED) {
      const lines = [...BUSTED_LINES];
      lines[1] = `You lost $200 in fines. Money: $${state.player.money}.`;
      drawPanel(context, 'BUSTED', lines, 'Press Enter to walk free', '#7ba7dd');
    } else if (screen === SCREEN_WASTED) {
      const lines = [...WASTED_LINES];
      lines[1] = `Hospital bill: $100. Money: $${state.player.money}.`;
      drawPanel(context, 'WASTED', lines, 'Press Enter to get back up', '#ff5a4e');
    }
  }

  resize();
  window.addEventListener('resize', resize);

  return {
    draw,
    /** Convert canvas CSS pixels to world coordinates, for aiming with the mouse. */
    screenToWorld(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const logicalX = (clientX - rect.left) / (rect.width / VIEW.width);
      const logicalY = (clientY - rect.top) / (rect.height / VIEW.height);
      return { x: logicalX + camera.x, y: logicalY + camera.y };
    },
    /** The camera's top-left corner in world coordinates. */
    camera() {
      return { x: camera.x, y: camera.y };
    },
  };
}
