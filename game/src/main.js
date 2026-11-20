// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps, and the renderer paints what is there. The game moves between five screens:
// title, play, paused, busted and wasted. Progress (money and the mission reached) is
// saved to localStorage whenever it changes, and the title screen offers to continue it.
//
// ?seed=N fixes the city's random stream. ?shot=chase|drive|mission|street (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { STEP, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_SHOT, EVENT_HIT, EVENT_PICKUP, EVENT_MISSION, EVENT_CRIME, EVENT_BUSTED, EVENT_WASTED, EVENT_PUNCH, EVENT_RAMMED, EVENT_OBJECTIVE } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_PUNCH, ACTION_MUTE, ACTION_NEWGAME, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_WASTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

// A handle for automated playtests: lets a test read the world and drive the game.
window.__solara = { world };

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (raw === null) return null;
    const save = JSON.parse(raw);
    if (typeof save.money !== 'number' || typeof save.missionIndex !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function saveFromState() {
  return {
    money: world.state.player.money,
    missionIndex: world.state.missions.index,
    ammo: world.state.player.ammo,
    health: world.state.player.health,
  };
}

function applySave(save) {
  world.state.player.money = save.money;
  world.state.player.ammo = save.ammo || 24;
  world.state.player.health = save.health || 100;
  if (save.missionIndex > 0 && save.missionIndex < 4) {
    world.startMissionAt(save.missionIndex);
  } else if (save.missionIndex >= 4) {
    world.state.missions.index = 4;
    world.state.missions.active = false;
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();
  window.__solara.getScreen = () => screen;

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    world.reset();
    if (!fresh && save !== null) applySave(save);
    else if (fresh) {
      save = null;
      try { window.localStorage.removeItem(SAVE_KEY); } catch { /* storage can be off */ }
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.resume();
    announce('Playing in Solara Bay.');
  }

  function endGame(reason) {
    const player = world.state.player;
    if (reason === 'busted') {
      player.money = Math.max(0, player.money - 200);
      screen = SCREEN_BUSTED;
      audio.busted();
    } else {
      player.money = Math.max(0, player.money - 100);
      screen = SCREEN_WASTED;
      audio.busted();
    }
    // Clear the end itself: the world keeps reporting a set endReason, so leaving it
    // would bust or waste the player again on the very next step after they resume.
    world.state.endReason = null;
    player.arrestTimer = 0;
    world.state.police.wanted = 0;
    world.state.police.cops.length = 0;
    world.state.police.patrols.length = 0;
    player.health = 100;
    player.x = world.state.city.spawn.x;
    player.y = world.state.city.spawn.y;
    if (player.car !== null) player.car = null;
    save = saveFromState();
    writeSave(save);
    announce(reason === 'busted' ? 'Busted. You lost $200 in fines.' : 'Wasted. Hospital bill: $100.');
  }

  function handleEvents(events) {
    if (events & EVENT_SHOT) audio.gunshot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & (EVENT_PICKUP | EVENT_OBJECTIVE)) audio.pickup();
    if (events & EVENT_MISSION) {
      audio.missionPass();
      save = saveFromState();
      writeSave(save);
    }
    if (events & EVENT_BUSTED) endGame('busted');
    else if (events & EVENT_WASTED) endGame('wasted');
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      world.state.audioMuted = audio.isMuted();
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_NEWGAME) startGame(true);
      else if (actions & ACTION_CONFIRM) startGame(false);
      return;
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Back on the streets of Solara Bay.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  }

  function readControl() {
    const steer = input.steer();
    const mouse = input.mouse();
    const player = world.state.player;
    let aim = null;
    if (mouse !== null && player.car === null) {
      aim = renderer.screenToWorld(mouse.x, mouse.y);
    }
    return {
      move: { x: steer.x, y: steer.y },
      pedal: steer.y < 0 ? 1 : steer.y > 0 ? -1 : 0,
      steer: steer.x,
      aim,
      shooting: input.shooting(),
      enter: false,
      punch: false,
    };
  }

  // One step of play. `actions` are this frame's one-shot presses; only the first fixed
  // step of a frame may see them, so a single E never enters and leaves a car at once.
  function step(actions) {
    const control = readControl();
    control.enter = Boolean(actions & ACTION_ENTER);
    control.punch = Boolean(actions & ACTION_PUNCH);
    const events = world.step(STEP, control);
    handleEvents(events);
    audio.setEngine(world.state.player.car !== null
      ? Math.abs(world.state.player.car.speed) / world.state.player.car.type.topSpeed
      : 0);
    audio.setSiren(world.state.police.cops.length > 0 || world.state.police.patrols.length > 0);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Every one-shot press is taken exactly once per frame and handed to the screens and
    // to the first fixed step together; taking them twice would lose presses.
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, save);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solara Bay. Press Enter to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
