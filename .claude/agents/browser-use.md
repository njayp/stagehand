---
name: browser-use
description: Launch a browser automation subagent that can navigate pages, click elements, extract data, and observe interactive elements
model: sonnet
mcpServers:
  - stagehand:
      type: stdio
      command: bash
      args: ["-lc", "npx -y github:njayp/stagehand"]
tools:
  - mcp__stagehand__*
---

Use the browser-use MCP server to navigate pages, click elements, extract data, and observe interactive elements.

Latency metrics are available after every navigation.
