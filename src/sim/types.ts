export type Terrain = 'grass' | 'forest' | 'water';
export type Sex = 'F' | 'M';
export type LifeStage = 'child' | 'adult' | 'elder';
export type Activity = 'seeking food' | 'wandering' | 'resting';

/** Heritable traits, each in [0,1]. */
export interface Traits {
  metabolism: number; // higher = hungrier faster
  vigor: number; // higher = tougher, longer-lived
  fertility: number; // higher = reproduces more readily
}

export interface Agent {
  id: number;
  name: string;
  x: number;
  y: number;
  sex: Sex;
  age: number; // ticks
  maxAge: number;
  hunger: number; // 0 full .. 100 starving
  energy: number; // 0..100
  health: number; // 0..100
  traits: Traits;
  cooldown: number; // ticks until may reproduce again
  activity: Activity;
  alive: boolean;
}

export interface Tile {
  terrain: Terrain;
  food: number; // 0..maxFood
}

export interface LogEntry {
  tick: number;
  kind: 'birth' | 'death' | 'warning' | 'event' | 'extinction';
  text: string;
}

export interface Config {
  size: number;
  startAgents: number;
  ticksPerYear: number;
  maxFood: number;
  foodRegrowChance: number;
  adultAge: number; // years
  elderAge: number; // years
  reproCooldown: number; // ticks
  maxPopulation: number;
  seed: number;
}

export interface Stats {
  population: number;
  births: number;
  deaths: number;
  avgHunger: number;
  avgHealth: number;
  tick: number;
  year: number;
  droughtTicks: number;
  extinct: boolean;
}
