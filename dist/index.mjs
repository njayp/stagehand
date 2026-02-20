var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/stagehand.ts
import { Stagehand } from "@browserbasehq/stagehand";
async function getStagehand() {
  if (!stagehand) {
    stagehand = new Stagehand({
      env: "LOCAL"
    });
    await stagehand.init();
  }
  return stagehand;
}
var stagehand;
var init_stagehand = __esm({
  "src/stagehand.ts"() {
    "use strict";
    stagehand = null;
  }
});

// src/tools/navigate.ts
import { z } from "zod";
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
        await page.goto(url, { waitUntil: "domcontentloaded" });
        const title = await page.title();
        return {
          content: [
            {
              type: "text",
              text: `Successfully navigated to ${url}. Page title is "${title}".`
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

// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
var server;
var init_server = __esm({
  "src/server.ts"() {
    "use strict";
    init_navigate();
    server = new McpServer({
      name: "stagehand-server",
      version: "1.0.0"
    });
    registerNavigateTool(server);
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
