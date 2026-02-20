import { z } from "zod";
import { getStagehand } from "../stagehand";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerNavigateTool(server: McpServer) {
  server.registerTool(
    "navigate",
    {
      description: "Navigate the browser to a specified URL",
      inputSchema: {
        url: z
          .string()
          .describe("The URL to navigate to (e.g. https://google.com)"),
      },
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
              text: `Successfully navigated to ${url}. Page title is "${title}".`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error navigating to ${url}: ${String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
