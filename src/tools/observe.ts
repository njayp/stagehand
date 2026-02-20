import { z } from "zod";
import { getStagehand } from "../stagehand";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ScreenRecorder } from "../utils/recorder.js";
import fs from "fs/promises";
import path from "path";

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
        const page = sh.context.activePage();
        if (!page) {
          throw new Error("No active page found in Stagehand context");
        }

        const logsDir = path.join(process.cwd(), ".stagehand", "logs");
        await fs.mkdir(logsDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const videoPath = path.join(logsDir, `${timestamp}-observe.mp4`);

        const recorder = new ScreenRecorder(page, sh);
        let recordingStarted = false;

        try {
          await recorder.start();
          recordingStarted = true;
        } catch (recorderError) {}

        try {
          let actions;
          if (instruction) {
            actions = await sh.observe(instruction);
          } else {
            actions = await sh.observe();
          }

          await new Promise((resolve) => setTimeout(resolve, 2000));

          let extraInfo = "";
          if (recordingStarted) {
            try {
              await recorder.stop(videoPath);
              extraInfo = `\nRecording saved to ${videoPath}`;
            } catch (stopError) {
              extraInfo = `\nWarning: Recording failed: ${String(stopError)}`;
            }
          }

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(actions, null, 2) + extraInfo,
              },
            ],
          };
        } catch (actionError) {
          if (recordingStarted) {
            await recorder.stop(videoPath).catch(() => {});
          }
          throw actionError;
        }
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
