---
name: browser-use
description: Launch a browser automation subagent that can navigate pages, click elements, extract data, and observe interactive elements
model: sonnet
mcpServers:
  stagehand:
    command: "node"
    args: ["/Users/nickpowell/repos/stagehand/dist/index.js"]
    cwd: "/Users/nickpowell/repos/stagehand"
    env:
      ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"
tools:
  - mcp__stagehand__*
---

Use the stagehand MCP server to navigate pages, click elements, extract data, and observe interactive elements.

Latency metrics are available after every navigation. Videos of actions will automatically be saved--always inform the user of their location.
