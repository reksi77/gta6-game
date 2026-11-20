// The story: four jobs from Marta Delgado, each a chain of objectives across Solara Bay,
// plus the free-roam cash packages hidden on the sidewalks. A mission's objectives are
// checked in order; the marker and the HUD always point at the current one.

import { MISSIONS, CASH_PACKAGES, CASH_VALUE, AMMO_PICKUPS, AMMO_VALUE, HEALTH_PICKUPS, HEALTH_VALUE } from './config.js';

export function createMissions() {
  return {
    index: 0,
    objective: 0,
    active: false,
    dialog: [],
    dialogTimer: 0,
    banner: '',
    bannerTimer: 0,
    timer: 0,
    defeated: 0,
    hasPackage: false,
    done: false,
  };
}

export function currentMission(missions) {
  if (missions.index >= MISSIONS.length) return null;
  return MISSIONS[missions.index];
}

export function currentObjective(missions) {
  const mission = currentMission(missions);
  if (mission === null) return null;
  return mission.objectives[missions.objective] || null;
}

function say(missions, lines) {
  missions.dialog = [...lines];
  missions.dialogTimer = 4;
}

function showBanner(missions, text) {
  missions.banner = text;
  missions.bannerTimer = 2.6;
}

/** Start the next mission: its intro lines and its first objective. */
export function startMission(missions, index) {
  const mission = MISSIONS[index];
  if (mission === undefined) return;
  missions.index = index;
  missions.objective = 0;
  missions.active = true;
  missions.defeated = 0;
  missions.hasPackage = false;
  missions.timer = 0;
  say(missions, mission.intro);
  showBanner(missions, mission.title);
}

/** Where the current objective points: a landmark, or null when no mission runs. */
export function objectiveTarget(missions, city) {
  const objective = currentObjective(missions);
  if (objective === null || objective.place === undefined) return null;
  return city.landmarks[objective.place] || null;
}

export function objectiveLabel(missions) {
  const mission = currentMission(missions);
  const objective = currentObjective(missions);
  if (mission === null || objective === null) return 'Free roam — find the hidden cash';
  if (objective.kind === 'defeat') {
    return objective.label.replace('(0/4)', `(${missions.defeated}/${objective.count})`);
  }
  return objective.label;
}

/** Spawn the rivals for the Payback mission around the warehouse. */
export function spawnRivals(state, count) {
  const rivals = [];
  const base = state.city.landmarks.warehouse;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    rivals.push({
      x: base.x + Math.cos(angle) * 120,
      y: base.y + Math.sin(angle) * 120,
      angle: 0,
      health: 100,
      state: 'walk',
      kind: 'rival',
      punchTimer: 0,
      shirt: '#5a3a8a',
    });
  }
  state.rivals = rivals;
  return rivals;
}

function spawnPickups(state) {
  const pickups = [];
  for (let i = 0; i < CASH_PACKAGES; i += 1) {
    const point = state.city.randomSidewalkPoint();
    pickups.push({ x: point.x, y: point.y, kind: 'cash', value: CASH_VALUE, bob: state.random() * 6 });
  }
  for (let i = 0; i < AMMO_PICKUPS; i += 1) {
    const point = state.city.randomSidewalkPoint();
    pickups.push({ x: point.x, y: point.y, kind: 'ammo', value: AMMO_VALUE, bob: state.random() * 6 });
  }
  for (let i = 0; i < HEALTH_PICKUPS; i += 1) {
    const point = state.city.randomSidewalkPoint();
    pickups.push({ x: point.x, y: point.y, kind: 'health', value: HEALTH_VALUE, bob: state.random() * 6 });
  }
  return pickups;
}

export function createPickups(state) {
  return spawnPickups(state);
}

/**
 * One step of the mission state machine. `events` collects what happened this step:
 * 'objective' (an objective finished), 'mission' (a mission paid out), 'alldone' (the
 * story is over). The world owns movement and combat; this only watches the objectives.
 */
export function stepMissions(state, dt) {
  const missions = state.missions;
  const events = [];
  if (missions.dialogTimer > 0) {
    missions.dialogTimer -= dt;
    if (missions.dialogTimer <= 0) missions.dialog = [];
  }
  if (missions.bannerTimer > 0) missions.bannerTimer -= dt;

  const mission = currentMission(missions);
  if (mission === null) {
    if (!missions.done) {
      missions.done = true;
      showBanner(missions, 'Solara Bay is yours');
      events.push('alldone');
    }
    return events;
  }
  if (!missions.active) return events;

  const objective = currentObjective(missions);
  if (objective === null) {
    // Mission complete: pay out, say the outro, start the next job — or, after the last
    // one, close the story instead of starting a mission that does not exist.
    state.player.money += mission.pay;
    say(missions, mission.outro);
    showBanner(missions, `Mission passed  +$${mission.pay}`);
    events.push('mission');
    if (missions.index + 1 < MISSIONS.length) startMission(missions, missions.index + 1);
    else {
      missions.index = MISSIONS.length;
      missions.active = false;
    }
    return events;
  }

  const player = state.player;
  if (objective.kind === 'timed') {
    missions.timer += dt;
    if (missions.timer >= objective.seconds) {
      say(missions, ['Marta: Too slow, Kane. The crate is gone. Try it again.']);
      startMission(missions, missions.index);
      events.push('failed');
      return events;
    }
  }
  if (objective.kind === 'defeat') {
    const target = objectiveTarget(missions, state.city);
    if (target !== null && missions.defeated === 0 && state.rivals.length === 0) {
      spawnRivals(state, objective.count);
    }
    if (missions.defeated >= objective.count) {
      missions.objective += 1;
      events.push('objective');
    }
    return events;
  }
  const target = objectiveTarget(missions, state.city);
  if (target === null) return events;
  const dist = Math.hypot(player.x - target.x, player.y - target.y);
  if (objective.kind === 'steal') {
    if (player.car !== null && player.car.marked) {
      missions.objective += 1;
      events.push('objective');
    }
    return events;
  }
  if (dist < 70) {
    if (objective.kind === 'collect') missions.hasPackage = true;
    missions.objective += 1;
    events.push('objective');
  }
  return events;
}
