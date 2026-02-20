"use strict";

// index.ts
var import_stdio = require("@modelcontextprotocol/sdk/server/stdio.js");

// src/server.ts
var import_mcp = require("@modelcontextprotocol/sdk/server/mcp.js");

// src/tools/navigate.ts
var import_zod = require("zod");

// src/stagehand.ts
var import_stagehand = require("@browserbasehq/stagehand");
var stagehand = null;
async function getStagehand() {
  if (!stagehand) {
    stagehand = new import_stagehand.Stagehand({
      env: "LOCAL"
    });
    await stagehand.init();
  }
  return stagehand;
}

// src/tools/navigate.ts
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

// src/server.ts
var server = new import_mcp.McpServer({
  name: "stagehand-server",
  version: "1.0.0"
});
registerNavigateTool(server);

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
