import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./src/server.js";

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Stagehand MCP server running on stdio");
  console.error(`[stagehand] process.cwd() = ${process.cwd()}`);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
