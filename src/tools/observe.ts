import { z } from "zod";
import { getStagehand } from "../stagehand";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerObserveTool(server: McpServer) {
  server.registerTool(
    "observe",
    {
      description:
        "List available actions and interactive elements on the current page. " +
        "Optionally provide an instruction to filter or focus the observation. " +
        "A page must already be loaded (use the navigate tool first).",
      inputSchema: {
        instruction: z
          .string()
          .optional()
          .describe(
            "Optional natural language description to filter or focus observation " +
              '(e.g. "Find all login-related buttons")',
          ),
      },
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
              type: "text" as const,
              text: JSON.stringify(actions, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error observing page: ${String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
