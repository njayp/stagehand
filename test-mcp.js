const { spawn } = require('child_process');

const server = spawn('node', ['dist/index.js']);

server.stdout.on('data', (data) => {
  console.log(`STDOUT: ${data}`);
});

server.stderr.on('data', (data) => {
  console.log(`STDERR: ${data}`);
});

const initReq = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" }
  }
};
server.stdin.write(JSON.stringify(initReq) + '\n');

setTimeout(() => {
  const toolsReq = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  };
  server.stdin.write(JSON.stringify(toolsReq) + '\n');
}, 500);

setTimeout(() => {
  server.kill();
}, 1500);
