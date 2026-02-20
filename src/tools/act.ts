import { z } from "zod";
import { getStagehand } from "../stagehand";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerActTool(server: McpServer) {
  server.registerTool(
    "act",
    {
      description:
        "Perform an action on the current page using a natural language instruction. " +
        "Examples: click a button, fill in a form field, select a dropdown option. " +
        "A page must already be loaded (use the navigate tool first).",
      inputSchema: {
        instruction: z
          .string()
          .describe(
            "Natural language description of the action to perform " +
              '(e.g. "Click the Sign In button", "Type hello into the search box")',
          ),
      },
    },
    async ({ instruction }) => {
      try {
        const sh = await getStagehand();

        const result = await sh.act(instruction);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error performing action: ${String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
