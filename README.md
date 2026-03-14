# Stagehand MCP Server

This package provides a Model Context Protocol (MCP) server for [Stagehand v3](https://github.com/browserbasehq/stagehand), enabling AI agents to control a browser and interact with web pages.

## Features

- **Browser Automation**: Navigate to URLs, click elements, fill forms, and more.
- **Information Extraction**: Extract text, links, and structured data from pages.
- **Context-Aware Tools**: Tools that understand the current page state.
- **Persistent Browser Profiles**: Optionally launch the browser with a pre-configured profile (e.g. logged-in session) via the `BROWSER_PROFILE_DIR` environment variable.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | API key for Claude (used by `extract`, `observe`, and `act` tools) |
| `BROWSER_PROFILE_DIR` | No | Path to a Chromium user data directory. When set, the server copies this directory to a temp location at startup and launches the browser with it, preserving cookies, sessions, and other browser state. The original directory is never modified. |
