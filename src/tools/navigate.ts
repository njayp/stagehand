import { z } from "zod";
import { getStagehand } from "../stagehand";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ScreenRecorder } from "../utils/recorder.js";
import fs from "fs/promises";
import path from "path";

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

        // Prepare recording directory
        const logsDir = path.join(process.cwd(), ".stagehand", "logs");
        await fs.mkdir(logsDir, { recursive: true });

        // Generate timestamped filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const videoPath = path.join(logsDir, `navigate-${timestamp}.mp4`);

        // Start recording
        const recorder = new ScreenRecorder(page, sh);
        let recordingStarted = false;

        try {
          await recorder.start();
          recordingStarted = true;
        } catch (recorderError) {
          // Continue navigation even if recording fails
        }

        try {
          // Navigate to URL
          await page.goto(url, { waitUntil: "domcontentloaded" });
          const title = await page.title();

          // Wait a moment to ensure frames are captured (screencast is async)
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Stop and save recording
          if (recordingStarted) {
            try {
              await recorder.stop(videoPath);
              return {
                content: [
                  {
                    type: "text",
                    text: `Successfully navigated to ${url}. Page title is "${title}". Recording saved to ${videoPath}`,
                  },
                ],
              };
            } catch (stopError) {
              return {
                content: [
                  {
                    type: "text",
                    text: `Successfully navigated to ${url}. Page title is "${title}". Warning: Recording failed: ${String(stopError)}`,
                  },
                ],
              };
            }
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully navigated to ${url}. Page title is "${title}". (Recording was disabled due to initialization error)`,
                },
              ],
            };
          }
        } catch (navError) {
          // Attempt to save partial recording if recording was started
          if (recordingStarted) {
            await recorder.stop(videoPath).catch(() => {
              // Ignore errors when trying to save partial recording
            });
          }
          throw navError;
        }
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
