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
async function getStagehand() {
  if (stagehand) {
    return stagehand;
  }
  if (initializationPromise) {
    return initializationPromise;
  }
  initializationPromise = (async () => {
    try {
      const instance = new Stagehand({
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
var stagehand, initializationPromise;
var init_stagehand = __esm({
  "src/stagehand.ts"() {
    "use strict";
    stagehand = null;
    initializationPromise = null;
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
        const tempDir = path.join(
          os.tmpdir(),
          `stagehand-frames-${Date.now()}-${Math.random().toString(36).substring(7)}`
        );
        await fs.mkdir(tempDir, { recursive: true });
        try {
          for (let i = 0; i < frames.length; i++) {
            const framePath = path.join(
              tempDir,
              `frame-${i.toString().padStart(5, "0")}.jpg`
            );
            const buffer = Buffer.from(frames[i].data, "base64");
            await fs.writeFile(framePath, buffer);
          }
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
            await fs.rm(tempDir, { recursive: true, force: true });
          } catch (cleanupError) {
          }
        }
      }
    };
  }
});

// src/tools/navigate.ts
import { z } from "zod";
import fs2 from "fs/promises";
import path2 from "path";
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
        const logsDir = path2.join(process.cwd(), ".stagehand", "logs");
        await fs2.mkdir(logsDir, { recursive: true });
        const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
        const videoPath = path2.join(logsDir, `navigate-${timestamp}.mp4`);
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
var init_navigate = __esm({
  "src/tools/navigate.ts"() {
    "use strict";
    init_stagehand();
    init_recorder();
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
var init_act = __esm({
  "src/tools/act.ts"() {
    "use strict";
    init_stagehand();
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
    server = new McpServer({
      name: "stagehand",
      version: "0.0.1"
    });
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
