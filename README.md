# Stagehand MCP Server

This package provides a Model Context Protocol (MCP) server for [Stagehand v3](https://github.com/browserbasehq/stagehand), enabling AI agents to control a browser and interact with web pages.

## Features

- **Browser Automation**: Navigate to URLs, click elements, fill forms, and more.
- **Information Extraction**: Extract text, links, and structured data from pages.
- **Context-Aware Tools**: Tools that understand the current page state.
- **Persistent Browser Profiles**: Optionally launch the browser with a pre-configured profile (e.g. logged-in session) by placing a `.browser-use/profile/` directory in the project root.

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

| Variable            | Required | Description                                                        |
| ------------------- | -------- | ------------------------------------------------------------------ |
| `ANTHROPIC_API_KEY` | Yes      | API key for Claude (used by `extract`, `observe`, and `act` tools) |

## Using a Browser Profile

To browse sites that require authentication, create a profile with your session already logged in. The server automatically detects a `.browser-use/profile/` directory in its working directory at startup.

1. **Create a `.browser-use/profile/` directory** in the project root (or wherever you run the server from):
   ```bash
   mkdir -p .browser-use/profile
   ```
2. **Launch Chromium with that directory** (uses the Playwright-managed Chromium installed during [Prerequisites](#prerequisites)):
   ```bash
   "$(ls ~/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/Google\ Chrome\ for\ Testing.app/Contents/MacOS/Google\ Chrome\ for\ Testing)" --user-data-dir=.browser-use/profile
   ```
3. **Log in** to the site in the browser window that opens. Complete any auth flow, 2FA, etc.
4. **Close the browser.** Your cookies and session are now saved in `.browser-use/profile/`.

At startup, the server copies `.browser-use/profile/` to a temp location and launches the browser with it, preserving your cookies and sessions. The original `.browser-use/profile/` directory is never modified.
