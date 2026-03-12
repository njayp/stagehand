import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getStagehand } from "../stagehand";

export function registerGetUrlTool(server: McpServer) {
  server.registerTool(
    "get_url",
    {
      description:
        "Get the current URL of the active browser page. " +
        "A page must already be loaded (use the navigate tool first).",
      inputSchema: {},
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
              type: "text" as const,
              text: url,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error getting URL: ${String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
