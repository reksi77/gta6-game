// Solara Bay: every tuning number, colour and story beat in one place. The world is a
// 3200x3200 city on a 1280x720 camera; nothing below depends on the screen size.

export const WORLD = { size: 3200 };
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'solara-bay.save.v1';

export const PLAYER = {
  radius: 13,
  walkSpeed: 215,
  health: 100,
  punchRange: 38,
  punchDamage: 30,
  punchCooldown: 0.38,
  shootCooldown: 0.24,
  ammoStart: 24,
  arrestSeconds: 0.8,
};

export const CAR_TYPES = [
  { name: 'Hatch', length: 64, width: 30, topSpeed: 330, accel: 260, brake: 420, turn: 2.6, color: '#e8b23a', roof: '#f7d774' },
  { name: 'Sedan', length: 72, width: 32, topSpeed: 360, accel: 280, brake: 440, turn: 2.5, color: '#4f7ec2', roof: '#7ba7dd' },
  { name: 'Taxi', length: 72, width: 32, topSpeed: 350, accel: 270, brake: 440, turn: 2.5, color: '#e8c832', roof: '#f5e06a', taxi: true },
  { name: 'Van', length: 88, width: 36, topSpeed: 300, accel: 220, brake: 380, turn: 2.1, color: '#c25a4f', roof: '#d98a7e' },
  { name: 'Sport', length: 76, width: 34, topSpeed: 470, accel: 380, brake: 500, turn: 3.0, color: '#7e4fc2', roof: '#a87fdd' },
];

export const TRAFFIC = { count: 14, cruiseMin: 130, cruiseMax: 200, lookAhead: 110, turnChance: 0.22 };
export const PEDS = { count: 26, walkSpeed: 55, fleeSpeed: 150 };
export const POLICE = {
  footSpeed: 238,
  carSpeed: 330,
  shootRange: 430,
  shootCooldown: 1.15,
  ramDamage: 6,
  ramCooldown: 1.0,
  spawnEvery: 1.6,
};
export const WANTED = { max: 5, decayDelay: 12, decayEvery: 6, crimeCooldown: 4 };

export const MISSIONS = [
  {
    id: 'pickup',
    title: 'The Pickup',
    pay: 400,
    intro: [
      'Marta: Jesse. You are back in Solara Bay, and already owing me.',
      'Marta: A package waits at the Old Pier. Fetch it. No questions.',
    ],
    objectives: [
      { kind: 'goto', place: 'pier', label: 'Go to the Old Pier' },
      { kind: 'collect', place: 'pier', label: 'Pick up the package' },
      { kind: 'goto', place: 'cafe', label: 'Deliver it to Delgado\u2019s Caf\u00e9' },
    ],
    outro: ['Marta: Clean hands, Kane. Here is your cut. There will be more.'],
  },
  {
    id: 'hotwheels',
    title: 'Hot Wheels',
    pay: 600,
    intro: [
      'Marta: A client wants a purple Sport, no questions, no plates.',
      'Marta: One sits in the East Lot. Take it to the Garage. Lose the heat.',
    ],
    objectives: [
      { kind: 'steal', place: 'eastlot', label: 'Steal the purple Sport' },
      { kind: 'goto', place: 'garage', label: 'Deliver it to the Garage' },
    ],
    outro: ['Marta: The client is pleased. The cops are not. Good.'],
  },
  {
    id: 'payback',
    title: 'Payback',
    pay: 900,
    intro: [
      'Marta: The Harbor Boys taxed my caf\u00e9. Four of them, at the Warehouse.',
      'Marta: Go remind them who runs this side of the bay. Fists or lead.',
    ],
    objectives: [
      { kind: 'defeat', place: 'warehouse', count: 4, label: 'Deal with the Harbor Boys (0/4)' },
      { kind: 'goto', place: 'cafe', label: 'Report back to the Caf\u00e9' },
    ],
    outro: ['Marta: The Boys will think twice now. Take this. You earned it.'],
  },
  {
    id: 'bigscore',
    title: 'The Big Score',
    pay: 1500,
    intro: [
      'Marta: One last job. A crate at the Docks, worth more than this whole street.',
      'Marta: The harbour police are already on you. One hundred seconds. Go.',
    ],
    objectives: [
      { kind: 'timed', place: 'docks', seconds: 100, label: 'Reach the Docks before time runs out' },
    ],
    outro: ['Marta: We are rich, Kane. Solara Bay is ours now.'],
  },
];

export const CASH_PACKAGES = 5;
export const CASH_VALUE = 100;
export const AMMO_PICKUPS = 2;
export const AMMO_VALUE = 12;
export const HEALTH_PICKUPS = 2;
export const HEALTH_VALUE = 40;

export const PALETTE = {
  backdrop: '#0e1420',
  grass: '#7da95c',
  park: '#5d8f46',
  sand: '#d9c48a',
  water: '#2e6f8e',
  road: '#3a3f47',
  roadEdge: '#2c3038',
  lane: '#c8b45a',
  sidewalk: '#9aa0a8',
  building: '#b08a5e',
  buildingRoof: '#8a6a45',
  plaza: '#b9b3a4',
  lot: '#4a4f58',
  player: '#f2f2f2',
  playerShirt: '#e5534b',
  ped: '#e8e0c8',
  cop: '#3a6fd8',
  patrol: '#2c4f9e',
  bullet: '#ffd94c',
  cash: '#37c978',
  ammo: '#f2a541',
  health: '#e5534b',
  marker: '#ffd94c',
  text: '#f4f1e8',
  muted: '#aab2bd',
  panel: 'rgba(16, 20, 30, 0.88)',
  panelEdge: '#ffd94c',
  banner: '#ffd94c',
  danger: '#ff5a4e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
