#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerCallTools } from "./tools/call.js";
import { createRetellClient } from "./client.js";

function createMcpServer() {
  const retellApiKey = process.env.RETELL_API_KEY;
  if (!retellApiKey) {
    throw new Error("RETELL_API_KEY environment variable is required");
  }

  const retellClient = createRetellClient(retellApiKey);

  const mcpServer = new McpServer({
    name: "Nexus AR Retell MCP",
    version: "1.0.0",
    capabilities: [],
  });

  registerCallTools(mcpServer, retellClient);

  return mcpServer;
}

async function main() {
  try {
    const mcpServer = createMcpServer();
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);

    process.on("SIGINT", async () => {
      try {
        await mcpServer.close();
        process.exit(0);
      } catch (err) {
        console.error("Error shutting down MCP server:", err);
        process.exit(1);
      }
    });
  } catch (err) {
    console.error("Error starting MCP server:", err);
    process.exit(1);
  }
}

main();