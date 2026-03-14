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
      const profileDir = process.env.BROWSER_PROFILE_DIR;
      let userDataDir;
      if (profileDir) {
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
        const navStart = Date.now();
        await page.goto(url, { waitUntil: "domcontentloaded" });
        const wallClockMs = Date.now() - navStart;
        const title = await page.title();
        const metrics = await collectPerformanceMetrics(page, wallClockMs);
        const metricsText = metrics ? formatMetrics(metrics) : "";
        return {
          content: [
            {
              type: "text",
              text: `Successfully navigated to ${url}. Page title is "${title}".${metricsText}`
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
      console.error(`[stagehand] process.cwd() = ${process.cwd()}`);
    }
    main().catch((error) => {
      console.error("Server error:", error);
      process.exit(1);
    });
  }
});
export default require_index();
