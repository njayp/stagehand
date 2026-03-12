import { z } from "zod";
import { getStagehand } from "../stagehand.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logVideoSaved } from "../utils/log.js";
import { ScreenRecorder } from "../utils/recorder.js";
import fs from "fs/promises";
import path from "path";
import { getLogsDir } from "../utils/paths.js";

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

        const logsDir = getLogsDir();
        console.error(`[act] logsDir resolved to: ${logsDir}`);
        await fs.mkdir(logsDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const videoPath = path.join(logsDir, `${timestamp}-act.mp4`);

        const recorder = new ScreenRecorder(page, sh);
        let recordingStarted = false;

        try {
          await recorder.start();
          recordingStarted = true;
        } catch (recorderError) {
          console.error(`[act] recorder.start() failed:`, recorderError);
        }

        try {
          const result = await sh.act(instruction);
          await new Promise((resolve) => setTimeout(resolve, 2000));

          let extraInfo = "";
          if (recordingStarted) {
            try {
              await recorder.stop(videoPath);
              extraInfo = `\nRecording saved to ${videoPath}`;
              logVideoSaved(server, "act", videoPath);
            } catch (stopError) {
              extraInfo = `\nWarning: Recording failed: ${String(stopError)}`;
            }
          }

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2) + extraInfo,
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
              text: `Error performing action: ${String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
