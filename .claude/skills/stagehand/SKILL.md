---
name: stagehand
description: Launch a browser automation subagent that can navigate pages, click elements, extract data, and observe interactive elements
user-invocable: true
argument-hint: "[prompt]"
---

Run the following bash command to launch a Claude Code subagent with the Stagehand MCP server (browser automation). Pass a prompt describing what the subagent should do in the browser:

```bash
claude -p --dangerously-skip-permissions --model sonnet --mcp-config ".claude/skills/stagehand/mcp.json" -- "$ARGUMENTS"
```
