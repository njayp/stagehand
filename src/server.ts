import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerNavigateTool } from "./tools/navigate.js";
import { registerExtractTool } from "./tools/extract.js";
import { registerObserveTool } from "./tools/observe.js";
import { registerActTool } from "./tools/act.js";
import { registerGetUrlTool } from "./tools/get_url.js";

export const server = new McpServer({
  name: "stagehand",
  version: "0.0.1",
});

registerNavigateTool(server);
registerExtractTool(server);
registerObserveTool(server);
registerActTool(server);
registerGetUrlTool(server);
