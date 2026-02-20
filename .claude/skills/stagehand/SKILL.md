---
name: stagehand
description: Start a Claude Code subagent with the Stagehand browser automation MCP server
user-invocable: true
argument-hint: "[prompt]"
---

Run the following bash command, passing the user's request as the prompt to a Claude Code subagent that has the Stagehand MCP server (browser automation) enabled:

```bash
claude -p --dangerously-skip-permissions --model sonnet --mcp-config ".claude/skills/stagehand/mcp.json" "$ARGUMENTS"
```

Print the subagent's output to the user.
