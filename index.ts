import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./src/server.js";
import { writeFileSync } from "fs";
import path from "path";

async function main() {
  // Breadcrumb: prove this code is actually running
  const breadcrumbPaths = [
    "/tmp/stagehand-mcp-breadcrumb.txt",
    path.join(path.dirname(process.argv[1] || "."), "..", "breadcrumb.txt"),
    path.join(process.cwd(), "breadcrumb.txt"),
  ];
  const msg = `started at ${new Date().toISOString()}, pid=${process.pid}, argv=${JSON.stringify(process.argv)}, cwd=${process.cwd()}\n`;
  for (const p of breadcrumbPaths) {
    try { writeFileSync(p, msg, { flag: "a" }); } catch {}
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Stagehand MCP server running on stdio");
  console.error(`[stagehand] process.cwd() = ${process.cwd()}`);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
