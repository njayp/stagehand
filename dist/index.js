#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// index.ts
var import_stdio = require("@modelcontextprotocol/sdk/server/stdio.js");

// src/server.ts
var import_mcp = require("@modelcontextprotocol/sdk/server/mcp.js");

// src/tools/navigate.ts
var import_zod = require("zod");

// src/stagehand.ts
var import_config = require("dotenv/config");
var import_stagehand = require("@browserbasehq/stagehand");
var import_promises = require("fs/promises");
var import_node_os = require("os");
var import_node_path = require("path");
var stagehand = null;
var initializationPromise = null;
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
var initStagehand = async () => {
  const profileDir = process.env.BROWSER_PROFILE_DIR;
  let userDataDir;
  if (profileDir) {
    userDataDir = await (0, import_promises.mkdtemp)((0, import_node_path.join)((0, import_node_os.tmpdir)(), "stagehand-profile-"));
    await (0, import_promises.cp)(profileDir, userDataDir, { recursive: true });
  }
  const instance = new import_stagehand.Stagehand({
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

// src/utils/recorder.ts
var import_fluent_ffmpeg = __toESM(require("fluent-ffmpeg"));
var import_ffmpeg_static = __toESM(require("ffmpeg-static"));
var import_promises2 = __toESM(require("fs/promises"));
var import_path = __toESM(require("path"));
var import_os = __toESM(require("os"));
if (import_ffmpeg_static.default) {
  import_fluent_ffmpeg.default.setFfmpegPath(import_ffmpeg_static.default);
}
var ScreenRecorder = class {
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
    const tempDir = await import_promises2.default.mkdtemp(import_path.default.join(import_os.default.tmpdir(), "stagehand-frames-"));
    try {
      await Promise.all(
        frames.map((frame, i) => {
          const framePath = import_path.default.join(tempDir, `frame-${i.toString().padStart(5, "0")}.jpg`);
          return import_promises2.default.writeFile(framePath, Buffer.from(frame.data, "base64"));
        })
      );
      const totalDuration = frames[frames.length - 1].timestamp / 1e3;
      const fps = Math.max(1, Math.min(30, frames.length / totalDuration));
      await new Promise((resolve, reject) => {
        const command = (0, import_fluent_ffmpeg.default)().input(import_path.default.join(tempDir, "frame-%05d.jpg")).inputFPS(fps).videoFilters([
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
        await import_promises2.default.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
      }
    }
  }
};

// src/utils/withRecording.ts
var import_promises3 = __toESM(require("fs/promises"));
var import_path2 = __toESM(require("path"));
var SCRIPT_DIR = import_path2.default.dirname(process.argv[1] || ".");
var PROJECT_ROOT = import_path2.default.resolve(SCRIPT_DIR, "..");
async function withRecording(toolName, page, stagehand2, callback) {
  const recordingsDir = import_path2.default.join(PROJECT_ROOT, "recordings");
  console.error(`[withRecording] cwd=${process.cwd()}, projectRoot=${PROJECT_ROOT}, recordingsDir=${recordingsDir}`);
  await import_promises3.default.mkdir(recordingsDir, { recursive: true });
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const outputPath = import_path2.default.join(recordingsDir, `${toolName}-${timestamp}.mp4`);
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
    const stat = await import_promises3.default.stat(outputPath);
    console.error(`[withRecording] file exists: ${outputPath}, size=${stat.size} bytes`);
  } catch {
    console.error(`[withRecording] WARNING: file does NOT exist at ${outputPath}`);
  }
  return { result, recordingPath: outputPath };
}

// src/tools/navigate.ts
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
        url: import_zod.z.string().describe("The URL to navigate to (e.g. https://google.com)")
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

// src/tools/extract.ts
var import_zod2 = require("zod");
function jsonSchemaToZod(schema) {
  const shape = {};
  for (const [key, typeStr] of Object.entries(schema)) {
    switch (typeStr) {
      case "string":
        shape[key] = import_zod2.z.string();
        break;
      case "number":
        shape[key] = import_zod2.z.number();
        break;
      case "boolean":
        shape[key] = import_zod2.z.boolean();
        break;
      case "string[]":
        shape[key] = import_zod2.z.array(import_zod2.z.string());
        break;
      case "number[]":
        shape[key] = import_zod2.z.array(import_zod2.z.number());
        break;
      case "boolean[]":
        shape[key] = import_zod2.z.array(import_zod2.z.boolean());
        break;
      default:
        shape[key] = import_zod2.z.string();
        break;
    }
  }
  return import_zod2.z.object(shape);
}
function registerExtractTool(server2) {
  server2.registerTool(
    "extract",
    {
      description: "Extract data from the current page using a natural language instruction. Optionally provide a schema to get structured JSON output. A page must already be loaded (use the navigate tool first).",
      inputSchema: {
        instruction: import_zod2.z.string().describe(
          'Natural language description of what data to extract from the page (e.g. "Extract the article title and author name")'
        ),
        schema: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.string()).optional().describe(
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

// src/tools/observe.ts
var import_zod3 = require("zod");
function registerObserveTool(server2) {
  server2.registerTool(
    "observe",
    {
      description: "List available actions and interactive elements on the current page. Optionally provide an instruction to filter or focus the observation. A page must already be loaded (use the navigate tool first).",
      inputSchema: {
        instruction: import_zod3.z.string().optional().describe(
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

// src/tools/act.ts
var import_zod4 = require("zod");
function registerActTool(server2) {
  server2.registerTool(
    "act",
    {
      description: "Perform an action on the current page using a natural language instruction. Examples: click a button, fill in a form field, select a dropdown option. A page must already be loaded (use the navigate tool first).",
      inputSchema: {
        instruction: import_zod4.z.string().describe(
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

// src/server.ts
var server = new import_mcp.McpServer({ name: "stagehand", version: "0.0.1" });
registerNavigateTool(server);
registerExtractTool(server);
registerObserveTool(server);
registerActTool(server);
registerGetUrlTool(server);

// index.ts
var import_fs = require("fs");
var import_path3 = __toESM(require("path"));
async function main() {
  const breadcrumbPaths = [
    "/tmp/stagehand-mcp-breadcrumb.txt",
    import_path3.default.join(import_path3.default.dirname(process.argv[1] || "."), "..", "breadcrumb.txt"),
    import_path3.default.join(process.cwd(), "breadcrumb.txt")
  ];
  const msg = `started at ${(/* @__PURE__ */ new Date()).toISOString()}, pid=${process.pid}, argv=${JSON.stringify(process.argv)}, cwd=${process.cwd()}
`;
  for (const p of breadcrumbPaths) {
    try {
      (0, import_fs.writeFileSync)(p, msg, { flag: "a" });
    } catch {
    }
  }
  const transport = new import_stdio.StdioServerTransport();
  await server.connect(transport);
  console.error("Stagehand MCP server running on stdio");
  console.error(`[stagehand] process.cwd() = ${process.cwd()}`);
}
main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
