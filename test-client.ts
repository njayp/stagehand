import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import fs from "fs/promises";

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

  // Verify video recording was created
  if (result.content && Array.isArray(result.content) && result.content.length > 0) {
    const firstContent = result.content[0];
    if (firstContent && typeof firstContent === "object" && "type" in firstContent && "text" in firstContent) {
      const responseText = firstContent.text as string;
      const match = responseText.match(/Recording saved to (.+\.mp4)/);

      if (match) {
        const videoPath = match[1];
        console.log("\nVerifying video recording...");
        console.log("Video path:", videoPath);

        try {
          const stat = await fs.stat(videoPath);
          console.log("✓ Video file exists");
          console.log("✓ File size:", (stat.size / 1024).toFixed(2), "KB");

          if (stat.size > 0) {
            console.log("✓ Video recording verification passed!");
          } else {
            console.error("✗ Video file is empty");
            process.exit(1);
          }
        } catch (error) {
          console.error("✗ Failed to verify video file:", error);
          process.exit(1);
        }
      } else {
        console.warn("⚠ Response did not include recording path");
      }
    }
  }

  // Test extract tool - instruction only
  console.log("\nCalling extract tool (instruction only)...");
  const extractResult = await client.callTool({
    name: "extract",
    arguments: {
      instruction:
        "Extract the main heading text and the paragraph text from this page",
    },
  });
  console.log(
    "Extract Result (instruction):",
    JSON.stringify(extractResult, null, 2),
  );

  // Test extract tool - with schema
  console.log("\nCalling extract tool (with schema)...");
  const extractSchemaResult = await client.callTool({
    name: "extract",
    arguments: {
      instruction: "Extract the main heading and description from this page",
      schema: {
        heading: "string",
        description: "string",
      },
    },
  });
  console.log(
    "Extract Result (schema):",
    JSON.stringify(extractSchemaResult, null, 2),
  );

  // Test observe tool - without instruction
  console.log("\nCalling observe tool (no instruction)...");
  const observeResult = await client.callTool({
    name: "observe",
    arguments: {},
  });
  console.log(
    "Observe Result (no instruction):",
    JSON.stringify(observeResult, null, 2),
  );

  // Test observe tool - with instruction
  console.log("\nCalling observe tool (with instruction)...");
  const observeFilteredResult = await client.callTool({
    name: "observe",
    arguments: {
      instruction: "Find all links on the page",
    },
  });
  console.log(
    "Observe Result (with instruction):",
    JSON.stringify(observeFilteredResult, null, 2),
  );

  // Test act tool
  console.log("\nCalling act tool...");
  const actResult = await client.callTool({
    name: "act",
    arguments: {
      instruction: "Click the 'More information...' link",
    },
  });
  console.log("Act Result:", JSON.stringify(actResult, null, 2));

  // Test get_url tool - should show the URL after the act navigation
  console.log("\nCalling get_url tool...");
  const getUrlResult = await client.callTool({
    name: "get_url",
    arguments: {},
  });
  console.log("Get URL Result:", JSON.stringify(getUrlResult, null, 2));

  process.exit(0);
}

main().catch((error) => {
  console.error("Client Error:", error);
  process.exit(1);
});
