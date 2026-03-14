UPDATE THIS FILE (CLAUDE.MD) AND README.md AS NEEDED

# Stagehand MCP Server

This application is a Model Context Protocol (MCP) Server that exposes local browser automation capabilities. It utilizes **Stagehand v3** (`@browserbasehq/stagehand`) under the hood to drive a local Chromium browser instance.

Docs: https://github.com/browserbase/stagehand

## Available Tools

The server implements the following MCP tools:

- **`navigate`**: Navigates the active browser page to a specified URL and returns the page's `<title>` along with performance metrics.
  - **Inputs**: `url` (string, required) - The URL to navigate to (e.g. `https://google.com`).
  - **Outputs**: Navigation success message with page title and performance metrics (wall clock duration, TTFB, DOM Interactive, DOM Content Loaded, Load Event End, Total Load Time, DOM Parsing Time).

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
- **Build Tooling**: `tsup`.
- **Validation**: `zod`.

## Environment Variables

- `ANTHROPIC_API_KEY` (required): API key for Claude, used by `extract`, `observe`, and `act` tools.

## Browser Profile

The server automatically detects a `.browser-use/profile/` directory in its working directory (`process.cwd()`) at startup. If found, it copies the directory to a temp location and launches the browser with it, preserving cookies, sessions, and other browser state. The original `.browser-use/profile/` directory is never modified.

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

### Connecting with an MCP Client (e.g., Claude Desktop, Cursor)

To test end-to-end inside of an AI environment, configure the client's connection settings to execute the built `dist/index.js` payload via Node.

Example configuration:

```json
{
  "mcpServers": {
    "stagehand": {
      "command": "node",
      "args": ["/absolute/path/to/stagehand/dist/index.js"]
    }
  }
}
```
