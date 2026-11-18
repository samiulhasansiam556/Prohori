import { describe, expect, it } from "vitest";

describe("Prohori Foundation", () => {
  it("should run the testing environment", () => {
    expect(true).toBe(true);
  });

  it("should identify the project correctly", () => {
    const projectName = "Prohori";

    expect(projectName).toBe("Prohori");
  });
});
