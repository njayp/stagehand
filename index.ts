import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./src/server.js";
import { writeFileSync } from "fs";

async function main() {
  try { writeFileSync("/tmp/stagehand-mcp-started.txt", `started ${new Date().toISOString()} pid=${process.pid}\n`, { flag: "a" }); } catch {}
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Stagehand MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
