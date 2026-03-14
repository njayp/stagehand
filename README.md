# Stagehand MCP Server

This package provides a Model Context Protocol (MCP) server for [Stagehand v3](https://github.com/browserbasehq/stagehand), enabling AI agents to control a browser and interact with web pages.

## Features

- **Browser Automation**: Navigate to URLs, click elements, fill forms, and more.
- **Information Extraction**: Extract text, links, and structured data from pages.
- **Context-Aware Tools**: Tools that understand the current page state.
- **Persistent Browser Profiles**: Optionally launch the browser with a pre-configured profile (e.g. logged-in session) via the `BROWSER_PROFILE_DIR` environment variable.

## Prerequisites

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Install Chromium for Playwright** (required — Stagehand uses Playwright to drive a local browser):
   ```bash
   npx playwright install chromium
   ```
3. **Build the server**:
   ```bash
   npm run build
   ```

## Environment Variables

| Variable              | Required | Description                                                                                                                                                                                                                                         |
| --------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`   | Yes      | API key for Claude (used by `extract`, `observe`, and `act` tools)                                                                                                                                                                                  |
| `BROWSER_PROFILE_DIR` | No       | Path to a Chromium user data directory. When set, the server copies this directory to a temp location at startup and launches the browser with it, preserving cookies, sessions, and other browser state. The original directory is never modified. |

## Using a Browser Profile

To browse sites that require authentication, create a profile with your session already logged in. This uses the Playwright-managed Chromium installed during the [Prerequisites](#prerequisites) step.

1. **Set `BROWSER_PROFILE_DIR`** to where you want to store the profile:
   ```bash
   export BROWSER_PROFILE_DIR=$PWD/my-profile
   ```
2. **Launch Chromium with that directory**:
   ```bash
   "$(ls ~/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/Google\ Chrome\ for\ Testing.app/Contents/MacOS/Google\ Chrome\ for\ Testing)" --user-data-dir=$BROWSER_PROFILE_DIR
   ```
3. **Log in** to the site in the browser window that opens. Complete any auth flow, 2FA, etc.
4. **Close the browser.** Your cookies and session are now saved in `$BROWSER_PROFILE_DIR`.

Then pass it to the MCP server:

```json
{
  "mcpServers": {
    "stagehand": {
      "command": "node",
      "args": ["/path/to/stagehand/dist/index.js"],
      "env": {
        "BROWSER_PROFILE_DIR": "/path/to/my-profile"
      }
    }
  }
}
```

The server copies the profile at startup so the original stays clean and reusable.
