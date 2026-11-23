// The Solara Bay Police Department dispatch board: the live picture of the pursuit the
// HUD paints. Every unit the wanted level has put on the street gets a call sign, a
// distance from the player in metres, and the tactic it is running right now, so the
// player can read the chase at a glance instead of guessing where the heat is coming
// from. From four stars up the department also puts Air One overhead, and the board says
// so. Pure derivation: it reads the police state and returns rows; it never moves a car.

import { wantedLevel } from './police.js';

const PATROL_CALL_SIGNS = ['SBPD-11', 'SBPD-27', 'SBPD-03', 'SBPD-42', 'SBPD-19', 'SBPD-58'];
const FOOT_CALL_SIGNS = ['K-9 UNIT', 'FOOT-04', 'FOOT-12', 'FOOT-21'];

/** The helicopter is on station once the heat reaches four stars. */
export function airUnitDeployed(police) {
  return wantedLevel(police) >= 4;
}

/** How many units the board is tracking: patrol cars, foot cops, and Air One. */
export function dispatchUnitCount(state) {
  const police = state.police;
  let count = police.patrols.length + police.cops.length;
  if (airUnitDeployed(police)) count += 1;
  return count;
}

function metres(worldDistance) {
  // The city is drawn at roughly ten world units to the metre.
  return Math.max(1, Math.round(worldDistance / 10));
}

function patrolTactic(distance) {
  if (distance < 150) return 'RAMMING';
  if (distance < 320) return 'PURSUIT';
  return 'RESPONDING';
}

function footTactic(distance) {
  if (distance < 60) return 'ARREST';
  if (distance < 260) return 'CLOSING IN';
  return 'ON FOOT';
}

/**
 * One row per unit on the board, closest first: { callSign, tactic, metres, kind }.
 * Air One always leads the list while it is deployed; patrol cars follow, then foot
 * cops. The caller caps how many rows it paints and notes the rest as "+N more".
 */
export function dispatchBoardRows(state) {
  const player = state.player;
  const police = state.police;
  const rows = [];

  if (airUnitDeployed(police)) {
    rows.push({ callSign: 'AIR ONE', tactic: 'SPOTLIGHT', metres: 0, kind: 'air', overhead: true });
  }
  police.patrols.forEach((patrol, i) => {
    const dist = Math.hypot(patrol.car.x - player.x, patrol.car.y - player.y);
    rows.push({
      callSign: PATROL_CALL_SIGNS[i % PATROL_CALL_SIGNS.length],
      tactic: patrolTactic(dist),
      metres: metres(dist),
      kind: 'patrol',
      overhead: false,
    });
  });
  police.cops.forEach((cop, i) => {
    const dist = Math.hypot(cop.x - player.x, cop.y - player.y);
    rows.push({
      callSign: FOOT_CALL_SIGNS[i % FOOT_CALL_SIGNS.length],
      tactic: footTactic(dist),
      metres: metres(dist),
      kind: 'foot',
      overhead: false,
    });
  });

  // Closest units first, but Air One always stays on top of the board.
  const air = rows.filter((row) => row.kind === 'air');
  const ground = rows
    .filter((row) => row.kind !== 'air')
    .sort((a, b) => a.metres - b.metres);
  return [...air, ...ground];
}

/** True when at least one unit is close enough that the player is being seen. */
export function dispatchInSight(state) {
  return dispatchBoardRows(state).some(
    (row) => row.kind === 'air' || (row.kind === 'patrol' && row.metres < 320),
  );
}
