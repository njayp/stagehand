import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getStagehand } from "../stagehand.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerActTool } from "./act.js";
import fs from "fs/promises";

describe("Act Tool End-to-End", () => {
  let stagehandInstance: Awaited<ReturnType<typeof getStagehand>> | null = null;
  let actHandler: any;

  beforeAll(async () => {
    stagehandInstance = await getStagehand();

    // Ensure we are on a page where we can perform an action
    const page = stagehandInstance.context.activePage();
    if (page) {
      await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    }

    const mockServer = {
      registerTool: (name: string, schema: any, handler: any) => {
        if (name === "act") {
          actHandler = handler;
        }
      },
    } as unknown as McpServer;

    registerActTool(mockServer);
  }, 60000);

  afterAll(async () => {
    if (stagehandInstance) {
      await stagehandInstance.context.close();
    }
  });

  it("should successfully perform an action on the page and create a recording", async () => {
    expect(actHandler).toBeDefined();

    // The instruction must be viable on example.com
    const result = await actHandler({
      instruction: "Click the 'More information...' link",
    });

    // Ensure it returned successfully
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Recording saved to");

    // Extract file path from output
    const match = result.content[0].text.match(/Recording saved to (.*\.mp4)/);
    expect(match).toBeTruthy();

    if (match) {
      const filePath = match[1];

      // Verify file exists on system
      const stats = await fs.stat(filePath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);

      // Clean up the test file
      await fs.unlink(filePath);
    }
  }, 45000);
});
