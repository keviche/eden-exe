import { describe, expect, it } from "vitest";
import { nextSimulationSpeed, scaledElapsedSeconds, SIMULATION_SPEEDS } from "../simulation/timeControls";

describe("simulation time controls", () => {
  it("cycles through supported time multipliers and wraps back to real time", () => {
    expect(SIMULATION_SPEEDS).toEqual([1, 2, 4, 8, 16]);
    expect(nextSimulationSpeed(1)).toBe(2);
    expect(nextSimulationSpeed(2)).toBe(4);
    expect(nextSimulationSpeed(4)).toBe(8);
    expect(nextSimulationSpeed(8)).toBe(16);
    expect(nextSimulationSpeed(16)).toBe(1);
    expect(nextSimulationSpeed(99)).toBe(1);
  });

  it("scales elapsed real seconds and rejects invalid inputs", () => {
    expect(scaledElapsedSeconds(1_000, 1)).toBe(1);
    expect(scaledElapsedSeconds(1_000, 4)).toBe(4);
    expect(scaledElapsedSeconds(250, 8)).toBe(2);
    expect(scaledElapsedSeconds(0, 4)).toBe(0);
    expect(scaledElapsedSeconds(-500, 2)).toBe(0);
    expect(scaledElapsedSeconds(Number.NaN, 2)).toBe(0);
    expect(scaledElapsedSeconds(1_000, Number.POSITIVE_INFINITY)).toBe(0);
  });
});
