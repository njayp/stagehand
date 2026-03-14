import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { mkdtemp, writeFile, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

describe("BROWSER_PROFILE_DIR support", () => {
  let client: Client;
  let profileDir: string;
  const markerFileName = "cookies.json";
  const markerContent = '{"marker": true}';

  beforeAll(async () => {
    // Create a temp "golden" profile directory with a marker file
    profileDir = await mkdtemp(path.join(tmpdir(), "stagehand-test-profile-"));
    await writeFile(
      path.join(profileDir, markerFileName),
      markerContent,
      "utf-8",
    );

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.resolve(__dirname, "../dist/index.js")],
      env: { ...process.env, BROWSER_PROFILE_DIR: profileDir },
    });

    client = new Client(
      { name: "test-client-profile", version: "1.0.0" },
      { capabilities: {} },
    );

    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
    await rm(profileDir, { recursive: true, force: true });
  });

  it("navigates successfully with a profile directory", async () => {
    const result = await client.callTool({
      name: "navigate",
      arguments: { url: "https://example.com" },
    });

    expect(result.content).toBeDefined();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content.length).toBeGreaterThan(0);
    expect(content[0].text).toContain("Example Domain");
  });

  it("does not modify the original profile directory", async () => {
    const files = await readdir(profileDir);
    expect(files).toContain(markerFileName);

    const content = await readFile(
      path.join(profileDir, markerFileName),
      "utf-8",
    );
    expect(content).toBe(markerContent);

    // The original profile should only have the marker file we created
    expect(files).toEqual([markerFileName]);
  });
});
