import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getStagehand } from "../stagehand.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetUrlTool } from "./get_url.js";
import fs from "fs/promises";

describe("Get URL Tool End-to-End", () => {
  let stagehandInstance: Awaited<ReturnType<typeof getStagehand>> | null = null;
  let getUrlHandler: any;

  beforeAll(async () => {
    stagehandInstance = await getStagehand();

    // Ensure we are on a known page
    const page = stagehandInstance.context.activePage();
    if (page) {
      await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    }

    const mockServer = {
      registerTool: (name: string, schema: any, handler: any) => {
        if (name === "get_url") {
          getUrlHandler = handler;
        }
      },
    } as unknown as McpServer;

    registerGetUrlTool(mockServer);
  }, 60000);

  afterAll(async () => {
    if (stagehandInstance) {
      await stagehandInstance.context.close();
    }
  });

  it("should retrieve the active URL and create a recording", async () => {
    expect(getUrlHandler).toBeDefined();

    const result = await getUrlHandler({});

    // Ensure it returned successfully
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("https://example.com");
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
  }, 30000);
});
