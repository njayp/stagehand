import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerNavigateTool } from "./tools/navigate.js";

export const server = new McpServer({
  name: "stagehand",
  version: "0.0.1",
});

registerNavigateTool(server);
