import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function logVideoSaved(
  server: McpServer,
  toolName: string,
  videoPath: string,
) {
  server.server.sendLoggingMessage({
    level: "info",
    data: `[${toolName}] Completed. Video saved to: ${videoPath}`,
  });
}
