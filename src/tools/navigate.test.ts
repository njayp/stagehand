import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getStagehand } from "../stagehand.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerNavigateTool } from "./navigate.js";
import fs from "fs/promises";
import path from "path";

// Note: Testing tools via direct method call is difficult with McpServer since tool handlers are private.
// We'll extract the handler logic by intercepting the registerTool call for the purpose of the test,
// or we can test using a simulated request. The simplest approach without complex LocalTransports
// is to intercept the callback provided to registerTool.

describe("Navigate Tool End-to-End", () => {
  let stagehandInstance: Awaited<ReturnType<typeof getStagehand>> | null = null;
  let navigateHandler: any;

  beforeAll(async () => {
    stagehandInstance = await getStagehand();

    // Intercept registerTool to get the handler
    const mockServer = {
      registerTool: (name: string, schema: any, handler: any) => {
        if (name === "navigate") {
          navigateHandler = handler;
        }
      },
    } as unknown as McpServer;

    registerNavigateTool(mockServer);
  }, 60000);

  afterAll(async () => {
    if (stagehandInstance) {
      await stagehandInstance.context.close();
    }
  });

  it("should successfully navigate to example.com and create a recording", async () => {
    expect(navigateHandler).toBeDefined();

    const timestampStart = Date.now();
    const result = await navigateHandler({ url: "https://example.com" });

    // Ensure it returned successfully
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain(
      "Successfully navigated to https://example.com",
    );
    expect(result.content[0].text).toContain("Recording saved to");

    // Extract file path from output
    const match = result.content[0].text.match(/Recording saved to (.*\.mp4)/);
    expect(match).toBeTruthy();

    if (match) {
      const filePath = match[1];

      // Verify file exists on system
      const stats = await fs.stat(filePath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0); // Ensure size is not 0 bytes

      // Clean up the test file
      await fs.unlink(filePath);
    }
  }, 30000);
});
