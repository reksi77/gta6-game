// Solara Bay itself: a 3200x3200 grid city. Eight roads each way, 400 apart, leave 300x300
// blocks; each block holds buildings with wide alleys between them (never narrower than the
// player), or a park, a parking lot or the plaza. Landmarks are the mission addresses.

import { WORLD } from './config.js';
import { clamp, circleHitsRect, pushCircleOutOfRect } from './util.js';
import { randomInt } from './random.js';

export const ROAD_WIDTH = 100;
export const ROAD_STEP = 400;
export const ROAD_FIRST = 200;

function roadLines() {
  const lines = [];
  for (let i = 0; i < 8; i += 1) lines.push(ROAD_FIRST + i * ROAD_STEP);
  return lines;
}

/** Block (col, row) spans this rectangle, inside the roads around it. */
function blockRect(col, row) {
  const x0 = ROAD_FIRST + col * ROAD_STEP + ROAD_WIDTH / 2;
  const y0 = ROAD_FIRST + row * ROAD_STEP + ROAD_WIDTH / 2;
  return { x: x0, y: y0, w: ROAD_STEP - ROAD_WIDTH, h: ROAD_STEP - ROAD_WIDTH };
}

export function createCity(random) {
  const size = WORLD.size;
  const roads = { vertical: roadLines(), horizontal: roadLines(), width: ROAD_WIDTH };
  const buildings = [];
  const trees = [];
  const lots = [];
  const parks = [];
  const plaza = blockRect(3, 3);
  const parkBlocks = [[1, 1], [5, 5]];
  const lotBlocks = [[5, 1], [1, 5], [6, 3]];

  function isSpecial(col, row) {
    if (col === 3 && row === 3) return true;
    for (const [pc, pr] of parkBlocks) if (pc === col && pr === row) return true;
    for (const [lc, lr] of lotBlocks) if (lc === col && lr === row) return true;
    return false;
  }

  // Buildings: 1 to 3 per block, each at least 70 px a side, with at least 40 px of alley
  // between any two and at least 30 px to the block's edge, so the player (26 px across)
  // is never wedged between them.
  for (let col = 0; col < 7; col += 1) {
    for (let row = 0; row < 7; row += 1) {
      const block = blockRect(col, row);
      if (col === 3 && row === 3) continue;
      if (parkBlocks.some(([pc, pr]) => pc === col && pr === row)) {
        parks.push(block);
        for (let t = 0; t < 9; t += 1) {
          trees.push({ x: block.x + 30 + random() * (block.w - 60), y: block.y + 30 + random() * (block.h - 60), r: 12 + random() * 8 });
        }
        continue;
      }
      if (lotBlocks.some(([lc, lr]) => lc === col && lr === row)) {
        lots.push(block);
        continue;
      }
      const count = 1 + Math.floor(random() * 3);
      const placed = [];
      for (let n = 0; n < count; n += 1) {
        let rect = null;
        for (let attempt = 0; attempt < 12 && rect === null; attempt += 1) {
          const w = 70 + random() * 130;
          const h = 70 + random() * 130;
          const x = block.x + 30 + random() * Math.max(1, block.w - 60 - w);
          const y = block.y + 30 + random() * Math.max(1, block.h - 60 - h);
          const candidate = { x, y, w, h };
          let clear = true;
          for (const other of placed) {
            if (candidate.x < other.x + other.w + 40 && candidate.x + candidate.w + 40 > other.x &&
                candidate.y < other.y + other.h + 40 && candidate.y + candidate.h + 40 > other.y) {
              clear = false;
              break;
            }
          }
          if (clear) rect = candidate;
        }
        if (rect !== null) {
          rect.shade = randomInt(random, 0, 4);
          placed.push(rect);
          buildings.push(rect);
        }
      }
    }
  }

  const landmarks = {
    pier: { name: 'Old Pier', x: 1600, y: 3100 },
    cafe: { name: 'Delgado\u2019s Caf\u00e9', x: 1480, y: 1480 },
    garage: { name: 'Garage', x: 2650, y: 1450 },
    warehouse: { name: 'Warehouse District', x: 1050, y: 650 },
    docks: { name: 'Docks', x: 2850, y: 2850 },
    eastlot: { name: 'East Lot', x: 2400, y: 800 },
    plaza: { name: 'Sunset Plaza', x: 1600, y: 1600 },
  };

  const city = {
    size, roads, buildings, trees, lots, parks, plaza, landmarks,
    spawn: { x: 1600, y: 1600 },
  };

  return {
    ...city,
    isOnRoad,
    nearestRoadPoint,
    randomRoadPoint,
    randomSidewalkPoint,
    collideCircle,
    pointInsideBuilding,
  };

  function isOnRoad(x, y) {
    const half = ROAD_WIDTH / 2;
    for (const line of roads.vertical) if (Math.abs(x - line) <= half) return true;
    for (const line of roads.horizontal) if (Math.abs(y - line) <= half) return true;
    return false;
  }

  function nearestRoadPoint(x, y) {
    let best = null;
    let bestDist = Infinity;
    for (const line of roads.vertical) {
      const d = Math.abs(x - line);
      if (d < bestDist) { bestDist = d; best = { x: line, y: clamp(y, 0, size) }; }
    }
    for (const line of roads.horizontal) {
      const d = Math.abs(y - line);
      if (d < bestDist) { bestDist = d; best = { x: clamp(x, 0, size), y: line }; }
    }
    return best;
  }

  function randomRoadPoint() {
    if (random() < 0.5) {
      const line = roads.vertical[Math.floor(random() * roads.vertical.length)];
      return { x: line, y: random() * size };
    }
    const line = roads.horizontal[Math.floor(random() * roads.horizontal.length)];
    return { x: random() * size, y: line };
  }

  function randomSidewalkPoint() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const vertical = random() < 0.5;
      const line = vertical
        ? roads.vertical[Math.floor(random() * roads.vertical.length)]
        : roads.horizontal[Math.floor(random() * roads.horizontal.length)];
      const along = 60 + random() * (size - 120);
      const side = random() < 0.5 ? -1 : 1;
      const offset = ROAD_WIDTH / 2 + 16;
      const point = vertical
        ? { x: line + side * offset, y: along }
        : { x: along, y: line + side * offset };
      if (!pointInsideBuilding(point.x, point.y, 20)) return point;
    }
    return randomRoadPoint();
  }

  function pointInsideBuilding(x, y, radius) {
    for (const building of buildings) {
      if (circleHitsRect(x, y, radius, building)) return true;
    }
    return false;
  }

  /** Push a circle out of every building it overlaps, then clamp it inside the city. */
  function collideCircle(x, y, radius) {
    let px = clamp(x, radius, size - radius);
    let py = clamp(y, radius, size - radius);
    for (const building of buildings) {
      if (circleHitsRect(px, py, radius, building)) {
        const fixed = pushCircleOutOfRect(px, py, radius, building);
        px = fixed.x;
        py = fixed.y;
      }
    }
    return { x: px, y: py };
  }
}
