import { z } from "zod";
import { getStagehand } from "../stagehand";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logVideoSaved } from "../utils/log.js";
import { ScreenRecorder } from "../utils/recorder.js";
import fs from "fs/promises";
import path from "path";
import { getLogsDir } from "../utils/paths.js";

function jsonSchemaToZod(schema: Record<string, string>): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, typeStr] of Object.entries(schema)) {
    switch (typeStr) {
      case "string":
        shape[key] = z.string();
        break;
      case "number":
        shape[key] = z.number();
        break;
      case "boolean":
        shape[key] = z.boolean();
        break;
      case "string[]":
        shape[key] = z.array(z.string());
        break;
      case "number[]":
        shape[key] = z.array(z.number());
        break;
      case "boolean[]":
        shape[key] = z.array(z.boolean());
        break;
      default:
        shape[key] = z.string();
        break;
    }
  }

  return z.object(shape);
}

export function registerExtractTool(server: McpServer) {
  server.registerTool(
    "extract",
    {
      description:
        "Extract data from the current page using a natural language instruction. " +
        "Optionally provide a schema to get structured JSON output. " +
        "A page must already be loaded (use the navigate tool first).",
      inputSchema: {
        instruction: z
          .string()
          .describe(
            "Natural language description of what data to extract from the page " +
              '(e.g. "Extract the article title and author name")',
          ),
        schema: z
          .record(z.string(), z.string())
          .optional()
          .describe(
            "Optional: a JSON object mapping field names to types for structured extraction. " +
              'Supported types: "string", "number", "boolean", "string[]", "number[]", "boolean[]". ' +
              'Example: { "title": "string", "price": "number" }',
          ),
      },
    },
    async ({ instruction, schema }) => {
      try {
        const sh = await getStagehand();
        const page = sh.context.activePage();
        if (!page) {
          throw new Error("No active page found in Stagehand context");
        }

        const logsDir = getLogsDir();
        await fs.mkdir(logsDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const videoPath = path.join(logsDir, `${timestamp}-extract.mp4`);

        const recorder = new ScreenRecorder(page, sh);
        let recordingStarted = false;

        try {
          await recorder.start();
          recordingStarted = true;
        } catch (recorderError) {}

        try {
          let result: unknown;

          if (schema && Object.keys(schema).length > 0) {
            const zodSchema = jsonSchemaToZod(schema);
            result = await sh.extract(instruction, zodSchema);
          } else {
            result = await sh.extract(instruction);
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));

          let extraInfo = "";
          if (recordingStarted) {
            try {
              await recorder.stop(videoPath);
              extraInfo = `\nRecording saved to ${videoPath}`;
              logVideoSaved(server, "extract", videoPath);
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
              text: `Error extracting data: ${String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
