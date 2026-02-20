import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getStagehand } from "../stagehand.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerExtractTool } from "./extract.js";
import fs from "fs/promises";

describe("Extract Tool End-to-End", () => {
  let stagehandInstance: Awaited<ReturnType<typeof getStagehand>> | null = null;
  let extractHandler: any;

  beforeAll(async () => {
    stagehandInstance = await getStagehand();

    // Navigate to example.com to have deterministic content
    const page = stagehandInstance.context.activePage();
    if (page) {
      await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    }

    const mockServer = {
      registerTool: (name: string, schema: any, handler: any) => {
        if (name === "extract") {
          extractHandler = handler;
        }
      },
    } as unknown as McpServer;

    registerExtractTool(mockServer);
  }, 60000);

  afterAll(async () => {
    if (stagehandInstance) {
      await stagehandInstance.context.close();
    }
  });

  it("should successfully extract data from the page with schema and create a recording", async () => {
    expect(extractHandler).toBeDefined();

    const timestampStart = Date.now();
    const result = await extractHandler({
      instruction: "Extract the heading and the paragraph text below it",
      schema: { heading: "string", paragraph: "string" },
    });

    // Ensure it returned successfully
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Recording saved to");
    expect(result.content[0].text).toContain("Example Domain");

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
