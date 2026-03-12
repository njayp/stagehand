import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

describe("MCP tools integration", () => {
  let client: Client;

  beforeAll(async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.resolve(__dirname, "../dist/index.js")],
    });

    client = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} },
    );

    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  it("navigate to example.com", async () => {
    const result = await client.callTool({
      name: "navigate",
      arguments: { url: "https://example.com" },
    });

    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content.length).toBeGreaterThan(0);

    const text = content[0].text;
    expect(text).toContain("Example Domain");

    // Verify performance metrics
    expect(text).toContain("Performance Metrics:");
    expect(text).toContain("Navigation Duration (wall clock):");
  });

  it("extract with instruction only", async () => {
    const result = await client.callTool({
      name: "extract",
      arguments: {
        instruction:
          "Extract the main heading text and the paragraph text from this page",
      },
    });

    expect(result.content).toBeDefined();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content.length).toBeGreaterThan(0);
    expect(content[0].text).toBeTruthy();
  });

  it("extract with schema", async () => {
    const result = await client.callTool({
      name: "extract",
      arguments: {
        instruction:
          "Extract the main heading and description from this page",
        schema: {
          heading: "string",
          description: "string",
        },
      },
    });

    expect(result.content).toBeDefined();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content.length).toBeGreaterThan(0);
    expect(content[0].text).toBeTruthy();
  });

  it("observe without instruction", async () => {
    const result = await client.callTool({
      name: "observe",
      arguments: {},
    });

    expect(result.content).toBeDefined();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content.length).toBeGreaterThan(0);
    expect(content[0].text).toBeTruthy();
  });

  it("observe with instruction", async () => {
    const result = await client.callTool({
      name: "observe",
      arguments: {
        instruction: "Find all links on the page",
      },
    });

    expect(result.content).toBeDefined();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content.length).toBeGreaterThan(0);
    expect(content[0].text).toBeTruthy();
  });

  it("act to click a link", async () => {
    const result = await client.callTool({
      name: "act",
      arguments: {
        instruction: "Click the 'More information...' link",
      },
    });

    expect(result.content).toBeDefined();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content.length).toBeGreaterThan(0);
  });

  it("get_url returns current page URL", async () => {
    const result = await client.callTool({
      name: "get_url",
      arguments: {},
    });

    expect(result.content).toBeDefined();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content.length).toBeGreaterThan(0);
    expect(content[0].text).toBeTruthy();
  });
});
