# Stagehand MCP Server

A [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) agent that gives Claude browser automation capabilities using [Stagehand v3](https://github.com/browserbase/stagehand). It runs an MCP server that can navigate pages, click elements, extract data, and observe interactive elements.

## Setup

1. **Prerequisites**: [Node.js](https://nodejs.org/) (which includes `npx`).

2. **Install Playwright Chromium** (Stagehand uses Playwright to drive a local browser):
   ```bash
   npx playwright install chromium
   ```

3. **Set your API key** (required for `extract`, `observe`, and `act` tools):
   ```bash
   export ANTHROPIC_API_KEY=your-key-here
   ```

4. **Copy the agent file** from this repo into your project:
   ```bash
   mkdir -p .claude/agents
   cp path/to/stagehand/.claude/agents/browser-use.md .claude/agents/
   ```

Claude Code runs the MCP server automatically via `npx` — no additional install or build step needed.

## Usage

Once the agent file is in place, Claude Code detects it and makes a `browser-use` agent available. Claude will automatically launch it when browser automation is needed.

## Available Tools

| Tool | Description |
| --- | --- |
| `navigate` | Navigate to a URL. Returns page title and performance metrics. |
| `extract` | Extract structured data from the current page using natural language. |
| `observe` | List available actions and interactive elements on the current page. |
| `act` | Perform an action on the current page (click, type, etc.) using natural language. |
| `get_url` | Get the current page URL. |

## Using a Browser Profile

To browse sites that require authentication, create a profile with your session already logged in. The server automatically detects a `.browser-use/profile/` directory in its working directory at startup.

1. **Create a `.browser-use/profile/` directory** in the project root (or wherever you run the server from):
   ```bash
   mkdir -p .browser-use/profile
   ```
2. **Launch Chromium with that directory** (uses the Playwright-managed Chromium):
   ```bash
   npx playwright install chromium
   "$(ls ~/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/Google\ Chrome\ for\ Testing.app/Contents/MacOS/Google\ Chrome\ for\ Testing)" --user-data-dir=.browser-use/profile --use-mock-keychain
   ```
3. **Log in** to the site in the browser window that opens. Complete any auth flow, 2FA, etc.
4. **Close the browser.** Your cookies and session are now saved in `.browser-use/profile/`.

> **Important**: The `--use-mock-keychain` flag is required on macOS. Playwright's Chromium encrypts cookies using a mock keychain with a deterministic key. Without this flag, cookies are encrypted with the macOS system Keychain, and the server's browser won't be able to decrypt them.

At startup, the server copies `.browser-use/profile/` to a temp location and launches the browser with it, preserving your cookies and sessions. The original `.browser-use/profile/` directory is never modified.
