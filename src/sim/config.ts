import type { Config } from './types';

export const defaultConfig: Config = {
  size: 32,
  startAgents: 20,
  ticksPerYear: 100,
  maxFood: 3,
  foodRegrowChance: 0.0008,
  adultAge: 16,
  elderAge: 55,
  reproCooldown: 150,
  maxPopulation: 150,
  seed: 0,
};
