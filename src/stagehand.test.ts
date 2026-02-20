import { describe, it, expect, afterAll } from "vitest";
import { getStagehand } from "./stagehand.js";

describe("getStagehand thread safety", () => {
  // Note: These tests will use the actual Stagehand implementation
  // which may be slow due to browser initialization

  let stagehandInstance: Awaited<ReturnType<typeof getStagehand>> | null = null;

  afterAll(async () => {
    // Cleanup after all tests complete
    if (stagehandInstance) {
      await stagehandInstance.context.close();
    }
  });

  it("should return the same instance for concurrent calls", async () => {
    // Make 3 concurrent calls before initialization completes
    const [sh1, sh2, sh3] = await Promise.all([
      getStagehand(),
      getStagehand(),
      getStagehand(),
    ]);

    // All should reference the exact same instance
    expect(sh1).toBe(sh2);
    expect(sh2).toBe(sh3);

    // Save for cleanup
    stagehandInstance = sh1;
  }, 30000); // Increase timeout for browser initialization

  it("should return cached instance on subsequent calls", async () => {
    const sh1 = await getStagehand();
    const sh2 = await getStagehand();

    expect(sh1).toBe(sh2);
    expect(sh1).toBe(stagehandInstance); // Should be same as from first test
  });

  it("should have initialized Stagehand with correct properties", async () => {
    const sh = await getStagehand();

    // Verify it's a properly initialized Stagehand instance
    expect(sh).toBeDefined();
    expect(sh.context).toBeDefined();
    expect(typeof sh.context.activePage).toBe("function");
    expect(sh).toBe(stagehandInstance); // Should be same instance
  });
});
