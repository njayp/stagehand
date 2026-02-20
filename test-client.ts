import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

async function main() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve(__dirname, "dist/index.js")],
  });

  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} },
  );

  await client.connect(transport);
  console.log("Connected to server, calling navigate tool...");

  const result = await client.callTool({
    name: "navigate",
    arguments: { url: "https://example.com" },
  });
  console.log("Navigation Result:", JSON.stringify(result, null, 2));

  process.exit(0);
}

main().catch((error) => {
  console.error("Client Error:", error);
  process.exit(1);
});
