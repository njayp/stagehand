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
var stagehand = null;
var initializationPromise = null;
async function getStagehand() {
  if (stagehand) {
    return stagehand;
  }
  if (initializationPromise) {
    return initializationPromise;
  }
  initializationPromise = (async () => {
    try {
      const instance = new import_stagehand.Stagehand({
        env: "LOCAL",
        localBrowserLaunchOptions: {
          headless: true
        },
        model: {
          modelName: "anthropic/claude-sonnet-4-5",
          apiKey: process.env.ANTHROPIC_API_KEY
        }
      });
      await instance.init();
      stagehand = instance;
      return instance;
    } catch (error) {
      initializationPromise = null;
      throw error;
    }
  })();
  return initializationPromise;
}

// src/utils/recorder.ts
var import_fluent_ffmpeg = __toESM(require("fluent-ffmpeg"));
var import_ffmpeg_static = __toESM(require("ffmpeg-static"));
var import_promises = __toESM(require("fs/promises"));
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
  async stop(outputPath) {
    try {
      await this.page.sendCDP("Page.stopScreencast");
    } catch (error) {
    }
    if (this.frameHandler && this.session) {
      this.session.off("Page.screencastFrame", this.frameHandler);
      this.frameHandler = null;
      this.session = null;
    }
    if (this.frames.length === 0) {
      throw new Error("No frames captured during recording");
    }
    await this.encodeToMp4(this.frames, outputPath);
  }
  async encodeToMp4(frames, outputPath) {
    const tempDir = import_path.default.join(
      import_os.default.tmpdir(),
      `stagehand-frames-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );
    await import_promises.default.mkdir(tempDir, { recursive: true });
    try {
      for (let i = 0; i < frames.length; i++) {
        const framePath = import_path.default.join(
          tempDir,
          `frame-${i.toString().padStart(5, "0")}.jpg`
        );
        const buffer = Buffer.from(frames[i].data, "base64");
        await import_promises.default.writeFile(framePath, buffer);
      }
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
        ]).output(outputPath).on("start", (cmdLine) => {
        }).on("stderr", (stderrLine) => {
        }).on("end", () => {
          resolve();
        }).on("error", (err, stdout, stderr) => {
          reject(new Error(`FFmpeg encoding failed: ${err.message}`));
        });
        command.run();
      });
    } finally {
      try {
        await import_promises.default.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
      }
    }
  }
};

// src/tools/navigate.ts
var import_promises2 = __toESM(require("fs/promises"));
var import_path2 = __toESM(require("path"));
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
        const logsDir = import_path2.default.join(process.cwd(), ".stagehand", "logs");
        await import_promises2.default.mkdir(logsDir, { recursive: true });
        const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
        const videoPath = import_path2.default.join(logsDir, `navigate-${timestamp}.mp4`);
        const recorder = new ScreenRecorder(page, sh);
        let recordingStarted = false;
        try {
          await recorder.start();
          recordingStarted = true;
        } catch (recorderError) {
        }
        try {
          await page.goto(url, { waitUntil: "domcontentloaded" });
          const title = await page.title();
          await new Promise((resolve) => setTimeout(resolve, 2e3));
          if (recordingStarted) {
            try {
              await recorder.stop(videoPath);
              return {
                content: [
                  {
                    type: "text",
                    text: `Successfully navigated to ${url}. Page title is "${title}". Recording saved to ${videoPath}`
                  }
                ]
              };
            } catch (stopError) {
              return {
                content: [
                  {
                    type: "text",
                    text: `Successfully navigated to ${url}. Page title is "${title}". Warning: Recording failed: ${String(stopError)}`
                  }
                ]
              };
            }
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully navigated to ${url}. Page title is "${title}". (Recording was disabled due to initialization error)`
                }
              ]
            };
          }
        } catch (navError) {
          if (recordingStarted) {
            await recorder.stop(videoPath).catch(() => {
            });
          }
          throw navError;
        }
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
        const result = await sh.act(instruction);
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
var server = new import_mcp.McpServer({
  name: "stagehand",
  version: "0.0.1"
});
registerNavigateTool(server);
registerExtractTool(server);
registerObserveTool(server);
registerActTool(server);
registerGetUrlTool(server);

// index.ts
async function main() {
  const transport = new import_stdio.StdioServerTransport();
  await server.connect(transport);
  console.error("Stagehand MCP server running on stdio");
}
main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
