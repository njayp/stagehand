import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerNavigateTool } from "./tools/navigate.js";

export const server = new McpServer({
  name: "stagehand-server",
  version: "1.0.0",
});

registerNavigateTool(server);
