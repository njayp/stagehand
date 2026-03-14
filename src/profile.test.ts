import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import {
  mkdtemp,
  writeFile,
  readdir,
  readFile,
  rm,
  mkdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";

describe(".browser-use/profile directory support", () => {
  let client: Client;
  let cwdDir: string;
  const profileSubdir = path.join(".browser-use", "profile");
  const markerFileName = "cookies.json";
  const markerContent = '{"marker": true}';

  beforeAll(async () => {
    // Create a temp directory to act as the server's cwd
    cwdDir = await mkdtemp(path.join(tmpdir(), "stagehand-test-cwd-"));
    // Create .browser-use/profile/ inside it with a marker file
    await mkdir(path.join(cwdDir, profileSubdir), { recursive: true });
    await writeFile(
      path.join(cwdDir, profileSubdir, markerFileName),
      markerContent,
      "utf-8",
    );

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.resolve(__dirname, "../dist/index.js")],
      cwd: cwdDir,
    });

    client = new Client(
      { name: "test-client-profile", version: "1.0.0" },
      { capabilities: {} },
    );

    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
    await rm(cwdDir, { recursive: true, force: true });
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
    const files = await readdir(path.join(cwdDir, profileSubdir));
    expect(files).toContain(markerFileName);

    const content = await readFile(
      path.join(cwdDir, profileSubdir, markerFileName),
      "utf-8",
    );
    expect(content).toBe(markerContent);

    // The original profile should only have the marker file we created
    expect(files).toEqual([markerFileName]);
  });
});
