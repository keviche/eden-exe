import { describe, expect, it } from "vitest";

describe("EDEN.EXE setup", () => {
  it("runs TypeScript tests successfully", () => {
    const appName: string = "EDEN.EXE";

    expect(appName).toBe("EDEN.EXE");
  });

  it("can perform basic calculations", () => {
    expect(2 + 3).toBe(5);
  });
});
