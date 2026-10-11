export const SIMULATION_SPEEDS = [1, 2, 4, 8, 16] as const;
export type SimulationSpeed = (typeof SIMULATION_SPEEDS)[number];

export function nextSimulationSpeed(current: number): SimulationSpeed {
  const index = SIMULATION_SPEEDS.indexOf(current as SimulationSpeed);
  return SIMULATION_SPEEDS[(index + 1) % SIMULATION_SPEEDS.length]!;
}

/** Convert real elapsed time into the amount of simulation time to advance. */
export function scaledElapsedSeconds(elapsedMilliseconds: number, speed: number): number {
  if (!Number.isFinite(elapsedMilliseconds) || elapsedMilliseconds <= 0) return 0;
  if (!Number.isFinite(speed) || speed <= 0) return 0;
  return elapsedMilliseconds / 1_000 * speed;
}
