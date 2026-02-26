#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerCallTools } from "./tools/call.js";
import { registerEmailTools } from "./tools/email.js";
import { registerCallOutcomeTools } from "./tools/callOutcomes.js";
import { createRetellClient } from "./client.js";

import { fileURLToPath } from "url";
import path from "path";

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
  registerEmailTools(mcpServer);
  registerCallOutcomeTools(mcpServer);

  return mcpServer;
}

export async function main() {
  const mcpServer = createMcpServer();
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  process.on("SIGINT", async () => {
    try {
      await mcpServer.close();
    } catch (err) {
      console.error("Error shutting down MCP server:", err);
    }
  });
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("Error starting MCP server:", err);
      process.exit(1);
    });
}
