import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getStagehand } from "../stagehand";
import { ScreenRecorder } from "../utils/recorder.js";
import fs from "fs/promises";
import path from "path";

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

        const logsDir = path.join(process.cwd(), ".stagehand", "logs");
        await fs.mkdir(logsDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const videoPath = path.join(logsDir, `${timestamp}-get_url.mp4`);

        const recorder = new ScreenRecorder(page, sh);
        let recordingStarted = false;

        try {
          await recorder.start();
          recordingStarted = true;
        } catch (recorderError) {}

        try {
          const url = page.url();

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
                text: url + extraInfo,
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
              text: `Error getting URL: ${String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
