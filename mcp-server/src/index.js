// Planit MCP server – exposes a user's Planit goals to AI assistants over stdio.
//
// Required environment:
//   PLANIT_API_URL   e.g. http://127.0.0.1:8000
//   PLANIT_EMAIL / PLANIT_PASSWORD   the Planit account to act as
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { PlanitClient } from "./planitClient.js";
import { registerTools } from "./tools.js";

const client = new PlanitClient({
  baseUrl: process.env.PLANIT_API_URL ?? "http://127.0.0.1:8000",
  email: process.env.PLANIT_EMAIL,
  password: process.env.PLANIT_PASSWORD,
});

const server = new McpServer({ name: "planit", version: "2.0.0" });
registerTools(server, client);

await server.connect(new StdioServerTransport());
// stdout carries the protocol; diagnostics go to stderr only.
process.stderr.write("[planit-mcp] ready – tools: list_goals, get_goal_projection, simulate_what_if, log_contribution\n");
