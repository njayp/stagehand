---
name: browser-use
description: Launch a browser automation subagent that can navigate pages, click elements, extract data, and observe interactive elements
model: sonnet
mcpServers:
  browser-use:
    command: "npx"
    args: ["-y", "github:njayp/stagehand"]
tools:
  - mcp__browser-use__*
---

Use the browser-use MCP server to navigate pages, click elements, extract data, and observe interactive elements.

Latency metrics are available after every navigation.
