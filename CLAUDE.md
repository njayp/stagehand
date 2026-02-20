UPDATE THIS FILE (CLAUDE.MD) AS NEEDED. KEEP THIS FILE SUCCINCT.

# Stagehand MCP Server

This application is a Model Context Protocol (MCP) Server that exposes local browser automation capabilities. It utilizes **Stagehand v3** (`@browserbasehq/stagehand`) under the hood to drive a local Chromium browser instance.

Docs: https://github.com/browserbase/stagehand

## Available Tools

The server implements the following MCP tools:

- **`navigate`**: Navigates the active browser page to a specified URL, records the navigation as video, and returns the page's `<title>` along with performance metrics.
  - **Inputs**: `url` (string, required) - The URL to navigate to (e.g. `https://google.com`).
  - **Outputs**: Navigation success message with page title, path to the recorded video, and performance metrics (wall clock duration, TTFB, DOM Interactive, DOM Content Loaded, Load Event End, Total Load Time, DOM Parsing Time).
  - **Recording**: Each navigation is automatically recorded using Chrome DevTools Protocol screencast and saved as an MP4 video in `.stagehand/logs/navigate-<timestamp>.mp4`.

- **`extract`**: Extracts data from the currently loaded page using natural language instructions.
  - **Inputs**:
    - `instruction` (string, required) - Natural language description of what to extract (e.g. "Extract the article title and author").
    - `schema` (object, optional) - A JSON object mapping field names to type strings for structured extraction. Supported types: `"string"`, `"number"`, `"boolean"`, `"string[]"`, `"number[]"`, `"boolean[]"`. Example: `{ "title": "string", "price": "number" }`.
  - **Outputs**: Extracted data as JSON text. Without a schema, returns `{ "extraction": "..." }`. With a schema, returns a JSON object matching the requested structure.
  - **Prerequisites**: A page must already be loaded using the `navigate` tool. Requires an LLM API key (e.g. `ANTHROPIC_API_KEY`) to be set in the environment.

- **`observe`**: Lists available actions and interactive elements on the current page.
  - **Inputs**: `instruction` (string, optional) - Natural language description to filter or focus the observation.
  - **Outputs**: JSON array of actions, each containing `selector`, `description`, and optionally `method` and `arguments`.
  - **Prerequisites**: A page must already be loaded using the `navigate` tool. Requires an LLM API key (e.g. `ANTHROPIC_API_KEY`) to be set in the environment.

- **`act`**: Performs an action on the current page using natural language.
  - **Inputs**: `instruction` (string, required) - Natural language description of the action to perform (e.g. "Click the Sign In button").
  - **Outputs**: JSON object with action result details.
  - **Prerequisites**: A page must already be loaded using the `navigate` tool. Requires an LLM API key (e.g. `ANTHROPIC_API_KEY`) to be set in the environment.

- **`get_url`**: Gets the current URL of the active browser page.
  - **Inputs**: None.
  - **Outputs**: The current page URL as a text string.
  - **Prerequisites**: A page must already be loaded using the `navigate` tool.

## Technical Stack

- **Server Protocol**: [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) - specifically utilizing the modern `McpServer` class.
- **Browser Automation**: `Stagehand` (v3).
- **Video Recording**: Chrome DevTools Protocol screencast with FFmpeg encoding.
- **Build Tooling**: `tsup`.
- **Validation**: `zod`.

## How to Test and Run

### Running Locally (CLI)

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Build the server**:
   ```bash
   npm run build
   ```
3. **Run the tests**:
   All tests use vitest. Run the full suite with:
   ```bash
   npm test
   ```
   This runs unit tests (`src/stagehand.test.ts`) and integration tests (`src/server.test.ts`) which connect to the built MCP server and exercise all tools.

## Video Recordings

All navigation actions are automatically recorded and saved as MP4 videos in the `.stagehand/logs/` directory. Each recording:

- Captures the entire page load and rendering process
- Uses Chrome DevTools Protocol's screencast feature to capture frames
- Encodes frames to H.264 MP4 format using FFmpeg
- Saves with timestamped filename: `navigate-<ISO8601-timestamp>.mp4`
- Can be played in any standard video player (VLC, QuickTime, browser, etc.)

**Note**: The `.stagehand/logs/` directory is automatically created on first use and is excluded from git via `.gitignore`.

### Connecting with an MCP Client (e.g., Claude Desktop, Cursor)

To test end-to-end inside of an AI environment, configure the client's connection settings to execute the built `dist/index.js` payload via Node.

Example configuration:

```json
{
  "mcpServers": {
    "stagehand": {
      "command": "node",
      "args": ["/absolute/path/to/stagehand/dist/index.js"],
      "env": {}
    }
  }
}
```
