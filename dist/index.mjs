#!/usr/bin/env node
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/stagehand.ts
import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";
import { mkdtemp, cp } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
async function getStagehand() {
  if (stagehand) {
    return stagehand;
  }
  if (initializationPromise) {
    return initializationPromise;
  }
  initializationPromise = initStagehand();
  return initializationPromise;
}
var stagehand, initializationPromise, initStagehand;
var init_stagehand = __esm({
  "src/stagehand.ts"() {
    "use strict";
    stagehand = null;
    initializationPromise = null;
    initStagehand = async () => {
      const profileDir = join(process.cwd(), ".browser-use", "profile");
      let userDataDir;
      if (existsSync(profileDir)) {
        userDataDir = await mkdtemp(join(tmpdir(), "stagehand-profile-"));
        await cp(profileDir, userDataDir, { recursive: true });
      }
      const instance = new Stagehand({
        env: "LOCAL",
        localBrowserLaunchOptions: {
          headless: true,
          ...userDataDir && { userDataDir }
        },
        model: {
          modelName: "anthropic/claude-haiku-4-5",
          apiKey: process.env.ANTHROPIC_API_KEY
        }
      });
      await instance.init();
      stagehand = instance;
      return instance;
    };
  }
});

// src/utils/recorder.ts
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs/promises";
import path from "path";
import os from "os";
var ScreenRecorder;
var init_recorder = __esm({
  "src/utils/recorder.ts"() {
    "use strict";
    if (ffmpegStatic) {
      ffmpeg.setFfmpegPath(ffmpegStatic);
    }
    ScreenRecorder = class {
      constructor(page, stagehand2) {
        this.page = page;
        this.stagehand = stagehand2;
      }
      frames = [];
      frameHandler = null;
      session = null;
      // Will store the CDP session for event unregistration
      MAX_FRAMES = 1e3;
      recordingStartTime = 0;
      async start() {
        this.frames = [];
        this.recordingStartTime = Date.now();
        await this.page.sendCDP("Page.enable");
        const mainFrame = this.page.mainFrame();
        this.session = mainFrame.session;
        this.frameHandler = (params) => {
          if (this.frames.length < this.MAX_FRAMES) {
            this.frames.push({
              data: params.data,
              sessionId: params.sessionId,
              timestamp: Date.now() - this.recordingStartTime
            });
          }
          this.page.sendCDP("Page.screencastFrameAck", { sessionId: params.sessionId }).catch((err) => {
          });
        };
        this.session.on("Page.screencastFrame", this.frameHandler);
        await this.page.sendCDP("Page.startScreencast", {
          format: "jpeg",
          quality: 80,
          maxWidth: 1280,
          maxHeight: 720,
          everyNthFrame: 1
        });
      }
      async waitForMinFrames(min, timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        while (this.frames.length < min && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      async stop(outputPath) {
        console.error(
          `[recorder] stop() called, frames captured: ${this.frames.length}, outputPath: ${outputPath}`
        );
        try {
          await this.page.sendCDP("Page.stopScreencast");
        } catch (error) {
          console.error(`[recorder] Page.stopScreencast error:`, error);
        }
        if (this.frameHandler && this.session) {
          this.session.off("Page.screencastFrame", this.frameHandler);
          this.frameHandler = null;
          this.session = null;
        }
        if (this.frames.length < 2) {
          console.error(
            `[recorder] Only ${this.frames.length} frame(s) captured, skipping encoding`
          );
          return;
        }
        console.error(
          `[recorder] encoding ${this.frames.length} frames to ${outputPath}`
        );
        await this.encodeToMp4(this.frames, outputPath);
        console.error(`[recorder] encoding complete: ${outputPath}`);
      }
      async encodeToMp4(frames, outputPath) {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "stagehand-frames-"));
        try {
          await Promise.all(
            frames.map((frame, i) => {
              const framePath = path.join(tempDir, `frame-${i.toString().padStart(5, "0")}.jpg`);
              return fs.writeFile(framePath, Buffer.from(frame.data, "base64"));
            })
          );
          const totalDuration = frames[frames.length - 1].timestamp / 1e3;
          const fps = Math.max(1, Math.min(30, frames.length / totalDuration));
          await new Promise((resolve, reject) => {
            const command = ffmpeg().input(path.join(tempDir, "frame-%05d.jpg")).inputFPS(fps).videoFilters([
              "scale=trunc(iw/2)*2:trunc(ih/2)*2"
              // Ensure even dimensions for H.264
            ]).outputOptions([
              "-c:v libx264",
              // H.264 codec
              "-pix_fmt yuv420p",
              // Pixel format for compatibility
              "-movflags +faststart"
              // Enable fast start for web playback
            ]).output(outputPath).on("end", () => {
              resolve();
            }).on("error", (err, stdout, stderr) => {
              reject(new Error(`FFmpeg encoding failed: ${err.message}`));
            });
            command.run();
          });
        } finally {
          try {
            await fs.rm(tempDir, { recursive: true, force: true });
          } catch (cleanupError) {
          }
        }
      }
    };
  }
});

// src/utils/withRecording.ts
import fs2 from "fs/promises";
import path2 from "path";
async function withRecording(toolName, page, stagehand2, callback) {
  const recordingsDir = path2.join(RECORDINGS_BASE, ".browser-use", "recordings");
  console.error(`[withRecording] recordingsDir=${recordingsDir}`);
  await fs2.mkdir(recordingsDir, { recursive: true });
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const outputPath = path2.join(recordingsDir, `${timestamp}-${toolName}.mp4`);
  console.error(`[withRecording] outputPath=${outputPath}`);
  const recorder = new ScreenRecorder(page, stagehand2);
  try {
    await recorder.start();
  } catch (err) {
    console.error(`[withRecording] Failed to start recording:`, err);
    const result2 = await callback();
    return { result: result2, recordingPath: "" };
  }
  let result;
  try {
    result = await callback();
  } catch (err) {
    recorder.stop(outputPath).catch(() => {
    });
    throw err;
  }
  try {
    console.error(`[withRecording] waiting for frames...`);
    await recorder.waitForMinFrames(10, 5e3);
    console.error(`[withRecording] frames ready, stopping recorder...`);
    await recorder.stop(outputPath);
    console.error(`[withRecording] recorder stopped`);
  } catch (err) {
    console.error(`[withRecording] Recording encoding failed:`, err);
  }
  try {
    const stat = await fs2.stat(outputPath);
    console.error(
      `[withRecording] file exists: ${outputPath}, size=${stat.size} bytes`
    );
  } catch {
    console.error(
      `[withRecording] WARNING: file does NOT exist at ${outputPath}`
    );
  }
  return { result, recordingPath: outputPath };
}
var RECORDINGS_BASE;
var init_withRecording = __esm({
  "src/utils/withRecording.ts"() {
    "use strict";
    init_recorder();
    RECORDINGS_BASE = process.cwd();
  }
});

// src/tools/navigate.ts
import { z } from "zod";
async function collectPerformanceMetrics(page, wallClockMs) {
  try {
    const timing = await page.evaluate(() => {
      const entries = performance.getEntriesByType(
        "navigation"
      );
      if (!entries.length) return null;
      const nav = entries[0];
      return {
        ttfb: nav.responseStart > 0 ? Math.round(nav.responseStart) : null,
        domInteractive: nav.domInteractive > 0 ? Math.round(nav.domInteractive) : null,
        domContentLoaded: nav.domContentLoadedEventEnd > 0 ? Math.round(nav.domContentLoadedEventEnd) : null,
        loadEventEnd: nav.loadEventEnd > 0 ? Math.round(nav.loadEventEnd) : null,
        totalLoadTime: nav.loadEventEnd > 0 ? Math.round(nav.loadEventEnd) : null,
        domParsing: nav.domInteractive > 0 && nav.responseEnd > 0 ? Math.round(nav.domInteractive - nav.responseEnd) : null
      };
    });
    return {
      wallClockMs,
      ttfbMs: timing?.ttfb ?? null,
      domInteractiveMs: timing?.domInteractive ?? null,
      domContentLoadedMs: timing?.domContentLoaded ?? null,
      loadEventEndMs: timing?.loadEventEnd ?? null,
      totalLoadTimeMs: timing?.totalLoadTime ?? null,
      domParsingMs: timing?.domParsing ?? null
    };
  } catch {
    return null;
  }
}
function formatMetrics(metrics) {
  const lines = ["\n\nPerformance Metrics:"];
  lines.push(`  Navigation Duration (wall clock): ${metrics.wallClockMs}ms`);
  if (metrics.ttfbMs !== null)
    lines.push(`  TTFB (Time to First Byte): ${metrics.ttfbMs}ms`);
  if (metrics.domInteractiveMs !== null)
    lines.push(`  DOM Interactive: ${metrics.domInteractiveMs}ms`);
  if (metrics.domContentLoadedMs !== null)
    lines.push(`  DOM Content Loaded: ${metrics.domContentLoadedMs}ms`);
  if (metrics.loadEventEndMs !== null)
    lines.push(`  Load Event End: ${metrics.loadEventEndMs}ms`);
  if (metrics.totalLoadTimeMs !== null)
    lines.push(`  Total Load Time: ${metrics.totalLoadTimeMs}ms`);
  if (metrics.domParsingMs !== null)
    lines.push(`  DOM Parsing Time: ${metrics.domParsingMs}ms`);
  return lines.join("\n");
}
function registerNavigateTool(server2) {
  server2.registerTool(
    "navigate",
    {
      description: "Navigate the browser to a specified URL",
      inputSchema: {
        url: z.string().describe("The URL to navigate to (e.g. https://google.com)")
      }
    },
    async ({ url }) => {
      try {
        const sh = await getStagehand();
        const page = sh.context.activePage();
        if (!page) {
          throw new Error("No active page found in Stagehand context");
        }
        const { result: navResult, recordingPath } = await withRecording(
          "navigate",
          page,
          sh,
          async () => {
            const navStart = Date.now();
            await page.goto(url, { waitUntil: "domcontentloaded" });
            const wallClockMs = Date.now() - navStart;
            const title = await page.title();
            const metrics = await collectPerformanceMetrics(page, wallClockMs);
            const metricsText = metrics ? formatMetrics(metrics) : "";
            return `Successfully navigated to ${url}. Page title is "${title}".${metricsText}`;
          }
        );
        const recordingText = recordingPath ? `
Recording: ${recordingPath}` : "";
        return {
          content: [
            {
              type: "text",
              text: `${navResult}${recordingText}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error navigating to ${url}: ${String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
}
var init_navigate = __esm({
  "src/tools/navigate.ts"() {
    "use strict";
    init_stagehand();
    init_withRecording();
  }
});

// src/tools/extract.ts
import { z as z2 } from "zod";
function jsonSchemaToZod(schema) {
  const shape = {};
  for (const [key, typeStr] of Object.entries(schema)) {
    switch (typeStr) {
      case "string":
        shape[key] = z2.string();
        break;
      case "number":
        shape[key] = z2.number();
        break;
      case "boolean":
        shape[key] = z2.boolean();
        break;
      case "string[]":
        shape[key] = z2.array(z2.string());
        break;
      case "number[]":
        shape[key] = z2.array(z2.number());
        break;
      case "boolean[]":
        shape[key] = z2.array(z2.boolean());
        break;
      default:
        shape[key] = z2.string();
        break;
    }
  }
  return z2.object(shape);
}
function registerExtractTool(server2) {
  server2.registerTool(
    "extract",
    {
      description: "Extract data from the current page using a natural language instruction. Optionally provide a schema to get structured JSON output. A page must already be loaded (use the navigate tool first).",
      inputSchema: {
        instruction: z2.string().describe(
          'Natural language description of what data to extract from the page (e.g. "Extract the article title and author name")'
        ),
        schema: z2.record(z2.string(), z2.string()).optional().describe(
          'Optional: a JSON object mapping field names to types for structured extraction. Supported types: "string", "number", "boolean", "string[]", "number[]", "boolean[]". Example: { "title": "string", "price": "number" }'
        )
      }
    },
    async ({ instruction, schema }) => {
      try {
        const sh = await getStagehand();
        const page = sh.context.activePage();
        if (!page) {
          throw new Error("No active page found in Stagehand context");
        }
        let result;
        if (schema && Object.keys(schema).length > 0) {
          const zodSchema = jsonSchemaToZod(schema);
          result = await sh.extract(instruction, zodSchema);
        } else {
          result = await sh.extract(instruction);
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error extracting data: ${String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
}
var init_extract = __esm({
  "src/tools/extract.ts"() {
    "use strict";
    init_stagehand();
  }
});

// src/tools/observe.ts
import { z as z3 } from "zod";
function registerObserveTool(server2) {
  server2.registerTool(
    "observe",
    {
      description: "List available actions and interactive elements on the current page. Optionally provide an instruction to filter or focus the observation. A page must already be loaded (use the navigate tool first).",
      inputSchema: {
        instruction: z3.string().optional().describe(
          'Optional natural language description to filter or focus observation (e.g. "Find all login-related buttons")'
        )
      }
    },
    async ({ instruction }) => {
      try {
        const sh = await getStagehand();
        const page = sh.context.activePage();
        if (!page) {
          throw new Error("No active page found in Stagehand context");
        }
        let actions;
        if (instruction) {
          actions = await sh.observe(instruction);
        } else {
          actions = await sh.observe();
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(actions, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error observing page: ${String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
}
var init_observe = __esm({
  "src/tools/observe.ts"() {
    "use strict";
    init_stagehand();
  }
});

// src/tools/act.ts
import { z as z4 } from "zod";
function registerActTool(server2) {
  server2.registerTool(
    "act",
    {
      description: "Perform an action on the current page using a natural language instruction. Examples: click a button, fill in a form field, select a dropdown option. A page must already be loaded (use the navigate tool first).",
      inputSchema: {
        instruction: z4.string().describe(
          'Natural language description of the action to perform (e.g. "Click the Sign In button", "Type hello into the search box")'
        )
      }
    },
    async ({ instruction }) => {
      try {
        const sh = await getStagehand();
        const page = sh.context.activePage();
        if (!page) {
          throw new Error("No active page found in Stagehand context");
        }
        const { result, recordingPath } = await withRecording(
          "act",
          page,
          sh,
          async () => sh.act(instruction)
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ...result, recordingPath }, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error performing action: ${String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
}
var init_act = __esm({
  "src/tools/act.ts"() {
    "use strict";
    init_stagehand();
    init_withRecording();
  }
});

// src/tools/get_url.ts
function registerGetUrlTool(server2) {
  server2.registerTool(
    "get_url",
    {
      description: "Get the current URL of the active browser page. A page must already be loaded (use the navigate tool first).",
      inputSchema: {}
    },
    async () => {
      try {
        const sh = await getStagehand();
        const page = sh.context.activePage();
        if (!page) {
          throw new Error("No active page found in Stagehand context");
        }
        const url = page.url();
        return {
          content: [
            {
              type: "text",
              text: url
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting URL: ${String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
}
var init_get_url = __esm({
  "src/tools/get_url.ts"() {
    "use strict";
    init_stagehand();
  }
});

// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
var server;
var init_server = __esm({
  "src/server.ts"() {
    "use strict";
    init_navigate();
    init_extract();
    init_observe();
    init_act();
    init_get_url();
    server = new McpServer({ name: "stagehand", version: "0.0.1" });
    registerNavigateTool(server);
    registerExtractTool(server);
    registerObserveTool(server);
    registerActTool(server);
    registerGetUrlTool(server);
  }
});

// index.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
var require_index = __commonJS({
  "index.ts"() {
    init_server();
    async function main() {
      const transport = new StdioServerTransport();
      await server.connect(transport);
      console.error("Stagehand MCP server running on stdio");
    }
    main().catch((error) => {
      console.error("Server error:", error);
      process.exit(1);
    });
  }
});
export default require_index();
