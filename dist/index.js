#!/usr/bin/env node
"use strict";

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
  initializationPromise = initStagehand();
  return initializationPromise;
}
var initStagehand = async () => {
  const instance = new import_stagehand.Stagehand({
    env: "LOCAL",
    localBrowserLaunchOptions: {
      headless: true
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
var server = new import_mcp.McpServer(
  { name: "stagehand", version: "0.0.1" },
  { capabilities: { logging: {} } }
);
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
  console.error(`[stagehand] process.cwd() = ${process.cwd()}`);
}
main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
