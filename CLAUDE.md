UPDATE THIS FILE AS NEEDED

# Stagehand MCP Server

This application is a Model Context Protocol (MCP) Server that exposes local browser automation capabilities. It utilizes **Stagehand v3** (`@browserbasehq/stagehand`) under the hood to drive a local Chromium browser instance.

## Available Tools

The server currently implements a single MCP tool:

- **`navigate`**: Navigates the active browser page to a specified URL and returns the page's `<title>`.
  - **Inputs**: `url` (string, required) - The URL to navigate to (e.g. `https://google.com`).

## Technical Stack

- **Server Protocol**: [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) - specifically utilizing the modern `McpServer` class.
- **Browser Automation**: `Stagehand` (v3).
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
3. **Run the testing script**:
   We have included an integrated programmatic test suite file `test-client.ts`. It will connect to the built MCP server using `StdioClientTransport`, issue a `tools/list` request, and subsequently invoke the `navigate` tool for `https://example.com`.
   ```bash
   npx tsx test-client.ts
   ```
   If successful, you will see output like:
   ```json
   Navigation Result: {
     "content": [
       {
         "type": "text",
         "text": "Successfully navigated to https://example.com. Page title is \"Example Domain\"."
       }
     ]
   }
   ```

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

### Reference Docs

- Stagehand -- https://github.com/browserbase/stagehand
