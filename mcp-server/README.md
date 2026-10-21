# Planit MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets an AI assistant
(Claude Desktop, Claude Code, Cursor, …) look at **your** Planit goals and help you plan.
It is a thin layer over the Planit REST API – it holds no data of its own.

## Tools

| Tool | Changes data? | What it does |
|---|---|---|
| `list_goals` | no | All goals with progress, status and suggested monthly deposit, plus a summary |
| `get_goal_projection` | no | Expected month-by-month path with cautious/optimistic bands |
| `simulate_what_if` | no | "What if I deposit X per month?" (optionally with another yearly return) |
| `log_contribution` | **yes** | Records a deposit/withdrawal on a goal, dated today |

## Setup

Requires Node 20+ and a running Planit API.

```bash
cd mcp-server
npm install
npm test
```

Add it to your MCP client (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "planit": {
      "command": "node",
      "args": ["/absolute/path/to/Planit/mcp-server/src/index.js"],
      "env": {
        "PLANIT_API_URL": "http://127.0.0.1:8000",
        "PLANIT_EMAIL": "you@example.com",
        "PLANIT_PASSWORD": "your-planit-password"
      }
    }
  }
}
```

Try it interactively with `npm run inspect`.

## Security notes

- The server signs in as the account you configure and can do anything that account can do through
  the tools above – nothing more. Use your own account only.
- Credentials live in your MCP client's config file on your machine; keep that file private.
- `log_contribution` is the only write. Assistants are told to call it only on an explicit request.
- Output is logged to stderr only; stdout carries the protocol.

> Version 2 replaced the earlier mock portfolio/tax tools (VOO comparison, US capital-gains
> simulation). They used made-up data and US tax rules; they remain in git history if you want them back.
