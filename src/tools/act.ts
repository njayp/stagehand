import { z } from "zod";
import { getStagehand } from "../stagehand.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRecording } from "../utils/withRecording.js";

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
        const page = sh.context.activePage();
        if (!page) {
          throw new Error("No active page found in Stagehand context");
        }

        const { result, recordingPath } = await withRecording(
          "act",
          page,
          sh,
          async () => sh.act(instruction),
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ ...result, recordingPath }, null, 2),
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
